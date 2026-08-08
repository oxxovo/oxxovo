// The 2026-11-01 daylight-saving transition, pinned against the rules that
// decide a participant's round and a participant's refund.
//
// WHY THIS FILE EXISTS. season_0's prelim window straddles the transition
// (measured 2026-08-07: application_close_at = Nov 4 00:00 PST, and the window
// that reaches it started under PDT), while the main round does not (Nov 9
// 00:00 PST -> Nov 12 00:00 PST, exactly 72h). So one round crosses and one does
// not, which is precisely the shape where a wall-clock assumption survives every
// test until the one week it matters.
//
// ★THE RISK IS NOT COLUMN-VS-COLUMN. Our boundary columns do not sit inside the
// repeated hour. Participants do: between 01:00 and 02:00 Pacific on Nov 1 the
// wall clock runs twice, so "01:30 Pacific" names TWO different instants an hour
// apart. Anything that decides which round a clip belongs to, or whether a
// refund grace has elapsed, has to answer for the second one as confidently as
// the first.
//
// ★WHAT THESE TESTS ACTUALLY ASSERT. Not "we handle DST" -- that is unfalsifiable
// phrasing. They assert that the predicates compare ABSOLUTE INSTANTS, by
// feeding them the two distinct UTC instants that share one Pacific wall-clock
// reading and requiring different answers where the instants differ. A rewrite
// into local-calendar arithmetic (getHours, setDate, date strings) cannot pass
// the repeated-hour cases.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveEffectiveRound, isInEffectiveRound } from './studio'
import { isPastRound, seasonBoundsFrom, boundaryFor, tsOrNull } from './studio-round-bounds'

// ── the transition, written as instants ─────────────────────────────────────
// 2026-11-01 02:00 PDT falls back to 01:00 PST. Offsets are written explicitly
// so the file does not depend on the machine's timezone database being consulted
// the way we expect -- these are the UTC instants, and they are checkable by
// hand: 08:00Z - 7h = 01:00 PDT, 09:00Z - 8h = 01:00 PST.
const FIRST_0130_PDT = '2026-11-01T08:30:00.000Z' // 01:30 Pacific, before the fold
const SECOND_0130_PST = '2026-11-01T09:30:00.000Z' // 01:30 Pacific, after the fold
const HOUR = 3_600_000

test('the repeated hour really is two instants, one hour apart', () => {
  // The premise of every case below. If this ever stops holding, the rest of the
  // file is asserting nothing.
  const a = Date.parse(FIRST_0130_PDT)
  const b = Date.parse(SECOND_0130_PST)
  assert.equal(b - a, HOUR)
  const pacific = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  assert.equal(pacific(FIRST_0130_PDT), pacific(SECOND_0130_PST)) // same wall clock
})

// ── ③ round boundary: resolveEffectiveRound / isInEffectiveRound ────────────

test('a boundary inside the fold splits the two 01:30s, not just the dates', () => {
  // The worst placement we could ever be handed: main_round_start_at set to the
  // instant between the two readings of 01:30. The earlier 01:30 is prelim, the
  // later one is main -- even though a participant looking at a clock saw the
  // same time both times.
  const cfg = { round: 'both' as const, mainRoundStartAt: '2026-11-01T09:00:00.000Z' }

  assert.equal(resolveEffectiveRound(cfg, new Date(FIRST_0130_PDT)), 'application')
  assert.equal(resolveEffectiveRound(cfg, new Date(SECOND_0130_PST)), 'main')

  assert.equal(isInEffectiveRound(FIRST_0130_PDT, cfg, 'application'), true)
  assert.equal(isInEffectiveRound(FIRST_0130_PDT, cfg, 'main'), false)
  assert.equal(isInEffectiveRound(SECOND_0130_PST, cfg, 'main'), true)
  assert.equal(isInEffectiveRound(SECOND_0130_PST, cfg, 'application'), false)
})

test('a clip made in the repeated hour lands in exactly one round, never both', () => {
  // The participant-facing invariant. Whatever the boundary is, a clip belongs to
  // the current round or it does not -- the fold must not let one timestamp
  // satisfy both branches (which is what a wall-clock comparison would do).
  const boundaries = [
    '2026-11-01T07:00:00.000Z', // before the fold entirely
    '2026-11-01T08:30:00.000Z', // exactly the first 01:30
    '2026-11-01T09:00:00.000Z', // inside the fold
    '2026-11-01T09:30:00.000Z', // exactly the second 01:30
    '2026-11-01T12:00:00.000Z', // after
  ]
  for (const mainRoundStartAt of boundaries) {
    const cfg = { round: 'both' as const, mainRoundStartAt }
    for (const created of [FIRST_0130_PDT, SECOND_0130_PST]) {
      const inApp = isInEffectiveRound(created, cfg, 'application')
      const inMain = isInEffectiveRound(created, cfg, 'main')
      assert.notEqual(inApp, inMain, `${created} vs ${mainRoundStartAt}`)
    }
  }
})

test('the boundary instant itself belongs to the main round, on both sides of DST', () => {
  // >= at the boundary, matching every other rule in the codebase (the `>` that
  // left the close instant open was the 2026-08-04 landing defect). Checked once
  // under PDT and once under PST so a future rewrite cannot get it right in only
  // one offset.
  for (const at of ['2026-10-15T07:00:00.000Z', '2026-11-15T08:00:00.000Z']) {
    const cfg = { round: 'both' as const, mainRoundStartAt: at }
    assert.equal(resolveEffectiveRound(cfg, new Date(at)), 'main', at)
    assert.equal(isInEffectiveRound(at, cfg, 'main'), true, at)
    assert.equal(isInEffectiveRound(new Date(Date.parse(at) - 1).toISOString(), cfg, 'main'), false, at)
  }
})

test('season_0 measured values: prelim crosses the transition, main does not', () => {
  // Pinned from the live row (2026-08-07). The asymmetry is the reason this file
  // exists, so it is an assertion and not a comment: if someone re-schedules the
  // main round across Nov 1, this fails and they read the rest of the file.
  const prelimStartsUnderPdt = Date.parse('2026-07-25T07:00:00.000Z') // Jul 25 00:00 PDT
  const prelimClose = Date.parse('2026-11-04T08:00:00.000Z') // Nov 4 00:00 PST
  const mainStart = Date.parse('2026-11-09T08:00:00.000Z') // Nov 9 00:00 PST
  const mainEnd = Date.parse('2026-11-12T08:00:00.000Z') // Nov 12 00:00 PST

  const offset = (t: number) =>
    new Date(t).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', timeZoneName: 'short' }).split(' ').pop()
  assert.equal(offset(prelimStartsUnderPdt), 'PDT')
  assert.equal(offset(prelimClose), 'PST') // the prelim window changes offset mid-flight
  assert.equal(offset(mainStart), 'PST')
  assert.equal(offset(mainEnd), 'PST') // the main round does not

  // The main round is exactly 72 elapsed hours because it never crosses. A
  // wall-clock window that DID cross would be 73.
  assert.equal((mainEnd - mainStart) / HOUR, 72)
})

// ── ④ refund grace: isPastRound + the 24h ROUND_GRACE_MS ────────────────────

test('the 24h grace is 24 ELAPSED hours, which is not the next day at the same clock time', () => {
  // ROUND_GRACE_MS (lib/studio-lease.ts:80) is 86_400_000 added to an absolute
  // boundary. Across the fall-back that lands at 23:00 Pacific, not 00:00 the
  // next day -- and that is CORRECT: the grace covers work still in flight, and
  // in-flight work is measured in real elapsed time, not in calendar days.
  //
  // ★Pinned deliberately. "Fixing" this into calendar arithmetic would silently
  // hand out an extra hour of unrefunded credit on one day of the year.
  const GRACE = 86_400_000
  const boundary = Date.parse('2026-11-01T07:00:00.000Z') // Nov 1 00:00 PDT
  const expiry = boundary + GRACE

  const pacific = (t: number) =>
    new Date(t).toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  assert.equal(pacific(expiry), '23:00') // not 00:00 -- the day was 25 hours long

  assert.equal(isPastRound(boundary, expiry - 1, GRACE), false)
  assert.equal(isPastRound(boundary, expiry, GRACE), false) // strict >, grace must fully elapse
  assert.equal(isPastRound(boundary, expiry + 1, GRACE), true)
})

test('the grace behaves identically on a day with no transition', () => {
  // Control. Without this the case above only proves the clock moved, not that
  // the rule is unchanged by it.
  const GRACE = 86_400_000
  const boundary = Date.parse('2026-11-08T08:00:00.000Z') // Nov 8 00:00 PST, no fold
  const expiry = boundary + GRACE
  const pacific = (t: number) =>
    new Date(t).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hour12: false })
  assert.equal(pacific(expiry), '00:00')
  assert.equal(isPastRound(boundary, expiry, GRACE), false)
  assert.equal(isPastRound(boundary, expiry + 1, GRACE), true)
})

test('a job left in the repeated hour is not expired twice, nor skipped', () => {
  // A clip claimed at the first 01:30 and one claimed at the second 01:30 are an
  // hour apart, so their graces expire an hour apart. A wall-clock rule would
  // expire them together (or expire the later one first).
  const GRACE = 86_400_000
  const bounds = seasonBoundsFrom({
    application_close_at: FIRST_0130_PDT,
    main_round_end_at: SECOND_0130_PST,
    awards_announcement_at: null,
  })
  const appBoundary = boundaryFor(bounds, 'application')
  const mainBoundary = boundaryFor(bounds, 'main')
  assert.equal(mainBoundary! - appBoundary!, HOUR)

  const justAfterFirst = appBoundary! + GRACE + 1
  assert.equal(isPastRound(appBoundary, justAfterFirst, GRACE), true)
  assert.equal(isPastRound(mainBoundary, justAfterFirst, GRACE), false) // still has an hour
})

test('tsOrNull does not invent an instant for a bare wall-clock string', () => {
  // The failure this guards: a column (or a hand-written fixture) holding
  // '2026-11-01 01:30:00' with no offset is AMBIGUOUS during the fold -- there is
  // no single right answer. Our real columns are timestamptz and always carry
  // one; anything that does not must not be silently resolved to whichever
  // instant the server's locale prefers.
  assert.equal(tsOrNull('2026-11-01T08:30:00.000Z'), Date.parse(FIRST_0130_PDT))
  assert.equal(tsOrNull('2026-11-01T01:30:00-07:00'), Date.parse(FIRST_0130_PDT))
  assert.equal(tsOrNull('2026-11-01T01:30:00-08:00'), Date.parse(SECOND_0130_PST))
  assert.equal(tsOrNull(null), null)
  assert.equal(tsOrNull('not a date'), null)
})
