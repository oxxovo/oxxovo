// Pages, top menu and left menus of the new site.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, existsSync } from 'node:fs'
import { PAGES, TOP_MENU, getPage, pageOfPath, resolveSidebarItem, sidebarHref } from './site-nav.ts'
import { EN } from './site-messages-en.ts'
import { SITE_ROUTES } from './locales.ts'
import { getSection } from './home-sections.ts'
import { BANNER_PAGES } from './site-banner.ts'

test('top menu: the 7 business axes in order, each its own page', () => {
  assert.deepEqual(TOP_MENU.map((p) => EN[p.navKey!]), ['Tournament', 'Entertainment', 'Daily', 'Market', 'Education', 'Jobs', 'AI Games'])
  assert.equal(new Set(PAGES.map((p) => p.path)).size, PAGES.length)
})

test('Tournament leads to /competition (the live /tournament gallery is untouched) and Studio is not an axis', () => {
  assert.equal(getPage('tournament').path, '/competition')
  assert.ok(!PAGES.some((p) => p.path === '/tournament' || p.path === '/studio'))
})

test('every page path is a site route with a real app folder, and every site route is a page', () => {
  assert.deepEqual([...PAGES.map((p) => p.path.slice(1))].sort(), [...SITE_ROUTES].sort())
  for (const p of PAGES) assert.ok(existsSync(p.path === '/' ? 'app/page.tsx' : `app${p.path}/page.tsx`), p.path)
})

test('every menu label is a catalog key; every item with a source names a real section', () => {
  for (const p of PAGES) for (const i of p.side) {
    assert.ok(i.labelKey in EN, `${p.id}/${i.id}`)
    if (i.section) assert.ok(getSection(i.section), `${p.id}/${i.id}`)
  }
})

test('left menus are the approved mockup menus (counts, first item = the page home)', () => {
  const counts: Record<string, number> = { entertainment: 9, daily: 8, market: 9, education: 9, jobs: 8, games: 9 }
  for (const [id, n] of Object.entries(counts)) {
    const p = getPage(id as never)
    assert.equal(p.side.length, n, id)
    assert.equal(p.side[0].id, 'home', id)
    assert.equal(new Set(p.side.map((i) => i.id)).size, n, id + ': item ids are unique')
  }
  assert.deepEqual(getPage('market').side.map((i) => EN[i.labelKey]), ['AI Market Home', 'All Products', 'AI Robots', 'AI Software', 'AI Hardware', 'Compare', 'Buying Guide', 'Featured', 'Inquiry'])
})

test('data sources: only the items that equal a content kind list videos; everything else is an empty frame; Coming Soon is one catalog key', () => {
  const withSource = PAGES.flatMap((p) => p.side.filter((i) => i.section).map((i) => p.id + '/' + i.id + '=' + i.section)).sort()
  assert.deepEqual(withSource, ['daily/home=news', 'daily/latest=news', 'entertainment/cf=cf', 'entertainment/drama=drama', 'entertainment/film=film', 'entertainment/home=entertainment', 'entertainment/music=music'])
  for (const id of ['market', 'education', 'jobs', 'games'] as const) for (const i of getPage(id).side) assert.equal(i.section, null, id + '/' + i.id)
  const wording = Object.entries(EN).filter(([, v]) => v.toLowerCase().includes('coming soon')).map(([k]) => k)
  assert.deepEqual(wording, ['page.comingSoon'], '"Coming Soon" wording lives in exactly one catalog key')
})

test('?m= resolves inside the page; unknown or foreign values fall to the first item; no menu -> null', () => {
  const ent = getPage('entertainment')
  assert.equal(resolveSidebarItem(ent, 'film')?.section, 'film')
  assert.equal(resolveSidebarItem(ent, 'nope')?.id, 'home')
  assert.equal(resolveSidebarItem(ent, ['film', 'cf'])?.id, 'home')
  assert.equal(resolveSidebarItem(ent, '__proto__')?.id, 'home')
  assert.equal(resolveSidebarItem(getPage('daily'), 'film')?.id, 'home', 'a value from another page never selects')
  assert.equal(resolveSidebarItem(getPage('tournament'), 'x'), null)
  assert.equal(sidebarHref(ent, ent.side[0]), '/entertainment')
  assert.equal(sidebarHref(ent, ent.side[1]), '/entertainment?m=film')
})

test('pageOfPath and banner pages cover the same 8 pages', () => {
  for (const p of PAGES) assert.equal(pageOfPath(p.path), p.id)
  assert.equal(pageOfPath('/watch'), null)
  assert.deepEqual([...BANNER_PAGES].sort(), PAGES.map((p) => p.id).sort())
})

test('no stray route folders: every new-site folder under app/ is a page', () => {
  const dirs = readdirSync('app', { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  for (const r of SITE_ROUTES.filter(Boolean)) assert.ok(dirs.includes(r), r)
})

// ---- the switch: nothing of the new site is reachable while watch_as_home is off ----
import { readFileSync } from 'node:fs'
const code = (f: string) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n')

test('★every new page goes through the gate: it loads its data with loadSitePage -> enterSite -> isWatchHome -> notFound', () => {
  for (const p of PAGES.filter((x) => x.id !== 'home')) {
    const f = `app${p.path}/page.tsx`
    const src = code(f)
    assert.ok(/loadSitePage\(|<SectionPage /.test(src), `${f} must load through the gate`)
  }
  assert.ok(code('app/_site/SectionPage.tsx').includes('loadSitePage('))
  assert.ok(code('lib/site-page.ts').includes('enterSite('))
  const gate = code('lib/site-locale.ts')
  assert.ok(/if \(!\(await isNewSiteOpen\(\)\)\) notFound\(\)/.test(gate), 'the first check is the switch')
  assert.ok(gate.indexOf('isNewSiteOpen()') < gate.indexOf('headers()'), 'the switch is checked before anything else is read')
})

test('★/competition redirects to /watch only after the gate, and only when the competition is public', () => {
  const src = code('app/competition/page.tsx')
  assert.ok(src.indexOf('loadSitePage(') < src.indexOf('redirect('), 'gate first')
  assert.ok(/if \(await isCompetitionWatchPublic\(\)\) redirect\('\/watch'\)/.test(src))
})

test('watch is linked, not modified: the Tournament page does not import any watch component', () => {
  const src = code('app/competition/page.tsx')
  assert.ok(!/from '[^']*\/watch\//.test(src) && !/ArenaWatch/.test(src))
})
