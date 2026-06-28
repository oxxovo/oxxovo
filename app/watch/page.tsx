// /watch -- the public video gallery ("YouTube-lite + tournament"). Left rail
// (WatchSidebar: Home/Tournament/sort/seasons) + video grid (WatchView). The
// same WatchView renders at the root when watch_as_home is on. 100% data-driven.

import Link from 'next/link'
import { type WatchSort } from '@/lib/watch'
import { WatchView } from './WatchView'
import { ChatWidget } from '@/app/_components/ChatWidget'
import { formatFooterStatusLine } from '@/lib/ip-info'

export const dynamic = 'force-dynamic'

export default async function WatchPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; season?: string }>
}) {
  const sp = await searchParams
  const sort: WatchSort = sp.sort === 'trending' || sp.sort === 'award' ? sp.sort : 'latest'

  return (
    <main className="min-h-screen bg-[#030305] text-white">
      <WatchView sort={sort} activeSeason={sp.season} />

      <footer className="px-6 py-12 border-t border-white/5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-xs tracking-[0.2em] text-white/40">
          <Link href="/" className="hover:text-white transition">← OXXOVO</Link>
          <div>OXXOVO&trade; &middot; Las Vegas, Nevada, USA</div>
        </div>
        <div className="max-w-5xl mx-auto mt-4 text-center text-[10px] tracking-[0.15em] text-white/30">
          OXXOVO&trade; &copy; 2026 OXXOVO Labs Inc. &middot; {formatFooterStatusLine()}
        </div>
      </footer>

      <ChatWidget />
    </main>
  )
}
