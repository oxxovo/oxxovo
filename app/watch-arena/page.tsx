// /watch-arena -- PREVIEW ONLY (시안). The dark-purple "arena spectator"
// redesign of Watch. The live /watch is deliberately left untouched; this is an
// unlisted route for TK to review before any live promotion.
//
// Reuses the existing Watch chrome (WatchShell: sidebar/filters/search/
// subscriptions/logo/header) via basePath='/watch-arena', and the existing
// lib/watch data layer. Score policy enforced in the cards (Arena.tsx).

import Link from 'next/link'
import {
  getWatchVideos,
  getWatchSeasonGroups,
  getFollowedCreators,
  getPublicMainScore,
  getCurrentCompetitionStats,
  type WatchSort,
  type WatchRound,
} from '@/lib/watch'
import { getCurrentSeason, getCurrentSeasonId } from '@/lib/seasons'
import { getUserOrNull } from '@/lib/user-auth'
import { WatchShell, type SidebarSeason, type SidebarSubscription } from '../watch/WatchShell'
import { ChatWidget } from '@/app/_components/ChatWidget'
import { ArenaBanner, ArenaHero, FeaturedCompetitors, Leaderboard, LatestEntries, type ScoredMain } from './Arena'

export const dynamic = 'force-dynamic'

export default async function WatchArenaPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; season?: string; q?: string; round?: string; award_rank?: string }>
}) {
  const sp = await searchParams
  const sort: WatchSort = sp.sort === 'trending' || sp.sort === 'award' ? sp.sort : 'latest'
  const round: WatchRound | undefined =
    sp.round === 'application' || sp.round === 'main' ? sp.round : undefined
  const awardRank =
    sp.award_rank === '1' || sp.award_rank === '2' || sp.award_rank === '3' ? Number(sp.award_rank) : undefined
  const q = sp.q?.trim().toLowerCase() ?? ''
  const activeSeason = sp.season

  const [allVideos, groups, user] = await Promise.all([
    getWatchVideos({ sort }),
    getWatchSeasonGroups(sort),
    getUserOrNull(),
  ])
  const followed = user ? await getFollowedCreators(user.id) : []
  const subscriptions: SidebarSubscription[] = followed.map((f) => ({ creatorUserId: f.userId, name: f.name }))

  const seasonNames: Record<string, string> = Object.fromEntries(groups.map((g) => [g.seasonId, g.displayName]))
  const seasons: SidebarSeason[] = groups.map((g) => ({
    seasonId: g.seasonId,
    label: g.hostType === 'partner' ? `${g.displayName} · Host` : g.displayName,
    count: g.videos.length,
  }))

  // Main-round videos + their public Triple-AI scores (null until judged). Only
  // scored ones feed Featured/Leaderboard, which auto-hide when empty (pre-launch).
  const mainVids = allVideos.filter((v) => v.round === 'main')
  const scoredPairs = (
    await Promise.all(mainVids.map(async (v) => ({ video: v, score: await getPublicMainScore(v.applicationId) })))
  ).filter((x): x is ScoredMain => x.score != null)
  const featured = scoredPairs.slice(0, 8)
  const leaderboard = [...scoredPairs]
    .sort((a, b) => (b.score.verifiedScore ?? 0) - (a.score.verifiedScore ?? 0))
    .slice(0, 3)

  // Latest Entries = the current Watch grid role: all entries, filtered by the
  // sidebar (season/round/winner/search). Newest first via the 'latest' sort.
  let latest = allVideos
  if (activeSeason) latest = latest.filter((v) => v.seasonId === activeSeason)
  if (round) latest = latest.filter((v) => v.round === round)
  if (awardRank) latest = latest.filter((v) => v.awardRank === awardRank)
  if (q) latest = latest.filter((v) => (v.videoTitle ?? '').toLowerCase().includes(q) || v.creatorName.toLowerCase().includes(q))

  const showRound = allVideos.some((v) => v.round === 'main')
  const showWinners = allVideos.some((v) => v.awardRank != null)

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

  return (
    <main className="min-h-screen bg-[#070512] text-[#f4f0ff]">
      <WatchShell
        seasons={seasons}
        sort={sort}
        activeSeason={activeSeason}
        activeRound={round}
        activeAwardRank={awardRank}
        user={user ? { email: user.email } : null}
        subscriptions={subscriptions}
        showRound={showRound}
        showWinners={showWinners}
        basePath="/watch-arena"
      >
        {/* Preview marker so it's unmistakably a 시안, not live. */}
        <div className="mb-4 flex items-center justify-between rounded-lg border border-[#8b22ff]/30 bg-[#8b22ff]/[.08] px-3 py-2 text-[11px] text-[#c9a9ff]">
          <span className="font-bold uppercase tracking-wider">Arena Preview · 시안</span>
          <Link href="/watch" className="underline hover:text-white">
            current live Watch →
          </Link>
        </div>

        <ArenaBanner />
        <ArenaHero seasonNumber={seasonNumber} roundName={roundName} stats={heroStats} />
        <FeaturedCompetitors items={featured} seasonNames={seasonNames} />
        <Leaderboard items={leaderboard} seasonNames={seasonNames} />
        <LatestEntries videos={latest} seasonNames={seasonNames} />
      </WatchShell>

      <ChatWidget />
    </main>
  )
}
