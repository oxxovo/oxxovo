// The new site's catalogs: English canonical, every other language a layer over it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { LOCALES } from './locales.ts'
import { CATALOGS, message, pickTranslation, translator, type Catalog } from './site-messages.ts'
import { EN, PENDING_COPY, type MessageKey } from './site-messages-en.ts'
import { KO } from './site-messages-ko.ts'

const FAKE: Record<string, Catalog> = { en: EN, ko: { 'nav.daily': '[ko] Daily' }, ar: { 'nav.daily': '[ar] Daily' } }

test('every configured language has a catalog, and English is complete', () => {
  for (const l of LOCALES) assert.ok(CATALOGS[l.code], l.code)
  for (const k of Object.keys(EN) as MessageKey[]) {
    if (PENDING_COPY.includes(k)) assert.equal(EN[k], '', `${k} is pending copy: must stay empty until its wording exists`)
    else assert.ok(EN[k].trim() !== '', `${k} is empty`)
  }
})

test('only the hero sub-line is pending copy (its English is not written; Korean was supplied)', () => {
  assert.deepEqual([...PENDING_COPY], ['hero.sub'])
})

test('every left-menu item has English wording and, being approved in the mockup, Korean wording', () => {
  const sideKeys = (Object.keys(EN) as MessageKey[]).filter((k) => k.startsWith('side.'))
  assert.equal(sideKeys.length, 9 + 8 + 9 + 9 + 8 + 9, 'the mockup menus: 9 + 8 + 9 + 9 + 8 + 9 items')
  for (const k of sideKeys) assert.ok(EN[k].trim() !== '' && (KO[k] ?? '').trim() !== '', k)
})

test('a translation may only use keys that exist in English, and may not blank them', () => {
  for (const [k, v] of Object.entries(KO)) {
    assert.ok(k in EN, `KO has an unknown key ${k}`)
    assert.ok(typeof v === 'string' && v.trim() !== '', `KO blanks ${k}`)
  }
})

test('fallback: a missing key shows English; an own key wins; unknown language is English', () => {
  assert.equal(message('ko', 'nav.daily', FAKE), '[ko] Daily')
  assert.equal(message('ko', 'nav.market', FAKE), 'Market')
  assert.equal(message('xx', 'nav.market', FAKE), 'Market')
  assert.equal(message('ko', 'side.market.1', FAKE), '', 'pending copy stays empty, never a raw key')
  assert.equal(translator('ar', FAKE)('nav.daily'), '[ar] Daily')
})

test('a screen is one language: a key missing in ar falls to English, not to ko', () => {
  assert.equal(message('ar', 'nav.market', FAKE), 'Market')
})

test('★no literal wording in the new-site files: every visible string goes through the catalog', () => {
  const files = ['app/_site/SiteFrame.tsx', 'app/_site/Card.tsx', 'app/_site/LanguageMenu.tsx', 'app/_site/SectionPage.tsx', 'app/competition/page.tsx', 'app/page.tsx']
  for (const f of files) {
    const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n')
    const texts = [...src.matchAll(/>\s*([A-Za-z][A-Za-z ,.'!?-]{2,})\s*</g)].map((m) => m[1].trim())
    assert.deepEqual(texts, [], `${f} has literal text: ${texts.join(' | ')}`)
  }
})

test('content translation seat: translated title, canonical fallback, blank translation ignored', () => {
  const c = { title: 'Canon', description: 'Canon desc' }
  assert.deepEqual(pickTranslation(c, 'ko', { ko: { title: 'T', description: 'D' } }), { title: 'T', description: 'D' })
  assert.deepEqual(pickTranslation(c, 'ko', { ko: { title: '  ' } }), { title: 'Canon', description: 'Canon desc' })
  assert.deepEqual(pickTranslation(c, 'ko', undefined), c)
  assert.deepEqual(pickTranslation(c, 'ja', { ko: { title: 'T' } }), c)
  assert.deepEqual(pickTranslation(c, 'en', { en: { title: 'ignored' } }), c, 'English is the canonical column itself')
  assert.deepEqual(pickTranslation({ title: 'x', description: null }, 'ko', { ko: { description: 'D' } }), { title: 'x', description: 'D' })
})
