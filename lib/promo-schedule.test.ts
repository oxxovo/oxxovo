// The time-entry normalizer is the whole point of this file's UX change (HQ
// 2026-08-14: "사람이 형식을 맞추게 하지 마라") -- these are exactly the
// examples HQ gave, plus the invalid cases the field must still block rather
// than silently coerce.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizePromoTime, isValidPromoTimezone, isInPublishWindow, nextPublishSlot } from './promo-schedule'

test('normalizePromoTime -- HQ examples', () => {
  assert.equal(normalizePromoTime('6'), '06:00')
  assert.equal(normalizePromoTime('630'), '06:30')
  assert.equal(normalizePromoTime('6:30'), '06:30')
  assert.equal(normalizePromoTime('18'), '18:00')
})

test('normalizePromoTime -- more shapes', () => {
  assert.equal(normalizePromoTime('0'), '00:00')
  assert.equal(normalizePromoTime('06:00'), '06:00')
  assert.equal(normalizePromoTime('1830'), '18:30')
  assert.equal(normalizePromoTime('  6  '), '06:00')
})

test('normalizePromoTime -- rejects out-of-range and unparseable input', () => {
  assert.equal(normalizePromoTime('24'), null) // hour 0-23 only
  assert.equal(normalizePromoTime('2560'), null) // 25:60 -- both fields OOR
  assert.equal(normalizePromoTime('99'), null)
  assert.equal(normalizePromoTime('korea'), null)
  assert.equal(normalizePromoTime(''), null)
  assert.equal(normalizePromoTime('6:99'), null) // valid hour, bad minute
})

test('isValidPromoTimezone -- closed list, not free text', () => {
  assert.equal(isValidPromoTimezone('Asia/Seoul'), true)
  assert.equal(isValidPromoTimezone('America/Los_Angeles'), true)
  assert.equal(isValidPromoTimezone('korea'), false)
  assert.equal(isValidPromoTimezone('Asia/Tokyo'), false)
})

test('nextPublishSlot agrees with isInPublishWindow on the instant it returns', () => {
  const cadence = { weekdays: ['mon', 'wed', 'fri'], time: '06:00', timezone: 'Asia/Seoul' }
  const from = new Date('2026-08-14T00:00:00Z') // an arbitrary Friday
  const next = nextPublishSlot(cadence, from)
  assert.ok(next, 'a next slot must exist for a non-empty weekday set')
  assert.equal(isInPublishWindow(cadence, next!, 15), true, 'the slot nextPublishSlot names must itself be in-window')
  // And the minute before it must NOT be in-window (the slot is the first eligible instant).
  const oneMinuteBefore = new Date(next!.getTime() - 60_000)
  assert.equal(isInPublishWindow(cadence, oneMinuteBefore, 15), false)
})

test('nextPublishSlot returns null when paused (0 weekdays)', () => {
  assert.equal(nextPublishSlot({ weekdays: [], time: '06:00', timezone: 'Asia/Seoul' }, new Date()), null)
})
