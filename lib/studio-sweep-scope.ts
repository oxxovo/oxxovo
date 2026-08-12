// WHICH SWEEP OWNS WHICH ROWS. Declared once, as executable predicates.
//
// There are two sweeps over the Studio tables and they must not both reclaim the
// same row. If they do, an accepted render is requeued twice per tick and lane
// A's attempt bound is bypassed -- the row is handed back before anyone counts.
//
// ★A comment saying "these do not overlap" is not evidence. The scopes are
// functions here so the disjointness is a property a test can execute, and the
// same test also proves there is no GAP -- which is not hypothetical, because a
// gap is exactly the bug being fixed: an un-submitted render was in neither
// sweep and sat in 'rendering' forever.
//
// ★No imports, so this stays loadable by a test without pulling in server-only
// code. It is a boundary declaration, not logic.

export const SWEEP_TABLES = ['generation_jobs', 'render_jobs', 'studio_music_assets'] as const
export type SweepTable = (typeof SWEEP_TABLES)[number]

/** The only fact the split turns on: has this row been accepted for submission. */
export type SweepRowFacts = {
  table: SweepTable
  /** render_jobs.submit_intent_at IS NOT NULL. Always false for the other tables. */
  hasSubmitIntent: boolean
}

export const SWEEP_OWNERS = ['studio_lease', 'async_submission'] as const
export type SweepOwner = (typeof SWEEP_OWNERS)[number]

/**
 * Who reclaims this row.
 *
 *   async_submission (lane A, sweepAsyncSubmissions)
 *       renders that have been ACCEPTED for submission. Their lease recovery is
 *       entangled with the 24h processing buffer -- intent, finalize, one
 *       re-render, overdue flagging -- so it stays with the code that owns that
 *       policy. Taking the lease branch out would drag the policy with it.
 *
 *   studio_lease (lane C, sweepStudioLeases)
 *       everything else: clips, AI music, and renders NOT accepted for
 *       submission. No submission policy applies to any of them.
 *
 * Total by construction -- every table returns an owner, so adding a table to
 * SWEEP_TABLES without deciding who sweeps it fails the test rather than
 * silently creating another row nobody recovers.
 */
export function sweepOwner(row: SweepRowFacts): SweepOwner {
  if (row.table === 'render_jobs') {
    return row.hasSubmitIntent ? 'async_submission' : 'studio_lease'
  }
  // A clip or a music bed has no submission intent of its own; the render it
  // eventually feeds does. So they are never lane A's.
  return 'studio_lease'
}

/** Convenience for each sweep to filter with, rather than re-deriving the rule. */
export function isOwnedBy(owner: SweepOwner, row: SweepRowFacts): boolean {
  return sweepOwner(row) === owner
}
