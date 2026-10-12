// What a new-site page needs around its body -- SERVER ONLY. One function so the eight
// pages (home + 7) cannot differ in how they gate, pick a language, or load the frame.
import 'server-only'
import { enterSite } from '@/lib/site-locale'
import { readBanners } from '@/lib/site-banner-read'
import { getUserOrNull } from '@/lib/user-auth'
import { LOCALES, withLocale } from '@/lib/locales'
import { translator } from '@/lib/site-messages'
import { getPage, resolveSidebarItem, type PageId } from '@/lib/site-nav'
import type { SiteFrameProps } from '@/app/_site/SiteFrame'

export type SitePageData = Omit<SiteFrameProps, 'children'>

// `search` is the raw ?m= value; `searchString` (with '?') is kept for the language
// redirect and the language links.
export async function loadSitePage(page: PageId, rawItem?: unknown): Promise<SitePageData> {
  const def = getPage(page)
  const item = resolveSidebarItem(def, rawItem)
  const query = item && item.id !== def.side[0].id ? `?m=${item.id}` : ''
  const ctx = await enterSite(def.path, query)
  const [banners, user] = await Promise.all([readBanners(), getUserOrNull().catch(() => null)])
  return {
    locale: ctx.locale,
    dir: ctx.dir,
    t: translator(ctx.locale),
    page,
    banner: banners[page] ?? null,
    activeItem: item,
    accountHref: user ? '/profile' : '/login',
    languages: LOCALES.map((l) => ({ code: l.code, nativeName: l.nativeName, href: withLocale(def.path, l.code) + query })),
  }
}
