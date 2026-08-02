import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SWEEP_OWNERS, SWEEP_TABLES, isOwnedBy, sweepOwner, type SweepRowFacts } from './studio-sweep-scope'

// ★THE POINT OF THIS FILE. Two sweeps run over the Studio tables -- lane A's
// sweepAsyncSubmissions and lane C's sweepStudioLeases -- and a comment claiming
// they do not collide is not evidence. This executes both scopes over every
// combination that exists and proves two things at once:
//
//   OVERLAP  a row owned by both is requeued twice per tick, which also slips
//            past whichever sweep counts attempts -- the row is handed back
//            before anyone increments.
//   GAP      a row owned by neither is never recovered at all. Not
//            hypothetical: the un-submitted render was exactly this, and the
//            visible symptom was a participant parked in the compose editor on
//            a render that would never finish.

// Every row any sweep can see. render_jobs is the only table where the
// submission flag can be either way; a clip or a music bed has no submission
// intent of its own.
const ALL_ROWS: SweepRowFacts[] = SWEEP_TABLES.flatMap((table) =>
  [true, false].map((hasSubmitIntent) => ({ table, hasSubmitIntent })),
)

test('every row has exactly one owner -- no overlap, no gap', () => {
  for (const row of ALL_ROWS) {
    const owners = SWEEP_OWNERS.filter((o) => isOwnedBy(o, row))
    assert.equal(
      owners.length,
      1,
      `${row.table} (submitIntent=${row.hasSubmitIntent}) has ${owners.length} owners: ${owners.join(', ') || 'none'}`,
    )
  }
})

test('accepted renders belong to lane A, and only accepted renders do', () => {
  assert.equal(sweepOwner({ table: 'render_jobs', hasSubmitIntent: true }), 'async_submission')
  for (const row of ALL_ROWS) {
    if (sweepOwner(row) === 'async_submission') {
      assert.equal(row.table, 'render_jobs', `${row.table} must not be swept by the submission sweep`)
      assert.equal(row.hasSubmitIntent, true)
    }
  }
})

// The complement, which is what changed: this row used to be in neither scope.
test('an un-submitted render is lane C -- the case that was in neither sweep', () => {
  assert.equal(sweepOwner({ table: 'render_jobs', hasSubmitIntent: false }), 'studio_lease')
})

test('clips and music are always lane C, submission flag or not', () => {
  for (const table of ['generation_jobs', 'studio_music_assets'] as const) {
    for (const hasSubmitIntent of [true, false]) {
      assert.equal(sweepOwner({ table, hasSubmitIntent }), 'studio_lease')
    }
  }
})

// A table added without deciding who sweeps it is the gap all over again. The
// owner function is total, so this is really asserting that SWEEP_TABLES and the
// ALL_ROWS enumeration above stay in step with each other.
test('adding a table forces an ownership decision', () => {
  assert.equal(ALL_ROWS.length, SWEEP_TABLES.length * 2)
  for (const row of ALL_ROWS) {
    assert.ok(SWEEP_OWNERS.includes(sweepOwner(row)), `${row.table} resolved to an unknown owner`)
  }
})
