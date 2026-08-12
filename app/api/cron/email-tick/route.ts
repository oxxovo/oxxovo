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
  makeTickBudget,
  budgetAllows,
  budgetRecord,
  type TickBudget,
} from '@/lib/email/deferral'
import {
  sendSelectedTop50,
  sendNotSelected,
  sendMainRoundStart,
  sendSubmissionDeadline,
  sendResultsAnnounced,
  sendMembershipRenewal,
  sendMembershipFoundingExpiry,
  sendVideoLivePrelim,
  sendVideoLiveMain,
  type SendResult,
} from '@/lib/email/send'
import { detectEmailLang } from '@/lib/email/lang'
import {
  videoLiveRounds,
  videoLiveTemplateKey,
  isVotingOpen,
  formatVoteDeadline,
  type VideoLiveRound,
} from '@/lib/video-live'
import { getDisplayNames } from '@/lib/nickname'
import { isRehearsalFixture } from '@/lib/lobby'
import { sendSubmissionReceipts, type ReceiptTally } from '@/lib/email/submission-receipts'
import { loadScoredRanks, loadNextSeason } from '@/lib/email/finalist-report'
import { isMembershipEnabled } from '@/lib/membership'
import { getPlatformConfigMap } from '@/lib/partners'
import type { Season } from '@/lib/seasons'

const APP_URL = process.env.APP_URL ?? 'https://www.oxxovo.ai'
const VALID_INTERVALS = ['day', 'week', 'month', 'year']

// Force the handler to run at request time. Cron payloads have no useful
// cache, and a prerendered 'now' would silently ignore time-based triggers.
export const dynamic = 'force-dynamic'

// ★DECLARED, not inherited -- the same omission season-tick was caught on
// (app/api/cron/season-tick/route.ts:47). This route sends serially, one
// applicant at a time, and ⑥F adds a step whose batch is the whole released
// cohort rather than the finalist slice. On the platform default the tick would
// be killed part-way through a send loop; the killed sends are retryable (they
// leave no 'sent' row), but nothing would report the truncation. 300s is the Pro
// ceiling for the Node runtime and VIDEO_LIVE_MAX_PER_TICK is sized against it.
export const maxDuration = 300

type ApplicantRow = {
  id: string
  email: string
  creator_name: string
  country: string | null
  main_round_submitted_at: string | null
}

type BatchTally = { sent: number; skipped: number; failed: number; deferred: number }

type TickReport = {
  ok: true
  ranAt: string
  // ★Every tally carries `deferred`. It is the count this tick did not reach --
  // either the send budget ran out or Resend rate-limited -- and it is reported
  // rather than folded into `failed`, because the two need opposite responses:
  // a failure wants investigating, a deferral wants the next tick.
  mainRoundStart: ({ season: string } & BatchTally)[]
  submissionDeadline: ({ season: string; reminderHour: number } & BatchTally)[]
  resultsAnnounced: ({ season: string } & BatchTally)[]
  // Finalist advancement notices (SelectedTop50 + NotSelected), fired once a
  // season's scoring window has completed and season-tick has set the
  // selected/rejected statuses. Dedup-safe (canSend + executeSend).
  finalistResults: ({ season: string } & BatchTally)[]
  // ⑥F growth engine: "your film is live". `deferred` is how many eligible
  // entries this tick did NOT reach because of the per-tick cap -- reported
  // rather than swallowed, so a truncated run never reads as a complete one.
  videoLive: {
    season: string
    round: VideoLiveRound
    sent: number
    skipped: number
    failed: number
    deferred: number
  }[]
  // ⑤ submission receipts the immediate send missed. Empty on a healthy tick --
  // a non-empty entry here means the submit action's own send is failing.
  submissionReceipts: ({ season: string } & ReceiptTally)[]
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
  // ★ONE budget for the whole tick, not one per template. The 300s ceiling is
  // the invocation's, so five passes each convinced they had 240s of their own
  // would overrun exactly as before.
  const budget = makeTickBudget(now.getTime())

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
    finalistResults: [],
    videoLive: [],
    submissionReceipts: [],
  }

  for (const season of seasons) {
    if (
      season.main_round_start_at &&
      new Date(season.main_round_start_at) <= now
    ) {
      const result = await fireMainRoundStart(season, budget)
      report.mainRoundStart.push({ season: season.id, ...result })

      // ★The close this reminds people about must be the close that REFUSES them:
      // canSubmitMainRound reads main_round_end_at, so that column is the
      // authority here too. Deriving it again from submission_hours made a second
      // definition of one boundary -- they agree for season_0/season_1 today but
      // NOT for season_test (76 minutes apart), so an edited end date would have
      // sent "6 hours left" against an instant that was not the deadline. The
      // derivation stays only as the fallback for seasons whose end is not set
      // yet, which is how the column itself is computed at creation
      // (lib/season-schedule.ts).
      const submissionCloseAt = season.main_round_end_at
        ? new Date(season.main_round_end_at)
        : new Date(
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
          const result = await fireSubmissionDeadline(season, reminderHour, budget)
          report.submissionDeadline.push({
            season: season.id,
            reminderHour,
            ...result,
          })
        }
      }
    }

    // Finalist advancement notices: once scoring is complete, season-tick has
    // (or soon will) set selected/rejected statuses. Fire SelectedTop50 to the
    // Finalists and NotSelected to the rest. Before advancement runs there are
    // no selected/rejected rows yet, so this is a no-op until they exist; dedup
    // makes the eventual fire once-only.
    if (
      season.scoring_complete_at &&
      new Date(season.scoring_complete_at) <= now
    ) {
      const result = await fireFinalistResults(season, budget)
      report.finalistResults.push({ season: season.id, ...result })
    }

    if (
      season.awards_announcement_at &&
      new Date(season.awards_announcement_at) <= now
    ) {
      const result = await fireResultsAnnounced(season, budget)
      report.resultsAnnounced.push({ season: season.id, ...result })
    }

    // ⑥F. ★Rehearsal fixtures are excluded by the SAME predicate the lobby uses
    // (lib/lobby.isRehearsalFixture) -- season_test and the zz_ probes carry real
    // addresses, and a second definition of "is this a real competition" is how
    // one of them would eventually receive production mail.
    if (!isRehearsalFixture(season)) {
      for (const r of await fireVideoLive(season, now)) {
        report.videoLive.push({ season: season.id, ...r })
      }

      // ⑤ retry net. The receipt is sent by the submit action itself; this picks
      // up the ones that send did not manage -- a Resend outage, a function
      // killed mid-await, or a submission that reached the row through a path
      // nobody wired to the mailer. Same dedup, so it is a no-op otherwise.
      const receipts = await sendSubmissionReceipts({ season })
      if (receipts.sent || receipts.failed || receipts.deferred) {
        report.submissionReceipts.push({ season: season.id, ...receipts })
      }
    }
  }

  // P4e: membership renewal / founding-expiry notices. Gated on the membership
  // master switch so nothing fires in dark launch.
  if (await isMembershipEnabled()) {
    report.membershipNotices = await fireMembershipNotices(now)
  }

  return NextResponse.json(report)
}

// ── ⑥F "your film is live" ─────────────────────────────────────────────────
//
// ★No season-level time gate. The rule for "is this film watchable" is one
// predicate (lib/video-live.videoLiveRounds -> lib/watch-visibility.isRowPublic),
// and the email fires on exactly that -- not on prelim_released_at, which is only
// the usual CAUSE of it. The difference is two real cohorts: an entry still in the
// safety scan when the cohort was released (would have been mailed while
// invisible) and an entry whose scan cleared afterwards (would never have been
// mailed at all).
//
// Re-evaluating every row every 15 minutes is what makes that safe, so the cost
// of the steady state matters: one `email_logs` read per season replaces one
// `canSend` round trip per row per tick. canSend still runs for anything the
// read did not cover -- it owns failure backoff, and a row logged without a
// season_id is invisible to the bulk read.
const VIDEO_LIVE_MAX_PER_TICK = 120

type VideoLiveAppRow = {
  id: string
  email: string
  creator_name: string | null
  country: string | null
  user_id: string | null
  video_title: string | null
  thumbnail_url: string | null
  status: string
  watch_hidden: boolean | null
  watch_hold: boolean | null
  moderation_status: string | null
  free_entry_url: string | null
  main_round_video_url: string | null
}

type VideoLiveTally = { sent: number; skipped: number; failed: number; deferred: number }

async function fireVideoLive(season: Season, now: Date) {
  const supabase = createSupabaseAdmin()
  const votingOpen = isVotingOpen(season, now.getTime())

  const { data: rowsRaw, error } = await supabase
    .from('genesis_applications')
    .select(
      'id, email, creator_name, country, user_id, video_title, thumbnail_url, status, watch_hidden, watch_hold, moderation_status, free_entry_url, main_round_video_url',
    )
    .eq('season_id', season.id)
    .or('free_entry_url.not.is.null,main_round_video_url.not.is.null')
  if (error) {
    console.error('[cron] video_live entry load failed:', error.message)
    return []
  }
  const rows = (rowsRaw ?? []) as VideoLiveAppRow[]
  if (rows.length === 0) return []

  const { data: sentRaw } = await supabase
    .from('email_logs')
    .select('application_id, template_key')
    .eq('season_id', season.id)
    .in('template_key', ['video_live_prelim', 'video_live_main'])
    .eq('status', 'sent')
  const already = new Set(
    (sentRaw ?? []).map((r) => `${(r as { application_id: string }).application_id}:${(r as { template_key: string }).template_key}`),
  )

  const names = await getDisplayNames(rows.map((r) => r.user_id))

  // View counts only matter to the main-round template, and only while voting is
  // open -- skip the scan entirely otherwise.
  const views = new Map<string, number>()
  if (votingOpen) {
    const { data: viewRows } = await supabase
      .from('watch_views')
      .select('application_id')
      .eq('round', 'main')
    for (const v of (viewRows ?? []) as { application_id: string }[]) {
      views.set(v.application_id, (views.get(v.application_id) ?? 0) + 1)
    }
  }

  const tally: Record<VideoLiveRound, VideoLiveTally> = {
    application: { sent: 0, skipped: 0, failed: 0, deferred: 0 },
    main: { sent: 0, skipped: 0, failed: 0, deferred: 0 },
  }
  let budget = VIDEO_LIVE_MAX_PER_TICK

  for (const row of rows) {
    for (const round of videoLiveRounds(row, { votingOpen })) {
      const t = tally[round]
      const template = videoLiveTemplateKey(round)
      if (already.has(`${row.id}:${template}`)) {
        t.skipped++
        continue
      }

      const lang = detectEmailLang(row.country)
      // ★The main template is built around a countdown. If the end of the vote
      // window cannot be stated, the mail does not go -- see formatVoteDeadline
      // for why a dash is not an acceptable stand-in. Checked BEFORE the budget
      // so an unsendable row never consumes another row's slot.
      const voteDeadline =
        round === 'main' ? formatVoteDeadline(season.community_vote_end_at, now.getTime(), lang) : null
      if (round === 'main' && !voteDeadline) {
        t.skipped++
        continue
      }

      if (budget <= 0) {
        // Counted, not dropped: the next tick picks it up 15 minutes later, and
        // the report says how many are still waiting.
        t.deferred++
        continue
      }

      const verdict = await canSend(row.id, template)
      if (!verdict.ok) {
        t.skipped++
        continue
      }
      budget--

      const nickname =
        (row.user_id ? names.get(row.user_id) : undefined) ?? row.creator_name ?? row.email.split('@')[0]
      const common = {
        toEmail: row.email,
        country: row.country,
        creatorUserId: row.user_id,
        nickname,
        seasonName: season.display_name,
        // ★Untitled entries are resolved inside the sender, where the language is
        // known -- '제목 없음' / 'Untitled' (Jenny3). Passing the season name here
        // would give every untitled entry in the season one identical title.
        videoTitle: row.video_title?.trim() || null,
        thumbnailUrl: row.thumbnail_url,
        applicationId: row.id,
        seasonId: season.id,
        // Pinned so the deadline string above and the body cannot disagree about
        // which language they are in.
        forceLang: lang,
      }

      const result: SendResult =
        round === 'application'
          ? await sendVideoLivePrelim({
              ...common,
              // ★Empty ON PURPOSE. Under the canonical schedule the films go public
              // as they pass and judging runs for days afterwards, so there is no
              // score to hand over at this moment; the template drops its score and
              // critique blocks rather than printing dashes, and the scores reach
              // the creator in the separate prelim-result mail. The scored branch
              // stays reachable for a season that releases after judging.
              score: null,
              percentile: null,
              rank: null,
              aiStrength: '',
              aiImprove: '',
            })
          : await sendVideoLiveMain({
              ...common,
              voteDeadline: voteDeadline as string,
              viewCount: views.get(row.id) ?? 0,
            })

      if (!result.ok) t.failed++
      else if ('skipped' in result && result.skipped) t.skipped++
      else t.sent++
    }
  }

  const out: { round: VideoLiveRound; sent: number; skipped: number; failed: number; deferred: number }[] = []
  for (const round of ['application', 'main'] as VideoLiveRound[]) {
    const t = tally[round]
    if (t.sent || t.skipped || t.failed || t.deferred) out.push({ round, ...t })
    if (t.deferred > 0) {
      console.warn(
        `[cron] video_live ${round} for ${season.id}: ${t.deferred} eligible entries deferred to the next tick (cap ${VIDEO_LIVE_MAX_PER_TICK}).`,
      )
    }
  }
  return out
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

async function fireMainRoundStart(season: Season, budget: TickBudget): Promise<BatchTally> {
  const supabase = createSupabaseAdmin()
  const { data: rows, error } = await supabase
    .from('genesis_applications')
    .select('id, email, creator_name, country, main_round_submitted_at')
    .eq('season_id', season.id)
    .eq('status', 'selected')
  if (error) {
    console.error('[cron] main_round_start applicant load failed:', error.message)
    return { sent: 0, skipped: 0, failed: 1, deferred: 0 }
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
    budget,
  )
}

// ── submission_deadline ───────────────────────────────────────────────────

async function fireSubmissionDeadline(
  season: Season,
  reminderHour: number,
  budget: TickBudget,
): Promise<BatchTally> {
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
    return { sent: 0, skipped: 0, failed: 1, deferred: 0 }
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
    budget,
    reminderHour,
  )
}

// ── results_announced ─────────────────────────────────────────────────────

async function fireResultsAnnounced(season: Season, budget: TickBudget): Promise<BatchTally> {
  const supabase = createSupabaseAdmin()
  // Results go to the main-round cohort only: Finalists (selected /
  // main_round_submitted) and winners (awarded). Preliminary-round rejects
  // already received NotSelected at finalist advancement (step 5), so they are
  // intentionally excluded here -- no second, mismatched notice.
  const { data: rows, error } = await supabase
    .from('genesis_applications')
    .select('id, email, creator_name, country, main_round_submitted_at')
    .eq('season_id', season.id)
    .in('status', ['selected', 'main_round_submitted', 'awarded'])
  if (error) {
    console.error('[cron] results_announced applicant load failed:', error.message)
    return { sent: 0, skipped: 0, failed: 1, deferred: 0 }
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
    budget,
  )
}

// ── finalist results (SelectedTop50 + NotSelected) ────────────────────────
// Fired after season-tick advancement has set selected/rejected statuses.
// SelectedTop50 -> Finalists; NotSelected -> the rest of the scored pool.
// Each batch is dedup-safe (canSend + executeSend per applicationId+template).
async function fireFinalistResults(season: Season, budget: TickBudget): Promise<BatchTally> {
  const supabase = createSupabaseAdmin()

  // Season Report inputs (shared with the admin path via lib/email/finalist-
  // report): rank the scored pool + per-entry strengths/weaknesses, and resolve
  // the dynamic next-season CTA target.
  const rankMap = await loadScoredRanks(supabase, season.id)
  const total = rankMap.size
  const { name: nextSeasonName, openAt: nextSeasonOpenAt } = await loadNextSeason(supabase)

  const [selRes, rejRes] = await Promise.all([
    supabase
      .from('genesis_applications')
      .select('id, email, creator_name, country, main_round_submitted_at')
      .eq('season_id', season.id)
      .eq('status', 'selected'),
    supabase
      .from('genesis_applications')
      .select('id, email, creator_name, country, main_round_submitted_at')
      .eq('season_id', season.id)
      .eq('status', 'rejected'),
  ])
  if (selRes.error || rejRes.error) {
    console.error(
      '[cron] finalist_results applicant load failed:',
      selRes.error?.message ?? rejRes.error?.message,
    )
    return { sent: 0, skipped: 0, failed: 1, deferred: 0 }
  }

  const selected = await dispatchBatch(
    (selRes.data ?? []) as ApplicantRow[],
    'selected_top50',
    async (row) =>
      sendSelectedTop50({
        toEmail: row.email,
        country: row.country,
        creatorName: row.creator_name,
        seasonName: season.display_name,
        topNAdvance: season.top_n_advance,
        totalParticipants: total,
        mainRoundStartAt: season.main_round_start_at,
        applicationId: row.id,
        seasonId: season.id,
      }),
    budget,
  )
  const rejected = await dispatchBatch(
    (rejRes.data ?? []) as ApplicantRow[],
    'not_selected',
    async (row) => {
      const m = rankMap.get(row.id)
      return sendNotSelected({
        toEmail: row.email,
        country: row.country,
        creatorName: row.creator_name,
        seasonName: season.display_name,
        score: m?.score ?? 0,
        rank: m?.rank ?? total,
        total: m?.total ?? total,
        percentile: m?.percentile ?? 0,
        strength: m?.strength ?? '',
        improvement: m?.improvement ?? '',
        nextSeasonName,
        nextSeasonOpenAt,
        applicationId: row.id,
        seasonId: season.id,
      })
    },
    budget,
  )

  return {
    sent: selected.sent + rejected.sent,
    skipped: selected.skipped + rejected.skipped,
    failed: selected.failed + rejected.failed,
    deferred: selected.deferred + rejected.deferred,
  }
}

// ── shared dispatcher ─────────────────────────────────────────────────────

type TemplateName =
  | 'selected_top50'
  | 'not_selected'
  | 'main_round_start'
  | 'submission_deadline'
  | 'results_announced'

async function dispatchBatch(
  rows: ApplicantRow[],
  template: TemplateName,
  send: (row: ApplicantRow) => Promise<SendResult>,
  budget: TickBudget,
  reminderHour?: number,
): Promise<BatchTally> {
  let sent = 0
  let skipped = 0
  let failed = 0
  let deferred = 0

  for (const [i, row] of rows.entries()) {
    // ★Stop on the budget BEFORE spending, and count the rest rather than
    // dropping them. Being killed by maxDuration mid-loop is already survivable
    // -- an unsent row leaves no 'sent' log and the next tick picks it up -- but
    // it is survivable SILENTLY, and "450 sent" and "270 sent, 180 still owed"
    // look identical in a report that only counts what happened.
    if (!budgetAllows(budget)) {
      deferred = rows.length - i
      console.warn(
        `[cron] ${template}: tick budget spent — ${sent} sent, ${deferred} deferred to the next tick ` +
          `(${budget.attempts} sends averaged ${Math.round(budget.avgMs)}ms)`,
      )
      break
    }

    const startedMs = Date.now()
    const verdict = await canSend(row.id, template, reminderHour)
    if (!verdict.ok) {
      skipped++
      // A skip is two orders of magnitude cheaper than a send, so it must not
      // drag the average down and talk the budget into one more real send.
      continue
    }
    const result = await send(row)
    budgetRecord(budget, Date.now() - startedMs)

    if (!result.ok) {
      if (result.deferred) deferred++
      else failed++
    } else if ('skipped' in result && result.skipped) skipped++
    else sent++
  }

  return { sent, skipped, failed, deferred }
}
