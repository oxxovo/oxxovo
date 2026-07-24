// validateMusicBed shape/bounds unit tests (server authority; client mirrors).
// Run via the app suite: node --import ./scripts/test-register.mjs --test lib/music-limits.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { validateMusicBed } from './music-limits.ts'

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
