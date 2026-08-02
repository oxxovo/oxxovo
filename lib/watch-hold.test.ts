// The prelim hold decision -- the rule alone, with no database in the way.
//
// It is one boolean and it decides whether a participant's video is visible, so
// it gets pinned here rather than living only inside the three stamp sites that
// call it. The case that matters is the third one: an entry finalizing AFTER the
// cohort was released must not be held again, which is the failure this rule was
// written for (manual release -> that entry is invisible for the rest of the
// competition, and nothing reports it).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { holdDecision } from './watch-hold.ts'

const RELEASED = '2026-08-03T12:00:00.000Z'

test('hold OFF: never held, released or not', () => {
  assert.equal(holdDecision({ studio_prelim_hold_enabled: false, prelim_released_at: null }), false)
  assert.equal(holdDecision({ studio_prelim_hold_enabled: false, prelim_released_at: RELEASED }), false)
})

test('hold ON and not released yet: held', () => {
  assert.equal(holdDecision({ studio_prelim_hold_enabled: true, prelim_released_at: null }), true)
})

test('★hold ON but the cohort is already released: NOT held (the straggler)', () => {
  assert.equal(holdDecision({ studio_prelim_hold_enabled: true, prelim_released_at: RELEASED }), false)
})

test('a missing season is not a hold', () => {
  assert.equal(holdDecision(null), false)
})

test('absent fields read as "not enabled" rather than throwing', () => {
  assert.equal(holdDecision({}), false)
  assert.equal(holdDecision({ studio_prelim_hold_enabled: null, prelim_released_at: null }), false)
})

// ★The switch alone is not the rule. If this ever passes, someone has gone back
// to stamping studio_prelim_hold_enabled directly and the straggler bug is back.
test('the release outranks the switch', () => {
  const stillOn = { studio_prelim_hold_enabled: true, prelim_released_at: RELEASED }
  assert.notEqual(holdDecision(stillOn), stillOn.studio_prelim_hold_enabled)
})
