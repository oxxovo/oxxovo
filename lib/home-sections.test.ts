// Video sections and card badges: the mapping TK fixed (2026-10-11) and the invariants
// that keep every content kind reachable and badged.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CONTENT_KINDS } from './content-kinds.ts'
import { COMPETITION_BADGE, SECTIONS, badgeKey, badgeOfKind, getSection, isSectionId } from './home-sections.ts'
import { EN } from './site-messages-en.ts'

test('badges: exactly the mapping TK fixed, and their wording comes from the catalog', () => {
  assert.equal(COMPETITION_BADGE, 'competition')
  assert.equal(badgeOfKind('news'), 'daily')
  for (const k of ['drama', 'film', 'music', 'music_video'] as const) assert.equal(badgeOfKind(k), 'original', k)
  assert.equal(badgeOfKind('cf'), 'commercial')
  assert.equal(EN[badgeKey('competition')], 'COMPETITION')
  assert.equal(EN[badgeKey('original')], 'OXXOVO ORIGINAL')
  assert.equal(EN[badgeKey('daily')], 'OXXOVO DAILY')
  assert.equal(EN[badgeKey('commercial')], 'COMMERCIAL')
})

test('every content kind has a badge (a new kind cannot ship unbadged)', () => {
  for (const k of CONTENT_KINDS) assert.ok(badgeOfKind(k), k)
})

test('section ids are unique and every label is a real catalog key', () => {
  assert.equal(new Set(SECTIONS.map((s) => s.id)).size, SECTIONS.length)
  for (const s of SECTIONS) assert.ok(s.labelKey in EN, s.id)
})

test('Music lists both music and music_video; Entertainment lists the 5 non-news kinds', () => {
  assert.deepEqual([...getSection('music').kinds].sort(), ['music', 'music_video'])
  assert.deepEqual([...getSection('entertainment').kinds].sort(), ['cf', 'drama', 'film', 'music', 'music_video'])
})

test('every content kind is reachable from All and from at least one other section', () => {
  const all = new Set(getSection('all').kinds)
  const others = new Set(SECTIONS.filter((s) => s.id !== 'all').flatMap((s) => [...s.kinds]))
  for (const k of CONTENT_KINDS) {
    assert.ok(all.has(k), `all misses ${k}`)
    assert.ok(others.has(k), `no section lists ${k}`)
  }
})

test('section id check', () => {
  assert.equal(isSectionId('news'), true)
  for (const bad of ['market', '', 'NEWS', '__proto__', undefined, null, 3]) assert.equal(isSectionId(bad), false, String(bad))
})
