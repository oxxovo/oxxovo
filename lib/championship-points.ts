// Championship Points -- design approved 2026-08-18 (HQ). SERVER ONLY.
//
// Three accrual events, three separate hooks:
//   - participation (flat, no scaling)  -- season-tick, at application_close_at
//   - top50 (200 base)                  -- season-tick, right after advance_season_finalists
//   - award (250/500/1000 base)         -- admin actions that set award_rank
//
// Ledger only. Never UPDATE/DELETE a row -- correct by inserting a reversal
// (reverses_id -> the row being undone), and re-pay by inserting a NEW credit
// whose reverses_id points at the REVERSAL (not the original) -- "the reversal
// of a reversal". This keeps every row outside the partial unique indexes once
// it has ever been touched, so a corrected application can cycle
// credit -> reverse -> re-credit -> reverse -> ... forever without ever
// colliding with itself. The chain IS the audit trail: read it top to bottom
// to see why a total is what it is. See reports/championship_points_migration_2026-08-18.sql.
//
// Headcount + multiplier + basis are computed ONCE, at the participation event
// (same moment, same valid-submission definition as the 50-point payout), and
// FROZEN into that row. Top50 and award events read the frozen value back off
// the season's participation row -- they never recompute. A later
// disqualification does not re-freeze the multiplier for anyone else; only the
// disqualified application's own points are reversed.

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdmin } from './supabase-admin'
import { sendAdminAlertOnceDaily } from './admin-alert-dedup'

type Admin = SupabaseClient

const UNIQUE_VIOLATION = '23505'

// ─── config reads (no hardcoded points -- platform_config + a dedicated
//     brackets table, both set by the 2026-08-18 migration) ──────────────────

type BaseConfig = {
  participation: number
  top50: number
  third: number
  second: number
  first: number
}

async function getBaseConfig(admin: Admin): Promise<BaseConfig | null> {
  const { data, error } = await admin
    .from('platform_config')
    .select('key, value')
    .in('key', [
      'championship_points_participation',
      'championship_points_base_top50',
      'championship_points_base_third',
      'championship_points_base_second',
      'championship_points_base_first',
    ])
  if (error || !data) return null
  const m = new Map(data.map((r) => [r.key as string, Number(r.value)]))
  const participation = m.get('championship_points_participation')
  const top50 = m.get('championship_points_base_top50')
  const third = m.get('championship_points_base_third')
  const second = m.get('championship_points_base_second')
  const first = m.get('championship_points_base_first')
  if (
    ![participation, top50, third, second, first].every((v) => typeof v === 'number' && Number.isFinite(v))
  ) {
    return null
  }
  return { participation: participation!, top50: top50!, third: third!, second: second!, first: first! }
}

// Bracket boundaries are DATA, not code (HQ 2026-08-18) -- the first row's
// min=0 and the last row's max is a large sentinel, so every headcount from a
// below-floor season up through any realistic size matches exactly one row.
// No code-side clamp.
async function getBracketMultiplier(admin: Admin, headcount: number): Promise<number | null> {
  const { data, error } = await admin
    .from('championship_points_brackets')
    .select('multiplier')
    .lte('min_participants', headcount)
    .gte('max_participants', headcount)
    .maybeSingle()
  if (error || !data) return null
  return Number(data.multiplier)
}

// Same definition used for BOTH the participation payout and the headcount
// denominator (HQ 2026-08-18 ④) -- moderation_status excluded on purpose
// (HQ ②): moderation resolves later than the submission deadline, so gating
// entry on it would keep delaying payout. Anything that surfaces later
// (moderation flag, integrity disqualification) is handled at the EXIT
// (reversal), never at this entrance.
async function getValidSubmitterCount(admin: Admin, seasonId: string): Promise<number> {
  const { count, error } = await admin
    .from('genesis_applications')
    .select('id', { count: 'exact', head: true })
    .eq('season_id', seasonId)
    .not('free_entry_url', 'is', null)
    .neq('status', 'flagged')
  if (error) throw new Error(`getValidSubmitterCount(${seasonId}): ${error.message}`)
  return count ?? 0
}

type FrozenBasis = { headcount: number; multiplier: number; basisUsd: number }

// The season's frozen headcount/multiplier/basis, read back from its
// participation ledger row (there is exactly one, ever -- the partial unique
// index guarantees it). Returns null if participation hasn't run yet for this
// season -- callers (top50/award) must not credit without it.
async function getFrozenBasis(admin: Admin, seasonId: string): Promise<FrozenBasis | null> {
  const { data, error } = await admin
    .from('championship_points_ledger')
    .select('headcount, multiplier, basis_usd')
    .eq('season_id', seasonId)
    .eq('event_type', 'participation')
    .is('reverses_id', null)
    .limit(1)
    .maybeSingle()
  if (error || !data || data.headcount == null || data.multiplier == null) return null
  return { headcount: data.headcount, multiplier: data.multiplier, basisUsd: Number(data.basis_usd) }
}

function pointsYear(now: Date): number {
  return now.getUTCFullYear()
}

// ─── 1. PARTICIPATION -- season-tick, at application_close_at ────────────────
//
// Idempotent at two levels: (a) the caller should only invoke this once
// application_close_at has passed, but repeated ticks are still safe because
// (b) each application's insert is caught for 23505 (unique_violation) and
// treated as "already credited". Never throws -- every failure is collected
// into the return value so the caller's step never aborts the tick.

export type ParticipationResult = {
  attempted: number
  credited: number
  alreadyCredited: number
  errors: string[]
  skipped?: 'basis_null' | 'already_ran_for_season'
}

export async function creditParticipationForSeason(
  seasonId: string,
  now: Date = new Date(),
): Promise<ParticipationResult> {
  const admin = createSupabaseAdmin()
  const errors: string[] = []

  // Season-level idempotency guard: if this season already has ANY
  // participation row, the whole batch already ran -- skip without touching
  // anything (also avoids re-freezing headcount/multiplier).
  const { data: already, error: alreadyErr } = await admin
    .from('championship_points_ledger')
    .select('id')
    .eq('season_id', seasonId)
    .eq('event_type', 'participation')
    .limit(1)
  if (alreadyErr) {
    return { attempted: 0, credited: 0, alreadyCredited: 0, errors: [alreadyErr.message] }
  }
  if (already && already.length > 0) {
    return { attempted: 0, credited: 0, alreadyCredited: 0, errors: [], skipped: 'already_ran_for_season' }
  }

  const { data: seasonRow, error: seasonErr } = await admin
    .from('seasons')
    .select('points_fee_basis_usd, is_fixture')
    .eq('id', seasonId)
    .maybeSingle()
  if (seasonErr) return { attempted: 0, credited: 0, alreadyCredited: 0, errors: [seasonErr.message] }

  const basisUsd = seasonRow?.points_fee_basis_usd
  if (basisUsd == null) {
    // fail-closed (HQ ③), but never SILENTLY -- EXCEPT fixture/rehearsal
    // seasons (HQ 2026-08-19 ①): nobody is ever going to set a real fee basis
    // on season_test, so alerting there is not "still blocked", it's noise --
    // 58 identical mails in ~29h buried the real ones. Non-fixture seasons
    // still alert, capped at once/day per season (HQ 2026-08-19 ②) so a real
    // season stuck on this for a week is one mail a day, not one an hour.
    if (!seasonRow?.is_fixture) {
      await sendAdminAlertOnceDaily(
        `championship_points_basis_null_${seasonId}`,
        `[OXXOVO] Championship Points blocked: ${seasonId} has no points_fee_basis_usd`,
        `<div style="font-family: Arial, sans-serif; max-width: 560px; color: #1a1a1a;">
          <h2 style="color: #c0392b;">Championship Points not credited</h2>
          <p><strong>${seasonId}</strong>'s application window closed, but
             <code>seasons.points_fee_basis_usd</code> is NULL. No points were
             credited for this season -- set the column and this will run on the
             next tick (fail-closed, not silent: this is that alert, capped at
             once/day while it persists).</p>
        </div>`,
      )
    }
    return { attempted: 0, credited: 0, alreadyCredited: 0, errors: [], skipped: 'basis_null' }
  }

  const base = await getBaseConfig(admin)
  if (!base) {
    errors.push('championship_points platform_config rows missing or invalid')
    return { attempted: 0, credited: 0, alreadyCredited: 0, errors }
  }

  const headcount = await getValidSubmitterCount(admin, seasonId)
  const multiplier = await getBracketMultiplier(admin, headcount)
  if (multiplier == null) {
    errors.push(`no championship_points_brackets row covers headcount=${headcount}`)
    return { attempted: 0, credited: 0, alreadyCredited: 0, errors }
  }

  const { data: apps, error: appsErr } = await admin
    .from('genesis_applications')
    .select('id, user_id')
    .eq('season_id', seasonId)
    .not('free_entry_url', 'is', null)
    .neq('status', 'flagged')
  if (appsErr) return { attempted: 0, credited: 0, alreadyCredited: 0, errors: [appsErr.message] }

  let credited = 0
  let alreadyCredited = 0
  const year = pointsYear(now)
  for (const app of apps ?? []) {
    const { error } = await admin.from('championship_points_ledger').insert({
      application_id: app.id,
      user_id: app.user_id,
      season_id: seasonId,
      points_year: year,
      event_type: 'participation',
      points_awarded: base.participation,
      basis_usd: basisUsd,
      headcount,
      multiplier,
      reason: `Valid final submission, ${seasonId}`,
      created_by: 'system:season-tick',
    })
    if (error) {
      if (error.code === UNIQUE_VIOLATION) alreadyCredited++
      else errors.push(`application ${app.id}: ${error.message}`)
    } else {
      credited++
    }
  }

  return { attempted: (apps ?? []).length, credited, alreadyCredited, errors }
}

// ─── 2. TOP 50 -- season-tick, right after advance_season_finalists ──────────
//
// Called with the list of application ids that are CURRENTLY 'selected' for
// this season (the caller queries this after the RPC -- newly- and
// previously-advanced are indistinguishable on purpose: re-attempting an
// already-credited application is a no-op via 23505, so passing the full
// selected set every tick is simpler than diffing and exactly as safe).

export type Top50Result = {
  attempted: number
  credited: number
  alreadyCredited: number
  errors: string[]
  skipped?: 'not_frozen_yet'
}

export async function creditTop50ForApplications(
  seasonId: string,
  applications: { id: string; user_id: string | null }[],
  now: Date = new Date(),
): Promise<Top50Result> {
  if (applications.length === 0) return { attempted: 0, credited: 0, alreadyCredited: 0, errors: [] }
  const admin = createSupabaseAdmin()

  const frozen = await getFrozenBasis(admin, seasonId)
  if (!frozen) {
    // Participation hasn't run for this season yet (or was blocked by a null
    // basis, already alerted there) -- nothing to scale against. Do not guess.
    return { attempted: applications.length, credited: 0, alreadyCredited: 0, errors: [], skipped: 'not_frozen_yet' }
  }

  const base = await getBaseConfig(admin)
  if (!base) {
    return {
      attempted: applications.length,
      credited: 0,
      alreadyCredited: 0,
      errors: ['championship_points platform_config rows missing or invalid'],
    }
  }

  const points = base.top50 * (frozen.basisUsd / 50) * frozen.multiplier
  const year = pointsYear(now)
  let credited = 0
  let alreadyCredited = 0
  const errors: string[] = []
  for (const app of applications) {
    const { error } = await admin.from('championship_points_ledger').insert({
      application_id: app.id,
      user_id: app.user_id,
      season_id: seasonId,
      points_year: year,
      event_type: 'top50',
      points_awarded: points,
      basis_usd: frozen.basisUsd,
      headcount: frozen.headcount,
      multiplier: frozen.multiplier,
      reason: `Top-50 advancement, ${seasonId}`,
      created_by: 'system:season-tick',
    })
    if (error) {
      if (error.code === UNIQUE_VIOLATION) alreadyCredited++
      else errors.push(`application ${app.id}: ${error.message}`)
    } else {
      credited++
    }
  }
  return { attempted: applications.length, credited, alreadyCredited, errors }
}

// ─── 3. AWARD (1st/2nd/3rd) -- admin actions that set award_rank ─────────────
//
// Called from every call site that writes genesis_applications.award_rank
// (saveAwardRank / approveTop3Awards / saveAwardOverride) AFTER that write
// succeeds. Reads the application's OWN latest award-type ledger row (if any)
// to find its current effective rank, and:
//   - newRank === currentRank        -> no-op (idempotent re-click)
//   - currentRank set, changing      -> reversal row (reverses_id -> old row)
//   - newRank in {1,2,3}, no current -> credit row (reverses_id -> the
//                                       reversal just inserted, if any, else
//                                       null -- "the reversal of a reversal")
//
// Never throws -- callers must not let a points failure block the award_rank
// write itself, which is the source of truth.

export type SyncAwardResult =
  | { ok: true; action: 'noop' | 'credited' | 'reversed' | 'reversed_and_recredited' }
  | { ok: false; error: string }

export async function syncAwardPoints(args: {
  applicationId: string
  seasonId: string
  userId: string | null
  newRank: 1 | 2 | 3 | null
  reason: string // human "why" -- e.g. an admin override's stated reason
  actor: string // 'admin:<uid>' or similar, for created_by
  now?: Date
}): Promise<SyncAwardResult> {
  const admin = createSupabaseAdmin()
  const now = args.now ?? new Date()

  const { data: latest, error: latestErr } = await admin
    .from('championship_points_ledger')
    .select('id, award_rank, points_awarded, basis_usd, headcount, multiplier')
    .eq('application_id', args.applicationId)
    .eq('event_type', 'award')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (latestErr) return { ok: false, error: latestErr.message }

  const currentRank = latest && Number(latest.points_awarded) > 0 ? (latest.award_rank as 1 | 2 | 3) : null
  if (currentRank === args.newRank) return { ok: true, action: 'noop' }

  let reversalId: string | null = null
  if (currentRank !== null && latest) {
    // Carry the same basis/headcount/multiplier the original credit used --
    // a reversal must undo EXACTLY that amount, not a re-derived one.
    const { data: rev, error: revErr } = await admin
      .from('championship_points_ledger')
      .insert({
        application_id: args.applicationId,
        user_id: args.userId,
        season_id: args.seasonId,
        points_year: pointsYear(now),
        event_type: 'award',
        award_rank: latest.award_rank,
        points_awarded: -Number(latest.points_awarded),
        basis_usd: latest.basis_usd,
        headcount: latest.headcount,
        multiplier: latest.multiplier,
        reason: `Reversed: ${args.reason}`,
        reverses_id: latest.id,
        created_by: args.actor,
      })
      .select('id')
      .single()
    if (revErr) return { ok: false, error: `reversal insert failed: ${revErr.message}` }
    reversalId = rev.id
  }

  if (args.newRank === null) {
    return { ok: true, action: reversalId ? 'reversed' : 'noop' }
  }

  const frozen = await getFrozenBasis(admin, args.seasonId)
  if (!frozen) {
    return { ok: false, error: `${args.seasonId}: no frozen participation basis -- cannot credit award` }
  }
  const base = await getBaseConfig(admin)
  if (!base) return { ok: false, error: 'championship_points platform_config rows missing or invalid' }
  const rankBase = args.newRank === 1 ? base.first : args.newRank === 2 ? base.second : base.third
  const points = rankBase * (frozen.basisUsd / 50) * frozen.multiplier

  const { error: credErr } = await admin.from('championship_points_ledger').insert({
    application_id: args.applicationId,
    user_id: args.userId,
    season_id: args.seasonId,
    points_year: pointsYear(now),
    event_type: 'award',
    award_rank: args.newRank,
    points_awarded: points,
    basis_usd: frozen.basisUsd,
    headcount: frozen.headcount,
    multiplier: frozen.multiplier,
    reason: reversalId ? `Re-credited: ${args.reason}` : `Award rank ${args.newRank}, ${args.seasonId}`,
    // ★"the reversal of a reversal" (HQ 2026-08-18 ②): a re-credit's
    // reverses_id points at the REVERSAL row, not at the original credit.
    // This keeps it out of the (application_id, award_rank) partial unique
    // index (which only covers reverses_id IS NULL rows), so the exact same
    // rank can be credited again after a correction without colliding with
    // its own first-ever credit.
    reverses_id: reversalId,
    created_by: args.actor,
  })
  if (credErr) {
    if (credErr.code === UNIQUE_VIOLATION) {
      // Only reachable for a first-ever credit (reversalId === null) racing
      // itself -- treat as already-done.
      return { ok: true, action: reversalId ? 'reversed' : 'noop' }
    }
    return { ok: false, error: `credit insert failed: ${credErr.message}` }
  }
  return { ok: true, action: reversalId ? 'reversed_and_recredited' : 'credited' }
}
