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

// Official + publicly visible (not draft). Partner seasons are excluded from v1.
function isOfficialPublic(s: SeasonRow): boolean {
  const official = s.host_type == null || s.host_type === 'official'
  return official && s.status !== 'draft'
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
  const cards: LobbyCard[] = rows
    .filter(isOfficialPublic)
    .map((s) => {
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
    })

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
