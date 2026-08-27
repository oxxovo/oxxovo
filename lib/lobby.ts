// Tournament lobby data + SERVER-AUTHORITATIVE status. The home page is a client
// component, so it calls loadLobbyTournaments() (a server action) which derives
// each card's mode here on the server from the schedule. The client only ticks
// the countdown to the provided target -- it never computes the mode itself.
//
// v1: official seasons only (host_type null/'official'), publicly visible
// (not draft), ordered lobby_featured first then by nearest deadline. Reads the
// anon-readable seasons_public view (secret twist excluded) -- same source as
// getCurrentSeason.

import { supabase } from './supabase'
import { getSeasonPhase, toLobbyMode, type SeasonPhase } from './season-phase'
import { isFixtureSeason } from './season-fixture'

export type LobbyMode = 'upcoming' | 'accepting' | 'live' | 'ended'

export type LobbyCard = {
  id: string
  displayName: string
  theme: string | null
  posterUrl: string | null
  prizePool: number
  prizeFirst: number
  mode: LobbyMode
  // The next scheduled public moment, or null when none is ahead. See
  // countdownTarget -- this is NOT keyed on the mode any more.
  countdownTargetIso: string | null
  /**
   * ★Which boundary countdownTargetIso is, so the label can be true. 'live'
   * alone cannot say it: inside that one mode the target moves from the
   * main-round deadline to the vote opening to the vote closing to the awards.
   * null exactly when countdownTargetIso is null. Wording is not decided here.
   */
  countdownTargetKind: CountdownKind | null
  lobbyFeatured: boolean
  /**
   * ★C-4 seam. `mode` collapses main_live / voting / awaiting_results into one
   * 'live', so a card cannot tell "voting is open" from "voting closed, waiting
   * on the podium" -- and the badge and countdown label need that distinction.
   * The phase is carried so the copy can be written against it. Wording is not
   * decided here.
   *
   * ★Caveat for whoever writes that copy: finalistCount is not fetched (it
   * cannot change the mode or the target), so this never reports
   * 'finalists_pending' -- that interval arrives as 'judging'.
   */
  phase: SeasonPhase
}

// ─── badge copy, shared by LobbySection.tsx (home) and tournament/page.tsx
// (gallery) ───────────────────────────────────────────────────────────────
//
// ★Consolidated 2026-08-23 (Jenny3): these were two literal copies, one per
// file. PHASE_BADGE already drifted once -- a KR label patch landed on
// LobbySection.tsx first and tournament/page.tsx kept the stale English text
// until a second pass caught it. MODE_BADGE was still English-only in both
// when this moved, but the same drift is coming: COMING SOON/OPEN/LIVE/ENDED
// are public copy on both surfaces and are next in line for KR text. Fixing
// it here once, before that lands, means there is no second copy left to miss.
export const MODE_BADGE: Record<LobbyMode, { label: string; cls: string }> = {
  upcoming: { label: 'COMING SOON', cls: 'bg-white/10 text-white/70 border-white/20' },
  accepting: { label: 'OPEN', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
  live: { label: 'LIVE', cls: 'bg-[#ff4444]/20 text-[#ff8888] border-[#ff4444]/50' },
  ended: { label: 'ENDED', cls: 'bg-white/5 text-white/40 border-white/10' },
}

// ★C-4 (Jenny3, 2026-08-10). `mode` still collapses main_live / voting /
// awaiting_results into one 'live' -- this only overrides the badge for the
// two sub-phases that have their own copy; every other 'live' phase falls
// through to MODE_BADGE.live.
export const PHASE_BADGE: Partial<Record<LobbyCard['phase'], { label: string; cls: string }>> = {
  voting: { label: '관객 투표 중', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
  awaiting_results: { label: '최종 집계 중', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
}

type SeasonRow = {
  id: string
  name: string
  display_name: string | null
  season_number: number
  status: string
  season_theme: string | null
  poster_url: string | null
  lobby_featured: boolean | null
  host_type: string | null
  total_prize_pool: number | null
  prize_first: number | null
  application_open_at: string | null
  application_close_at: string | null
  main_round_start_at: string | null
  main_round_end_at: string | null
  // Added for C-2: the canonical machine needs the vote window to tell 'voting'
  // from 'main_live' and 'awaiting_results'. The old date rule never looked.
  community_vote_start_at: string | null
  community_vote_end_at: string | null
  awards_announcement_at: string | null
  // ★C-2: the fixture flag, read through seasons_public since the view was
  // redefined to 68 columns on 2026-08-09.
  //
  // ★OPTIONAL, matching lib/seasons.ts Season. Not laziness about the fixtures:
  // getLobbyTournaments' own select names it, so on that path it is always
  // there, but SeasonRow is also the parameter type of the exported
  // seasonToLobbyCard, which /tournament calls with a row it fetched for its own
  // reasons. Requiring it would force a caller that does not need it to invent a
  // value -- and an invented `false` on this column publishes a rehearsal.
  // `undefined` says "this read did not carry it" and isFixtureSeason then falls
  // back rather than guessing.
  is_fixture?: boolean | null
}

function ms(v: string | null): number | null {
  if (!v) return null
  const t = new Date(v).getTime()
  return Number.isNaN(t) ? null : t
}

// ─── winner evidence (C-1) ──────────────────────────────────────────────────
//
// ★WHY THE LOBBY HAS TO COUNT SOMETHING. getSeasonPhase reaches 'results' only
// with winnerCount > 0, because awards_announcement_at passing is not the same
// event as a podium being approved (award_rank is written by approveTop3Awards,
// a manual admin action). getBannerStage already applies that honesty rule on
// Watch; the lobby card does not, and closing that gap needs the count.
//
// ★finalistCount is deliberately NOT fetched. 'finalists_pending', 'judging' and
// 'main_live' all fold to 'live' in toLobbyMode, so it cannot change a card. One
// query, not two, and the reason is written down rather than rediscovered.

/** Tally award_rank rows per season. Pure, so the shape is testable without a DB. */
export function tallyWinnerCounts(rows: { season_id: string | null }[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    if (!r.season_id) continue
    out[r.season_id] = (out[r.season_id] ?? 0) + 1
  }
  return out
}

/**
 * How many entries carry an award_rank, per season. ONE batched query -- the
 * lobby renders 14 seasons today (measured 2026-08-07) and a per-card query
 * would be 14 round trips on the home page.
 *
 * ★service_role, and only for this. genesis_applications is not anon-readable,
 * while the season rows above come from the anon-readable seasons_public view --
 * and reading seasons_public WITH service_role fails 42501, so the two halves
 * genuinely need different clients. The admin import is lazy for the reason the
 * watch-hold release path documents: a top-level server-only import kills every
 * CLI harness that loads this module.
 *
 * ★Fails to an EMPTY map, deliberately, and says so loudly. No evidence of
 * winners is not evidence of winners -- the same rule getSeasonPhase applies to
 * a null boundary. The visible consequence of a failed query is a card that has
 * not announced a result yet, never a card that announces one.
 */
export async function fetchWinnerCounts(seasonIds: string[]): Promise<Record<string, number>> {
  if (seasonIds.length === 0) return {}
  try {
    const { createSupabaseAdmin } = await import('./supabase-admin')
    const { data, error } = await createSupabaseAdmin()
      .from('genesis_applications')
      .select('season_id')
      .not('award_rank', 'is', null)
      .in('season_id', seasonIds)
    if (error) {
      console.error('[lobby] winner count query failed:', error.message)
      return {}
    }
    return tallyWinnerCounts((data ?? []) as { season_id: string | null }[])
  } catch (e) {
    console.error('[lobby] winner count unavailable:', e instanceof Error ? e.message : String(e))
    return {}
  }
}

// ─── C-2: the lobby stops deciding, and reads the canonical machine ─────────
//
// ★WHAT WAS WRONG. The old rule ended a season at `main_round_end_at ?? awards`.
// For season_0 that is 2026-11-12 00:00 PST, while the earliest honest end is
// 2026-11-16 20:00 PST -- 116 hours, 4 days 20 hours, during which the home card
// read ENDED and greyed itself out while the main-round films were showing and
// community voting was open. And that is the FLOOR: 'ended' now also needs an
// approved podium, so a late award_rank used to be invisible here and is not.
//
// Two behaviour changes ride along, both deliberate:
//   1. status='completed' with zero winners is no longer 'ended'. The date
//      passing is not the announcement; award_rank is a manual admin approval.
//      getBannerStage has applied that rule on Watch for a while -- the lobby was
//      the surface still willing to declare a winner nobody approved.
//   2. the vote window is read at all. The old rule had no idea it existed.
//
// ★deriveLobbyMode is GONE. It delegated for one commit -- the migration rule --
// and then had zero production callers, because the card builder resolves the
// phase directly. Keeping a named second route to the same answer is the exact
// shape this stage existed to remove: two entry points drift, and the one that
// drifts is always the one nobody is looking at.

function phaseOf(s: SeasonRow, now: Date, winnerCount: number): SeasonPhase {
  return getSeasonPhase(
    {
      status: s.status,
      applicationOpenAt: s.application_open_at,
      applicationCloseAt: s.application_close_at,
      // Sub-phase only (isProcessingBuffer), which no card reads.
      scoringStartAt: null,
      mainRoundStartAt: s.main_round_start_at,
      mainRoundEndAt: s.main_round_end_at,
      voteStartAt: s.community_vote_start_at,
      voteEndAt: s.community_vote_end_at,
      awardsAt: s.awards_announcement_at,
      // Not fetched, and it cannot change either output: 'finalists_pending',
      // 'judging' and 'main_live' all map to 'live' AND to the same countdown
      // target. One query instead of two, and the reason is written down.
      finalistCount: 0,
      winnerCount,
    },
    now,
  ).phase
}


// ─── C-3: the countdown follows the phase, never the mode ───────────────────
//
// ★WHY THIS HAD TO SHIP WITH C-2, not after. The old target was keyed on the
// MODE, and 'live' used to mean exactly "closed, main round not over", so
// main_round_end_at was always ahead of now. C-2 stretches 'live' across voting
// and awaiting-results, and the same lookup would hand the client an instant in
// the PAST -- the widget renders an em dash. For season_0 that is 4 of those 5
// days. lib/lobby.test.ts proved that against the old code before the change.
//
// ★A past target becomes null rather than a countdown to nothing. "No countdown"
// is a true statement; a timer stuck at zero is not.
//
// ★AND IT IS NOT A PER-PHASE LOOKUP, for a reason the first draft got wrong. A
// phase does not always have exactly one boundary ahead of it: season_0 spends
// 2026-11-12 00:00 -> 11-13 00:00 in 'main_live' with main_round_end_at ALREADY
// PAST (the films stay up, voting has not opened). A phase->boundary map returns
// the stale instant there, the past-guard nulls it, and the card shows nothing
// for a day when it could be counting down to the vote opening. So the rule is
// the simpler and more honest one: THE NEXT SCHEDULED PUBLIC MOMENT, whichever
// it is. Missing boundaries are skipped, and when none is ahead there is no
// countdown -- which is exactly right for 'results'.
export type CountdownKind =
  | 'application_open'
  | 'application_close'
  | 'main_round_start'
  | 'main_round_end'
  | 'vote_start'
  | 'vote_end'
  | 'awards'

function countdownTarget(
  s: SeasonRow,
  now: Date,
): { iso: string; kind: CountdownKind } | null {
  // Chronological by construction -- the schedule's own order.
  const schedule: [CountdownKind, string | null][] = [
    ['application_open', s.application_open_at],
    ['application_close', s.application_close_at],
    ['main_round_start', s.main_round_start_at],
    ['main_round_end', s.main_round_end_at],
    ['vote_start', s.community_vote_start_at],
    ['vote_end', s.community_vote_end_at],
    ['awards', s.awards_announcement_at],
  ]
  const t = now.getTime()
  for (const [kind, iso] of schedule) {
    const at = ms(iso)
    if (at != null && at > t) return { iso: iso as string, kind }
  }
  return null
}

// ─── rehearsal fixtures must not appear on a public surface ─────────────────
//
// ★WHY THIS EXISTS AT ALL, so nobody deletes it asking "why is season_test
// excluded". Measured 2026-08-07: of the 14 seasons the lobby renders, NINE are
// rehearsal or pipeline fixtures (season_test, season_test2, season_1000..1006),
// and eight of those carry status='completed' with zero award_rank rows. Today
// they read ENDED, which looks harmless. The moment the card asks the canonical
// machine (C-2), completed-with-no-podium becomes 'awaiting_results' -> 'live',
// and eight finished rehearsals announce themselves as running tournaments on
// the home page. The canonical is right; the rows should not be on a public
// surface in the first place. isOfficialPublic filtered host_type and drafts and
// nothing else.
//
// ★NO COLUMN SAYS THIS, and that was measured before writing a heuristic:
// is_test and visibility do not exist; host_type, lobby_featured, max_applicants
// and poster_url are identical across real and fixture rows; total_prize_pool is
// actively MISLEADING (season_0 and every fixture are 3000, while the real
// seasons 1-4 are 0). The durable fix is a column on seasons, which is a DB
// change and belongs to head office. This is the interim rule, and it is a
// heuristic -- see the limitation at the bottom.

// ★Moved to lib/season-fixture.ts (2026-08-27, HQ build-break fix): these were
// pure and dependency-free, but living in this file meant importing either one
// pulled in lib/lobby.ts's whole module graph -- including the dynamic
// `import('./supabase-admin')` below -- which broke the build the moment
// lib/seasons.ts (reachable from the Client Component SeasonForm.tsx) started
// importing isFixtureSeason from here (c86a4a9). Re-exported so every existing
// '@/lib/lobby' import of these two names (season-tick, email-tick,
// host/new/actions, lib/lobby.test.ts, isOfficialPublic below) keeps working
// unchanged -- only lib/seasons.ts now imports straight from season-fixture.ts.
export { isRehearsalFixture, isFixtureSeason } from './season-fixture'

// Official + publicly visible (not draft) + an actual competition. Partner
// seasons are excluded from v1.
function isOfficialPublic(s: SeasonRow): boolean {
  const official = s.host_type == null || s.host_type === 'official'
  if (!official || s.status === 'draft') return false
  // ★C-2 landed 2026-08-09: this asks isFixtureSeason, so a boolean a human
  // wrote decides, and the id/number heuristic only answers when the column did
  // not travel. The select above now carries it, so on this path the column
  // always decides -- and it is the fail-closed direction (DB DEFAULT true).
  if (isFixtureSeason(s)) {
    // ★A LIVE season being hidden is worse than a fixture leaking, so the one
    // case that must never pass in silence gets a line. Not logged for the other
    // statuses: the nine known fixtures would print on every home-page render.
    //
    // ★The message names WHICH rule hid it, because the two have different
    // fixes -- and the column case has TWO causes that read identically here.
    // is_fixture is NOT NULL DEFAULT true, so `true` can mean a human wrote it
    // OR that nobody ever wrote false: /admin/seasons' create payload does not
    // name the column, while season-tick's clone and host/new both do. Both
    // causes want the same repair (write false on the row) and neither is a
    // reason to touch the filter, so the line says so instead of guessing which.
    if (s.status === 'active') {
      const byColumn = typeof s.is_fixture === 'boolean'
      console.error(
        `[lobby] ★an ACTIVE season was filtered out as a fixture: ${s.id} (#${s.season_number}) ` +
          (byColumn
            ? '-- by the is_fixture COLUMN, which reads true. Either it was written, or it was ' +
              'never overridden from the DEFAULT (true). If this is a real competition, set ' +
              'is_fixture = false on the row -- do not change the filter.'
            : '-- by the id/number HEURISTIC, because is_fixture did not arrive on this read. ' +
              'Check the select list first: the row, not the rule, is probably fine.'),
      )
    }
    return false
  }
  return true
}

// Project a seasons row into a lobby card (server-authoritative mode). Exported
// so the /tournament gallery can reuse it for the current season, which may be a
// draft surfaced by getCurrentSeason that getLobbyTournaments filters out. The
// param is the lobby SeasonRow shape; a full Season satisfies it structurally.
//
// ★winnerCount defaults to 0, and the default is a POSITION, not a shortcut: 0
// means "no podium is on record", which is the only direction a default may fail
// in once C-2 lets this value decide whether the card says a season is over. A
// caller that does not know cannot be allowed to announce a result. Both call
// sites pass a real count anyway; the default exists because `now` is optional
// and TypeScript will not take a required parameter after an optional one.
// (Live since C-2: it decides whether the card may say a season is over.)
export function seasonToLobbyCard(
  s: SeasonRow,
  now: Date = new Date(),
  winnerCount: number = 0,
): LobbyCard {
  const phase = phaseOf(s, now, winnerCount)
  const mode = toLobbyMode(phase)
  const countdown = countdownTarget(s, now)
  return {
    phase,
    id: s.id,
    displayName: s.display_name || s.name,
    theme: s.season_theme,
    posterUrl: s.poster_url,
    prizePool: Number(s.total_prize_pool ?? 0),
    prizeFirst: Number(s.prize_first ?? 0),
    mode,
    countdownTargetIso: countdown?.iso ?? null,
    countdownTargetKind: countdown?.kind ?? null,
    lobbyFeatured: !!s.lobby_featured,
  }
}

export async function getLobbyTournaments(now: Date = new Date()): Promise<LobbyCard[]> {
  const { data, error } = await supabase
    .from('seasons_public')
    .select(
      'id, name, display_name, season_number, status, season_theme, poster_url, lobby_featured, host_type, total_prize_pool, prize_first, application_open_at, application_close_at, main_round_start_at, main_round_end_at, community_vote_start_at, community_vote_end_at, awards_announcement_at, is_fixture',
    )
  if (error) {
    console.error('[lobby] failed to load seasons:', error.message)
    return []
  }

  const rows = (data ?? []) as SeasonRow[]
  const visible = rows.filter(isOfficialPublic)
  // One query for every card, after the filter so we never count a season the
  // page will not render.
  const winners = await fetchWinnerCounts(visible.map((s) => s.id))
  const cards: LobbyCard[] = visible.map((s) => seasonToLobbyCard(s, now, winners[s.id] ?? 0))

  // lobby_featured first, then nearest deadline (cards with a countdown target
  // before those without; ended cards sink to the bottom).
  const ORDER: Record<LobbyMode, number> = { accepting: 0, upcoming: 1, live: 2, ended: 3 }
  cards.sort((a, b) => {
    if (a.lobbyFeatured !== b.lobbyFeatured) return a.lobbyFeatured ? -1 : 1
    if (ORDER[a.mode] !== ORDER[b.mode]) return ORDER[a.mode] - ORDER[b.mode]
    const at = a.countdownTargetIso ? new Date(a.countdownTargetIso).getTime() : Infinity
    const bt = b.countdownTargetIso ? new Date(b.countdownTargetIso).getTime() : Infinity
    return at - bt
  })
  return cards
}
