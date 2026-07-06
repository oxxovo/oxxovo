// Shared Watch surface (the "arena spectator" design). Renders the arena chrome
// (ArenaShell + top bar + sidebar) with the announcement banner, Current
// Competition Hero, filter bar, and the entry grid. Rendered by /watch and, when
// watch_as_home is on, by the root (/). 100% data-driven (lib/watch).
//
// Score policy (strict): preliminary cards never show a score or rank; the grid
// is submission-order only (no Trending/Featured/Staff Pick -- fairness policy).

import {
  getWatchVideos,
  getWatchSeasonGroups,
  getCurrentCompetitionStats,
  getJudgingProgress,
  isVoteWindowOpen,
  type WatchSort,
  type WatchRound,
} from '@/lib/watch'
import { getCurrentSeason, getCurrentSeasonId } from '@/lib/seasons'
import { getUserOrNull } from '@/lib/user-auth'
import { ArenaShell } from './ArenaShell'
import { ArenaFilterBar, type FilterSeason } from './ArenaFilterBar'
import { ArenaBanner, ArenaHero, LatestEntries } from './Arena'

export async function ArenaWatch({
  sort,
  activeSeason,
  query,
  round,
  awardRank,
}: {
  sort: WatchSort
  activeSeason?: string
  query?: string
  round?: WatchRound
  awardRank?: number
}) {
  const q = query?.trim().toLowerCase() ?? ''

  const [allVideos, groups, user] = await Promise.all([
    getWatchVideos({ sort }),
    getWatchSeasonGroups(sort),
    getUserOrNull(),
  ])

  const seasonNames: Record<string, string> = Object.fromEntries(groups.map((g) => [g.seasonId, g.displayName]))
  const filterSeasons: FilterSeason[] = groups.map((g) => ({
    id: g.seasonId,
    label: g.hostType === 'partner' ? `${g.displayName} · Host` : g.displayName,
  }))

  // Grid = all entries in submission order (newest first), filtered by the
  // season/round/winner/search query params (driven by the filter bar).
  let latest = allVideos
  if (activeSeason) latest = latest.filter((v) => v.seasonId === activeSeason)
  if (round) latest = latest.filter((v) => v.round === round)
  if (awardRank) latest = latest.filter((v) => v.awardRank === awardRank)
  if (q) latest = latest.filter((v) => (v.videoTitle ?? '').toLowerCase().includes(q) || v.creatorName.toLowerCase().includes(q))

  // Current Competition panel: resolve the current season (dynamic, DB-driven)
  // and its live stats. Round label follows the season TIMELINE (not any single
  // submission): once main_round_start_at has passed it's the Main Round, before
  // that the Preliminary Round. Pre-launch (season_0 main round = Sep) -> Prelim.
  const currentSeason = await getCurrentSeason()
  const currentSeasonId = currentSeason?.id ?? getCurrentSeasonId()
  const heroStats = await getCurrentCompetitionStats(currentSeasonId)
  const seasonNumber = currentSeason?.season_number ?? 0
  const mainStart = currentSeason?.main_round_start_at
    ? Date.parse(currentSeason.main_round_start_at)
    : null
  const inMainRound = mainStart != null && Date.now() >= mainStart
  const roundName = inMainRound ? 'Main Round' : 'Preliminary Round'

  // LIVE status: the application window is genuinely open (open <= now < close).
  // Drives the blinking LIVE dot, the deadline countdown, and the stats polling.
  // All from the DB dates (never hardcoded) -- when closed these are simply off.
  const openMs = currentSeason?.application_open_at ? Date.parse(currentSeason.application_open_at) : null
  const closeMs = currentSeason?.application_close_at ? Date.parse(currentSeason.application_close_at) : null
  const now = Date.now()
  const isAccepting = openMs != null && closeMs != null && now >= openMs && now < closeMs
  const closeAtISO = currentSeason?.application_close_at ?? null

  // Stage flags for the ⚡ judging bar (Hero) and the card status badges:
  //   showJudgingBar = prelim judging window (applications closed, results not out)
  //                    -> Hero shows the Triple-AI progress bar for the PRELIM pool.
  //   cardsJudging   = any post-close scoring phase -> cards may show "⚡ 심사 중".
  //   voteOpen       = community vote window -> main cards show "🔥 {votes}".
  const applicationsClosed = closeMs != null && now >= closeMs
  const showJudgingBar = applicationsClosed && !inMainRound
  const cardsJudging = applicationsClosed
  const voteOpen = await isVoteWindowOpen(currentSeasonId)
  const judging = showJudgingBar ? await getJudgingProgress(currentSeasonId) : { scored: 0, total: 0 }

  return (
    <ArenaShell user={user ? { email: user.email } : null}>
      <ArenaBanner />
      <ArenaHero
        seasonNumber={seasonNumber}
        roundName={roundName}
        stats={heroStats}
        seasonId={currentSeasonId}
        closeAtISO={closeAtISO}
        isAccepting={isAccepting}
        showJudging={showJudgingBar}
        judging={judging}
      />
      <ArenaFilterBar seasons={filterSeasons} activeSeason={activeSeason} />
      <LatestEntries videos={latest} seasonNames={seasonNames} showJudging={cardsJudging} voteOpen={voteOpen} />
    </ArenaShell>
  )
}
