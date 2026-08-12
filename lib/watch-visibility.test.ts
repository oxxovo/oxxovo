// The public-visibility rule, alone. Extracted from lib/watch.ts so the
// growth-engine email can read the same rule instead of a copy; these cases pin
// the behavior across that move -- if the extraction changed anything, one of
// them fails.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isRowPublic } from './watch-visibility.ts'

const PUBLIC = {
  status: 'submitted',
  watch_hidden: false,
  moderation_status: 'approved',
  watch_hold: false,
}

test('an approved, unhidden, unheld entry is public', () => {
  assert.equal(isRowPublic(PUBLIC), true)
})

test('each gate alone is enough to hide it', () => {
  assert.equal(isRowPublic({ ...PUBLIC, status: 'flagged' }), false)
  assert.equal(isRowPublic({ ...PUBLIC, watch_hidden: true }), false)
  assert.equal(isRowPublic({ ...PUBLIC, watch_hold: true }), false)
  assert.equal(isRowPublic({ ...PUBLIC, moderation_status: 'pending' }), false)
  assert.equal(isRowPublic({ ...PUBLIC, moderation_status: 'rejected' }), false)
})

// ★Moderation is allow-list, not deny-list: an unknown or absent verdict keeps
// the film private. A new verdict string added upstream must not publish itself.
test('moderation is an allow list -- null and unknown verdicts stay private', () => {
  assert.equal(isRowPublic({ ...PUBLIC, moderation_status: null }), false)
  assert.equal(isRowPublic({ ...PUBLIC, moderation_status: 'quarantined' }), false)
})

// ★Statuses OTHER than 'flagged' do not hide an entry. 'rejected' is a scoring
// outcome and a rejected prelim entry is still watchable -- folding it in here
// would make a system failure look like a takedown
// ([[project-system-error-not-user-rejection]]).
test('only flagged hides by status -- rejected stays visible', () => {
  assert.equal(isRowPublic({ ...PUBLIC, status: 'rejected' }), true)
  assert.equal(isRowPublic({ ...PUBLIC, status: 'selected' }), true)
})

test('nullable columns read as "not set" rather than throwing', () => {
  assert.equal(isRowPublic({ ...PUBLIC, watch_hidden: null, watch_hold: null }), true)
})
