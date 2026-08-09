// Run: node --import ./scripts/test-register.mjs --test lib/music-grid-labels.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MUSIC_GENRE_KEYS,
  MUSIC_MOOD_KEYS,
  MUSIC_TEMPO_KEYS,
  TEMPO_BUCKET_EDGES_BPM,
  genreLabel,
  moodLabel,
  tempoLabel,
  tempoKeyOf,
  musicAssetMatches,
  filterMusicAssets,
  availableFacets,
  presentGenreKeys,
  presentMoodKeys,
  presentTempoKeys,
  musicPickerLine,
} from './music-grid-labels.ts'

// ---- the approved shape --------------------------------------------------
test('★the grid is the approved 10 x 8 = 80 cells', () => {
  assert.equal(MUSIC_GENRE_KEYS.length, 10)
  assert.equal(MUSIC_MOOD_KEYS.length, 8)
  assert.equal(MUSIC_GENRE_KEYS.length * MUSIC_MOOD_KEYS.length, 80)
  // 1,000 tracks / 80 cells = 12.5, the density the design sized for
  assert.equal(1000 / 80, 12.5)
})

test('keys are lowercase-ascii and unique on both axes', () => {
  for (const k of [...MUSIC_GENRE_KEYS, ...MUSIC_MOOD_KEYS]) {
    assert.match(k, /^[a-z][a-z-]*$/, `"${k}" is not a lowercase-ascii key`)
  }
  assert.equal(new Set(MUSIC_GENRE_KEYS).size, MUSIC_GENRE_KEYS.length)
  assert.equal(new Set(MUSIC_MOOD_KEYS).size, MUSIC_MOOD_KEYS.length)
})

test('every key has a non-empty label in BOTH languages, and they differ', () => {
  for (const k of MUSIC_GENRE_KEYS) {
    for (const lang of ['ko', 'en']) assert.ok(genreLabel(k, lang).length > 0, `genre ${k}/${lang}`)
    // an untranslated entry would silently fall back to the key
    assert.notEqual(genreLabel(k, 'ko'), k, `genre "${k}" has no KO label (fell back to the key)`)
  }
  for (const k of MUSIC_MOOD_KEYS) {
    for (const lang of ['ko', 'en']) assert.ok(moodLabel(k, lang).length > 0, `mood ${k}/${lang}`)
    assert.notEqual(moodLabel(k, 'ko'), k, `mood "${k}" has no KO label (fell back to the key)`)
  }
  for (const k of MUSIC_TEMPO_KEYS) {
    assert.ok(tempoLabel(k, 'ko').length > 0)
    assert.ok(tempoLabel(k, 'en').length > 0)
  }
})

// ---- ★the leak guard, on the labels themselves ---------------------------
// The build-level guard (npm run test:theme-leak) scopes to app/studio/**, and this
// file is lib/, so the vocabulary would not be covered by it. Assert it here.
test('★no label in either language contains a product-category / industry / ad-format word', () => {
  const banned = [
    '화장품', '코스메틱', '코스메', '스킨케어', '뷰티', '메이크업', '립스틱', '제품', '광고', '커머셜',
    'cosmetic', 'skincare', 'makeup', 'lipstick', 'beauty', 'product', 'commercial', 'luxury',
  ]
  const all = [
    ...MUSIC_GENRE_KEYS.flatMap((k) => [k, genreLabel(k, 'ko'), genreLabel(k, 'en')]),
    ...MUSIC_MOOD_KEYS.flatMap((k) => [k, moodLabel(k, 'ko'), moodLabel(k, 'en')]),
    ...MUSIC_TEMPO_KEYS.flatMap((k) => [k, tempoLabel(k, 'ko'), tempoLabel(k, 'en')]),
  ].map((s) => s.toLowerCase())
  for (const value of all) {
    for (const term of banned) {
      assert.ok(!value.includes(term.toLowerCase()), `"${value}" contains the banned term "${term}"`)
    }
  }
})

test("★the values head office dropped stay dropped", () => {
  const all = [...MUSIC_GENRE_KEYS, ...MUSIC_MOOD_KEYS]
  assert.ok(!all.includes('luxury'), "'luxury' implies a product grade -- 'elegant' replaced it")
  assert.ok(all.includes('elegant'), "'elegant' is the replacement and must be present")
  assert.ok(!all.includes('rock'), "'rock' was dropped for sparsity (rock x elegant is empty)")
  assert.ok(!all.includes('percussion'), "'percussion' was dropped for sparsity")
})

// ---- unknown keys degrade visibly, not silently --------------------------
test('★an unknown key renders as itself -- visible, not blank, not a throw', () => {
  assert.equal(moodLabel('legacy-freetext', 'ko'), 'legacy-freetext')
  assert.equal(genreLabel('dubstep', 'en'), 'dubstep')
  assert.equal(moodLabel(null, 'ko'), '')
  assert.equal(moodLabel(undefined, 'en'), '')
  assert.equal(genreLabel('', 'ko'), '')
})

// ---- tempo buckets, and the boundary the worker uses --------------------
test('tempo buckets match the worker: the edge is inclusive UPWARD', () => {
  assert.deepEqual([...TEMPO_BUCKET_EDGES_BPM], [90, 120])
  assert.equal(tempoKeyOf(89), 'slow')
  assert.equal(tempoKeyOf(90), 'mid') // 90 is mid, not slow
  assert.equal(tempoKeyOf(119), 'mid')
  assert.equal(tempoKeyOf(120), 'fast') // 120 is fast, not mid
  assert.equal(tempoKeyOf(200), 'fast')
})

test('a missing or nonsense bpm has NO bucket rather than a default one', () => {
  for (const bad of [null, undefined, 0, -1, NaN, Infinity]) {
    assert.equal(tempoKeyOf(bad), null, `bpm=${String(bad)}`)
  }
})

// ---- the filter ---------------------------------------------------------
const A = { genre: 'cinematic', mood: 'elegant', bpm: 96 }
const B = { genre: 'lo-fi', mood: 'calm', bpm: 72 }
const C = { genre: 'cinematic', mood: 'calm', bpm: 130 }
const BARE = { title: 'unclassified' }

test('an empty selection constrains nothing', () => {
  assert.equal(filterMusicAssets([A, B, C, BARE], {}).length, 4)
  assert.equal(musicAssetMatches(BARE, {}), true)
})

test('facets intersect (AND), not union', () => {
  assert.deepEqual(filterMusicAssets([A, B, C], { genre: 'cinematic' }), [A, C])
  assert.deepEqual(filterMusicAssets([A, B, C], { genre: 'cinematic', mood: 'calm' }), [C])
  assert.deepEqual(filterMusicAssets([A, B, C], { genre: 'cinematic', mood: 'calm', tempo: 'fast' }), [C])
  assert.deepEqual(filterMusicAssets([A, B, C], { genre: 'lo-fi', mood: 'elegant' }), [])
})

test('the tempo facet filters by BUCKET, not by an exact bpm', () => {
  assert.deepEqual(filterMusicAssets([A, B, C], { tempo: 'mid' }), [A])
  assert.deepEqual(filterMusicAssets([A, B, C], { tempo: 'slow' }), [B])
  assert.deepEqual(filterMusicAssets([A, B, C], { tempo: 'fast' }), [C])
})

test('★an asset missing the facet being filtered is EXCLUDED, not treated as a match', () => {
  // Today every asset is BARE (genre/bpm unmigrated). If absence matched everything,
  // then after the migration the unclassified leftovers would appear under every
  // filter and look like classification that had happened.
  assert.equal(musicAssetMatches(BARE, { genre: 'cinematic' }), false)
  assert.equal(musicAssetMatches(BARE, { mood: 'calm' }), false)
  assert.equal(musicAssetMatches(BARE, { tempo: 'slow' }), false)
})

test('key comparison is case-insensitive on the stored value', () => {
  assert.equal(musicAssetMatches({ genre: 'Cinematic' }, { genre: 'cinematic' }), true)
  assert.equal(musicAssetMatches({ mood: 'ELEGANT' }, { mood: 'elegant' }), true)
})

test('a null selection value does not constrain (same as absent)', () => {
  assert.equal(filterMusicAssets([A, B], { genre: null, mood: null, tempo: null }).length, 2)
})

// ---- what the UI may offer ----------------------------------------------
test('★with today\'s unmigrated data, NO facet is offered -- so no dead control renders', () => {
  const todaysRows = [{ mood: null, title: 'x' }, { mood: null, title: 'y' }]
  assert.deepEqual(availableFacets(todaysRows), { genre: false, mood: false, tempo: false })
})

test('a facet becomes available exactly when the loaded data carries it', () => {
  assert.deepEqual(availableFacets([{ mood: 'calm' }]), { genre: false, mood: true, tempo: false })
  assert.deepEqual(availableFacets([{ genre: 'jazz' }]), { genre: true, mood: false, tempo: false })
  assert.deepEqual(availableFacets([{ bpm: 96 }]), { genre: false, mood: false, tempo: true })
  assert.deepEqual(availableFacets([{ bpm: 0 }]), { genre: false, mood: false, tempo: false })
})

test('only PRESENT values are offered, in canonical order', () => {
  assert.deepEqual(presentGenreKeys([C, B, A]), ['cinematic', 'lo-fi'])
  assert.deepEqual(presentMoodKeys([C, B, A]), ['calm', 'elegant'])
  assert.deepEqual(presentTempoKeys([C, B, A]), ['slow', 'mid', 'fast'])
  assert.deepEqual(presentGenreKeys([BARE]), [])
})

test('an unknown stored value is NOT offered as a filter choice', () => {
  // it still renders (see the unknown-key test) but it is not a grid value, so it
  // cannot become a chip.
  assert.deepEqual(presentGenreKeys([{ genre: 'dubstep' }]), [])
})

// ---- the picker line ----------------------------------------------------
test('★the picker line is LOCALISED, not the raw key', () => {
  assert.equal(musicPickerLine({ title: 'Aurora', mood: 'elegant', genre: 'cinematic' }, 'ko'), '시네마틱 · 우아한 — Aurora')
  assert.equal(musicPickerLine({ title: 'Aurora', mood: 'elegant', genre: 'cinematic' }, 'en'), 'Cinematic · Elegant — Aurora')
})

test('the line degrades cleanly as facets go missing', () => {
  assert.equal(musicPickerLine({ title: 'Aurora', mood: 'calm' }, 'ko'), '차분한 — Aurora')
  assert.equal(musicPickerLine({ title: 'Aurora' }, 'ko'), 'Aurora')
  assert.equal(musicPickerLine({ mood: 'calm' }, 'ko'), '차분한')
  assert.equal(musicPickerLine({}, 'ko'), '')
  assert.equal(musicPickerLine({ title: '  ' }, 'ko'), '')
})
