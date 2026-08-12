import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boundaryFor, isPastRound, seasonBoundsFrom, tsOrNull } from './studio-round-bounds'

// These rules decide a REFUND. A wrong answer either takes credits from a job
// that was still usable or holds them forever, and neither surfaces as an error,
// so the rules are asserted rather than reasoned about.

const T = (iso: string) => Date.parse(iso)

// Live values, measured 2026-08-02, so the fixture is the real schedule rather
// than an invented one.
const SEASON_0 = {
  application_close_at: '2026-09-30T07:00:00+00:00',
  main_round_end_at: '2026-10-08T07:00:00+00:00',
  awards_announcement_at: '2026-10-13T03:00:00+00:00',
}

test('a real season resolves all three boundaries, last being the latest', () => {
  const b = seasonBoundsFrom(SEASON_0)
  assert.equal(b.application, T('2026-09-30T07:00:00Z'))
  assert.equal(b.main, T('2026-10-08T07:00:00Z'))
  assert.equal(b.last, T('2026-10-13T03:00:00Z'))
})

// ★THE ONE THAT MATTERS. Measured on 2026-08-02: season_1 and every season_100x
// rehearsal row have application_close_at = null, several have main_round_end_at
// = null too. If a null ever read as "boundary passed", the sweep would refund
// every queued job in those seasons the first time it ran.
test('a season with no dates yields no boundary, and no boundary is never past', () => {
  const b = seasonBoundsFrom({ application_close_at: null, main_round_end_at: null, awards_announcement_at: null })
  assert.equal(b.application, null)
  assert.equal(b.main, null)
  assert.equal(b.last, null)
  assert.equal(isPastRound(boundaryFor(b, 'application'), Date.now(), 0), false)
  assert.equal(isPastRound(boundaryFor(b, 'main'), Date.now(), 0), false)
  assert.equal(isPastRound(boundaryFor(b, null), Date.now(), 0), false)
})

test('a partially dated season only offers the boundaries it actually has', () => {
  // season_1 shape: no application_close_at, but a main_round_end_at.
  const b = seasonBoundsFrom({ application_close_at: null, main_round_end_at: '2026-10-10T04:00:00+00:00' })
  assert.equal(boundaryFor(b, 'application'), null)
  assert.equal(boundaryFor(b, 'main'), T('2026-10-10T04:00:00Z'))
  // ★An application-round job in this season is NOT expired just because the
  // main round has an end date. Falling back to `last` here would refund it.
  assert.equal(isPastRound(boundaryFor(b, 'application'), T('2027-01-01T00:00:00Z'), 0), false)
})

test('garbage in the column is treated as absent, not as epoch zero', () => {
  assert.equal(tsOrNull('not a date'), null)
  assert.equal(tsOrNull(''), null)
  assert.equal(tsOrNull(undefined), null)
  assert.equal(tsOrNull(null), null)
  // Epoch 0 would be "1970", i.e. long past, i.e. refund everything.
  assert.equal(isPastRound(tsOrNull('not a date'), Date.now(), 0), false)
})

test('music uses its own round; a clip with no round falls back to the last boundary', () => {
  const b = seasonBoundsFrom(SEASON_0)
  assert.equal(boundaryFor(b, 'application'), b.application)
  assert.equal(boundaryFor(b, 'main'), b.main)
  // generation_jobs has no round column, so null must mean "the latest boundary
  // this season has" -- the earliest moment a clip is certainly unusable.
  assert.equal(boundaryFor(b, null), b.last)
  assert.equal(boundaryFor(b, ''), b.last)
})

test('an unknown season is not a closed season', () => {
  assert.equal(boundaryFor(undefined, 'application'), null)
  assert.equal(boundaryFor(null, 'main'), null)
})

test('the grace has to elapse as well as the boundary', () => {
  const close = T('2026-09-30T07:00:00Z')
  const day = 86_400_000
  assert.equal(isPastRound(close, close - 1, day), false, 'before the boundary')
  assert.equal(isPastRound(close, close + 1, day), false, 'inside the processing buffer')
  assert.equal(isPastRound(close, close + day, day), false, 'exactly at the end of the buffer')
  assert.equal(isPastRound(close, close + day + 1, day), true, 'past the buffer')
})

test('a nonsense clock or grace does not expire anything', () => {
  const close = T('2026-09-30T07:00:00Z')
  assert.equal(isPastRound(close, Number.NaN, 0), false)
  assert.equal(isPastRound(close, Date.now(), Number.NaN), false)
})
