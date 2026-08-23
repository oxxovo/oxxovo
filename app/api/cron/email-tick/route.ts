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
  sendApplicationDeadline,
  sendVoteDeadline,
  sendDeferralNotice,
  sendResultsAnnounced,
  type ResultsPlacement,
  sendMembershipRenewal,
  sendMembershipFoundingExpiry,
  sendVideoLivePrelim,
  sendVideoLiveMain,
  type SendResult,
} from '@/lib/email/send'
import { detectEmailLang } from '@/lib/email/lang'
import { canSendMarketingEmail } from '@/lib/email/consent'
import {
  videoLiveRounds,
  videoLiveTemplateKey,
  isVotingOpen,
  formatVoteDeadline,
  type VideoLiveRound,
} from '@/lib/video-live'
import { getDisplayNames } from '@/lib/nickname'
import { isFixtureSeason } from '@/lib/lobby'
import { sendSubmissionReceipts, type ReceiptTally } from '@/lib/email/submission-receipts'
import { loadScoredRanks, loadNextSeason } from '@/lib/email/finalist-report'
import { isMembershipEnabled } from '@/lib/membership'
import { getPlatformConfigMap } from '@/lib/partners'
import {
  computeSubmissionCloseAt,
  deadlineReminderFireTimes,
  applicationDeadlineReminderFireTimes,
  type Season,
} from '@/lib/seasons'

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
  // Optional -- only fireResultsAnnounced selects/reads this (item 2, #15
  // placement split). Every other caller leaves it undefined.
  award_rank?: number | null
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
  // HQ 2026-08-22: D-7/3/1/6h before application_close_at (the VIDEO
  // submission hard-cut), to registrants who have not yet submitted their
  // prelim video. Replaces the old registrationCount notice (D-14/7/3/1
  // before registration_close_at, retired -- the registration cutoff itself
  // is not announced by email any more, the Watch countdown covers it).
  applicationDeadline: ({ season: string; reminderHour: number } & BatchTally)[]
  // HQ 2026-08-22, item 3 (#13): ONE fire, 24h before community_vote_end_at.
  // Two independent tallies -- participant (application-scoped dedup) and
  // member (email_logs-scoped dedup, no applicationId) -- see
  // fireVoteDeadlineParticipants/fireVoteDeadlineMembers.
  voteDeadline: ({ season: string; audience: string } & BatchTally)[]
  // HQ 2026-08-12: fired once per application_defer_count value when
  // defer_season_schedule has actually shifted the calendar -- detected here
  // (not signaled by season-tick) by simply re-checking every season's
  // current defer_count every tick; dedup makes repeats a no-op and a NEW
  // defer_count naturally fires again.
  deferralNotice: ({ season: string; deferCount: number } & BatchTally)[]
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
    applicationDeadline: [],
    voteDeadline: [],
    deferralNotice: [],
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
      // computeSubmissionCloseAt/deadlineReminderFireTimes are shared with the
      // admin edit form's live preview (lib/seasons.ts) -- one definition of
      // this boundary, not a second hand-copy that can drift from it.
      const submissionCloseAt = computeSubmissionCloseAt(season)
      const reminderHours = Array.isArray(season.deadline_reminder_hours)
        ? (season.deadline_reminder_hours as number[])
        : []
      if (submissionCloseAt) {
        for (const { n: reminderHour, fireAt } of deadlineReminderFireTimes(season, reminderHours)) {
          if (fireAt && fireAt <= now && now < submissionCloseAt) {
            const result = await fireSubmissionDeadline(season, reminderHour, budget)
            report.submissionDeadline.push({
              season: season.id,
              reminderHour,
              ...result,
            })
          }
        }
      }
    }

    // Application (prelim video) deadline notice (HQ 2026-08-22): D-7/3/1/6h
    // before application_close_at -- the VIDEO submission hard-cut, not
    // registration_close_at (that clock is retired, see below). Recomputed
    // from application_close_at fresh every tick, same pattern as
    // submissionDeadline above -- if defer_season_schedule pushes
    // application_close_at out, these fire times move with it automatically
    // (back-calculated, not stored absolute instants). Recipients = only
    // people who registered for this season (HQ: "신청한 사람만") and have
    // not yet submitted their prelim video.
    //
    // Retired the same tick this replaced (HQ 2026-08-12 registration_count,
    // D-14/7/3/1 before registration_close_at): TK's call, 2026-08-22 -- the
    // registration deadline itself is never announced by email, the Watch
    // countdown covers it. fireRegistrationCount/sendRegistrationCount stay
    // defined (lib/email/send.tsx, RegistrationCount.tsx) but nothing calls
    // them any more.
    if (season.application_close_at && !isFixtureSeason(season)) {
      const applicationCloseAt = new Date(season.application_close_at)
      const reminderHours = Array.isArray(season.application_deadline_reminder_hours)
        ? (season.application_deadline_reminder_hours as number[])
        : []
      for (const { n: reminderHour, fireAt } of applicationDeadlineReminderFireTimes(
        season.application_close_at,
        reminderHours,
      )) {
        if (fireAt && fireAt <= now && now < applicationCloseAt) {
          const result = await fireApplicationDeadline(season, reminderHour, budget)
          report.applicationDeadline.push({
            season: season.id,
            reminderHour,
            ...result,
          })
        }
      }
    }

    // Vote deadline (HQ 2026-08-22, item 3 / #13): ONE fire, 24h before
    // community_vote_end_at -- HQ's canonical spec, not a season-configurable
    // hours array like deadline_reminder_hours/application_deadline_reminder_
    // hours above (those are genuinely per-season tunable; this offset is
    // fixed by the spec itself). Plain elapsed-time subtraction is correct
    // here (unlike the day-scale application_deadline case) -- 24h never
    // crosses a DST calendar-day boundary the way N*24h-as-days does.
    if (season.community_vote_end_at && !isFixtureSeason(season)) {
      const voteEndAt = new Date(season.community_vote_end_at)
      const voteDeadlineAt = new Date(voteEndAt.getTime() - 24 * 3_600_000)
      if (voteDeadlineAt <= now && now < voteEndAt) {
        const participantResult = await fireVoteDeadlineParticipants(season, budget)
        report.voteDeadline.push({ season: season.id, audience: 'participant', ...participantResult })
        const memberResult = await fireVoteDeadlineMembers(season, budget)
        report.voteDeadline.push({ season: season.id, audience: 'member', ...memberResult })
      }
    }

    // Deferral notice (HQ 2026-08-12): defer_season_schedule (season-tick)
    // shifted the calendar -- someone has to tell the people who registered,
    // or "registration reopened" is invisible to everyone but an admin
    // reading sendAdminAlert's inbox. Detected here, not signaled by
    // season-tick: every season with application_defer_count > 0 fires every
    // tick, and canSend's per-defer_count dedup makes every tick after the
    // first a no-op for that defer_count -- a LATER defer (count goes 1 -> 2)
    // naturally fires again because the variant changed. Fixture-excluded
    // for the same reason every other participant-facing send here is.
    if (season.application_defer_count > 0 && !isFixtureSeason(season)) {
      const result = await fireDeferralNotice(season, season.application_defer_count, budget)
      report.deferralNotice.push({
        season: season.id,
        deferCount: season.application_defer_count,
        ...result,
      })
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
    // (lib/lobby.isFixtureSeason) -- season_test and the zz_ probes carry real
    // addresses, and a second definition of "is this a real competition" is how
    // one of them would eventually receive production mail.
    //
    // ★2026-08-09: that sentence stopped being true for a few hours and this is
    // the repair. The lobby moved to the is_fixture COLUMN and this line was
    // still asking the id/number heuristic -- so the two definitions had in fact
    // split, exactly as the sentence above warns. The column was already on this
    // row: the tick reads the base table with select('*'), so it was fetched and
    // then ignored.
    //
    // ★WHY THIS DIRECTION IS NOT A TRADE. The heuristic can only be wrong by
    // clearing a rehearsal (a season numbered below 900 with an unconventional
    // id), which sends real mail to test addresses and cannot be taken back. The
    // column can only be wrong by holding a real season's mail, which is visible
    // and fixable -- and it is now hard to reach at all: /admin/seasons requires
    // the answer, season-tick's clone inherits it, host/new writes it. The
    // heuristic remains as isFixtureSeason's fallback for a read that did not
    // carry the column, which this one always does.
    if (!isFixtureSeason(season)) {
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

// ── application_deadline ──────────────────────────────────────────────────
// HQ 2026-08-22, replaces the old registration_count notice below it in
// history. Recipients = registrants for this season (genesis_applications
// row exists) who have NOT yet submitted their prelim video -- mirrors
// fireSubmissionDeadline's `.is('main_round_submitted_at', null)' one round
// earlier. The status filter (same list registration_count used) excludes
// rows already past the prelim phase (selected/rejected/etc.) -- a "finish
// your video" nudge makes no sense once the season has moved the applicant
// on. studio_application_submitted_at is the second, belt-and-suspenders
// guard: none of those statuses should already have a submission, but
// checking directly costs nothing and a nag-after-submit email is exactly
// the failure this function exists to avoid causing.
async function fireApplicationDeadline(
  season: Season,
  reminderHour: number,
  budget: TickBudget,
): Promise<BatchTally> {
  const supabase = createSupabaseAdmin()
  const { data: rows, error } = await supabase
    .from('genesis_applications')
    .select('id, email, creator_name, country, main_round_submitted_at')
    .eq('season_id', season.id)
    .in('status', ['pending', 'waitlist', 'verifying', 'flagged', 'eligible'])
    .is('studio_application_submitted_at', null)
  if (error) {
    console.error('[cron] application_deadline applicant load failed:', error.message)
    return { sent: 0, skipped: 0, failed: 1, deferred: 0 }
  }

  return await dispatchBatch(
    (rows ?? []) as ApplicantRow[],
    'application_deadline',
    async (row) =>
      sendApplicationDeadline({
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

// ── vote_deadline ─────────────────────────────────────────────────────────
// HQ 2026-08-22, item 3 (#13). Two audiences, two functions -- they need
// different recipient sources AND different dedup strategies (see the
// log.ts comment on 'vote_deadline' and sendVoteDeadline's header comment).

// Participant = main-round entrants ("마지막 동원 기회", HQ) -- application-
// scoped, so this reuses dispatchBatch's normal per-applicationId dedup
// exactly like every other multi-recipient sender in this file.
async function fireVoteDeadlineParticipants(
  season: Season,
  budget: TickBudget,
): Promise<BatchTally> {
  const supabase = createSupabaseAdmin()
  const { data: rows, error } = await supabase
    .from('genesis_applications')
    .select('id, email, creator_name, country, main_round_submitted_at')
    .eq('season_id', season.id)
    .in('status', ['selected', 'main_round_submitted', 'awarded'])
  if (error) {
    console.error('[cron] vote_deadline (participant) applicant load failed:', error.message)
    return { sent: 0, skipped: 0, failed: 1, deferred: 0 }
  }

  return await dispatchBatch(
    (rows ?? []) as ApplicantRow[],
    'vote_deadline',
    async (row) =>
      sendVoteDeadline({
        toEmail: row.email,
        country: row.country,
        name: row.creator_name,
        seasonName: season.display_name,
        audience: 'participant',
        videoUrl: `${APP_URL}/watch/${row.id}?round=main`,
        applicationId: row.id,
        seasonId: season.id,
      }),
    budget,
  )
}

// Member = any opted-in site member ("아직 안 했으면 지금", HQ) -- NOT
// application-scoped, so dispatchBatch's canSend(applicationId, ...) path
// cannot dedup it (no applicationId to key off). Same shape admin_broadcast
// uses (lib/email/broadcast-tick.ts) for the identical reason: query
// email_logs directly by (season_id, template_key, metadata->>audience,
// to_email) to build the "already got this" set, then filter candidates
// against it by hand. Consent gate: canSendMarketingEmail() (lib/email/
// consent.ts) -- its own header comment requires every future broadcast-
// style sender to filter through it, this is that.
async function fireVoteDeadlineMembers(season: Season, budget: TickBudget): Promise<BatchTally> {
  const supabase = createSupabaseAdmin()
  const { data: profileRows, error } = await supabase
    .from('profiles')
    .select('email, display_name, country, email_opt_in, email_opt_out_at')
    .eq('email_opt_in', true)
    .is('email_opt_out_at', null)
  if (error) {
    console.error('[cron] vote_deadline (member) profile load failed:', error.message)
    return { sent: 0, skipped: 0, failed: 1, deferred: 0 }
  }

  const { data: doneRows, error: doneErr } = await supabase
    .from('email_logs')
    .select('to_email')
    .eq('season_id', season.id)
    .eq('template_key', 'vote_deadline')
    .eq('metadata->>audience', 'member')
    .eq('status', 'sent')
  if (doneErr) {
    console.error('[cron] vote_deadline (member) dedup load failed:', doneErr.message)
    return { sent: 0, skipped: 0, failed: 1, deferred: 0 }
  }
  const alreadySent = new Set(
    ((doneRows ?? []) as { to_email: string }[]).map((r) => r.to_email.trim().toLowerCase()),
  )

  type MemberRow = {
    email: string
    display_name: string | null
    country: string | null
    email_opt_in: boolean | null
    email_opt_out_at: string | null
  }
  const candidates = ((profileRows ?? []) as MemberRow[])
    .filter((p) => canSendMarketingEmail(p))
    .filter((p) => !alreadySent.has(p.email.trim().toLowerCase()))

  let sent = 0
  // Consent/dedup filtering already happened above via .filter() -- nothing
  // in this loop produces a 'skipped' outcome, unlike dispatchBatch's
  // canSend() path (which does). Always 0, kept in the tally shape for
  // symmetry with the participant side.
  const skipped = 0
  let failed = 0
  let deferred = 0
  for (const [i, p] of candidates.entries()) {
    if (!budgetAllows(budget)) {
      deferred = candidates.length - i
      console.warn(
        `[cron] vote_deadline (member): tick budget spent — ${sent} sent, ${deferred} deferred to the next tick`,
      )
      break
    }
    const t0 = Date.now()
    const result = await sendVoteDeadline({
      toEmail: p.email,
      country: p.country,
      // Placeholder fallback -- real copy (and whether a blank/generic name
      // is even acceptable here) is 제니3's call, not decided by this wiring.
      name: p.display_name ?? '',
      seasonName: season.display_name,
      audience: 'member',
      videoUrl: null,
      seasonId: season.id,
    })
    budgetRecord(budget, Date.now() - t0)
    if (result.ok) sent++
    else if (result.deferred) deferred++
    else failed++
  }
  return { sent, skipped, failed, deferred }
}

// ── deferral_notice ───────────────────────────────────────────────────────

async function fireDeferralNotice(
  season: Season,
  deferCount: number,
  budget: TickBudget,
): Promise<BatchTally> {
  const supabase = createSupabaseAdmin()
  // Same recipient definition as registration_count -- registrants of this
  // season (waitlist included), excluding rows already past the application
  // phase.
  const { data: rows, error } = await supabase
    .from('genesis_applications')
    .select('id, email, creator_name, country, main_round_submitted_at')
    .eq('season_id', season.id)
    .in('status', ['pending', 'waitlist', 'verifying', 'flagged', 'eligible'])
  if (error) {
    console.error('[cron] deferral_notice applicant load failed:', error.message)
    return { sent: 0, skipped: 0, failed: 1, deferred: 0 }
  }

  return await dispatchBatch(
    (rows ?? []) as ApplicantRow[],
    'deferral_notice',
    async (row) =>
      sendDeferralNotice({
        toEmail: row.email,
        country: row.country,
        creatorName: row.creator_name,
        seasonName: season.display_name,
        deferCount,
        maxDeferCount: season.max_defer_count,
        newRegistrationCloseAt: season.registration_close_at,
        newApplicationCloseAt: season.application_close_at,
        applicationId: row.id,
        seasonId: season.id,
      }),
    budget,
    deferCount,
  )
}

// ── results_announced ─────────────────────────────────────────────────────

// HQ 2026-08-22, item 2 (#15): which of the 4 email variants a main-round
// finisher gets. Pure so it's independently testable -- award_rank is the
// only input that matters (1/2/3 -> that rank; anything else, including
// null or an out-of-range value, folds into 'main_no_award' rather than
// throwing, since a stray rank value must never crash the whole tick).
function resultsPlacementFor(awardRank: number | null | undefined): ResultsPlacement {
  if (awardRank === 1) return 'rank1'
  if (awardRank === 2) return 'rank2'
  if (awardRank === 3) return 'rank3'
  return 'main_no_award'
}

async function fireResultsAnnounced(season: Season, budget: TickBudget): Promise<BatchTally> {
  const supabase = createSupabaseAdmin()
  // Results go to the main-round cohort only: Finalists (selected /
  // main_round_submitted) and winners (awarded). Preliminary-round rejects
  // already received NotSelected at finalist advancement (step 5), so they are
  // intentionally excluded here -- no second, mismatched notice. That is
  // deliberately UNCHANGED by the item-2 placement split below: HQ named
  // "예선 미진출" as one of 5 outcome categories, but a second "results are
  // live" email to someone who was told they didn't advance weeks earlier
  // would contradict, not complete, that earlier notice -- flagged back to
  // HQ rather than silently added.
  const { data: rows, error } = await supabase
    .from('genesis_applications')
    .select('id, email, creator_name, country, main_round_submitted_at, award_rank')
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
        placement: resultsPlacementFor(row.award_rank),
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

  // ★Big cohort first: the shared tick budget is spent in call order, so
  // whichever of these runs second is the one that can defer. Rejected is
  // deferred to the next tick, not lost -- HQ-accepted (2026-08-10).
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
  const selected = await dispatchBatch(
    (selRes.data ?? []) as ApplicantRow[],
    'selected_top50',
    async (row) => {
      // HQ 2026-08-22, item 1 (#7): same rankMap lookup the rejected branch
      // above already used -- every scored applicant is in it regardless of
      // outcome, so this was always available and simply wasn't read here.
      const m = rankMap.get(row.id)
      return sendSelectedTop50({
        toEmail: row.email,
        country: row.country,
        creatorName: row.creator_name,
        seasonName: season.display_name,
        topNAdvance: season.top_n_advance,
        totalParticipants: total,
        mainRoundStartAt: season.main_round_start_at,
        score: m?.score ?? 0,
        rank: m?.rank ?? total,
        percentile: m?.percentile ?? 0,
        strength: m?.strength ?? '',
        improvement: m?.improvement ?? '',
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
  | 'application_deadline'
  | 'vote_deadline'
  | 'deferral_notice'
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
