// Which music beds a participant may be OFFERED. PURE -- no DB, no server-only, so
// the rule can be executed by tests instead of eyeballed. Same reason
// lib/text-track-lanes.ts exists.
//
// ★WHY IT IS ITS OWN FILE. Until 2026-08-07 listMusicAssets selected every ready
// row and narrowed it in JS. Under the B plan (library only, zero AI rows) that was
// harmless. Under the C plan it is not, and the failure is invisible:
//   - the query ordered by `source` ascending, and 'ai' sorts before 'library', so
//     the rows PostgREST drops at its row ceiling are the LIBRARY ones;
//   - with a 1,000-track library the ceiling is reached by the library alone, so the
//     FIRST participant generation begins pushing songs out of everyone's picker;
//   - no error, no warning, and nothing to compare a count against.
// Pushing the rule into SQL is the fix, and a rule written as a filter STRING is a
// rule no test can see -- so both halves live here: the string that goes to
// PostgREST, and the row predicate that must agree with it.
//
// The two are asserted to agree in lib/music-picker-scope.test.ts. They are kept
// separate on purpose (defence in depth): the SQL narrows, the predicate re-checks,
// and a disagreement is reported by the caller rather than silently applied.

/** Rows a participant may see: the ACTIVE platform library, plus their OWN AI tracks. */
export type MusicScopeRow = { source: unknown; active: unknown; user_id: unknown }

/**
 * Postgres-side half, as a PostgREST `or=` argument.
 *
 * ★The uuid is interpolated into a filter string, so the caller must have validated
 * it. `assertUuid` below is the check, exported so the call site cannot forget which
 * shape is required and a test can prove the refusal.
 */
export function musicPickerOrFilter(userId: string): string {
  if (!isUuid(userId)) throw new Error('musicPickerOrFilter: userId must be a uuid')
  return `and(source.eq.library,active.is.true),and(source.eq.ai,user_id.eq.${userId})`
}

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

/**
 * JS-side half. MUST accept exactly what the filter above accepts.
 *
 * ★`active` is compared to `true` rather than truthy-tested: the column is
 * nullable, and a NULL `active` on a library row means "nobody has said this may be
 * offered". Under head office's 2026-08-07 rule -- when the path cannot be decided,
 * block -- an undecided row is withheld, not shown. A free pass accumulates loss
 * silently; a refusal shows up immediately.
 *
 * ★Any `source` that is neither 'library' nor 'ai' is refused for the same reason.
 * This repo cannot prove a CHECK constraint exists on that column, so a third value
 * is not hypothetical enough to leave open.
 */
export function musicPickerPathOk(row: MusicScopeRow, userId: string): boolean {
  if (!isUuid(userId)) return false
  if (row.source === 'library') return row.active === true
  if (row.source === 'ai') return row.user_id === userId
  return false
}
