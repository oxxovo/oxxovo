// Root (/) -- watch_as_home decides the surface (TK manual switch, default off):
//   off -> marketing landing (LandingView). This is launch behavior (7/25).
//   on  -> the OXXOVO home: top menu + banner + Featured, over the aggregation layer
//          (lib/home-feed). The other pages of the new site (/entertainment, /daily,
//          /market, /education, /jobs, /games, /competition) sit behind the same
//          switch, in every language (/ko/...). The landing stays at /welcome and
//          /watch is unchanged.
//
// The competition gate (isCompetitionWatchPublic) is NOT ANDed here: the home lists
// contents too, and a closed competition must not hide an open news section. The gate
// sits inside lib/home-feed, around the competition cards only.

import { isNewSiteOpen } from '@/lib/watch-home'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { PREFIXED_HEADER, rootSurface } from '@/lib/locales'
import { getHomeCards } from '@/lib/home-feed'
import { loadSitePage } from '@/lib/site-page'
import { SiteFrame } from './_site/SiteFrame'
import { CardGrid } from './_site/Card'
import { siteMetadata } from './_site/SectionPage'
import { LandingView } from './_landing/LandingView'
import { ChatWidget } from './_components/ChatWidget'

export const dynamic = 'force-dynamic'
export const generateMetadata = () => siteMetadata('home')

const FEATURED_MAX = 4

export default async function Home() {
  const surface = rootSurface(await isNewSiteOpen(), (await headers()).get(PREFIXED_HEADER))
  // Switch off, reached as /ko (the proxy rewrote it to /): a new-site address, so 404.
  if (surface === 'notfound') notFound()
  if (surface === 'home') {
    const data = await loadSitePage('home')
    const cards = (await getHomeCards('all', undefined, data.locale)).slice(0, FEATURED_MAX)
    return (
      <>
        <SiteFrame {...data}>
          <h2 className="mb-3 text-lg font-bold text-[#f4f0ff]">{data.t('home.featured')}</h2>
          <CardGrid cards={cards} t={data.t} carousel />
        </SiteFrame>
        <ChatWidget />
      </>
    )
  }
  return <LandingView />
}
