// Root (/) -- watch_as_home decides the surface (TK manual switch, default off):
//   off -> marketing landing (LandingView). This is launch behavior (7/25).
//   on  -> Watch home (same WatchView as /watch), flipped once Season 0 videos
//          have accumulated. The marketing landing stays reachable at /welcome
//          (sidebar "Tournament").

import Link from 'next/link'
import { isWatchHome } from '@/lib/watch-home'
import { WatchView } from './watch/WatchView'
import { LandingView } from './_landing/LandingView'
import { ChatWidget } from './_components/ChatWidget'
import { formatFooterStatusLine } from '@/lib/ip-info'

export const dynamic = 'force-dynamic'

export default async function Home() {
  if (await isWatchHome()) {
    return (
      <main className="min-h-screen bg-[#030305] text-white">
        <WatchView sort="latest" />

        <footer className="px-6 py-12 border-t border-white/5">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-xs tracking-[0.2em] text-white/40">
            <Link href="/welcome" className="hover:text-white transition">About OXXOVO</Link>
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
  return <LandingView />
}
