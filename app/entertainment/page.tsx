// /entertainment -- new-site page (behind watch_as_home, see lib/site-locale). Body: app/_site/SectionPage.
import { SectionPage, siteMetadata } from '../_site/SectionPage'

export const dynamic = 'force-dynamic'
export const generateMetadata = () => siteMetadata('entertainment')

export default function Page({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  return <SectionPage page="entertainment" searchParams={searchParams} />
}
