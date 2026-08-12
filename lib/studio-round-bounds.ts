// When a round stops being able to use a job. PURE -- no DB, no imports.
//
// Reading the seasons date columns is all this needs: getSeasonPhase (head
// office) owns which phase a season is IN, and nothing here interprets that.
// The only question is whether one timestamp has passed.
//
// ★It is separated out because it decides a REFUND. A wrong answer here takes
// credits from a job that was still usable, or leaves them held forever, and
// neither shows up as an error -- so the rules are pure and executed by tests
// rather than reasoned about at the call site.

/** The boundaries one season offers. Any of them may be absent. */
export type SeasonBounds = {
  application: number | null
  main: number | null
  /** The latest boundary the season has at all. */
  last: number | null
}

/**
 * Epoch ms, or null for anything that is not a real timestamp.
 *
 * ★NULL IS THE COMMON CASE, not an edge. Measured 2026-08-02: season_1 and every
 * season_100x rehearsal row have application_close_at = null, and several have
 * main_round_end_at = null as well. `Date.parse(null)` is NaN, and NaN
 * comparisons are all false, so a naive `now > parse(x)` happens to fail safe --
 * by accident. Anything that depends on money should not depend on an accident.
 */
export function tsOrNull(value: unknown): number | null {
  const t = Date.parse(String(value ?? ''))
  return Number.isFinite(t) ? t : null
}

export function seasonBoundsFrom(row: {
  application_close_at?: unknown
  main_round_end_at?: unknown
  awards_announcement_at?: unknown
}): SeasonBounds {
  const application = tsOrNull(row.application_close_at)
  const main = tsOrNull(row.main_round_end_at)
  const awards = tsOrNull(row.awards_announcement_at)
  const known = [application, main, awards].filter((t): t is number => t !== null)
  return { application, main, last: known.length ? Math.max(...known) : null }
}

/**
 * Which boundary applies to one row, or null when there is nothing to compare
 * against.
 *
 * ★Music knows its own round -- studio_music_assets.round is stamped at creation
 * -- so it gets the precise boundary. generation_jobs has NO round column
 * (measured against the live schema, not assumed), so a clip can only be judged
 * against the LAST boundary the season has: the earliest moment it is CERTAINLY
 * unusable. The two differ because the available data differs, not because two
 * separate choices were made.
 */
export function boundaryFor(bounds: SeasonBounds | undefined | null, round: string | null | undefined): number | null {
  if (!bounds) return null
  if (round === 'application') return bounds.application
  if (round === 'main') return bounds.main
  return bounds.last
}

/**
 * Has the round closed long enough ago that a still-queued job should be given
 * back?
 *
 * ★Returns false for an unknown boundary, always. "We have no date for this
 * season" and "this season has ended" must never collapse into the same answer
 * when the answer spends a participant's credits.
 *
 * The grace is not padding: the processing buffer is real, and work accepted at
 * the deadline is still finishing inside it. Refunding into that window takes
 * credits back from a job that was about to succeed.
 */
export function isPastRound(boundary: number | null, now: number, graceMs: number): boolean {
  if (boundary === null) return false
  if (!Number.isFinite(now) || !Number.isFinite(graceMs)) return false
  return now > boundary + graceMs
}
