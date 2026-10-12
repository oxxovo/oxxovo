// /competition -- the Tournament page of the new site. A blank frame for now (the
// tournament ad video goes into the slot later). When the competition is public it
// redirects to /watch, the existing competition screen, which is not touched.
// (/tournament is the live poster gallery, so this page cannot use that address.)
import { redirect } from 'next/navigation'
import { SiteFrame } from '../_site/SiteFrame'
import { siteMetadata } from '../_site/SectionPage'
import { loadSitePage } from '@/lib/site-page'
import { isCompetitionWatchPublic } from '@/lib/watch-gate'

export const dynamic = 'force-dynamic'
export const generateMetadata = () => siteMetadata('tournament')

export default async function CompetitionPage() {
  const data = await loadSitePage('tournament')
  if (await isCompetitionWatchPublic()) redirect('/watch')
  return (
    <SiteFrame {...data}>
      <div role="region" aria-label={data.t('aria.adSlot')} data-ad-slot="true" className="aspect-video w-full rounded-lg bg-[#110d1f]" />
    </SiteFrame>
  )
}
