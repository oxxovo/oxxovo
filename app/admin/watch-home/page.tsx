// /admin/watch-home -- manual switch for the root surface. OFF (default) = root
// shows the marketing landing (launch 7/25). ON = root shows Watch. TK flips it
// once Season 0 has enough videos so the Watch home isn't empty.

import { requireAdmin } from '@/lib/admin-auth'
import { isWatchHome } from '@/lib/watch-home'
import { WatchHomeView } from './WatchHomeView'

export const dynamic = 'force-dynamic'

export default async function AdminWatchHomePage() {
  await requireAdmin()
  const on = await isWatchHome()

  return <WatchHomeView initial={on} />
}
