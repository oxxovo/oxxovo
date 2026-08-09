// ⑤E -- the release, as the operator has to read it.
//
// Falsifiable form: each case feeds two entries differing in one field and
// demands different answers. The case that matters is the last one -- a rule
// that trusts the release stamp over the film's timestamp cannot pass it, and
// that rule is the one you write if you do not think about the buffer.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyPrelimEntry, countPrelimEntries } from './prelim-release.ts'

const RELEASED = '2026-11-04T08:00:00.000Z'
const BEFORE = '2026-11-04T07:00:00.000Z'
const AFTER = '2026-11-04T09:30:00.000Z'

const COHORT_MEMBER = {
  watch_hold: false,
  watch_hold_released_at: RELEASED,
  free_entry_url: 'https://r2.example/a.mp4',
  finalizedAt: BEFORE,
}

test('still held, released or not', () => {
  const held = { ...COHORT_MEMBER, watch_hold: true, watch_hold_released_at: null }
  assert.equal(classifyPrelimEntry(held, null), 'held')
  assert.equal(classifyPrelimEntry(held, RELEASED), 'held')
})

test('freed by the bulk release, film already in hand: cohort', () => {
  assert.equal(classifyPrelimEntry(COHORT_MEMBER, RELEASED), 'cohort')
})

// ★THE ORDERING CASE. Same row, same release stamp -- only the film's timestamp
// moves, and the answer has to move with it. An entry that was still rendering
// when the cohort went out carries watch_hold_released_at anyway, because the
// bulk update touched it; its film appeared an hour and a half later.
test('freed by the bulk release but the film landed after it: late, not cohort', () => {
  const straggler = { ...COHORT_MEMBER, finalizedAt: AFTER }
  assert.equal(classifyPrelimEntry(COHORT_MEMBER, RELEASED), 'cohort')
  assert.equal(classifyPrelimEntry(straggler, RELEASED), 'late')
})

// ★A submission that arrived after the gate opened was never held at all, so it
// has no release stamp. It is still an arrival the operator has to see.
test('never held, film after the release: late', () => {
  const arrival = { ...COHORT_MEMBER, watch_hold_released_at: null, finalizedAt: AFTER }
  assert.equal(classifyPrelimEntry(arrival, RELEASED), 'late')
})

// ★Public, with a film, before the release, and not part of it -- the hold was
// off when this entry was submitted. Counting it either way misreports the
// release, so it counts as neither.
test('an entry from before the hold was switched on is neither', () => {
  const preHold = { ...COHORT_MEMBER, watch_hold_released_at: null, finalizedAt: BEFORE }
  assert.equal(classifyPrelimEntry(preHold, RELEASED), 'other')
})

test('no film, or no release yet, is not a count', () => {
  assert.equal(classifyPrelimEntry({ ...COHORT_MEMBER, free_entry_url: null }, RELEASED), 'other')
  assert.equal(classifyPrelimEntry({ ...COHORT_MEMBER, free_entry_url: '  ' }, RELEASED), 'other')
  assert.equal(classifyPrelimEntry(COHORT_MEMBER, null), 'other')
})

// An accepted submission whose render never landed has no finalizedAt. It must
// not be read as "arrived": it has not.
test('an unparseable or absent film timestamp falls back to the release stamp', () => {
  assert.equal(classifyPrelimEntry({ ...COHORT_MEMBER, finalizedAt: null }, RELEASED), 'cohort')
  assert.equal(classifyPrelimEntry({ ...COHORT_MEMBER, finalizedAt: 'nope' }, RELEASED), 'cohort')
})

test('the counts are what the panel prints', () => {
  const entries = [
    COHORT_MEMBER,
    { ...COHORT_MEMBER, finalizedAt: AFTER },
    { ...COHORT_MEMBER, watch_hold: true, watch_hold_released_at: null },
    { ...COHORT_MEMBER, free_entry_url: null },
  ]
  assert.deepEqual(countPrelimEntries(entries, RELEASED), { held: 1, cohort: 1, late: 1 })
  // Before the release, the only true statement is how many are held.
  assert.deepEqual(countPrelimEntries(entries, null), { held: 1, cohort: 0, late: 0 })
})
