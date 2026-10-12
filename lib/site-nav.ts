// The new site's pages, top menu and per-section left menus -- ONE data file, so
// changing a page, a menu item or where Tournament leads is an edit here and no
// component changes. Pure: no env, no DB.
//
// Two layers: the top menu is the 7 business axes (each its own page); the left menu
// differs per page. Studio is a tool of Tournament, not an axis.
//
// ★TK decisions that are still open live here and nowhere else: Tournament's closed
// screen, icons, images (banners: lib/site-banner.ts), and the left-menu items of the
// left-menu items (names from the approved mockup; wording is in the catalogs).
import type { MessageKey } from '@/lib/site-messages-en'
import type { SectionId } from '@/lib/home-sections'

export type PageId = 'home' | 'tournament' | 'entertainment' | 'daily' | 'market' | 'education' | 'jobs' | 'games'

export type SidebarItem = {
  id: string
  labelKey: MessageKey
  // Video source the item lists (lib/home-sections), or null = no data source yet: the
  // body shows the skeleton frame.
  section: SectionId | null
}

export type PageDef = {
  id: PageId
  path: string
  // null for home (not in the top menu)
  navKey: MessageKey | null
  // Left menu; empty = the page has none.
  side: readonly SidebarItem[]
}

// Left menus (the approved mockup, TK 2026-10-11). The first item of every page is that
// page's home and is the page's own address. Every item opens a frame; an item lists
// real videos only where it maps exactly onto a content kind (Entertainment Home / Film /
// Drama / CF / Music & MV, Daily Home / Latest). Every other item has `section: null`
// = an empty skeleton frame until its data exists -- giving it a data source later is a
// one-word edit here, no component changes. (Set any `section` to null to make an item a
// pure empty frame.)
type Entry = readonly [id: string, section: SectionId | null]
const menu = (page: PageId, entries: readonly Entry[]): SidebarItem[] =>
  entries.map(([id, section]) => ({ id, labelKey: `side.${page}.${id}` as MessageKey, section }))

export const PAGES: readonly PageDef[] = [
  { id: 'home', path: '/', navKey: null, side: [] },
  // Tournament leads to a blank page for now (tournament ad video goes there later).
  // /tournament itself is the live poster gallery (linked from the landing and QR
  // codes), so the new page is /competition; when the competition is public the page
  // redirects to /watch (app/competition/page.tsx).
  { id: 'tournament', path: '/competition', navKey: 'nav.tournament', side: [] },
  {
    id: 'entertainment',
    path: '/entertainment',
    navKey: 'nav.entertainment',
    side: menu('entertainment', [
      ['home', 'entertainment'], ['film', 'film'], ['drama', 'drama'], ['cf', 'cf'], ['music', 'music'],
      ['stars', null], ['series', null], ['featured', null], ['library', null],
    ]),
  },
  {
    id: 'daily',
    path: '/daily',
    navKey: 'nav.daily',
    side: menu('daily', [
      ['home', 'news'], ['latest', 'news'], ['companies', null], ['models', null],
      ['trends', null], ['interviews', null], ['analysis', null], ['archive', null],
    ]),
  },
  {
    id: 'market',
    path: '/market',
    navKey: 'nav.market',
    side: menu('market', [
      ['home', null], ['products', null], ['robots', null], ['software', null], ['hardware', null],
      ['compare', null], ['guide', null], ['featured', null], ['inquiry', null],
    ]),
  },
  {
    id: 'education',
    path: '/education',
    navKey: 'nav.education',
    side: menu('education', [
      ['home', null], ['courses', null], ['projects', null], ['assessments', null], ['certification', null],
      ['tutorials', null], ['mentoring', null], ['community', null], ['learning', null],
    ]),
  },
  {
    id: 'jobs',
    path: '/jobs',
    navKey: 'nav.jobs',
    side: menu('jobs', [
      ['home', null], ['find', null], ['talent', null], ['post', null],
      ['applications', null], ['companies', null], ['guide', null], ['profile', null],
    ]),
  },
  {
    id: 'games',
    path: '/games',
    navKey: 'nav.games',
    side: menu('games', [
      ['home', null], ['chess', null], ['go', null], ['janggi', null], ['opponent', null],
      ['records', null], ['rankings', null], ['tournaments', null], ['community', null],
    ]),
  },
]

export const TOP_MENU: readonly PageDef[] = PAGES.filter((p) => p.navKey !== null)

export function getPage(id: PageId): PageDef {
  return PAGES.find((p) => p.id === id) as PageDef
}

// Which page a pathname (already stripped of any language prefix) belongs to.
export function pageOfPath(path: string): PageId | null {
  const clean = path.length > 1 ? path.replace(/\/+$/, '') : path
  return PAGES.find((p) => p.path === clean)?.id ?? null
}

// `?m=<id>` -> a left-menu item of THIS page, else the page's first item (null if the
// page has no left menu). Unknown values never reach a query.
export function resolveSidebarItem(page: PageDef, raw: unknown): SidebarItem | null {
  if (page.side.length === 0) return null
  if (typeof raw === 'string') {
    const hit = page.side.find((i) => i.id === raw)
    if (hit) return hit
  }
  return page.side[0]
}

// Address of an item inside a page (the first item is the page's own address).
export function sidebarHref(page: PageDef, item: SidebarItem): string {
  return item.id === page.side[0].id ? page.path : `${page.path}?m=${item.id}`
}
