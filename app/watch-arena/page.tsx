// /watch-arena -- PREVIEW ONLY (시안). The dark-purple "arena spectator"
// redesign of Watch. The live /watch is deliberately left untouched; this is an
// unlisted route for TK to review before any live promotion.
//
// Chrome is arena-only now (ArenaShell): the shared WatchShell is NOT used so the
// redesigned sidebar can never affect live /watch. Sort/season/champion controls
// live in ArenaFilterBar above the grid. Data comes from the shared lib/watch.

import Link from 'next/link'
import {
  getWatchVideos,
  getWatchSeasonGroups,
  getCurrentCompetitionStats,
  type WatchSort,
  type WatchRound,
} from '@/lib/watch'
import { getCurrentSeason, getCurrentSeasonId } from '@/lib/seasons'
import { getUserOrNull } from '@/lib/user-auth'
import { ChatWidget } from '@/app/_components/ChatWidget'
import { ArenaShell } from './ArenaShell'
import { ArenaFilterBar, type FilterSeason } from './ArenaFilterBar'
import { ArenaBanner, ArenaHero, LatestEntries } from './Arena'

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

  return (
    <main className="min-h-screen bg-[#070512] text-[#f4f0ff]">
      <ArenaShell user={user ? { email: user.email } : null}>
        {/* Preview marker so it's unmistakably a 시안, not live. */}
        <div className="mb-4 flex items-center justify-between rounded-lg border border-[#8b22ff]/30 bg-[#8b22ff]/[.08] px-3 py-2 text-[11px] text-[#c9a9ff]">
          <span className="font-bold uppercase tracking-wider">Arena Preview · 시안</span>
          <Link href="/watch" className="underline hover:text-white">
            current live Watch →
          </Link>
        </div>

        <ArenaBanner />
        <ArenaHero seasonNumber={seasonNumber} roundName={roundName} stats={heroStats} />
        <ArenaFilterBar seasons={filterSeasons} activeSeason={activeSeason} />
        <LatestEntries videos={latest} seasonNames={seasonNames} />
      </ArenaShell>

      <ChatWidget />
    </main>
  )
}
