// The new-site frame rendered from fixed data (the real components, next/link swapped
// for <a>): text-free empty states, language attributes, RTL safety, the 7+7 structure.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
// @ts-expect-error plain .mjs helper without types
import { renderSite, cleanup } from '../scripts/render-site.mjs'
import { LOCALES, withLocale, type LocaleDef } from './locales.ts'
import { translator, type Catalog } from './site-messages.ts'
import { EN } from './site-messages-en.ts'
import { KO } from './site-messages-ko.ts'
import { PAGES, TOP_MENU, getPage, resolveSidebarItem, type PageId } from './site-nav.ts'
import type { HomeCard } from './home-feed.ts'

after(() => cleanup())

const AR: LocaleDef = { code: 'ar', nativeName: 'العربية', dir: 'rtl' }
const CATS: Record<string, Catalog> = { en: EN, ko: { 'nav.daily': '[ko] Daily', 'nav.market': '[ko] Market' }, ar: { 'nav.daily': '[ar] Daily' } }

function frame(page: PageId, o: { locale?: string; dir?: 'ltr' | 'rtl'; item?: string; cards?: HomeCard[]; banner?: boolean; langs?: LocaleDef[]; carousel?: boolean } = {}): Promise<string> {
  const locale = o.locale ?? 'en'
  const def = getPage(page)
  const langs = o.langs ?? LOCALES
  return renderSite({
    locale,
    dir: o.dir ?? 'ltr',
    t: translator(locale, CATS),
    page,
    banner: o.banner ? { url: 'https://pub.example.r2.dev/b.webp', width: 1920, height: 1080 } : null,
    activeItem: resolveSidebarItem(def, o.item),
    accountHref: '/login',
    languages: langs.map((l) => ({ code: l.code, nativeName: l.nativeName, href: withLocale(def.path, l.code, langs) })),
    cards: o.cards ?? [],
    carousel: o.carousel ?? false,
  })
}

const card = (over: Partial<HomeCard> = {}): HomeCard => ({
  key: 'content:n1', href: '/daily/n1', title: 'Fixture title', subtitle: null, summary: null, badge: 'daily',
  publishedAt: '2026-10-10T00:00:00Z', durationSec: null, thumbnailUrl: null, aiGenerated: false, ...over,
})

test('every page renders; the top menu has the 7 axes; the empty body is a text-free skeleton (no Coming Soon)', async () => {
  for (const p of PAGES) {
    const out = await frame(p.id)
    for (const n of TOP_MENU) assert.ok(out.includes(`data-nav="${n.id}"`), `${p.id}: ${n.id}`)
    assert.ok(out.includes('data-empty="true"'), p.id)
    assert.ok(out.includes('data-skeleton="card"'), p.id)
    assert.ok(!/coming soon/i.test(out), `${p.id}: no Coming Soon`)
  }
})

test('control: with a card the grid shows and the skeleton does not', async () => {
  const out = await frame('daily', { cards: [card()] })
  assert.ok(out.includes('Fixture title') && out.includes('OXXOVO DAILY') && out.includes('href="/daily/n1"') && out.includes('data-badge="daily"'))
  assert.ok(!out.includes('data-empty'))
})

const desktopMenu = (out: string): string => out.match(/<nav[^>]*data-side="[^"]*".*?<\/nav>/s)?.[0] ?? ''
const mobileMenu = (out: string): string => out.match(/<nav[^>]*data-side-mobile="[^"]*".*?<\/nav>/s)?.[0] ?? ''

test('every section page shows its left menu on desktop: icon + name per item, the chosen item marked', async () => {
  for (const id of ['entertainment', 'daily', 'market', 'education', 'jobs', 'games'] as const) {
    const menu = desktopMenu(await frame(id))
    assert.ok(menu.includes('data-side="' + id + '"'), id)
    assert.equal((menu.match(/data-icon="item"/g) ?? []).length, getPage(id).side.length, id)
    for (const i of getPage(id).side) assert.ok(menu.includes('>' + EN[i.labelKey].replace(/&/g, '&amp;') + '<'), id + '/' + i.id)
    assert.equal((menu.match(/aria-current="page"/g) ?? []).length, 1, id + ': one chosen item')
  }
})

test('the Market body is an empty frame (skeleton cards), not words', async () => {
  const out = await frame('market', { item: 'robots' })
  assert.ok(out.includes('data-empty="true"') && out.includes('data-skeleton="card"'))
  assert.ok(out.includes('href="/market?m=robots"'))
})

test('Entertainment: the chosen item is marked and links keep ?m=', async () => {
  const out = await frame('entertainment', { item: 'film' })
  assert.match(out, /aria-current="page"[^>]*href="\/entertainment\?m=film"|href="\/entertainment\?m=film"[^>]*aria-current="page"/)
  assert.ok(out.includes('href="/entertainment"'), 'the first item (the page home) is the page address')
})

test('Korean: the approved menu names are used; a name without a Korean entry falls back to English', async () => {
  const REAL: Record<string, Catalog> = { en: EN, ko: KO }
  const def = getPage('entertainment')
  const out = await renderSite({
    locale: 'ko', dir: 'ltr', t: translator('ko', REAL), page: 'entertainment', banner: null,
    activeItem: resolveSidebarItem(def, undefined), accountHref: '/login',
    languages: LOCALES.map((l) => ({ code: l.code, nativeName: l.nativeName, href: withLocale(def.path, l.code) })), cards: [],
  })
  for (const w of ['엔터테인먼트 홈', '영화', '드라마', '음악·MV', 'AI 스타', '오리지널 시리즈', '내 라이브러리']) assert.ok(out.includes('>' + w + '<'), w)
  assert.ok(out.includes('>Entertainment<'), 'the top menu is not translated yet -> English')
})

test('Home: hero lines from the catalog; the Korean sub-line shows in ko and not in English', async () => {
  const en = await frame('home')
  for (const w of ['OXXOVO', 'AI x HUMAN', 'A BRIGHTER TOMORROW', 'Create · Compete · Learn · Work · Play']) assert.ok(en.includes(w), w)
  assert.ok(en.includes('data-hero="true"') && !en.includes('AI와 사람이'))
  const REAL: Record<string, Catalog> = { en: EN, ko: KO }
  const ko = await renderSite({ locale: 'ko', dir: 'ltr', t: translator('ko', REAL), page: 'home', banner: null, activeItem: null, accountHref: '/login', languages: [], cards: [] })
  assert.ok(ko.includes('AI와 사람이 함께 만드는 더 큰 세상'))
})

test('Tournament has no left menu', async () => {
  assert.ok(!(await frame('tournament')).includes('data-side='))
})

test('★language attributes: lang and dir on the page wrapper; links keep the language prefix', async () => {
  const ko = await frame('market', { locale: 'ko' })
  assert.ok(ko.includes('lang="ko"') && ko.includes('dir="ltr"') && ko.includes('data-locale="ko"'))
  assert.ok(ko.includes('href="/ko/daily"') && ko.includes('href="/ko"'), 'menu links carry the prefix')
  assert.ok(ko.includes('[ko] Market') && ko.includes('Education'), 'translated key used, missing key falls back to English')
  const en = await frame('market')
  assert.ok(en.includes('href="/daily"') && !en.includes('href="/ko/daily"'))
})

test('★a right-to-left language renders with dir="rtl" and its own links (language added by configuration only)', async () => {
  const langs = [...LOCALES, AR]
  const ar = await frame('daily', { locale: 'ar', dir: 'rtl', langs })
  assert.ok(ar.includes('dir="rtl"') && ar.includes('lang="ar"'))
  assert.ok(ar.includes('[ar] Daily'))
})

test('the top bar carries a labelled language button and account link', async () => {
  const out = await frame('daily', { langs: [...LOCALES, AR] })
  assert.ok(out.includes('aria-label="Language"'))
  assert.ok(out.includes('aria-label="Account"') && out.includes('href="/login"'))
})

test('the top bar has the account and language icons and nothing else (no search, no bell)', async () => {
  const out = await frame('home')
  assert.ok(!/search|notification|bell/i.test(out))
})

test('banner: default gradient when no file; the image when a valid banner is given; never an <img> otherwise', async () => {
  const none = await frame('home')
  assert.ok(none.includes('data-banner="default"') && !none.includes('<img'))
  assert.ok(none.includes('aspect-[4/1]'), 'the home hero is a wide crop of the 16:9 original')
  assert.ok((await frame('market')).includes('aspect-[21/9]'), 'a section banner sits inside the content column')
  const img = await frame('home', { banner: true })
  assert.ok(img.includes('data-banner="image"') && img.includes('src="https://pub.example.r2.dev/b.webp"'))
  const mkt = await frame('market', { banner: true })
  assert.ok(!/<h1/.test(mkt) && !mkt.includes('data-hero'), 'a section banner carries no overlaid text')
})

function walk(dir: string, out: string[]): void {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx$/.test(n)) out.push(p)
  }
}

test('★RTL safety: no physical left/right utility in any new-site component (logical start/end only)', () => {
  const files: string[] = []
  walk('app/_site', files)
  assert.ok(files.length >= 4)
  const PHYSICAL = /(?<![-\w])(?:-?(?:ml|mr|pl|pr|left|right)-[\w[./]+|text-(?:left|right)|float-(?:left|right)|border-[lr](?:-[\w[]+)?(?=[\s"'`])|rounded-[lr]{1,2}(?:-[\w[]+)?(?=[\s"'`])|space-x-\w+|divide-x)/
  for (const f of files) {
    const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n')
    const hits = [...src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|'([^']*)')/g)].flatMap((m) => (m[1] ?? m[2] ?? m[3]).split(/\s+/)).filter((c) => PHYSICAL.test(c))
    assert.deepEqual(hits, [], `${f}: ${hits.join(' ')}`)
  }
  assert.ok(PHYSICAL.test('ml-4') && PHYSICAL.test('left-2') && PHYSICAL.test('text-left') && !PHYSICAL.test('ms-4') && !PHYSICAL.test('start-2'), 'control: the pattern finds physical classes and lets logical ones through')
})

// ---- card hover, carousel, hero scrim ------------------------------------------------

test('card hover: only the DESCRIPTION is in the hover layer (the title is already under the image); a card with an address is a link', async () => {
  const out = await frame('daily', { cards: [card({ summary: 'Hover description text' })] })
  const hover = out.match(/data-hover="true"[^>]*>(.*?)<\/div>/s)?.[1] ?? ''
  assert.ok(hover.includes('Hover description text'))
  assert.ok(!hover.includes('Fixture title'), 'the title is not repeated inside the hover layer')
  assert.equal((out.match(/Fixture title/g) ?? []).length, 1, 'the title appears exactly once on the card')
  assert.ok(out.includes('data-card="link"') && out.includes('href="/daily/n1"'))
  assert.ok(out.includes('group-hover:opacity-100') && out.includes('group-focus-within:opacity-100'), 'shown on pointer hover and on keyboard focus')
})

test('★card hover: no description -> no hover layer at all; no address -> not a link', async () => {
  const none = await frame('daily', { cards: [card({ key: 'content:d1', href: null, summary: null })] })
  assert.ok(!none.includes('data-hover'), 'nothing to reveal, so no overlay element exists')
  assert.ok(none.includes('data-card="static"') && !none.includes('data-card="link"'))
  const blank = await frame('daily', { cards: [card({ summary: '' })] })
  assert.ok(!blank.includes('data-hover'), 'an empty description is no description')
  const withIt = await frame('daily', { cards: [card({ href: null, summary: 'Has text' })] })
  assert.ok(withIt.includes('data-hover') && withIt.includes('data-card="static"'), 'no address but a description: hover text shows, still not a link')
})

test('thumbnail: an image when the card has one; the gradient frame when it does not', async () => {
  const withImg = await frame('daily', { cards: [card({ thumbnailUrl: 'https://cdn.example/t.jpg' })] })
  assert.ok(withImg.includes('src="https://cdn.example/t.jpg"'))
  const without = await frame('daily', { cards: [card({ thumbnailUrl: null })] })
  assert.ok(!without.includes('<img') && without.includes('from-[#1a1033] to-[#0b0814]'))
})

test('★Featured is a horizontal scroll-snap carousel on small screens and a 4-column grid from md up; section lists are not', async () => {
  const home = await frame('home', { carousel: true, cards: [card(), card({ key: 'content:n2' })] })
  assert.ok(home.includes('data-carousel="true"'))
  assert.ok(/snap-x/.test(home) && /snap-mandatory/.test(home) && /overflow-x-auto/.test(home))
  assert.ok(/snap-start/.test(home) && home.includes('w-[72%]'), 'each card is ~72% wide so the next one peeks in')
  assert.ok(/md:grid-cols-4/.test(home) && /md:overflow-visible/.test(home))
  const emptyHome = await frame('home', { carousel: true })
  assert.ok(emptyHome.includes('data-carousel="true"') && emptyHome.includes('data-empty="true"'), 'the empty skeleton row scrolls the same way')
  assert.ok(!(await frame('daily', { cards: [card()] })).includes('data-carousel'), 'section lists keep the grid')
})

test('★the carousel is direction-neutral: it renders the same classes in an RTL page (flex + snap-start follow the writing mode)', async () => {
  const ar = await frame('home', { carousel: true, locale: 'ar', dir: 'rtl', cards: [card()], langs: [...LOCALES, AR] })
  assert.ok(ar.includes('dir="rtl"') && ar.includes('data-carousel="true"') && /snap-start/.test(ar))
  const classes = [...ar.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/))
  const physical = classes.filter((c) => /^(?:-?(?:ml|mr|pl|pr|left|right)-|text-(?:left|right)$)/.test(c))
  assert.deepEqual(physical, [], 'no physical-direction class anywhere in the rendered carousel')
})

test('★hero: a gradient scrim sits between the banner image and the text, and flips in RTL', async () => {
  const out = await frame('home', { banner: true })
  const iImg = out.indexOf('<img'), iScrim = out.indexOf('data-scrim="true"'), iText = out.indexOf('data-hero="true"')
  assert.ok(iImg >= 0 && iScrim > iImg && iText > iScrim, 'image, then scrim, then text')
  assert.ok(out.includes('from-black/75') && out.includes('rtl:bg-gradient-to-l'))
  assert.ok(!(await frame('market', { banner: true })).includes('data-scrim'), 'section banners carry no text, so no scrim')
})

test('hero height: the home hero is 4:1 with a floor, so the Featured heading and cards start inside a laptop first screen', async () => {
  const out = await frame('home')
  assert.ok(out.includes('aspect-[4/1]') && out.includes('min-h-[220px]'))
})

test('top bar on small screens: the 7 menu items are one scrollable row below the brand and icons, not a wrapping block', async () => {
  const out = await frame('home')
  assert.ok(out.includes('data-topnav="true"'))
  assert.ok(out.includes('overflow-x-auto') && out.includes('whitespace-nowrap') && out.includes('md:flex-1'))
  assert.ok(out.includes('order-3') && out.includes('md:order-2'), 'menu row sits below the brand + icons on small screens, between them from md up')
})

// ---- sideways rows: hidden bar, end fade, current item centred ------------------------

test('★the top menu and the Featured carousel hide the scroll BAR but stay scrollable', async () => {
  const out = await frame('home', { carousel: true, cards: [card()] })
  const rows = out.match(/data-scrollrow="true"/g) ?? []
  assert.equal(rows.length, 2, 'top menu + carousel')
  assert.equal((out.match(/\[scrollbar-width:none\]/g) ?? []).length, 2)
  assert.equal((out.match(/\[&amp;::-webkit-scrollbar\]:hidden|\[&::-webkit-scrollbar\]:hidden/g) ?? []).length, 2)
  assert.ok(out.includes('overflow-x-auto'), 'still a scroll container')
  assert.ok(!out.includes('overflow-x-hidden'), 'hiding the bar must not turn scrolling off')
})

test('★an end fade marks "there is more": one per row, on the end edge (logical), flipped for RTL, off from md up', async () => {
  const out = await frame('home', { carousel: true, cards: [card()] })
  const fades = [...out.matchAll(/<span[^>]*data-fade="end"[^>]*>/g)].map((m) => m[0])
  assert.equal(fades.length, 2)
  for (const f of fades) {
    assert.ok(f.includes('end-0'), 'anchored to the END edge, not left/right')
    assert.ok(f.includes('rtl:bg-gradient-to-r') && f.includes('bg-gradient-to-l'), 'gradient direction flips in RTL')
    assert.ok(f.includes('md:hidden') && f.includes('pointer-events-none') && f.includes('aria-hidden="true"'))
    assert.ok(f.includes('opacity-100'), 'visible at first paint (hidden by script once the end is reached)')
  }
  assert.ok(fades[0].includes('from-[#0b0814]') && fades[1].includes('from-[#070512]'), 'each fade matches the colour behind its row')
  const sections = await frame('daily', { cards: [card()] })
  assert.ok(sections.includes('data-fade="end"'), 'the top menu row has it on every page')
  assert.equal((sections.match(/data-fade="end"/g) ?? []).length, 1, 'a section list is a grid: no carousel fade')
})

test('the current top-menu item is marked in a way the centring script finds (aria-current on exactly one link)', async () => {
  for (const p of ['tournament', 'entertainment', 'daily', 'market', 'education', 'jobs', 'games'] as const) {
    const out = await frame(p)
    const nav = out.match(/data-topnav="true".*?<\/nav>/s)?.[0] ?? ''
    assert.equal((nav.match(/aria-current="page"/g) ?? []).length, 1, p)
    assert.ok(new RegExp('aria-current="page"[^>]*data-nav="' + p + '"|data-nav="' + p + '"[^>]*aria-current="page"').test(nav), p)
  }
  const home = await frame('home')
  assert.ok(!(home.match(/data-topnav="true".*?<\/nav>/s)?.[0] ?? '').includes('aria-current'), 'the home page highlights no business area')
})

test('★the current business area is emphasised: a filled pill with white bold text; the others are plain (desktop and mobile share the classes)', async () => {
  const out = await frame('market')
  const nav = out.match(/data-topnav="true".*?<\/nav>/s)?.[0] ?? ''
  const links = [...nav.matchAll(/<a [^>]*data-nav="(\w+)"[^>]*>/g)].map((m) => ({ id: m[1], tag: m[0] }))
  assert.equal(links.length, 7)
  for (const l of links) {
    if (l.id === 'market') assert.ok(l.tag.includes('bg-[#8b22ff]') && l.tag.includes('font-bold') && l.tag.includes('text-white'), 'current is filled')
    else assert.ok(!l.tag.includes('bg-[#8b22ff]') && !l.tag.includes('font-bold'), l.id + ' is plain')
    assert.ok(l.tag.includes('shrink-0') && l.tag.includes('px-3'), 'items keep their size inside the scrolling row')
  }
})

// ---- the section menu on small screens: ONE line under the banner, opens to the full list ----

test('★mobile: the section menu is a closed <details> showing the current item; desktop shows the list; each is hidden on the other size', async () => {
  const out = await frame('entertainment', { item: 'drama' })
  const m = mobileMenu(out)
  assert.ok(m.includes('<details') && m.includes('<summary'), 'native disclosure: no script needed')
  assert.ok(!/<details[^>]*\sopen/.test(m), 'closed until tapped')
  const summary = m.match(/<summary.*?<\/summary>/s)?.[0] ?? ''
  assert.ok(summary.includes('>Drama<') && summary.includes('data-icon="chevron"'), 'shows where you are, with an open/close cue')
  assert.ok(!summary.includes('>Film<') && !summary.includes('>CF (Commercial)<'), 'the summary names only the current item')
  assert.ok(/class="[^"]*md:hidden/.test(m.match(/<nav[^>]*>/)?.[0] ?? ''), 'mobile menu is hidden from md up')
  assert.ok(/class="[^"]*hidden md:block/.test(desktopMenu(out).match(/<nav[^>]*>/)?.[0] ?? ''), 'desktop list is hidden below md')
})

test('★mobile: opening shows ALL items as links (names at once), the current one marked, addresses as on desktop', async () => {
  for (const id of ['entertainment', 'daily', 'market', 'education', 'jobs', 'games'] as const) {
    const m = mobileMenu(await frame(id))
    const list = m.match(/<ul.*?<\/ul>/s)?.[0] ?? ''
    assert.equal((list.match(/<a /g) ?? []).length, getPage(id).side.length, id + ': every item is reachable')
    assert.equal((list.match(/aria-current="page"/g) ?? []).length, 1, id)
    for (const i of getPage(id).side) assert.ok(list.includes('>' + EN[i.labelKey].replace(/&/g, '&amp;') + '<'), id + '/' + i.id)
  }
  const out = await frame('entertainment', { item: 'film' })
  assert.ok(mobileMenu(out).includes('href="/entertainment?m=film"') && mobileMenu(out).includes('href="/entertainment"'))
  assert.ok(mobileMenu(out).includes('>Film<'))
})

test('★mobile: the menu sits directly under the banner and above the cards, in reading order', async () => {
  const out = await frame('market', { cards: [card()] })
  const iBanner = out.indexOf('data-banner='), iMenu = out.indexOf('data-side-mobile='), iCards = out.indexOf('data-card=')
  assert.ok(iBanner > 0 && iMenu > iBanner && iCards > iMenu, 'banner, then the menu, then the cards')
  assert.ok(out.indexOf('data-side="market"') < iBanner, 'the desktop list is in the left column, before the content column')
})

test('mobile menu: pages without a section menu (Tournament, Home) render none', async () => {
  for (const id of ['tournament', 'home'] as const) {
    const out = await frame(id)
    assert.ok(!out.includes('data-side-mobile') && !out.includes('data-side='), id)
  }
})

test('★mobile menu: current item follows ?m=; unknown values show the page home; Korean names are used', async () => {
  assert.ok((mobileMenu(await frame('market', { item: 'robots' })).match(/<summary.*?<\/summary>/s)?.[0] ?? '').includes('>AI Robots<'))
  assert.ok((mobileMenu(await frame('market', { item: 'zzz' })).match(/<summary.*?<\/summary>/s)?.[0] ?? '').includes('>AI Market Home<'))
  const REAL: Record<string, Catalog> = { en: EN, ko: KO }
  const def = getPage('market')
  const ko = await renderSite({
    locale: 'ko', dir: 'ltr', t: translator('ko', REAL), page: 'market', banner: null, activeItem: resolveSidebarItem(def, 'compare'), accountHref: '/login',
    languages: LOCALES.map((l) => ({ code: l.code, nativeName: l.nativeName, href: withLocale(def.path, l.code) })), cards: [], carousel: false,
  })
  assert.ok((mobileMenu(ko).match(/<summary.*?<\/summary>/s)?.[0] ?? '').includes('>제품 비교<'))
})

test('★mobile menu is direction-neutral: in an RTL page it uses the same logical classes (no physical left/right)', async () => {
  const ar = await frame('entertainment', { locale: 'ar', dir: 'rtl', langs: [...LOCALES, AR] })
  const m = mobileMenu(ar)
  assert.ok(m.includes('<details'))
  const classes = [...m.matchAll(/class="([^"]*)"/g)].flatMap((x) => x[1].split(/\s+/))
  assert.deepEqual(classes.filter((c) => /^(?:-?(?:ml|mr|pl|pr|left|right)-|text-(?:left|right)$)/.test(c)), [], 'no physical-direction class')
})
