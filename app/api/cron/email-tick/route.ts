// Vercel Cron entrypoint — fires every 15 minutes from vercel.json.
//
// One handler covers all three time-based templates so the cron schedule
// stays a single line of config; each template's eligibility is a simple
// DB query against `seasons` timestamps. Per OXXOVO automation philosophy
// there is no admin-facing "Send" button — this route IS the dispatch.
//
// Authentication: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`.
// Manual invocation must use the same header.
//
// Dedup + retry: each per-applicant send goes through `canSend()`, which
// combines (a) the partial-unique index on email_logs and (b) an
// exponential backoff over prior `failed` rows. Sends that succeed write a
// `sent` row; failures write a `failed` row that the next cron tick can
// retry once the backoff window elapses.

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { canSend } from '@/lib/email/log'
import {
  sendMainRoundStart,
  sendSubmissionDeadline,
  sendResultsAnnounced,
  sendMembershipRenewal,
  sendMembershipFoundingExpiry,
  type SendResult,
} from '@/lib/email/send'
import { isMembershipEnabled } from '@/lib/membership'
import { getPlatformConfigMap } from '@/lib/partners'
import type { Season } from '@/lib/seasons'

const APP_URL = process.env.APP_URL ?? 'https://oxxovo.com'
const VALID_INTERVALS = ['day', 'week', 'month', 'year']

// Force the handler to run at request time. Cron payloads have no useful
// cache, and a prerendered 'now' would silently ignore time-based triggers.
export const dynamic = 'force-dynamic'

type ApplicantRow = {
  id: string
  email: string
  creator_name: string
  country: string | null
  main_round_submitted_at: string | null
}

type TickReport = {
  ok: true
  ranAt: string
  mainRoundStart: { season: string; sent: number; skipped: number; failed: number }[]
  submissionDeadline: {
    season: string
    reminderHour: number
    sent: number
    skipped: number
    failed: number
  }[]
  resultsAnnounced: { season: string; sent: number; skipped: number; failed: number }[]
  // P4e membership notices (profile-scoped, not per-season). Absent when the
  // membership master switch is off (dark launch).
  membershipNotices?: {
    renewalSent: number
    foundingSent: number
    skipped: number
    failed: number
  }
}

export async function POST(request: NextRequest) {
  return handle(request)
}

// GET is supported only so the route is convenient to ping manually from a
// browser during development. Vercel Cron itself uses GET.
export async function GET(request: NextRequest) {
  return handle(request)
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

  // Pull every season the tick might need. Volume is tiny (one row per
  // season) so we load all and filter in memory.
  const { data: seasonsRaw, error: seasonsErr } = await supabase
    .from('seasons')
    .select('*')
  if (seasonsErr) {
    return NextResponse.json(
      { ok: false, error: `Failed to load seasons: ${seasonsErr.message}` },
      { status: 500 },
    )
  }
  const seasons = (seasonsRaw ?? []) as Season[]

  const report: TickReport = {
    ok: true,
    ranAt: now.toISOString(),
    mainRoundStart: [],
    submissionDeadline: [],
    resultsAnnounced: [],
  }

  for (const season of seasons) {
    if (
      season.main_round_start_at &&
      new Date(season.main_round_start_at) <= now
    ) {
      const result = await fireMainRoundStart(season)
      report.mainRoundStart.push({ season: season.id, ...result })

      const submissionCloseAt = new Date(
        new Date(season.main_round_start_at).getTime() +
          season.submission_hours * 3_600_000,
      )
      const reminderHours = Array.isArray(season.deadline_reminder_hours)
        ? (season.deadline_reminder_hours as number[])
        : []
      for (const reminderHour of reminderHours) {
        const fireAt = new Date(
          submissionCloseAt.getTime() - reminderHour * 3_600_000,
        )
        if (fireAt <= now && now < submissionCloseAt) {
          const result = await fireSubmissionDeadline(season, reminderHour)
          report.submissionDeadline.push({
            season: season.id,
            reminderHour,
            ...result,
          })
        }
      }
    }

    if (
      season.awards_announcement_at &&
      new Date(season.awards_announcement_at) <= now
    ) {
      const result = await fireResultsAnnounced(season)
      report.resultsAnnounced.push({ season: season.id, ...result })
    }
  }

  // P4e: membership renewal / founding-expiry notices. Gated on the membership
  // master switch so nothing fires in dark launch.
  if (await isMembershipEnabled()) {
    report.membershipNotices = await fireMembershipNotices(now)
  }

  return NextResponse.json(report)
}

// ── membership notices (P4e) ──────────────────────────────────────────────
// Profile-scoped, fired ~membership_renewal_notice_days before
// membership_expires_at. Dedup via profiles.membership_renewal_notified_at
// (set only on a successful send; P4c resets it each invoice.paid). All
// thresholds/price/interval from platform_config -- fail-closed on missing keys.

type MembershipCandidate = {
  id: string
  email: string
  membership_source: string | null
  membership_expires_at: string | null
  membership_cancel_at_period_end: boolean | null
  founding_creator_number: number | null
}

async function fireMembershipNotices(now: Date) {
  const counts = { renewalSent: 0, foundingSent: 0, skipped: 0, failed: 0 }
  const supabase = createSupabaseAdmin()

  // Config (fail-closed: a missing/invalid key skips the whole block -- never
  // invent a notice window / price / interval).
  const cfg = await getPlatformConfigMap()
  const noticeDays = Number(cfg.get('membership_renewal_notice_days') ?? 0)
  const priceUsd = Number(cfg.get('membership_creator_price_usd') ?? 0)
  const interval = String(cfg.get('membership_billing_interval') ?? '')
  if (
    !Number.isInteger(noticeDays) ||
    noticeDays <= 0 ||
    !Number.isFinite(priceUsd) ||
    priceUsd <= 0 ||
    !VALID_INTERVALS.includes(interval)
  ) {
    console.warn('[cron] membership notices config missing/invalid -- skipping', {
      noticeDays,
      priceUsd,
      interval,
    })
    return counts
  }

  const nowIso = now.toISOString()
  const thresholdIso = new Date(
    now.getTime() + noticeDays * 86_400_000,
  ).toISOString()

  // Candidates: active creator memberships entering their notice window that
  // haven't been notified this period.
  const { data: rows, error } = await supabase
    .from('profiles')
    .select(
      'id, email, membership_source, membership_expires_at, membership_cancel_at_period_end, founding_creator_number',
    )
    .eq('membership_tier', 'creator')
    .eq('membership_status', 'active')
    .not('membership_expires_at', 'is', null)
    .gt('membership_expires_at', nowIso)
    .lte('membership_expires_at', thresholdIso)
    .is('membership_renewal_notified_at', null)
    .in('membership_source', ['paid', 'founding_free'])
  if (error) {
    console.error('[cron] membership candidate load failed:', error.message)
    counts.failed++
    return counts
  }

  for (const row of (rows ?? []) as MembershipCandidate[]) {
    // Paid members who already chose to cancel get no renewal notice (the
    // /profile card shows "Cancels on <date>"). Skip without marking notified.
    if (row.membership_source === 'paid' && row.membership_cancel_at_period_end) {
      counts.skipped++
      continue
    }

    // Name/country: from the user's most recent application (profiles has no
    // name/country) -- same pattern as lib/partners.ts. Best-effort; defaults
    // to English + email-as-name.
    const { data: appRows } = await supabase
      .from('genesis_applications')
      .select('creator_name, country, created_at')
      .ilike('email', row.email)
      .order('created_at', { ascending: false })
      .limit(1)
    const latest = appRows?.[0]
    const creatorName = (latest?.creator_name as string | undefined) ?? row.email
    const country = (latest?.country as string | null | undefined) ?? null

    let result: SendResult
    if (row.membership_source === 'founding_free') {
      if (row.founding_creator_number == null) {
        // founding_free with no number is inconsistent -- skip defensively.
        counts.skipped++
        continue
      }
      result = await sendMembershipFoundingExpiry({
        toEmail: row.email,
        country,
        creatorName,
        foundingNumber: row.founding_creator_number,
        endsOn: row.membership_expires_at,
        priceUsd,
        interval,
        subscribeUrl: `${APP_URL}/apply`,
      })
    } else {
      result = await sendMembershipRenewal({
        toEmail: row.email,
        country,
        creatorName,
        priceUsd,
        interval,
        renewsOn: row.membership_expires_at,
      })
    }

    if (!result.ok) {
      // Leave notified_at null so the next tick retries (failure already logged
      // to email_logs by executeSend).
      counts.failed++
      continue
    }

    // Mark notified for this period so we don't resend. (Paid: P4c resets this
    // on the next invoice.paid. Founding: one-time, never resets.)
    const { error: markErr } = await supabase
      .from('profiles')
      .update({
        membership_renewal_notified_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', row.id)
    if (markErr) {
      console.error('[cron] membership notified_at update failed:', markErr.message)
    }

    if (row.membership_source === 'founding_free') counts.foundingSent++
    else counts.renewalSent++
  }

  return counts
}

// ── main_round_start ──────────────────────────────────────────────────────

async function fireMainRoundStart(season: Season) {
  const supabase = createSupabaseAdmin()
  const { data: rows, error } = await supabase
    .from('genesis_applications')
    .select('id, email, creator_name, country, main_round_submitted_at')
    .eq('season_id', season.id)
    .eq('status', 'selected')
  if (error) {
    console.error('[cron] main_round_start applicant load failed:', error.message)
    return { sent: 0, skipped: 0, failed: 1 }
  }

  return await dispatchBatch(
    (rows ?? []) as ApplicantRow[],
    'main_round_start',
    async (row) =>
      sendMainRoundStart({
        toEmail: row.email,
        country: row.country,
        creatorName: row.creator_name,
        seasonName: season.display_name,
        themeAnnouncementMinutesBefore: season.theme_announcement_minutes_before,
        submissionHours: season.submission_hours,
        mainRoundVideoMinSeconds: season.main_round_video_min_seconds,
        mainRoundVideoMaxSeconds: season.main_round_video_max_seconds,
        applicationId: row.id,
        seasonId: season.id,
      }),
  )
}

// ── submission_deadline ───────────────────────────────────────────────────

async function fireSubmissionDeadline(season: Season, reminderHour: number) {
  const supabase = createSupabaseAdmin()
  const { data: rows, error } = await supabase
    .from('genesis_applications')
    .select('id, email, creator_name, country, main_round_submitted_at')
    .eq('season_id', season.id)
    .eq('status', 'selected')
    .is('main_round_submitted_at', null)
  if (error) {
    console.error(
      '[cron] submission_deadline applicant load failed:',
      error.message,
    )
    return { sent: 0, skipped: 0, failed: 1 }
  }

  return await dispatchBatch(
    (rows ?? []) as ApplicantRow[],
    'submission_deadline',
    async (row) =>
      sendSubmissionDeadline({
        toEmail: row.email,
        country: row.country,
        creatorName: row.creator_name,
        seasonName: season.display_name,
        hoursRemaining: reminderHour,
        reminderHour,
        applicationId: row.id,
        seasonId: season.id,
      }),
    reminderHour,
  )
}

// ── results_announced ─────────────────────────────────────────────────────

async function fireResultsAnnounced(season: Season) {
  const supabase = createSupabaseAdmin()
  const { data: rows, error } = await supabase
    .from('genesis_applications')
    .select('id, email, creator_name, country, main_round_submitted_at')
    .eq('season_id', season.id)
    .in('status', ['selected', 'awarded', 'rejected'])
  if (error) {
    console.error('[cron] results_announced applicant load failed:', error.message)
    return { sent: 0, skipped: 0, failed: 1 }
  }

  return await dispatchBatch(
    (rows ?? []) as ApplicantRow[],
    'results_announced',
    async (row) =>
      sendResultsAnnounced({
        toEmail: row.email,
        country: row.country,
        creatorName: row.creator_name,
        seasonName: season.display_name,
        applicationId: row.id,
        seasonId: season.id,
      }),
  )
}

// ── shared dispatcher ─────────────────────────────────────────────────────

type TemplateName =
  | 'main_round_start'
  | 'submission_deadline'
  | 'results_announced'

async function dispatchBatch(
  rows: ApplicantRow[],
  template: TemplateName,
  send: (row: ApplicantRow) => Promise<SendResult>,
  reminderHour?: number,
) {
  let sent = 0
  let skipped = 0
  let failed = 0

  for (const row of rows) {
    const verdict = await canSend(row.id, template, reminderHour)
    if (!verdict.ok) {
      skipped++
      continue
    }
    const result = await send(row)
    if (!result.ok) failed++
    else if ('skipped' in result && result.skipped) skipped++
    else sent++
  }

  return { sent, skipped, failed }
}
