import { DateTime } from 'luxon'
import type { Season } from './seasons'

// All season scheduling is anchored to Las Vegas wall-clock time. Storing the
// zone here (not UTC) is the whole point: a Monday 00:00 PT anchor stays Monday
// 00:00 across the spring/autumn DST switches, and Luxon resolves it to the
// correct UTC instant each time. Never hardcode UTC-7/UTC-8 — see
// [[feedback-vercel-cron-limits]] / [[project-weekly-season-system]].
export const SEASON_ZONE = 'America/Los_Angeles'

// Every auto-created season inherits the SAME community-vote weight, read by the
// cron from platform_config.default_community_vote_weight (0.7) and passed in
// here — there is deliberately NO per-season branching. Only season_0, the
// hand-seeded bootstrap row, carries a different weight (0), and that lives
// purely as a data value on that one row; the cron never creates season_0, so it
// never has to special-case it. ai_score_weight is derived as 1 - community so
// the pair always sums to 1.0 (the seasonSchema invariant). If the policy ever
// changes, edit the platform_config value, not this code. See
// [[feedback-no-hardcode]] / [[project-final-score-design]].
export type SeasonSchedule = {
  application_open_at: string
  application_close_at: string
  scoring_start_at: string
  scoring_complete_at: string
  main_round_start_at: string
  main_round_end_at: string
  awards_announcement_at: string
}

// Given a season's opening Monday (00:00 PT, week 1) as a zoned DateTime, derive
// every downstream timestamp as a wall-clock offset *within the zone*, then
// convert each to a UTC ISO string for storage. Computing the offsets in-zone is
// what makes the result DST-correct: `.plus({ days })` followed by `.set({ hour })`
// always lands on the intended Las Vegas wall-clock time regardless of a DST
// boundary falling inside the window.
//
// Timeline (PT):
//   week1 Mon 00:00  application opens          (anchor)
//   week1 Sun 23:59  application closes / scoring starts
//   week2 Mon 00:00  scoring complete (Top N finalized)
//   week2 Wed 21:00  main round starts
//   week2 Wed 21:00 + submission_hours  main round ends (48h default -> Fri 21:00)
//   week3 Mon 21:00  awards announced
export function computeSeasonSchedule(
  openMondayPT: DateTime,
  submissionHours: number,
): SeasonSchedule {
  const open = openMondayPT.set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
  const close = open
    .plus({ days: 6 })
    .set({ hour: 23, minute: 59, second: 0, millisecond: 0 })
  const scoringComplete = open.plus({ weeks: 1 })
  const mainStart = open
    .plus({ weeks: 1, days: 2 })
    .set({ hour: 21, minute: 0, second: 0, millisecond: 0 })
  // Tie the end to the season's submission_hours param, not a fixed weekday, so
  // the window stays correct if a future season changes its duration.
  const mainEnd = mainStart.plus({ hours: submissionHours })
  const awards = open
    .plus({ weeks: 2 })
    .set({ hour: 21, minute: 0, second: 0, millisecond: 0 })

  const toIso = (dt: DateTime): string => {
    const iso = dt.toUTC().toISO()
    if (!iso) throw new Error('computeSeasonSchedule: produced an invalid DateTime')
    return iso
  }

  return {
    application_open_at: toIso(open),
    application_close_at: toIso(close),
    // Scoring begins the moment applications close.
    scoring_start_at: toIso(close),
    scoring_complete_at: toIso(scoringComplete),
    main_round_start_at: toIso(mainStart),
    main_round_end_at: toIso(mainEnd),
    awards_announcement_at: toIso(awards),
  }
}

// The opening Monday of the season that follows `prevOpenIso`, expressed in PT.
// Adding a calendar week in-zone (not 168 hours) keeps it pinned to Monday 00:00
// PT across DST switches.
export function nextOpenMondayPT(prevOpenIso: string): DateTime {
  const prev = DateTime.fromISO(prevOpenIso, { zone: SEASON_ZONE })
  if (!prev.isValid) {
    throw new Error(`nextOpenMondayPT: invalid prev application_open_at: ${prevOpenIso}`)
  }
  return prev.plus({ weeks: 1 }).set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
}

// Columns that must never be copied from the previous season when cloning:
// generated columns (Postgres computes prize_first/second/third from the pct +
// pool), identity/audit columns (the DB owns these), and everything we override
// explicitly below.
const NON_CLONED_KEYS = [
  'id',
  'season_number',
  'status',
  'prize_first',
  'prize_second',
  'prize_third',
  'created_at',
  'updated_at',
  'name',
  'display_name',
  'main_round_theme',
  'application_open_at',
  'application_close_at',
  'scoring_start_at',
  'scoring_complete_at',
  'main_round_start_at',
  'main_round_end_at',
  // The per-season deferral counter must never be copied from the previous
  // season: application_defer_count is runtime state that must reset to 0 for a
  // fresh season.
  'application_defer_count',
  'awards_announcement_at',
  'ai_score_weight',
  'community_vote_weight',
] as const

export type NewSeasonRow = Record<string, unknown>

// Build the INSERT payload for the season after `prev`: clone every operational
// parameter (capacity, prizes, video specs, AI models, sub-weights, thresholds,
// allowed platforms, ...), then override identity, status, schedule, and the
// vote weights. `communityVoteWeight` is supplied by the caller from
// platform_config (never hardcoded here); ai_score_weight is derived so the pair
// sums to 1.0. The result is written by the cron with the admin client, so it
// bypasses the admin-form Zod schema — `id` is set deterministically to
// `season_<n>` to make creation idempotent via the primary key.
export function buildNextSeasonRow(prev: Season, communityVoteWeight: number): NewSeasonRow {
  if (!Number.isFinite(communityVoteWeight) || communityVoteWeight < 0 || communityVoteWeight > 1) {
    throw new Error(`buildNextSeasonRow: invalid communityVoteWeight: ${communityVoteWeight}`)
  }
  const seasonNumber = prev.season_number + 1
  const id = `season_${seasonNumber}`

  const openMonday = nextOpenMondayPT(prev.application_open_at ?? '')
  const schedule = computeSeasonSchedule(openMonday, prev.submission_hours)
  // Round to 4 decimals to avoid 1 - 0.7 = 0.30000000000000004 floating drift.
  const ai_score_weight = Math.round((1 - communityVoteWeight) * 10000) / 10000

  const clone: Record<string, unknown> = { ...(prev as unknown as Record<string, unknown>) }
  for (const key of NON_CLONED_KEYS) delete clone[key]

  return {
    ...clone,
    id,
    season_number: seasonNumber,
    // Created ahead of time so an admin has a lead week to set a real codename
    // and the main-round theme; the status cron flips it to 'active' at open.
    status: 'draft',
    // Placeholder identity — overrideable in /admin/seasons before it opens.
    name: `SEASON_${seasonNumber}`,
    display_name: `OXXOVO Season ${seasonNumber}`,
    // Theme is set per-season by an admin before the main round; never inherited.
    main_round_theme: null,
    community_vote_weight: communityVoteWeight,
    ai_score_weight,
    ...schedule,
  }
}
