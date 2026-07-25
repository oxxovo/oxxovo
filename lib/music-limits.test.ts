// validateMusicBed shape/bounds unit tests (server authority; client mirrors).
// Run via the app suite: node --import ./scripts/test-register.mjs --test lib/music-limits.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateMusicBed,
  validateMusicPrompt,
  findImitation,
  parseArtistBlocklist,
  MAX_MUSIC_PROMPT,
} from './music-limits.ts'

const base = { assetId: 'lib_elegant_01', source: 'library' as const, volume: 70, clipVolume: 40, startMs: 0, endMs: 5000, fadeInMs: 500, fadeOutMs: 800 }
const TOTAL = 5000

test('valid bed passes', () => {
  assert.deepEqual(validateMusicBed(base, TOTAL), { ok: true })
})

test('absent music is valid (clip audio only)', () => {
  assert.deepEqual(validateMusicBed(undefined, TOTAL), { ok: true })
  assert.deepEqual(validateMusicBed(null, TOTAL), { ok: true })
})

test('endMs absent => plays to composition end (valid)', () => {
  assert.deepEqual(validateMusicBed({ ...base, endMs: undefined }, TOTAL), { ok: true })
})

test('bad shape rejects', () => {
  assert.equal(validateMusicBed({ ...base, assetId: '' }, TOTAL).ok, false)
  assert.equal((validateMusicBed({ ...base, source: 'upload' as never }, TOTAL) as { reason: string }).reason, 'music_shape')
})

test('volume out of range rejects', () => {
  assert.equal((validateMusicBed({ ...base, volume: 101 }, TOTAL) as { reason: string }).reason, 'music_volume')
  assert.equal((validateMusicBed({ ...base, clipVolume: -1 }, TOTAL) as { reason: string }).reason, 'music_volume')
})

test('window out of range rejects', () => {
  assert.equal((validateMusicBed({ ...base, endMs: TOTAL + 100 }, TOTAL) as { reason: string }).reason, 'music_window')
  assert.equal((validateMusicBed({ ...base, startMs: 4900, endMs: 5000 }, TOTAL) as { reason: string }).reason, 'music_window') // < MIN_WINDOW_MS
  assert.equal((validateMusicBed({ ...base, startMs: 3000, endMs: 2000 }, TOTAL) as { reason: string }).reason, 'music_window')
})

test('fades longer than the window reject', () => {
  assert.equal((validateMusicBed({ ...base, fadeInMs: 3000, fadeOutMs: 3000 }, TOTAL) as { reason: string }).reason, 'music_fade')
  assert.equal((validateMusicBed({ ...base, fadeInMs: -1 }, TOTAL) as { reason: string }).reason, 'music_fade')
})

// --- Stage 6: AI-gen prompt guards ---

test('valid mood prompt passes + trims', () => {
  const r = validateMusicPrompt('  warm acoustic guitar, hopeful  ')
  assert.deepEqual(r, { ok: true, prompt: 'warm acoustic guitar, hopeful' })
})

test('empty/whitespace prompt rejects', () => {
  assert.equal((validateMusicPrompt('') as { reason: string }).reason, 'music_prompt_empty')
  assert.equal((validateMusicPrompt('   ') as { reason: string }).reason, 'music_prompt_empty')
  assert.equal((validateMusicPrompt(123 as never) as { reason: string }).reason, 'music_prompt_empty')
})

test('over-length prompt rejects', () => {
  const long = 'a'.repeat(MAX_MUSIC_PROMPT + 1)
  assert.equal((validateMusicPrompt(long) as { reason: string }).reason, 'music_prompt_too_long')
  assert.equal(validateMusicPrompt('a'.repeat(MAX_MUSIC_PROMPT)).ok, true) // boundary ok
})

test('imitation phrases are caught (EN + KO)', () => {
  assert.ok(findImitation('make it in the style of a famous singer'))
  assert.ok(findImitation('something that sounds like a hit song'))
  assert.ok(findImitation('a cover of that track'))
  assert.ok(findImitation('유명한 가수 스타일로 만들어줘'))
  assert.ok(findImitation('그 노래처럼 만들어줘'))
})

test('clean mood prompt has no imitation signal', () => {
  assert.equal(findImitation('bright uplifting electro-pop for a skincare ad'), null)
  assert.equal(findImitation('elegant piano and strings, premium and calm'), null)
})

test('curated artist/track blocklist is caught (case-insensitive, CJK-safe)', () => {
  const list = parseArtistBlocklist('SomeArtist, 어떤가수')
  assert.equal(findImitation('a beat like SOMEARTIST would make', list), 'SomeArtist')
  assert.equal(findImitation('어떤가수 느낌의 곡', list), '어떤가수')
  assert.equal(findImitation('a generic upbeat track', list), null)
})

test('parseArtistBlocklist accepts JSON array or delimited', () => {
  assert.deepEqual(parseArtistBlocklist('["A","B"]'), ['A', 'B'])
  assert.deepEqual(parseArtistBlocklist('A, B\nC'), ['A', 'B', 'C'])
  assert.deepEqual(parseArtistBlocklist(''), [])
  assert.deepEqual(parseArtistBlocklist(null), [])
})
