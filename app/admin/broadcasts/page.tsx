import { requireAdmin } from '@/lib/admin-auth'
import { listBroadcastSeasons, listBroadcasts } from './actions'
import { BroadcastsView } from './BroadcastsView'

export const dynamic = 'force-dynamic'

export default async function BroadcastsPage() {
  await requireAdmin()
  const [seasons, campaigns] = await Promise.all([listBroadcastSeasons(), listBroadcasts()])

  return <BroadcastsView seasons={seasons} initialCampaigns={campaigns} />
}
