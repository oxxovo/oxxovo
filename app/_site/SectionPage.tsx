// Body of a section page (Entertainment, Daily, Market, Education, Jobs, AI Games):
// the frame + the cards of the chosen left-menu item. An item with no video source, or
// a source with nothing public, shows the text-free skeleton -- never a "Coming Soon"
// line. Real data for the four data-less sections plugs in by giving their left-menu
// items a `section` (lib/site-nav) or a new source -- this component does not change.
import type { Metadata } from 'next'
import { SiteFrame } from './SiteFrame'
import { CardGrid } from './Card'
import { loadSitePage } from '@/lib/site-page'
import { getHomeCards } from '@/lib/home-feed'
import { LOCALES, withLocale } from '@/lib/locales'
import { getPage, type PageId } from '@/lib/site-nav'

export async function SectionPage({ page, searchParams }: { page: PageId; searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const data = await loadSitePage(page, (await searchParams).m)
  const cards = data.activeItem?.section ? await getHomeCards(data.activeItem.section, undefined, data.locale) : []
  return (
    <SiteFrame {...data}>
      <CardGrid cards={cards} t={data.t} />
    </SiteFrame>
  )
}

// hreflang for every language + x-default (the canonical English address).
export function siteMetadata(page: PageId): Metadata {
  const path = getPage(page).path
  return {
    alternates: {
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l.code, withLocale(path, l.code)])),
        'x-default': path,
      },
    },
  }
}
