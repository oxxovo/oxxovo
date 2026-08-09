// The music grid as participants SEE it: keys -> KO/EN text, plus the picker's filter
// rule. PURE -- no DB, no server-only, so the rule is executed by tests.
//
// ★KEYS AND LABELS ARE SEPARATE ON PURPOSE. The worker writes lowercase-ASCII keys
// (`cinematic`, `elegant`) into `genre` / `mood`; the words a participant reads live
// here. So re-wording "차분한" costs one line, not a thousand-row UPDATE -- and it can
// never invalidate a v1m signature, which is computed over
// `v1m|assetId|source|contentHash` and has nothing to do with labels.
//
// ★THE TWO SIDES MUST NOT DRIFT. The key lists below are a second copy of
// oxxovo-studio's assets/music-grid.json, and a second copy is a thing that goes stale.
// `npm run test:music-grid-parity` reads the worker's file and asserts the two agree,
// the same cross-repo discipline as test:kat. It is NOT in `npm test`, because CI has no
// worker checkout and a test that cannot run is worse than one that is absent.
//
// ★VOCABULARY CONFIRMED 2026-08-08 by 제니3/본부. 'Luxury' was refused as a
// product-grade word (it implies an industry) and replaced by 'elegant'; rock and
// percussion were dropped for sparsity, not leakage.
//
// ★NO PRODUCT-CATEGORY / INDUSTRY / AD-FORMAT WORDS, in either language. A label alone
// leaks the main-round theme, which must not be inferable from Studio before the
// 11/8 12:00 reveal. `npm run test:theme-leak` fails the build on one, and the keys are
// guarded again on the worker side at the moment the vocabulary is read.

export type MusicLang = 'ko' | 'en'

/** genre axis -- 10 values. Order is display order, not significance. */
export const MUSIC_GENRE_KEYS = [
  'cinematic',
  'orchestral',
  'piano',
  'acoustic',
  'ambient',
  'electronic',
  'lo-fi',
  'pop',
  'hip-hop',
  'jazz',
] as const

/** mood axis -- 8 values. */
export const MUSIC_MOOD_KEYS = [
  'bright',
  'warm',
  'calm',
  'dreamy',
  'elegant',
  'energetic',
  'tense',
  'dark',
] as const

export type MusicGenreKey = (typeof MUSIC_GENRE_KEYS)[number]
export type MusicMoodKey = (typeof MUSIC_MOOD_KEYS)[number]

const GENRE_LABELS: Record<MusicGenreKey, { ko: string; en: string }> = {
  cinematic: { ko: '시네마틱', en: 'Cinematic' },
  orchestral: { ko: '오케스트럴', en: 'Orchestral' },
  piano: { ko: '피아노', en: 'Piano' },
  acoustic: { ko: '어쿠스틱', en: 'Acoustic' },
  ambient: { ko: '앰비언트', en: 'Ambient' },
  electronic: { ko: '일렉트로닉', en: 'Electronic' },
  'lo-fi': { ko: '로파이', en: 'Lo-fi' },
  pop: { ko: '팝', en: 'Pop' },
  'hip-hop': { ko: '힙합', en: 'Hip-hop' },
  jazz: { ko: '재즈', en: 'Jazz' },
}

const MOOD_LABELS: Record<MusicMoodKey, { ko: string; en: string }> = {
  bright: { ko: '밝은', en: 'Bright' },
  warm: { ko: '따뜻한', en: 'Warm' },
  calm: { ko: '차분한', en: 'Calm' },
  dreamy: { ko: '몽환적인', en: 'Dreamy' },
  elegant: { ko: '우아한', en: 'Elegant' },
  energetic: { ko: '활기찬', en: 'Energetic' },
  tense: { ko: '긴장감 있는', en: 'Tense' },
  dark: { ko: '어두운', en: 'Dark' },
}

/**
 * ★An UNKNOWN key returns the key itself rather than throwing or rendering blank.
 *
 * `mood` predates the grid as a free-text column, so a row loaded before the vocabulary
 * existed can hold anything. Showing the raw value is the honest failure: the
 * participant still sees something, and an operator sees immediately that the row was
 * never classified. Blank would hide it; a throw would take the whole picker down over
 * one bad row.
 */
export function genreLabel(key: string | null | undefined, lang: MusicLang): string {
  if (!key) return ''
  return GENRE_LABELS[key as MusicGenreKey]?.[lang] ?? key
}

export function moodLabel(key: string | null | undefined, lang: MusicLang): string {
  if (!key) return ''
  return MOOD_LABELS[key as MusicMoodKey]?.[lang] ?? key
}

// ---------------------------------------------------------------------------
// Tempo -- a FILTER, not an axis.
//
// ★Why not a third axis: 80 cells as genre x mood is 12.5 tracks each, but a
// three-condition cell ("tense x ambient x fast") comes back EMPTY far more often, and
// an empty filter result deletes the reason for having 1,000 tracks.
//
// Edges mirror the worker's tempoBucketsBpm [90, 120] and the boundary is inclusive
// upward, exactly as `tempoBucket` there: 90 is mid, 120 is fast.
// ---------------------------------------------------------------------------

export const TEMPO_BUCKET_EDGES_BPM = [90, 120] as const
export const MUSIC_TEMPO_KEYS = ['slow', 'mid', 'fast'] as const
export type MusicTempoKey = (typeof MUSIC_TEMPO_KEYS)[number]

const TEMPO_LABELS: Record<MusicTempoKey, { ko: string; en: string }> = {
  slow: { ko: '느림', en: 'Slow' },
  mid: { ko: '보통', en: 'Mid' },
  fast: { ko: '빠름', en: 'Fast' },
}

export function tempoLabel(key: MusicTempoKey, lang: MusicLang): string {
  return TEMPO_LABELS[key][lang]
}

/** Which bucket a bpm falls in. null when there is no usable bpm. */
export function tempoKeyOf(bpm: number | null | undefined): MusicTempoKey | null {
  if (bpm === null || bpm === undefined || !Number.isFinite(bpm) || bpm <= 0) return null
  if (bpm < TEMPO_BUCKET_EDGES_BPM[0]) return 'slow'
  if (bpm < TEMPO_BUCKET_EDGES_BPM[1]) return 'mid'
  return 'fast'
}

// ---------------------------------------------------------------------------
// The picker's filter
// ---------------------------------------------------------------------------

/** What the filter needs from an asset. Everything optional: see the note below. */
export type MusicFilterable = {
  genre?: string | null
  mood?: string | null
  bpm?: number | null
}

export type MusicFilterSelection = {
  genre?: MusicGenreKey | null
  mood?: MusicMoodKey | null
  tempo?: MusicTempoKey | null
}

/**
 * Does one asset pass the current selection? Unset facets do not constrain.
 *
 * ★AN ASSET MISSING THE FACET BEING FILTERED IS EXCLUDED, and that is the decision
 * worth stating. `genre` and `bpm` are not migrated yet, so today EVERY asset lacks
 * them: filtering by genre would empty the picker. That is why the UI only offers a
 * facet once the loaded data actually carries it (`availableFacets` below) -- the rule
 * here stays strict, and the surface is what adapts. Treating "no genre" as "matches
 * every genre" would be worse: after the migration a handful of unclassified rows would
 * turn up under every filter and look like classification that had happened.
 */
export function musicAssetMatches(asset: MusicFilterable, sel: MusicFilterSelection): boolean {
  if (sel.genre) {
    if (!asset.genre || asset.genre.toLowerCase() !== sel.genre) return false
  }
  if (sel.mood) {
    if (!asset.mood || asset.mood.toLowerCase() !== sel.mood) return false
  }
  if (sel.tempo) {
    if (tempoKeyOf(asset.bpm) !== sel.tempo) return false
  }
  return true
}

export function filterMusicAssets<T extends MusicFilterable>(assets: readonly T[], sel: MusicFilterSelection): T[] {
  return assets.filter((a) => musicAssetMatches(a, sel))
}

/**
 * Which facets the LOADED data can actually be filtered by.
 *
 * ★This is what keeps a dead control off the screen. Rendering a genre filter while the
 * column is unmigrated would offer 10 choices that all return nothing -- and the
 * participant would read that as "there is no cinematic music", not as "this filter is
 * not connected yet". When the migration lands and rows carry genre, the control appears
 * with no code change here.
 */
export function availableFacets(assets: readonly MusicFilterable[]): {
  genre: boolean
  mood: boolean
  tempo: boolean
} {
  return {
    genre: assets.some((a) => !!a.genre),
    mood: assets.some((a) => !!a.mood),
    tempo: assets.some((a) => tempoKeyOf(a.bpm) !== null),
  }
}

/** Only the values PRESENT in the loaded data, in canonical order. */
export function presentGenreKeys(assets: readonly MusicFilterable[]): MusicGenreKey[] {
  const have = new Set(assets.map((a) => (a.genre ?? '').toLowerCase()))
  return MUSIC_GENRE_KEYS.filter((k) => have.has(k))
}

export function presentMoodKeys(assets: readonly MusicFilterable[]): MusicMoodKey[] {
  const have = new Set(assets.map((a) => (a.mood ?? '').toLowerCase()))
  return MUSIC_MOOD_KEYS.filter((k) => have.has(k))
}

export function presentTempoKeys(assets: readonly MusicFilterable[]): MusicTempoKey[] {
  const have = new Set(assets.map((a) => tempoKeyOf(a.bpm)).filter(Boolean) as MusicTempoKey[])
  return MUSIC_TEMPO_KEYS.filter((k) => have.has(k))
}

/**
 * The one line a participant reads for a track in the picker.
 *
 * ★The design (§5) called out that `mood` was doing two jobs -- classification key AND
 * display string, rendered raw as `{mood} — {title}`. With the vocabulary confirmed the
 * key is English (`elegant`), so rendering it raw shows English to a Korean
 * participant. Display is the localised label plus the title; the key stays in the
 * column.
 */
export function musicPickerLine(
  asset: { title?: string | null; mood?: string | null; genre?: string | null },
  lang: MusicLang,
): string {
  const facets = [genreLabel(asset.genre, lang), moodLabel(asset.mood, lang)].filter(Boolean)
  const title = (asset.title ?? '').trim()
  if (!facets.length) return title || ''
  return title ? `${facets.join(' · ')} — ${title}` : facets.join(' · ')
}
