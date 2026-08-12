import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SEASON_PHASES,
  getSeasonPhase,
  phaseIndex,
  toLobbyMode,
  toDbStatus,
  toBannerStage,
  toRoundName,
  canApply,
  scoringRoundFor,
  type SeasonPhaseInput,
} from './season-phase'

// Live schedules, measured 2026-08-04, so the fixtures are the real rows rather
// than invented ones.
const SEASON_0: SeasonPhaseInput = {
  status: 'active',
  applicationOpenAt: '2026-07-25T07:00:00+00:00',
  applicationCloseAt: '2026-11-04T08:00:00+00:00',
  scoringStartAt: '2026-11-05T08:00:00+00:00',
  mainRoundStartAt: '2026-11-09T08:00:00+00:00',
  mainRoundEndAt: '2026-11-12T08:00:00+00:00',
  voteStartAt: '2026-11-12T08:00:00+00:00',
  voteEndAt: '2026-11-15T08:00:00+00:00',
  awardsAt: '2026-11-17T04:00:00+00:00',
  finalistCount: 0,
  winnerCount: 0,
}

// season_1 as it stood before the 2026-08-04 fix: no window at all, but an
// awards date. This row is the whole reason the machine exists.
const SEASON_1_STALE: SeasonPhaseInput = {
  status: 'upcoming',
  applicationOpenAt: null,
  applicationCloseAt: null,
  scoringStartAt: '2026-10-05T06:59:00+00:00',
  mainRoundStartAt: '2026-10-08T04:00:00+00:00',
  mainRoundEndAt: '2026-10-10T04:00:00+00:00',
  voteStartAt: null,
  voteEndAt: null,
  awardsAt: '2026-10-13T04:00:00+00:00',
  finalistCount: 0,
  winnerCount: 0,
}

const at = (iso: string) => new Date(iso)
const phaseAt = (s: SeasonPhaseInput, iso: string) => getSeasonPhase(s, at(iso)).phase

// ---------------------------------------------------------------------------

test('season_0 walks the whole schedule in order', () => {
  assert.equal(phaseAt(SEASON_0, '2026-07-01T00:00:00Z'), 'upcoming')
  assert.equal(phaseAt(SEASON_0, '2026-08-04T00:00:00Z'), 'accepting')
  assert.equal(phaseAt(SEASON_0, '2026-11-04T09:00:00Z'), 'judging')
  assert.equal(phaseAt(SEASON_0, '2026-11-06T00:00:00Z'), 'judging')
  assert.equal(phaseAt({ ...SEASON_0, finalistCount: 10 }, '2026-11-06T00:00:00Z'), 'finalists_pending')
  assert.equal(phaseAt({ ...SEASON_0, finalistCount: 10 }, '2026-11-10T00:00:00Z'), 'main_live')
  assert.equal(phaseAt({ ...SEASON_0, finalistCount: 10 }, '2026-11-13T00:00:00Z'), 'voting')
})

test('the processing buffer is visible without being its own phase', () => {
  // Between close and scoring_start nothing is being judged yet, so operators
  // need to tell the two apart even though the audience sees one banner.
  const inBuffer = getSeasonPhase(SEASON_0, at('2026-11-04T12:00:00Z'))
  assert.equal(inBuffer.phase, 'judging')
  assert.equal(inBuffer.isProcessingBuffer, true)

  const scoring = getSeasonPhase(SEASON_0, at('2026-11-06T00:00:00Z'))
  assert.equal(scoring.phase, 'judging')
  assert.equal(scoring.isProcessingBuffer, false)
})

// ---------------------------------------------------------------------------
// The season_1 regression. This is the bug, asserted.
// ---------------------------------------------------------------------------

test('a season with no window cannot reach a late phase on a stray awards date', () => {
  // 2026-10-13 is exactly when the old desiredStatus would have flipped it to
  // 'completed' -- rank 4, past the forward-only guard, mid-season-0.
  assert.equal(phaseAt(SEASON_1_STALE, '2026-10-13T05:00:00Z'), 'draft')
  assert.equal(phaseAt(SEASON_1_STALE, '2026-12-01T00:00:00Z'), 'draft')
})

test('...and therefore never asks the tick to mark it completed', () => {
  const p = phaseAt(SEASON_1_STALE, '2026-10-13T05:00:00Z')
  assert.equal(toDbStatus(p), 'draft')
  // rank(draft)=0, so a forward-only guard cannot be cleared by it at all.
  assert.equal(toLobbyMode(p), 'upcoming')
})

test('a dateless teaser is draft no matter which downstream dates carry values', () => {
  const everything: SeasonPhaseInput = {
    ...SEASON_1_STALE,
    voteStartAt: '2026-10-11T00:00:00Z',
    voteEndAt: '2026-10-12T00:00:00Z',
    finalistCount: 50,
    winnerCount: 3,
  }
  assert.equal(phaseAt(everything, '2026-10-11T12:00:00Z'), 'draft')
})

// ---------------------------------------------------------------------------
// Evidence gates: a date passing is not the thing having happened.
// ---------------------------------------------------------------------------

test('the awards date alone does not announce winners', () => {
  const noRanks = { ...SEASON_0, finalistCount: 10, winnerCount: 0 }
  const p = phaseAt(noRanks, '2026-11-18T00:00:00Z')
  assert.notEqual(p, 'results')
  // and the banner keeps saying judging rather than claim an empty podium
  assert.equal(toBannerStage(p), 'judging')
})

test('one recorded winner is enough to announce', () => {
  const ranked = { ...SEASON_0, finalistCount: 10, winnerCount: 3 }
  assert.equal(phaseAt(ranked, '2026-11-18T00:00:00Z'), 'results')
})

test('finalists_pending needs actual finalists, not just a reveal date', () => {
  assert.equal(phaseAt({ ...SEASON_0, finalistCount: 0 }, '2026-11-06T00:00:00Z'), 'judging')
  assert.equal(phaseAt({ ...SEASON_0, finalistCount: 1 }, '2026-11-06T00:00:00Z'), 'finalists_pending')
})

// ---------------------------------------------------------------------------
// The unbounded-main-round bug the ArenaWatch stopgap was patching.
// ---------------------------------------------------------------------------

test('main_live is bounded on both sides -- it does not survive into voting or results', () => {
  const s = { ...SEASON_0, finalistCount: 10 }
  assert.equal(phaseAt(s, '2026-11-10T00:00:00Z'), 'main_live')
  assert.equal(phaseAt(s, '2026-11-13T00:00:00Z'), 'voting') // not main_live
  assert.equal(phaseAt({ ...s, winnerCount: 3 }, '2026-11-18T00:00:00Z'), 'results') // not main_live
})

test('the card label and the banner cannot disagree, because both read one phase', () => {
  const s = { ...SEASON_0, finalistCount: 10, winnerCount: 3 }
  const p = phaseAt(s, '2026-11-18T00:00:00Z')
  assert.equal(toRoundName(p), 'Results')
  assert.equal(toBannerStage(p), 'results')
  // The contradiction the stopgap describes -- "우승 발표됨" + "본선 · 심사 중" --
  // is not expressible: there is only one phase to project from.
})

// ---------------------------------------------------------------------------
// Null policy, stated once.
// ---------------------------------------------------------------------------

test('a null boundary never advances the phase', () => {
  const noClose = { ...SEASON_0, applicationCloseAt: null }
  assert.equal(phaseAt(noClose, '2026-12-01T00:00:00Z'), 'accepting')

  const noMain = { ...SEASON_0, mainRoundStartAt: null, finalistCount: 10 }
  assert.equal(phaseAt(noMain, '2026-11-20T00:00:00Z'), 'judging')
})

test('a null open date is the one exception -- draft, not open-since-forever', () => {
  assert.equal(phaseAt({ ...SEASON_0, applicationOpenAt: null }, '2026-08-04T00:00:00Z'), 'draft')
})

test('unparseable timestamps are treated as absent, never as NaN', () => {
  const junk = { ...SEASON_0, applicationCloseAt: 'not a date' }
  assert.equal(phaseAt(junk, '2026-12-01T00:00:00Z'), 'accepting')
})

// ---------------------------------------------------------------------------
// Ordering is a property, not a coincidence.
// ---------------------------------------------------------------------------

test('the phase never moves backwards as the clock advances', () => {
  const s = { ...SEASON_0, finalistCount: 10, winnerCount: 3 }
  let last = -1
  // every 6h from before open to well past awards
  for (let t = Date.parse('2026-07-01T00:00:00Z'); t <= Date.parse('2026-12-01T00:00:00Z'); t += 6 * 3600_000) {
    const i = phaseIndex(getSeasonPhase(s, new Date(t)).phase)
    assert.ok(i >= last, `phase went backwards at ${new Date(t).toISOString()}`)
    last = i
  }
})

test('every phase projects to something on every surface', () => {
  for (const p of SEASON_PHASES) {
    assert.ok(toLobbyMode(p))
    assert.ok(toDbStatus(p))
    assert.ok(toBannerStage(p))
    assert.ok(toRoundName(p))
    assert.ok(scoringRoundFor(p))
    assert.equal(typeof canApply(p), 'boolean')
  }
})

test('only accepting can apply', () => {
  const allowed = SEASON_PHASES.filter(canApply)
  assert.deepEqual(allowed, ['accepting'])
})

test('an explicitly completed season is terminal whatever the dates say', () => {
  const done = { ...SEASON_0, status: 'completed' }
  assert.equal(phaseAt(done, '2026-08-04T00:00:00Z'), 'awaiting_results')
  assert.equal(phaseAt({ ...done, winnerCount: 3 }, '2026-08-04T00:00:00Z'), 'results')
  assert.equal(toLobbyMode(phaseAt({ ...done, winnerCount: 3 }, '2026-08-04T00:00:00Z')), 'ended')
})

test('voting closes before the ranks are approved, and that gap is a phase', () => {
  // voteEnd 11-15, awards 11-17. Between them nothing has been announced.
  const s = { ...SEASON_0, finalistCount: 10, winnerCount: 0 }
  assert.equal(phaseAt(s, '2026-11-16T00:00:00Z'), 'awaiting_results')
  // ...and the DB status does NOT go to completed on the calendar alone.
  assert.equal(toDbStatus(phaseAt(s, '2026-11-18T00:00:00Z')), 'closed')
  assert.equal(toDbStatus(phaseAt({ ...s, winnerCount: 3 }, '2026-11-18T00:00:00Z')), 'completed')
})
