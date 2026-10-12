// New-site language routing: addresses, negotiation, and the guarantees around the
// proxy (no duplicate addresses, no /ko/watch, a client cannot supply the language).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  DEFAULT_LOCALE, LOCALES, SITE_ROUTES, decideRoute, dirOf, isLocale, isSiteRoute, negotiateLocale,
  preferredLocale, syncLegacyLang, withLocale, type LocaleDef,
} from './locales.ts'
import { RESERVED_SLUGS } from './content-paths.ts'

const WITH_AR: LocaleDef[] = [...LOCALES, { code: 'ar', nativeName: 'العربية', dir: 'rtl' }]

test('English is the canonical default; ko is the second language; no code is duplicated', () => {
  assert.equal(DEFAULT_LOCALE, 'en')
  assert.deepEqual(LOCALES.map((l) => l.code), ['en', 'ko'])
  assert.equal(new Set(LOCALES.map((l) => l.code)).size, LOCALES.length)
})

test('★every language code and every site route is a reserved slug (a content slug can never shadow them)', () => {
  for (const l of LOCALES) assert.ok(RESERVED_SLUGS.includes(l.code), `locale ${l.code}`)
  for (const r of SITE_ROUTES.filter(Boolean)) assert.ok(RESERVED_SLUGS.includes(r), `route ${r}`)
})

test('addresses: unprefixed English, prefixed everything else, round trip', () => {
  assert.equal(withLocale('/entertainment', 'en'), '/entertainment')
  assert.equal(withLocale('/entertainment', 'ko'), '/ko/entertainment')
  assert.equal(withLocale('/', 'ko'), '/ko')
  assert.equal(withLocale('/', 'en'), '/')
  assert.equal(withLocale('/daily', 'xx'), '/daily', 'unknown language -> unprefixed')
  for (const l of LOCALES) for (const r of SITE_ROUTES) {
    const path = '/' + r
    const d = decideRoute(withLocale(path, l.code))
    if (l.code === 'en') assert.equal(d.action, 'pass')
    else assert.deepEqual(d, { action: 'rewrite', path, locale: l.code, prefixed: true })
  }
})

test('proxy decisions: rewrite ko, redirect /en, never touch other routes', () => {
  assert.deepEqual(decideRoute('/ko/market'), { action: 'rewrite', path: '/market', locale: 'ko', prefixed: true })
  assert.deepEqual(decideRoute('/ko'), { action: 'rewrite', path: '/', locale: 'ko', prefixed: true })
  assert.deepEqual(decideRoute('/ko/'), { action: 'rewrite', path: '/', locale: 'ko', prefixed: true })
  assert.deepEqual(decideRoute('/en/market'), { action: 'redirect', path: '/market' })
  assert.deepEqual(decideRoute('/en'), { action: 'redirect', path: '/' })
  for (const p of ['/ko/watch', '/ko/watch/abc', '/ko/admin', '/ko/tournament', '/ko/market/extra', '/ko/c/123', '/watch', '/market', '/market/x', '/xx/market']) {
    assert.equal(decideRoute(p).action, 'pass', p)
  }
})

test('site route test: only the exact new-site pages', () => {
  for (const p of ['/', '/competition', '/entertainment', '/daily', '/market', '/education', '/jobs', '/games']) assert.equal(isSiteRoute(p), true, p)
  for (const p of ['/watch', '/tournament', '/market/x', '/ko', '/c/1', '/admin']) assert.equal(isSiteRoute(p), false, p)
})

test('negotiation: q order, regional tags, q=0, garbage', () => {
  assert.equal(negotiateLocale('ko-KR,ko;q=0.9,en;q=0.8'), 'ko')
  assert.equal(negotiateLocale('en-US,en;q=0.9,ko;q=0.5'), 'en')
  assert.equal(negotiateLocale('fr;q=0.9,ko;q=0.4'), 'ko')
  assert.equal(negotiateLocale('ko;q=0'), null)
  assert.equal(negotiateLocale('fr,de'), null)
  assert.equal(negotiateLocale('*'), null)
  assert.equal(negotiateLocale(''), null)
  assert.equal(negotiateLocale(null), null)
  assert.equal(negotiateLocale(';;;,,,q=x'), null)
  assert.equal(negotiateLocale('KO-kr'), 'ko')
})

test('a stored choice beats the browser, an explicit English included; no signal -> English', () => {
  assert.equal(preferredLocale('en', 'ko-KR,ko;q=0.9'), 'en')
  assert.equal(preferredLocale('ko', 'en-US'), 'ko')
  assert.equal(preferredLocale(undefined, 'ko-KR'), 'ko')
  assert.equal(preferredLocale('zz', 'ko'), 'ko', 'an unknown stored value is ignored')
  assert.equal(preferredLocale(undefined, undefined), 'en')
  assert.equal(preferredLocale(undefined, 'fr'), 'en')
})

test('★adding a language is configuration only: a new code with rtl works through every function', () => {
  assert.equal(isLocale('ar', WITH_AR), true)
  assert.equal(isLocale('ar'), false)
  assert.equal(dirOf('ar', WITH_AR), 'rtl')
  assert.equal(dirOf('ko', WITH_AR), 'ltr')
  assert.equal(withLocale('/jobs', 'ar', WITH_AR), '/ar/jobs')
  assert.deepEqual(decideRoute('/ar/jobs', WITH_AR), { action: 'rewrite', path: '/jobs', locale: 'ar', prefixed: true })
  assert.equal(negotiateLocale('ar-EG,ar;q=0.9', WITH_AR), 'ar')
  assert.equal(decideRoute('/ar/jobs').action, 'pass', 'without the config line the prefix is just a 404')
})

test('the old ko/en toggle follows ko and en only', () => {
  assert.equal(syncLegacyLang('ko'), 'ko')
  assert.equal(syncLegacyLang('en'), 'en')
  assert.equal(syncLegacyLang('ar'), null)
})

test('★proxy.ts deletes both language headers from every incoming request before setting them', () => {
  const src = readFileSync('proxy.ts', 'utf8')
  assert.ok(/headers\.delete\(LOCALE_HEADER\)/.test(src) && /headers\.delete\(PREFIXED_HEADER\)/.test(src))
  assert.ok(src.indexOf('headers.delete(LOCALE_HEADER)') < src.indexOf('headers.set(LOCALE_HEADER'), 'delete comes before set')
  assert.ok(/isSiteRoute\(pathname\)/.test(src), 'unprefixed site routes are cleaned too, not only rewritten ones')
})
