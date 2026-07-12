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
  getFinalistRevealState,
  getFinalists,
  getBannerStage,
  type WatchSort,
  type WatchRound,
} from '@/lib/watch'
import { getCurrentSeason, getCurrentSeasonId } from '@/lib/seasons'
import { getUserOrNull } from '@/lib/user-auth'
import { ArenaShell } from './ArenaShell'
import { ArenaFilterBar, type FilterSeason } from './ArenaFilterBar'
import { ArenaBanner, ArenaHero, LatestEntries, FinalistSection } from './Arena'

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
  // Finalist-pending stage (advanced, before reveal): label + reveal countdown.
  const finalistReveal = await getFinalistRevealState(currentSeasonId)
  const roundName = inMainRound
    ? 'Main Round'
    : finalistReveal
      ? 'Judging Complete'
      : 'Preliminary Round'

  // LIVE status: the application window is genuinely open (open <= now < close).
  // Drives the blinking LIVE dot, the deadline countdown, and the stats polling.
  // All from the DB dates (never hardcoded) -- when closed these are simply off.
  const openMs = currentSeason?.application_open_at ? Date.parse(currentSeason.application_open_at) : null
  const closeMs = currentSeason?.application_close_at ? Date.parse(currentSeason.application_close_at) : null
  const now = Date.now()
  const isAccepting = openMs != null && closeMs != null && now >= openMs && now < closeMs
  const closeAtISO = currentSeason?.application_close_at ?? null

  // Live judging: the Triple-AI worker scores entries as they arrive (rolling),
  // so the progress bar + card badges can run WHILE the application window is
  // still open (prelim can be "LIVE" and "20/21 판정" at once). The boxed
  // LiveStatusBar shows the bar whenever the pool is non-zero; cards show
  // "⚡ AI 심사 중" for entries in that pool that are not scored yet.
  const judging = await getJudgingProgress(currentSeasonId)
  const cardsJudging = judging.total > 0
  const voteOpen = await isVoteWindowOpen(currentSeasonId)
  // Post-reveal (main_round_start_at passed): finalists show at the top of Watch.
  const finalists = inMainRound ? await getFinalists(currentSeasonId) : []

  // Public main-round theme teaser. Shown from "Judging Complete" onward (once
  // finalists are pending) through the main round -- the banner is a come-back
  // hook, so the theme is teased early (TK 2026-07-12). Hidden during the open
  // prelim (no theme leak). Reads season.main_round_theme (now on the public
  // view) -- null until an operator sets it.
  const showTheme = finalistReveal != null || inMainRound
  const theme = showTheme ? (currentSeason?.main_round_theme ?? null) : null
  const themeSeconds = currentSeason?.main_round_video_seconds ?? null

  // Top announcement banner: a date-driven lifecycle stage machine. Everything
  // comes from the current season's schedule columns (no hardcoding) so the
  // banner auto-advances accepting -> judging -> finalists -> main live ->
  // voting -> results as time passes.
  const bannerStage = getBannerStage({
    applicationCloseAt: closeAtISO,
    mainRoundStartAt: currentSeason?.main_round_start_at ?? null,
    voteStartAt: currentSeason?.community_vote_start_at ?? null,
    voteEndAt: currentSeason?.community_vote_end_at ?? null,
    awardsAt: currentSeason?.awards_announcement_at ?? null,
    finalistCount: finalistReveal?.count ?? finalists.length,
    finalistFilmCount: finalists.filter((f) => f.mainVideoUrl).length,
    theme: currentSeason?.main_round_theme ?? null,
  })

  return (
    <ArenaShell user={user ? { email: user.email } : null}>
      <ArenaBanner content={bannerStage} />
      <ArenaHero
        seasonNumber={seasonNumber}
        roundName={roundName}
        seasonId={currentSeasonId}
        stats={heroStats}
        closeAtISO={closeAtISO}
        isAccepting={isAccepting}
        judging={judging}
        revealAtISO={finalistReveal?.revealAt ?? null}
        theme={theme}
        themeSeconds={themeSeconds}
      />
      <FinalistSection finalists={finalists} />
      <ArenaFilterBar seasons={filterSeasons} activeSeason={activeSeason} />
      <LatestEntries videos={latest} seasonNames={seasonNames} showJudging={cardsJudging} voteOpen={voteOpen} />
    </ArenaShell>
  )
}
