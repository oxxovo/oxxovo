// Vercel Cron entrypoint — weekly season lifecycle automation.
//
// Two responsibilities, both idempotent so the tick is safe to run as often as
// we like (and to re-run after a missed tick):
//
//   1. CREATE-AHEAD — once the latest season has opened, ensure the *next*
//      season exists as a 'draft', scheduled exactly one week later. Created
//      ahead of time so an admin has a lead week to set a real codename and the
//      main-round theme before it auto-activates. Identity is deterministic
//      (id = season_<n>), so a duplicate insert is rejected by the primary key
//      rather than creating a second season.
//
//   2. STATUS TRANSITIONS — advance every season through draft → active →
//      closed → completed based on its own timestamps. Forward-only and written
//      as a compare-and-swap, so concurrent ticks and manual admin edits are
//      never clobbered.
//
// There is no per-season branching anywhere here — every difference between
// seasons comes from the cloned seasons-table row (see [[feedback-no-hardcode]]).
//
// Vercel Cron schedules run in UTC and cannot be pinned to a timezone, so this
// runs hourly and lets the (DST-correct) timestamps decide what fires. See
// [[project-weekly-season-system]].
//
// Authentication: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`.
// Manual invocation must use the same header.

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { buildNextSeasonRow } from '@/lib/season-schedule'
import { releasePrelimHoldCore } from '@/lib/watch-hold'
import { sweepAsyncSubmissions, type AsyncSweepReport } from '@/lib/studio'
import { sendAdminAlert } from '@/lib/email/admin-alert'
import {
  reportPricingHealth,
  pricingAlertHtml,
  summarizeProblems,
  type PricingHealthReport,
} from '@/lib/pricing-health'
import type { Season } from '@/lib/seasons'

// Run at request time — a prerendered 'now' would silently ignore time-based
// triggers.
export const dynamic = 'force-dynamic'

// Forward-only lifecycle order. 'upcoming' sits between draft and active: it is
// an announced teaser (shown on the lobby as "COMING SOON", no applications) that
// must NOT be regressed to draft by the tick, and is auto-promoted to 'active'
// once its application_open_at arrives. A teaser with no open date set stays
// 'upcoming' forever (desiredStatus returns 'draft' for it, which is <= upcoming,
// so the forward-only guard leaves it untouched).
const STATUS_RANK: Record<string, number> = {
  draft: 0,
  upcoming: 1,
  active: 2,
  closed: 3,
  completed: 4,
}

// The status a season *should* be in given the wall-clock and its own schedule.
// Evaluated newest-phase-first so a season whose cron was down for a while jumps
// straight to the correct state instead of crawling one step per tick.
function desiredStatus(s: Season, now: number): string {
  const at = (v: string | null) => (v ? new Date(v).getTime() : null)
  const open = at(s.application_open_at)
  const close = at(s.application_close_at)
  const awards = at(s.awards_announcement_at)
  if (awards !== null && now >= awards) return 'completed'
  if (close !== null && now >= close) return 'closed'
  if (open !== null && now >= open) return 'active'
  return 'draft'
}

type SeasonTickReport = {
  ok: true
  ranAt: string
  created: { id: string; season_number: number; application_open_at: string | null } | null
  transitions: { id: string; from: string; to: string }[]
  deferrals: { id: string; newClose: string | null; deferCount: number }[]
  prelimReleases: { id: string; released: number }[]
  advancements: { id: string; advanced: number; rejected: number; nTarget: number }[]
  skippedCreation?: string
  errors: string[]
  asyncSweep?: AsyncSweepReport
  // Always present, alert or not: the tick's JSON is the one place ops can read
  // the CURRENT pricing state on demand, rather than waiting for the mail that
  // only fires on a change.
  pricing?: { signature: string; alerted: boolean; problems: string[] }
}

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET not configured on the server.' },
      { status: 500 },
    )
  }
  const authHeader = request.headers.get('authorization') ?? ''
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseAdmin()
  const now = new Date()
  const nowMs = now.getTime()
  const errors: string[] = []

  const { data: seasonsRaw, error: seasonsErr } = await supabase
    .from('seasons')
    .select('*')
  if (seasonsErr) {
    await sendAdminAlert(
      '[OXXOVO] season-tick FAILED to load seasons',
      `<p>The season-tick cron could not read the seasons table:</p><pre>${seasonsErr.message}</pre>`,
    )
    return NextResponse.json(
      { ok: false, error: `Failed to load seasons: ${seasonsErr.message}` },
      { status: 500 },
    )
  }
  const seasons = (seasonsRaw ?? []) as Season[]

  // ── 1. CREATE-AHEAD ──────────────────────────────────────────────────────
  let created: SeasonTickReport['created'] = null
  let skippedCreation: string | undefined

  const latest = [...seasons].sort((a, b) => b.season_number - a.season_number)[0]
  if (!latest) {
    skippedCreation = 'no seasons exist yet — nothing to clone from'
    errors.push('season-tick: seasons table is empty; cannot bootstrap season_0')
  } else if (!latest.application_open_at) {
    // The latest season is a teaser with no open date set yet (e.g. an
    // announced "COMING SOON" season whose schedule is still TBD). That is a
    // normal state, not a failure — skip create-ahead quietly instead of
    // alerting every hourly tick. Create-ahead resumes once it has a date.
    skippedCreation = `latest season ${latest.id} has no application_open_at (teaser); next not scheduled`
  } else if (new Date(latest.application_open_at).getTime() > nowMs) {
    // Latest season hasn't opened yet — already exactly one draft ahead.
    skippedCreation = `latest season ${latest.id} not open yet; next already pending`
  } else {
    const nextNumber = latest.season_number + 1
    const nextId = `season_${nextNumber}`
    const alreadyExists = seasons.some(
      (s) => s.id === nextId || s.season_number === nextNumber,
    )
    if (alreadyExists) {
      skippedCreation = `${nextId} already exists`
    } else {
      try {
        // The default community-vote weight for every auto-created season lives
        // in platform_config, never hardcoded (mirrors lib/credits.ts). A throw
        // here is caught below and reported; status transitions still run.
        const { data: cfg, error: cfgErr } = await supabase
          .from('platform_config')
          .select('value')
          .eq('key', 'default_community_vote_weight')
          .single()
        if (cfgErr) {
          throw new Error(`read default_community_vote_weight failed: ${cfgErr.message}`)
        }
        const communityVoteWeight = Number(cfg?.value)
        if (!Number.isFinite(communityVoteWeight)) {
          throw new Error(
            `platform_config.default_community_vote_weight missing/invalid: ${JSON.stringify(cfg?.value)}`,
          )
        }
        const row = buildNextSeasonRow(latest, communityVoteWeight)
        // Set updated_at explicitly: the admin insert path always does, which
        // signals the column has no DB default. created_at is omitted (admin
        // omits it too, so it has a default).
        const { data, error } = await supabase
          .from('seasons')
          .insert({ ...row, updated_at: now.toISOString() })
          .select('id, season_number, application_open_at')
          .single()
        if (error) {
          // 23505 = unique_violation: a concurrent tick already created it.
          // That is the idempotency guarantee working, not a failure.
          if (error.code === '23505') {
            skippedCreation = `${nextId} created by a concurrent tick`
          } else {
            errors.push(`season-tick: insert ${nextId} failed: ${error.message}`)
          }
        } else {
          created = data as SeasonTickReport['created']
        }
      } catch (e) {
        errors.push(
          `season-tick: building ${nextId} threw: ${e instanceof Error ? e.message : String(e)}`,
        )
      }
    }
  }

  // ── 1.5. DEFERRAL ────────────────────────────────────────────────────────
  // Runs BEFORE status transitions: a season whose application window just
  // closed with too few applicants gets its whole calendar pushed forward
  // instead of closing. The RPC is atomic + idempotent; it self-gates on
  // now >= application_close_at, defer budget, and applicant count. A season
  // deferred THIS tick is skipped in the transition loop below, because the
  // in-memory row still carries the pre-shift (past) close date — using it
  // would wrongly mark the season 'closed'. Next tick reads the shifted dates.
  const deferrals: SeasonTickReport['deferrals'] = []
  const deferredThisTick = new Set<string>()
  for (const s of seasons) {
    if (!s.application_close_at || nowMs < new Date(s.application_close_at).getTime()) continue
    const { data, error } = await supabase.rpc('defer_season_schedule', { p_season_id: s.id })
    if (error) {
      errors.push(`season-tick: defer ${s.id} failed: ${error.message}`)
      continue
    }
    const row = Array.isArray(data) ? data[0] : data
    if (row?.deferred) {
      deferredThisTick.add(s.id)
      deferrals.push({
        id: s.id,
        newClose: row.new_close ?? null,
        deferCount: Number(row.new_defer_count ?? 0),
      })
    }
  }

  // ── 1.6. PRELIM HOLD RELEASE ─────────────────────────────────────────────
  // A season running the anti-copy hold keeps every prelim entry invisible until
  // the whole cohort is released together. This is the AUTO path: once the
  // application window has closed, release them all at once. Opt-in per season
  // (studio_prelim_auto_publish, default false) -- while it is off the release
  // is the admin's button on /admin/watch-videos, which is where season_0 stands
  // until the schedule is final. Idempotent: the release matches only still-held
  // rows, so later ticks release 0 and touch nothing.
  //
  // Runs AFTER deferral for the same reason transitions do: a season deferred
  // this tick has a shifted (future) close date, so releasing on its stale
  // in-memory date would publish the cohort while the window is still open.
  const prelimReleases: SeasonTickReport['prelimReleases'] = []
  for (const s of seasons) {
    if (deferredThisTick.has(s.id)) continue
    if (!s.studio_prelim_auto_publish) continue
    if (!s.application_close_at || nowMs < new Date(s.application_close_at).getTime()) continue
    const { released, error } = await releasePrelimHoldCore(s.id)
    if (error) {
      errors.push(`season-tick: prelim hold release ${s.id} failed: ${error}`)
      continue
    }
    if (released > 0) prelimReleases.push({ id: s.id, released })
  }

  // ── 2. STATUS TRANSITIONS ────────────────────────────────────────────────
  const transitions: SeasonTickReport['transitions'] = []
  for (const s of seasons) {
    if (deferredThisTick.has(s.id)) continue
    const desired = desiredStatus(s, nowMs)
    const currentRank = STATUS_RANK[s.status] ?? -1
    const desiredRank = STATUS_RANK[desired] ?? -1
    // Forward-only: never regress a season, and never fight a manual admin edit
    // that has already moved it further along.
    if (desired === s.status || desiredRank <= currentRank) continue

    // Compare-and-swap on the old status so two concurrent ticks can't both
    // apply the same transition.
    const { error, data } = await supabase
      .from('seasons')
      .update({ status: desired, updated_at: now.toISOString() })
      .eq('id', s.id)
      .eq('status', s.status)
      .select('id')
    if (error) {
      errors.push(`season-tick: transition ${s.id} ${s.status}->${desired} failed: ${error.message}`)
    } else if (data && data.length > 0) {
      transitions.push({ id: s.id, from: s.status, to: desired })
    }
  }

  // ── 2.5. ADVANCEMENT ──────────────────────────────────────────────────────
  // Once a season's scoring window has fully completed, promote the top
  // computeAdvanceCount() eligible entrants to 'selected' (Finalist) and reject
  // the rest of the scored pool. The RPC is atomic + idempotent and self-gates
  // (scoring_complete_at reached, no scoring in progress, no flagged rows, not
  // already advanced). A 'flagged_pending' block means an admin must clear
  // integrity reviews before finalists can be picked — surfaced as an alert.
  // Participant emails (Finalist / not-selected) are wired in step 5.
  const advancements: SeasonTickReport['advancements'] = []
  const flaggedBlocks: string[] = []
  for (const s of seasons) {
    if (!s.scoring_complete_at || nowMs < new Date(s.scoring_complete_at).getTime()) continue
    const { data, error } = await supabase.rpc('advance_season_finalists', { p_season_id: s.id })
    if (error) {
      errors.push(`season-tick: advance ${s.id} failed: ${error.message}`)
      continue
    }
    const row = Array.isArray(data) ? data[0] : data
    if (!row) continue
    if (row.blocked === 'flagged_pending') {
      flaggedBlocks.push(s.id)
    } else if (!row.blocked && Number(row.advanced) > 0) {
      advancements.push({
        id: s.id,
        advanced: Number(row.advanced),
        rejected: Number(row.rejected),
        nTarget: Number(row.n_target),
      })
    }
  }

  // ── 2.6. PRICING HEALTH ───────────────────────────────────────────────────
  // Can everything that can be spent on still be priced? The charge paths refuse
  // rather than charge 0 (lib/credits.ts), so a broken price gives nothing away --
  // it BLOCKS the participant, who sees a generic failure, while nothing is
  // written anywhere: the refusal happens before the job row exists. This is the
  // half that tells us. It alerts only when the set of problems CHANGES (a
  // standing condition would otherwise mail every tick), recovery included.
  // Never throws -- a pricing probe must not cost the tick its other work.
  let pricingHealth: PricingHealthReport | undefined
  try {
    pricingHealth = await reportPricingHealth()
    if (pricingHealth.stateError) {
      errors.push(`season-tick: pricing alert state: ${pricingHealth.stateError}`)
    }
  } catch (e) {
    errors.push(`season-tick: pricing health check threw: ${e instanceof Error ? e.message : String(e)}`)
  }

  // ── 3. NOTIFY ────────────────────────────────────────────────────────────
  const alerts: Promise<boolean>[] = []
  if (pricingHealth?.changed) {
    alerts.push(
      sendAdminAlert(
        pricingHealth.recovered
          ? '[OXXOVO] Studio pricing healthy again'
          : `[OXXOVO] Studio pricing problem: ${summarizeProblems(pricingHealth.problems)}`,
        pricingAlertHtml(pricingHealth),
      ),
    )
  }
  for (const d of deferrals) {
    alerts.push(
      sendAdminAlert(
        `[OXXOVO] Season ${d.id} application deadline deferred`,
        `<div style="font-family: Arial, sans-serif; max-width: 560px; color: #1a1a1a;">
          <h2 style="color: #8B22FF;">Application window extended</h2>
          <p><strong>${d.id}</strong> had fewer than the minimum applicants at close,
             so the whole calendar shifted forward (deferral #${d.deferCount}).</p>
          <p>New application close: <strong>${d.newClose}</strong> (UTC)</p>
        </div>`,
      ),
    )
  }
  for (const p of prelimReleases) {
    alerts.push(
      sendAdminAlert(
        `[OXXOVO] ${p.id}: ${p.released} prelim entries published`,
        `<div style="font-family: Arial, sans-serif; max-width: 560px; color: #1a1a1a;">
          <h2 style="color: #8B22FF;">Preliminary cohort released</h2>
          <p>The application window for <strong>${p.id}</strong> closed, so the
             anti-copy hold was lifted on <strong>${p.released}</strong> entries.
             They are now visible on <a href="https://www.oxxovo.ai/watch">/watch</a>.</p>
        </div>`,
      ),
    )
  }
  for (const a of advancements) {
    alerts.push(
      sendAdminAlert(
        `[OXXOVO] ${a.id}: ${a.advanced} Finalists advanced`,
        `<div style="font-family: Arial, sans-serif; max-width: 560px; color: #1a1a1a;">
          <h2 style="color: #8B22FF;">Finalists selected</h2>
          <p><strong>${a.id}</strong> scoring is complete. ${a.advanced} entrant(s)
             advanced to the main round (target N=${a.nTarget}); ${a.rejected}
             were not selected.</p>
        </div>`,
      ),
    )
  }
  for (const id of flaggedBlocks) {
    alerts.push(
      sendAdminAlert(
        `[OXXOVO] ${id}: Finalist advancement blocked by flagged reviews`,
        `<div style="font-family: Arial, sans-serif; max-width: 560px; color: #1a1a1a;">
          <h2 style="color: #c0392b;">Integrity reviews pending</h2>
          <p>Scoring for <strong>${id}</strong> is complete, but one or more
             applications are <strong>flagged</strong> for integrity review.
             Finalists cannot be advanced until each flagged application is
             resolved to 'eligible' or 'rejected' in
             <a href="https://www.oxxovo.ai/admin/applications">/admin/applications</a>.</p>
        </div>`,
      ),
    )
  }
  if (created) {
    alerts.push(
      sendAdminAlert(
        `[OXXOVO] New season auto-created: ${created.id}`,
        `<div style="font-family: Arial, sans-serif; max-width: 560px; color: #1a1a1a;">
          <h2 style="color: #8B22FF;">New season created</h2>
          <p>The weekly cron created <strong>${created.id}</strong>
             (season #${created.season_number}) as a <strong>draft</strong>.</p>
          <p>Applications open: <strong>${created.application_open_at}</strong> (UTC)</p>
          <p>Set its codename, display name, and main-round theme in
             <a href="https://www.oxxovo.ai/admin/seasons">/admin/seasons</a> before it
             auto-activates.</p>
        </div>`,
      ),
    )
  }
  if (errors.length > 0) {
    alerts.push(
      sendAdminAlert(
        '[OXXOVO] season-tick reported errors',
        `<div style="font-family: Arial, sans-serif; max-width: 560px; color: #1a1a1a;">
          <h2 style="color: #c0392b;">season-tick errors</h2>
          <ul>${errors.map((e) => `<li>${e}</li>`).join('')}</ul>
        </div>`,
      ),
    )
  }
  if (alerts.length > 0) await Promise.allSettled(alerts)

  // ★Asynchronous submission: finalize accepted-and-rendered entries, recover dead
  // render leases, flag overdue ones. Deliberately part of THIS tick rather than a new
  // cron entry -- see sweepAsyncSubmissions for why (Vercel cron plan limit).
  let asyncSweep: Awaited<ReturnType<typeof sweepAsyncSubmissions>> | undefined
  try {
    asyncSweep = await sweepAsyncSubmissions()
  } catch (e) {
    errors.push(`asyncSweep: ${e instanceof Error ? e.message : String(e)}`)
  }

  const report: SeasonTickReport = {
    ok: true,
    ranAt: now.toISOString(),
    created,
    transitions,
    deferrals,
    prelimReleases,
    advancements,
    ...(skippedCreation ? { skippedCreation } : {}),
    ...(asyncSweep ? { asyncSweep } : {}),
    ...(pricingHealth
      ? {
          pricing: {
            signature: pricingHealth.signature,
            alerted: pricingHealth.changed,
            problems: pricingHealth.problems.map((p) => `${p.kind}:${p.id} ${p.detail}`),
          },
        }
      : {}),
    errors,
  }
  return NextResponse.json(report)
}

export async function POST(request: NextRequest) {
  return handle(request)
}

// GET is supported only so the route is convenient to ping manually during
// development. Vercel Cron itself uses GET.
export async function GET(request: NextRequest) {
  return handle(request)
}
