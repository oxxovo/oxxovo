// The order the curation list is worked in. PURE -- no DB, no server-only, so the
// rule is executed by tests rather than eyeballed (same reason
// lib/music-picker-scope.ts and lib/text-track-lanes.ts exist).
//
// ★WHY THE ORDER IS THE WHOLE FEATURE. Curation is `active` on/off over 1,000
// tracks. The design (reports/lane_c_music_c_plan_design_2026-08-07.md §4b-(3))
// measured that the dominating cost is human listening time, and that machine
// review's real gift is not rejection but ORDER: listen in descending score, stop
// when 1,000 tracks are active, and you never audition the tail. So the curation
// screen is not an independent screen -- it is `active` toggles laid over [2.5]'s
// score-ordered output.
//
// ★[2.5] IS BUILT. THE COLUMN TO PUT IT IN IS NOT. Checked in BOTH repos on
// 2026-08-08 (the first check covered only this one, which is how the screen was
// nearly missed): the worker holds `screenMusic()` in src/music-screen.ts, shipped
// 2026-08-07 in fb42108, and it returns a 0-100 `score` for EVERY track -- rejects
// included, a dead file scoring 0 -- precisely so the audition can run downward and
// stop at the quota. What does not exist is anywhere to persist it:
// studio_music_assets has no score column (the design's migration list is
// genre / bpm / sort_order, and it is 지수 본체's to run), and the table holds 0 rows.
//
// So the score below is a SLOT with a known producer and no storage yet. The SQL
// half deliberately does not name it.
//
// ★`reviewScore` is this side's DTO name for the worker's `screenMusic().score`.
// Same direction (higher is better) and same range. It is NOT the same thing as an
// absent value -- see the unscored note on compareForCuration, which matters
// exactly because the worker scores rejects rather than skipping them.
//
// ★WHY THE SQL HALF MUST NOT NAME IT. PostgREST refuses a statement containing one
// unknown column SILENTLY, taking the whole statement with it
// ([[feedback-postgrest-unknown-column-silent]], which cost a submission with no
// file on 2026-08-03). Ordering by a column that has not been migrated would not
// error -- the list would come back in an arbitrary order, or empty, and look fine.
// So the columns that reach PostgREST are allowlisted here and a test asserts the
// allowlist holds only columns this repo can show are selected elsewhere.

/** A row as the curation list sees it. `reviewScore` is [2.5]'s output -- absent today. */
export type CurationSortRow = {
  id: string
  title: string | null
  reviewScore?: number | null
}

/** One screenful. 1,000 tracks in one response is a page nobody can work. */
export const MUSIC_CURATION_PAGE_SIZE = 100

/**
 * Columns the curation query may ORDER BY today.
 *
 * ★`title` and `id` only, and that is not a placeholder for score -- it is the
 * complete set of ordering columns this repo can prove exist on
 * studio_music_assets, because lib/studio.ts selects both in listMusicAssets. When
 * the score column is migrated, it joins this list and the comparator below already
 * knows what to do with it -- the producer is already written (the worker's
 * screenMusic), so the remaining step is storage, not logic.
 */
export const CURATION_ORDER_COLUMNS: readonly string[] = ['title', 'id']

/** PostgREST `order` terms, in precedence order. */
export function musicCurationOrderTerms(): Array<{ column: string; ascending: boolean }> {
  // id is the tie-break, so paging is stable: without it two rows with the same
  // title can swap between pages and a track is seen twice while another is never
  // seen at all -- the failure mode of a paged list that curators would blame on
  // themselves.
  return [
    { column: 'title', ascending: true },
    { column: 'id', ascending: true },
  ]
}

const hasScore = (r: CurationSortRow): boolean => typeof r.reviewScore === 'number' && Number.isFinite(r.reviewScore)

/**
 * The full rule, INCLUDING the score that does not exist yet.
 *
 * Precedence: scored rows first, by score DESCENDING (the point is to audition the
 * best first); then title ascending; then id, so the order is total and stable.
 *
 * ★Unscored rows sort AFTER scored ones rather than being treated as score 0. A
 * track nobody has measured is not a track that measured badly, and collapsing the
 * two would bury new arrivals among the rejects.
 */
export function compareForCuration(a: CurationSortRow, b: CurationSortRow): number {
  const as = hasScore(a)
  const bs = hasScore(b)
  if (as !== bs) return as ? -1 : 1
  if (as && bs && a.reviewScore !== b.reviewScore) return (b.reviewScore as number) - (a.reviewScore as number)
  const at = a.title ?? ''
  const bt = b.title ?? ''
  if (at !== bt) return at < bt ? -1 : 1
  if (a.id !== b.id) return a.id < b.id ? -1 : 1
  return 0
}

export function orderForCuration<T extends CurationSortRow>(rows: readonly T[]): T[] {
  return [...rows].sort(compareForCuration)
}
