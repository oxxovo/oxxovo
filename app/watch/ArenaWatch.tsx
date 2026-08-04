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
import { resolveSeasonStage } from '@/lib/season-stage'
import { getCurrentSeason, getCurrentSeasonId } from '@/lib/seasons'
import { getUserOrNull } from '@/lib/user-auth'
import { ArenaShell } from './ArenaShell'
import { ArenaFilterBar, type FilterSeason } from './ArenaFilterBar'
import { ArenaBanner, ArenaHero, LatestEntries, MainRoundSection, FinalistPrelimSection } from './Arena'

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
  // Stage, finalists and theme all come from one resolver (lib/season-stage) so
  // the landing shows the same answer at the same instant. Deriving them here a
  // second time is what let the two surfaces disagree.
  const { content: bannerStage, inMainRound, finalists, finalistReveal, theme } =
    await resolveSeasonStage(currentSeason, currentSeasonId)
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
  // Progress bar tracks the round that is actually live: main once the season is
  // in the main round, prelim before that (else a finished prelim shows a stale
  // "41/41" during the main event). (TK 2026-07-13)
  const judging = await getJudgingProgress(currentSeasonId, inMainRound ? 'main' : 'application')
  const cardsJudging = judging.total > 0
  const voteOpen = await isVoteWindowOpen(currentSeasonId)

  // Main round layout (TK 2026-07-13): TOP = the finalists' MAIN videos (the live
  // event), MIDDLE = their PRELIM entries tagged "본선 진출작" (reference). Derived
  // from the already-loaded public videos so nothing extra is fetched.
  const finalistIds = new Set(finalists.map((f) => f.applicationId))
  const currentSeasonVideos = allVideos.filter((v) => v.seasonId === currentSeasonId)
  const mainRoundVideos = currentSeasonVideos.filter((v) => v.round === 'main')
  const finalistPrelims = currentSeasonVideos.filter(
    (v) => v.round === 'application' && finalistIds.has(v.applicationId),
  )
  // Gallery excludes the current-season finalists — their prelim films already
  // show in the "본선 진출작" section and their main films in the Main Round
  // section, so the full gallery is the ELIMINATED entries (+ other seasons),
  // never a duplicate of what's above. No entry is hidden overall. (TK 2026-07-14)
  latest = latest.filter((v) => !(v.seasonId === currentSeasonId && finalistIds.has(v.applicationId)))

  // Stopgap (A안, 2026-07): the hero card's roundName is derived from the
  // TIMELINE only (inMainRound = now>=main_round_start, no upper bound), so once
  // a season reaches the terminal stages it stays stuck on "Main Round" while the
  // top banner correctly says voting/results -> a self-contradicting screen (e.g.
  // "우승 발표됨" + "본선 · 심사 중"). Reflect the banner stage in the card label at
  // those stages so the two never disagree. The judging row is suppressed in the
  // card the same way (see LiveStatusBar `stage`). This whole patch is absorbed
  // once a canonical getSeasonPhase() unifies banner + card + awards gate.
  const cardRoundName =
    bannerStage.stage === 'results'
      ? 'Results'
      : bannerStage.stage === 'voting'
        ? 'Community Vote'
        : roundName

  return (
    <ArenaShell user={user ? { email: user.email } : null}>
      <ArenaBanner content={bannerStage} />
      <ArenaHero
        seasonNumber={seasonNumber}
        roundName={cardRoundName}
        stage={bannerStage.stage}
        seasonId={currentSeasonId}
        stats={heroStats}
        closeAtISO={closeAtISO}
        isAccepting={isAccepting}
        judging={judging}
        revealAtISO={finalistReveal?.revealAt ?? null}
        theme={theme}
        voteOpen={voteOpen}
        voteEndISO={currentSeason?.community_vote_end_at ?? null}
      />
      <MainRoundSection videos={mainRoundVideos} seasonNames={seasonNames} voteOpen={voteOpen} stage={bannerStage.stage} />
      <FinalistPrelimSection videos={finalistPrelims} seasonNames={seasonNames} />
      <ArenaFilterBar seasons={filterSeasons} activeSeason={activeSeason} />
      <LatestEntries videos={latest} seasonNames={seasonNames} showJudging={cardsJudging} voteOpen={voteOpen} />
    </ArenaShell>
  )
}
