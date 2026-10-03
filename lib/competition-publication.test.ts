// The fail-closed rule for the competition switch, with no database in the way.
// The thing pinned is the DIRECTION of every non-'true' input: the previous
// reader opened on a missing row, a query error and any value but 'false'.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideCompetitionPublication } from './competition-publication.ts'

test('only a row saying true opens the door', () => {
  assert.equal(decideCompetitionPublication({ value: 'true' }, null), true)
  assert.equal(decideCompetitionPublication({ value: ' TRUE ' }, null), true)
})

test('a row saying false is closed', () => {
  assert.equal(decideCompetitionPublication({ value: 'false' }, null), false)
})

test('★no row is closed, not open', () => {
  assert.equal(decideCompetitionPublication(null, null), false)
  assert.equal(decideCompetitionPublication(undefined, null), false)
})

test('★a query error is closed, even if data came back', () => {
  assert.equal(decideCompetitionPublication(null, new Error('boom')), false)
  assert.equal(decideCompetitionPublication({ value: 'true' }, new Error('boom')), false)
})

test('★an unparseable value is closed, not open', () => {
  assert.equal(decideCompetitionPublication({ value: '' }, null), false)
  assert.equal(decideCompetitionPublication({ value: 'yes' }, null), false)
  assert.equal(decideCompetitionPublication({ value: 'ture' }, null), false)
})
