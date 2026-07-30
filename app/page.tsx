// Root (/) -- watch_as_home decides the surface (TK manual switch, default off):
//   off -> marketing landing (LandingView). This is launch behavior (7/25).
//   on  -> Watch home (same ArenaWatch surface as /watch), flipped once Season 0
//          videos have accumulated. The marketing landing stays reachable at
//          /welcome (sidebar "Tournament").

import { isWatchHome } from '@/lib/watch-home'
import { isWatchPublic } from '@/lib/watch-gate'
import { ArenaWatch } from './watch/ArenaWatch'
import { LandingView } from './_landing/LandingView'
import { ChatWidget } from './_components/ChatWidget'

export const dynamic = 'force-dynamic'

export default async function Home() {
  // watch-as-home may render the Watch surface at the root. Pre-launch that must
  // not expose Watch in production (patent novelty) -- fall back to the landing.
  if ((await isWatchHome()) && isWatchPublic()) {
    return (
      <main className="min-h-screen bg-[#070512] text-[#f4f0ff]">
        <ArenaWatch sort="latest" />
        <ChatWidget />
      </main>
    )
  }
  return <LandingView />
}
