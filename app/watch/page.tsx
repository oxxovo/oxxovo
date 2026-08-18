// /watch -- the public video gallery, rendered with the arena spectator design
// (ArenaShell + Current Competition Hero + entry grid). The same ArenaWatch
// surface renders at the root when watch_as_home is on. 100% data-driven.

import { notFound } from 'next/navigation'
import { type WatchSort, type WatchRound } from '@/lib/watch'
import { isWatchPublic } from '@/lib/watch-gate'
import { ArenaWatch } from './ArenaWatch'
import { ChatWidget } from '@/app/_components/ChatWidget'

export const dynamic = 'force-dynamic'

export default async function WatchPage({
  searchParams,
}: {
  searchParams: Promise<{
    sort?: string
    season?: string
    q?: string
    round?: string
    award_rank?: string
    // PREVIEW ONLY (HQ 2026-08-18 design review) -- see ChampionshipPointsTeaser.tsx.
    // Not read anywhere in production behavior; only gates that one section.
    cp_rows?: string
  }>
}) {
  // Pre-launch: Watch is not publicly reachable in production (patent novelty).
  if (!isWatchPublic()) notFound()
  const sp = await searchParams
  const sort: WatchSort = sp.sort === 'trending' || sp.sort === 'award' ? sp.sort : 'latest'
  const round: WatchRound | undefined =
    sp.round === 'application' || sp.round === 'main' ? sp.round : undefined
  const awardRank = sp.award_rank === '1' || sp.award_rank === '2' || sp.award_rank === '3'
    ? Number(sp.award_rank)
    : undefined
  const cpRowsNum = sp.cp_rows ? Number(sp.cp_rows) : undefined
  const cpRows = cpRowsNum != null && Number.isInteger(cpRowsNum) && cpRowsNum > 0 ? cpRowsNum : undefined

  return (
    <main className="min-h-screen bg-[#070512] text-[#f4f0ff]">
      <ArenaWatch sort={sort} activeSeason={sp.season} query={sp.q} round={round} awardRank={awardRank} cpRows={cpRows} />
      <ChatWidget />
    </main>
  )
}
