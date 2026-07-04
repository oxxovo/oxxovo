// /watch -- the public video gallery, rendered with the arena spectator design
// (ArenaShell + Current Competition Hero + entry grid). The same ArenaWatch
// surface renders at the root when watch_as_home is on. 100% data-driven.

import { type WatchSort, type WatchRound } from '@/lib/watch'
import { ArenaWatch } from './ArenaWatch'
import { ChatWidget } from '@/app/_components/ChatWidget'

export const dynamic = 'force-dynamic'

export default async function WatchPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; season?: string; q?: string; round?: string; award_rank?: string }>
}) {
  const sp = await searchParams
  const sort: WatchSort = sp.sort === 'trending' || sp.sort === 'award' ? sp.sort : 'latest'
  const round: WatchRound | undefined =
    sp.round === 'application' || sp.round === 'main' ? sp.round : undefined
  const awardRank = sp.award_rank === '1' || sp.award_rank === '2' || sp.award_rank === '3'
    ? Number(sp.award_rank)
    : undefined

  return (
    <main className="min-h-screen bg-[#070512] text-[#f4f0ff]">
      <ArenaWatch sort={sort} activeSeason={sp.season} query={sp.q} round={round} awardRank={awardRank} />
      <ChatWidget />
    </main>
  )
}
