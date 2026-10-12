// The frame of every new-site page: top menu (7 pages) + account + language, the page
// banner, the page's left menu, and the body slot. Props only -- it never fetches, so
// it renders identically from live data or from the fixed data of the tests and the
// review files. Text comes from the catalog (`t`); there is no literal wording here.
//
// RTL: only logical utilities (start/end, ms/me, ps/pe, text-start) -- a test fails on
// any physical left/right class in app/_site, so an Arabic-style language does not break
// the layout.
import Link from 'next/link'
import type { ReactNode } from 'react'
import { LanguageMenu, type LanguageOption } from './LanguageMenu'
import { AccountIcon, ChevronIcon, ItemIcon } from './icons'
import { ScrollRow } from './ScrollRow'
import { TOP_MENU, getPage, sidebarHref, type PageId, type SidebarItem } from '@/lib/site-nav'
import { withLocale } from '@/lib/locales'
import type { Banner } from '@/lib/site-banner'
import type { Translator } from '@/lib/site-messages'

export type SiteFrameProps = {
  locale: string
  dir: 'ltr' | 'rtl'
  t: Translator
  page: PageId
  banner: Banner | null
  activeItem: SidebarItem | null
  accountHref: string
  languages: LanguageOption[]
  children: ReactNode
}

function TopBar({ locale, t, page, accountHref, languages }: Pick<SiteFrameProps, 'locale' | 't' | 'page' | 'accountHref' | 'languages'>) {
  return (
    <header className="border-b border-[#2a2340] bg-[#0b0814]">
      {/* Small screens: brand + icons on the first row, the 7 menu items on a second row that
          scrolls sideways (never wraps into a block). From md up: one row, brand | menu | icons. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href={withLocale('/', locale)} className="order-1 text-lg font-extrabold tracking-wide text-[#f4f0ff]" data-home="true">
          {t('brand')}
        </Link>
        <ScrollRow
          as="nav"
          aria-label={t('aria.topMenu')}
          data-topnav="true"
          wrapperClassName="order-3 w-full md:order-2 md:w-auto md:flex-1"
          className="flex w-full items-center gap-x-1 overflow-x-auto whitespace-nowrap pb-1 text-sm md:pb-0"
          fadeClassName="bg-gradient-to-l from-[#0b0814] to-transparent rtl:bg-gradient-to-r"
          centerCurrent
        >
          {TOP_MENU.map((p) => (
            <Link
              key={p.id}
              href={withLocale(p.path, locale)}
              data-nav={p.id}
              aria-current={p.id === page ? 'page' : undefined}
              className={
                p.id === page
                  ? 'shrink-0 rounded-full bg-[#8b22ff] px-3 py-1 font-bold text-white'
                  : 'shrink-0 rounded-full px-3 py-1 text-[#a79fc4] hover:text-[#f4f0ff]'
              }
            >
              {t(p.navKey!)}
            </Link>
          ))}
        </ScrollRow>
        <div className="order-2 ms-auto flex items-center gap-4 md:order-3 md:ms-0">
          <Link href={accountHref} aria-label={t('aria.account')} className="flex items-center text-[#a79fc4] hover:text-[#f4f0ff]" data-account="true">
            <AccountIcon />
          </Link>
          <LanguageMenu current={locale} options={languages} label={t('aria.language')} />
        </div>
      </div>
    </header>
  )
}

// The wide hero of the home page and the banner of a section page. The image is a
// text-free 16:9 original, cropped to the box (object-cover); the home page overlays its
// hero lines from the catalog, section banners carry no text at all.
function BannerView({ banner, label, hero, t }: { banner: Banner | null; label: string; hero: boolean; t: Translator }) {
  const sub = hero ? t('hero.sub') : ''
  return (
    <section
      aria-label={label}
      data-banner={banner ? 'image' : 'default'}
      className={`relative w-full overflow-hidden rounded-xl bg-gradient-to-br from-[#1a1033] via-[#110d1c] to-[#0b0814] ${hero ? 'aspect-[4/1] min-h-[220px]' : 'aspect-[21/9]'}`}
    >
      {banner && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={banner.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {hero && (
        // Scrim: darkens the start side (where the title sits; the end side in a right-to-left
        // language) so the text stays readable on any banner image.
        <div
          aria-hidden="true"
          data-scrim="true"
          className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent rtl:bg-gradient-to-l"
        />
      )}
      {hero && (
        <div data-hero="true" className="absolute inset-0 flex items-center justify-between gap-6 px-6 sm:px-12">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold tracking-wide text-[#f4f0ff] sm:text-6xl">{t('hero.brand')}</h1>
            <p className="mt-2 text-xl text-[#f4f0ff] sm:text-3xl">{t('hero.line1')}</p>
            <p className="text-xl text-[#f4f0ff] sm:text-3xl">{t('hero.line2')}</p>
            <p className="mt-3 text-xs text-[#c9a9ff] sm:text-sm">{t('hero.verbs')}</p>
          </div>
          {sub !== '' && <p className="max-w-[16rem] text-lg font-semibold text-[#f4f0ff] sm:text-2xl">{sub}</p>}
        </div>
      )}
    </section>
  )
}

// One link of a section menu (desktop list and mobile list share it).
function SideLink({ locale, t, page, item, on }: { locale: string; t: SiteFrameProps['t']; page: PageId; item: SidebarItem; on: boolean }) {
  const def = getPage(page)
  const label = t(item.labelKey)
  if (label === '') {
    // Wording not written yet (pending copy): a text-free bar in the menu's shape.
    return <span aria-hidden="true" data-skeleton="menu" className="block h-8 w-36 rounded bg-[#15102a]" />
  }
  return (
    <Link
      href={withLocale(sidebarHref(def, item), locale)}
      aria-current={on ? 'page' : undefined}
      data-item={item.id}
      className={
        on
          ? 'flex items-center gap-2 rounded-lg bg-[#8b22ff] px-3 py-2 text-sm font-bold text-white'
          : 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#a79fc4] hover:text-[#f4f0ff]'
      }
    >
      <ItemIcon />
      <span>{label}</span>
    </Link>
  )
}

// md and up: the vertical list on the left of the page.
function SideMenuDesktop({ locale, t, page, activeItem }: Pick<SiteFrameProps, 'locale' | 't' | 'page' | 'activeItem'>) {
  const def = getPage(page)
  if (def.side.length === 0) return null
  return (
    <nav aria-label={t('aria.sideMenu')} className="hidden md:block md:w-52 md:shrink-0" data-side={page}>
      <ul className="flex flex-col gap-1">
        {def.side.map((item) => (
          <li key={item.id}>
            <SideLink locale={locale} t={t} page={page} item={item} on={activeItem?.id === item.id} />
          </li>
        ))}
      </ul>
    </nav>
  )
}

// Below md: ONE line under the banner showing where you are; tapping it opens the full
// list (all 8-9 names at once -- a sideways row would show only 2-3 of them and hide the
// "My ..." items at the far end). A native <details>: no script, keyboard and screen-reader
// support built in, direction-neutral; picking an item loads a new page, which closes it.
function SideMenuMobile({ locale, t, page, activeItem }: Pick<SiteFrameProps, 'locale' | 't' | 'page' | 'activeItem'>) {
  const def = getPage(page)
  if (def.side.length === 0) return null
  const current = activeItem ?? def.side[0]
  const currentLabel = t(current.labelKey)
  return (
    <nav aria-label={t('aria.sideMenu')} className="mb-6 md:hidden" data-side-mobile={page}>
      <details className="group rounded-lg border border-[#2a2340] bg-[#0b0814]">
        <summary
          data-side-current="true"
          className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold text-white [&::-webkit-details-marker]:hidden"
        >
          <ItemIcon />
          {currentLabel === '' ? (
            <span aria-hidden="true" data-skeleton="menu" className="block h-4 flex-1 rounded bg-[#15102a]" />
          ) : (
            <span className="min-w-0 flex-1 truncate">{currentLabel}</span>
          )}
          <ChevronIcon />
        </summary>
        <ul className="flex flex-col gap-1 border-t border-[#2a2340] p-1">
          {def.side.map((item) => (
            <li key={item.id}>
              <SideLink locale={locale} t={t} page={page} item={item} on={current.id === item.id} />
            </li>
          ))}
        </ul>
      </details>
    </nav>
  )
}

export function SiteFrame(props: SiteFrameProps) {
  const { locale, dir, t, page, banner, activeItem, children } = props
  const def = getPage(page)
  const sided = def.side.length > 0
  const label = def.navKey ? t(def.navKey) : t('brand')
  return (
    <div lang={locale} dir={dir} data-locale={locale} className="min-h-screen bg-[#070512] text-[#f4f0ff]">
      <TopBar locale={locale} t={t} page={page} accountHref={props.accountHref} languages={props.languages} />
      <div className="mx-auto max-w-6xl px-4 pt-4">
        {!sided && <BannerView banner={banner} label={label} hero={page === 'home'} t={t} />}
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row">
        <SideMenuDesktop locale={locale} t={t} page={page} activeItem={activeItem} />
        <main className="min-w-0 flex-1">
          {sided && (
            <div className="mb-6">
              <BannerView banner={banner} label={label} hero={false} t={t} />
            </div>
          )}
          {/* Small screens: the section menu sits directly under the banner. */}
          <SideMenuMobile locale={locale} t={t} page={page} activeItem={activeItem} />
          {children}
        </main>
      </div>
    </div>
  )
}

