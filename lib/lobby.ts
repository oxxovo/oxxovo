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

export type LobbyMode = 'upcoming' | 'accepting' | 'live' | 'ended'

export type LobbyCard = {
  id: string
  displayName: string
  theme: string | null
  posterUrl: string | null
  prizePool: number
  prizeFirst: number
  mode: LobbyMode
  // ISO target the client counts down to for this mode (null = no countdown).
  countdownTargetIso: string | null
  lobbyFeatured: boolean
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
  awards_announcement_at: string | null
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

// Server-authoritative mode from the schedule. Boundaries:
//   no open date set                   -> upcoming  (teaser / "COMING SOON")
//   now < open                         -> upcoming
//   open <= now < close                -> accepting
//   close <= now < mainEnd/awards      -> live  (applications closed; scoring + main round)
//   now >= mainEnd/awards | completed  -> ended
//
// A season with NO application_open_at is a teaser ("coming soon", date TBD), NOT
// an open one — defaulting a dateless season to 'accepting' would falsely show it
// as OPEN with an Apply CTA. Only a season whose open date has actually passed
// (and isn't past close) is 'accepting'.
export function deriveLobbyMode(s: SeasonRow, now: Date): LobbyMode {
  const t = now.getTime()
  const open = ms(s.application_open_at)
  const close = ms(s.application_close_at)
  const mainEnd = ms(s.main_round_end_at)
  const awards = ms(s.awards_announcement_at)
  const endish = mainEnd ?? awards

  if (s.status === 'completed') return 'ended'
  if (endish != null && t >= endish) return 'ended'
  if (open == null) return 'upcoming' // teaser: announced, open date not set yet
  if (t < open) return 'upcoming'
  if (close != null && t >= close) return 'live'
  // open<=now<close
  return 'accepting'
}

function countdownTarget(s: SeasonRow, mode: LobbyMode): string | null {
  switch (mode) {
    case 'upcoming':
      return s.application_open_at
    case 'accepting':
      return s.application_close_at
    case 'live':
      return s.main_round_end_at
    default:
      return null
  }
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

/** Ids we control by written convention. Each entry is a rule someone must follow, not a guess. */
const FIXTURE_ID_PREFIXES = [
  'zz_', // one-shot probe rows -- MANDATED by the go-live checklist C7
  'season_test', // pipeline seasons -- e2e/lib.mjs treats these as untouchable (TK 2026-07-14)
  'season_e2e', // the E2E harness season -- e2e/lib.mjs SEASON
  'season_loadtest', // load-test fixtures
] as const

// ★Everything at or above this is a fixture, and the number is chosen to be
// absurd rather than tight. season_0 runs about two months end to end (public
// 9/9 -> winner 11/16), so even at a monthly cadence -- far faster than anything
// planned -- 900 seasons is ~75 years. It is not "900 weeks": that reading was
// wrong when this rule was first drafted and is corrected here, because a
// comment carrying a false justification is how the next person talks themselves
// into lowering the threshold.
//
// It has to cover 997: e2e/zz-season.mjs deliberately picks 997 to sit BELOW the
// existing 1006 so it is not the newest season. A 998 cut would have leaked it.
const FIXTURE_SEASON_NUMBER_MIN = 900

/**
 * A rehearsal / test / harness season rather than a competition we run in public.
 *
 * Two clauses because the fixtures do not share one marker: the id-prefix clause
 * catches the conventions that are actually written down and enforced, and the
 * number clause catches season_1000..1006, which follow no id convention at all.
 *
 * ★LIMITATION, stated plainly: a future rehearsal season numbered below 900 with
 * an id matching none of the prefixes WILL leak onto the lobby. Nothing at season
 * creation enforces either convention -- app/host/new/actions.ts even derives
 * season_number as max+1, which is 1007 today, so the band is already polluted by
 * the fixtures themselves and keeps drifting up. Until the column exists, the
 * recurrence guard is procedural and lives in reports/rehearsal_runbook_2026-07.md.
 */
export function isRehearsalFixture(s: { id: string; season_number: number }): boolean {
  if (FIXTURE_ID_PREFIXES.some((p) => s.id.startsWith(p))) return true
  return Number.isFinite(s.season_number) && s.season_number >= FIXTURE_SEASON_NUMBER_MIN
}

// Official + publicly visible (not draft) + an actual competition. Partner
// seasons are excluded from v1.
function isOfficialPublic(s: SeasonRow): boolean {
  const official = s.host_type == null || s.host_type === 'official'
  if (!official || s.status === 'draft') return false
  if (isRehearsalFixture(s)) {
    // ★A LIVE season being hidden is worse than a fixture leaking, and the rule
    // above is a heuristic on names and numbers -- so the one case that must
    // never pass in silence gets a line. Not logged for the other statuses: the
    // nine known fixtures would print on every home-page render.
    if (s.status === 'active') {
      console.error(
        `[lobby] ★an ACTIVE season was filtered out as a rehearsal fixture: ${s.id} (#${s.season_number}). ` +
          'If this is a real competition, its id or season_number matches the fixture rule -- fix the row, not the filter.',
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
// (Inert today: deriveLobbyMode does not read it yet.)
export function seasonToLobbyCard(
  s: SeasonRow,
  now: Date = new Date(),
  winnerCount: number = 0,
): LobbyCard {
  void winnerCount // consumed by toLobbyMode in C-2
  const mode = deriveLobbyMode(s, now)
  return {
    id: s.id,
    displayName: s.display_name || s.name,
    theme: s.season_theme,
    posterUrl: s.poster_url,
    prizePool: Number(s.total_prize_pool ?? 0),
    prizeFirst: Number(s.prize_first ?? 0),
    mode,
    countdownTargetIso: countdownTarget(s, mode),
    lobbyFeatured: !!s.lobby_featured,
  }
}

export async function getLobbyTournaments(now: Date = new Date()): Promise<LobbyCard[]> {
  const { data, error } = await supabase
    .from('seasons_public')
    .select(
      'id, name, display_name, season_number, status, season_theme, poster_url, lobby_featured, host_type, total_prize_pool, prize_first, application_open_at, application_close_at, main_round_start_at, main_round_end_at, awards_announcement_at',
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
