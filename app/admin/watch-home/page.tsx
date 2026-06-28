// /admin/watch-home -- manual switch for the root surface. OFF (default) = root
// shows the marketing landing (launch 7/25). ON = root shows Watch. TK flips it
// once Season 0 has enough videos so the Watch home isn't empty.

import { requireAdmin } from '@/lib/admin-auth'
import { isWatchHome } from '@/lib/watch-home'
import { WatchHomeToggle } from './WatchHomeToggle'

export const dynamic = 'force-dynamic'

export default async function AdminWatchHomePage() {
  await requireAdmin()
  const on = await isWatchHome()

  return (
    <main className="min-h-screen bg-[#030305] text-white px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-black">Watch as Home</h1>
        <p className="mt-2 text-sm text-white/55 leading-relaxed">
          When ON, the site root (oxxovo.ai) shows the Watch surface. When OFF, the root shows the
          marketing landing. The landing always stays reachable at{' '}
          <span className="text-white/80">/welcome</span> (Watch sidebar &ldquo;Tournament&rdquo;).
          Turn this ON only after Season 0 has enough videos so Watch isn&apos;t empty.
        </p>

        <div className="mt-8 rounded-xl border border-white/10 bg-white/[.02] p-6">
          <WatchHomeToggle initial={on} />
        </div>
      </div>
    </main>
  )
}
