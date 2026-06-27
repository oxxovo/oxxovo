// /tournament/[id] -- dynamic season detail. One route renders every seasons
// row (official, future teaser, or partner/Host) from the seasons_public view
// via getSeasonById -- no hardcode ([[feedback-no-hardcode]]). Adding a row
// yields a page automatically.

import { notFound } from 'next/navigation'
import { getSeasonById, getCurrentSeason } from '@/lib/seasons'
import { getMembershipLandingData } from '@/app/membership/actions'
import { SeasonDetail } from '../SeasonDetail'

export const dynamic = 'force-dynamic'

export default async function SeasonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [season, current, mem] = await Promise.all([
    getSeasonById(id),
    getCurrentSeason(),
    getMembershipLandingData(),
  ])

  if (!season) notFound()
  // Hide unpublished (draft) seasons from the public, EXCEPT the current season:
  // pre-launch season_0 is still draft but is the active landing target, so a
  // direct /tournament/season_0 visit (QR / bio link) must resolve.
  if (season.status === 'draft' && current?.id !== season.id) notFound()

  return <SeasonDetail season={season} mem={mem} />
}
