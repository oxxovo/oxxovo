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
  type SendResult,
} from '@/lib/email/send'
import type { Season } from '@/lib/seasons'

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

  return NextResponse.json(report)
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
