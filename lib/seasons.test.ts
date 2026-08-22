// Control test for the reminder-fire-time helpers extracted out of
// app/api/cron/email-tick/route.ts (HQ 2026-08-16, so the admin edit form's
// "this value fires at..." preview shares exactly one implementation with
// the cron that actually sends -- not a second hand-copy that can drift).
// These assertions pin the exact math the cron relied on before the
// extraction, so the refactor is provably behavior-preserving.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeSubmissionCloseAt,
  deadlineReminderFireTimes,
  registrationReminderFireTimes,
  applicationDeadlineReminderFireTimes,
} from './seasons'

test('computeSubmissionCloseAt prefers main_round_end_at when set', () => {
  const closeAt = computeSubmissionCloseAt({
    main_round_end_at: '2026-11-12T00:00:00Z',
    main_round_start_at: '2026-11-09T00:00:00Z',
    submission_hours: 48,
  })
  assert.equal(closeAt?.toISOString(), '2026-11-12T00:00:00.000Z')
})

test('computeSubmissionCloseAt falls back to start_at + submission_hours when end_at is null', () => {
  const closeAt = computeSubmissionCloseAt({
    main_round_end_at: null,
    main_round_start_at: '2026-11-09T00:00:00Z',
    submission_hours: 48,
  })
  assert.equal(closeAt?.toISOString(), '2026-11-11T00:00:00.000Z')
})

test('computeSubmissionCloseAt is null when neither end_at nor start_at is set', () => {
  assert.equal(
    computeSubmissionCloseAt({ main_round_end_at: null, main_round_start_at: null, submission_hours: 48 }),
    null,
  )
})

test('deadlineReminderFireTimes: hours counted back from close, in the given order', () => {
  const season = {
    main_round_end_at: '2026-11-12T00:00:00Z',
    main_round_start_at: '2026-11-09T00:00:00Z',
    submission_hours: 48,
  }
  const times = deadlineReminderFireTimes(season, [24, 6])
  assert.equal(times[0].n, 24)
  assert.equal(times[0].fireAt?.toISOString(), '2026-11-11T00:00:00.000Z')
  assert.equal(times[1].n, 6)
  assert.equal(times[1].fireAt?.toISOString(), '2026-11-11T18:00:00.000Z')
})

test('deadlineReminderFireTimes: every entry is null when the close time is unknown', () => {
  const times = deadlineReminderFireTimes(
    { main_round_end_at: null, main_round_start_at: null, submission_hours: 48 },
    [24, 6],
  )
  assert.deepEqual(times.map((t) => t.fireAt), [null, null])
})

test('registrationReminderFireTimes: days counted back from registration_close_at (D-14/7/3/1)', () => {
  const times = registrationReminderFireTimes('2026-11-01T00:00:00Z', [14, 7, 3, 1])
  assert.equal(times[0].fireAt?.toISOString(), '2026-10-18T00:00:00.000Z')
  assert.equal(times[1].fireAt?.toISOString(), '2026-10-25T00:00:00.000Z')
  assert.equal(times[2].fireAt?.toISOString(), '2026-10-29T00:00:00.000Z')
  assert.equal(times[3].fireAt?.toISOString(), '2026-10-31T00:00:00.000Z')
})

test('registrationReminderFireTimes: null close_at yields null fire times, not a thrown error', () => {
  const times = registrationReminderFireTimes(null, [14, 7])
  assert.deepEqual(times.map((t) => t.fireAt), [null, null])
})

test('applicationDeadlineReminderFireTimes: hours counted back from application_close_at (D-7/3/1/6h), DST-safe', () => {
  // season_0: application_close_at = 2026-11-04 17:00 PT (PST) = 2026-11-05T01:00:00Z.
  // D-7 crosses the Nov 1 DST boundary (7 days earlier is still PDT) -- if this
  // used plain millisecond subtraction it would land at 2026-10-29T01:00:00Z
  // (2026-10-28 18:00 PDT), one hour later than the intended 17:00 PT wall-clock.
  const times = applicationDeadlineReminderFireTimes('2026-11-05T01:00:00Z', [168, 72, 24, 6])
  assert.equal(times[0].fireAt?.toISOString(), '2026-10-29T00:00:00.000Z') // 7d -> 10/28 17:00 PDT
  assert.equal(times[1].fireAt?.toISOString(), '2026-11-02T01:00:00.000Z') // 3d -> 11/1 17:00 PST
  assert.equal(times[2].fireAt?.toISOString(), '2026-11-04T01:00:00.000Z') // 1d -> 11/3 17:00 PST
  assert.equal(times[3].fireAt?.toISOString(), '2026-11-04T19:00:00.000Z') // 6h -> 11/4 11:00 PST
})

test('applicationDeadlineReminderFireTimes: null close_at yields null fire times, not a thrown error', () => {
  const times = applicationDeadlineReminderFireTimes(null, [168, 72])
  assert.deepEqual(times.map((t) => t.fireAt), [null, null])
})
