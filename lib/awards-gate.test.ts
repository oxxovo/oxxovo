import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateAwardsGate, type AwardsGateInput } from './awards-gate'
import type { SeasonPhaseInput } from './season-phase'

// season_0 as measured 2026-08-04. Soak season: community_vote_weight = 0.
const SEASON_0: SeasonPhaseInput = {
  status: 'closed',
  applicationOpenAt: '2026-07-25T07:00:00+00:00',
  applicationCloseAt: '2026-11-04T08:00:00+00:00',
  scoringStartAt: '2026-11-05T08:00:00+00:00',
  mainRoundStartAt: '2026-11-09T08:00:00+00:00',
  mainRoundEndAt: '2026-11-12T08:00:00+00:00',
  voteStartAt: '2026-11-12T08:00:00+00:00',
  voteEndAt: '2026-11-15T08:00:00+00:00',
  awardsAt: '2026-11-17T04:00:00+00:00',
  finalistCount: 10,
  winnerCount: 0,
}

const READY: AwardsGateInput = {
  season: SEASON_0,
  submittedCount: 10,
  scoredCount: 10,
  communityVoteWeight: 0,
  maxVotes: 0,
  voteEndAt: '2026-11-15T08:00:00+00:00',
}

// After the vote window, before any rank is written -- the window the button is for.
const AFTER_VOTE = new Date('2026-11-16T00:00:00Z')

test('all three gates pass in the window the button exists for', () => {
  const r = evaluateAwardsGate(READY, AFTER_VOTE)
  assert.equal(r.ok, true)
  assert.equal(r.phase, 'awaiting_results')
  assert.equal(r.checks.schedule, 'pass')
  assert.equal(r.checks.scoring, 'pass')
})

// ---------------------------------------------------------------------------
// Gate 1 -- schedule
// ---------------------------------------------------------------------------

test('cannot approve the day applications close', () => {
  const r = evaluateAwardsGate(READY, new Date('2026-11-04T09:00:00Z'))
  assert.equal(r.ok, false)
  assert.equal(r.blocked, 'schedule_not_reached')
  // finalists are already picked in this fixture, hence finalists_pending rather
  // than judging -- either way the podium does not exist yet.
  assert.equal(r.phase, 'finalists_pending')
})

test('cannot approve while the main round is live', () => {
  const r = evaluateAwardsGate(READY, new Date('2026-11-10T00:00:00Z'))
  assert.equal(r.blocked, 'schedule_not_reached')
  assert.equal(r.phase, 'main_live')
})

test('cannot approve while voting is open', () => {
  const r = evaluateAwardsGate(READY, new Date('2026-11-13T00:00:00Z'))
  assert.equal(r.blocked, 'schedule_not_reached')
  assert.equal(r.phase, 'voting')
})

test('"too early" and "already done" are different answers', () => {
  const done = { ...READY, season: { ...SEASON_0, winnerCount: 3 } }
  const r = evaluateAwardsGate(done, AFTER_VOTE)
  assert.equal(r.ok, false)
  assert.equal(r.blocked, 'already_awarded')
  assert.match(r.detail, /override/)
})

test('already-awarded is caught in the gap between approval and announcement', () => {
  // ★The regression this gate had on its first draft. Ranks are written by the
  // button; the audience-facing 'results' phase only opens at
  // awards_announcement_at (11-17). At 11-16 the ranks exist but the phase is
  // still awaiting_results -- so a phase-based idempotency check waves the second
  // press through and the payout email fires twice.
  const justApproved = { ...READY, season: { ...SEASON_0, winnerCount: 3 } }
  const r = evaluateAwardsGate(justApproved, new Date('2026-11-16T00:00:00Z'))
  assert.equal(r.phase, 'awaiting_results') // NOT 'results' yet
  assert.equal(r.blocked, 'already_awarded') // caught anyway
})

test('the schedule gate does not wait for awards_announcement_at', () => {
  // awards is 11-17; the button opens at 11-15 when voting closes. The
  // announcement date drives the audience-facing reveal, not the approval.
  assert.equal(evaluateAwardsGate(READY, new Date('2026-11-16T00:00:00Z')).ok, true)
})

// ---------------------------------------------------------------------------
// Gate 2 -- scoring completeness. rankMainRound DROPS unscored entries, so a
// partial set produces a plausible podium rather than an error.
// ---------------------------------------------------------------------------

test('a partial scoring set blocks instead of quietly shrinking the podium', () => {
  const r = evaluateAwardsGate({ ...READY, scoredCount: 7 }, AFTER_VOTE)
  assert.equal(r.blocked, 'scoring_incomplete')
  assert.match(r.detail, /7\/10/)
})

test('one unscored entry is enough to hold it', () => {
  assert.equal(evaluateAwardsGate({ ...READY, scoredCount: 9 }, AFTER_VOTE).blocked, 'scoring_incomplete')
  assert.equal(evaluateAwardsGate({ ...READY, scoredCount: 10 }, AFTER_VOTE).ok, true)
})

test('nothing submitted is its own answer, not "scoring incomplete"', () => {
  const r = evaluateAwardsGate({ ...READY, submittedCount: 0, scoredCount: 0 }, AFTER_VOTE)
  assert.equal(r.blocked, 'nothing_submitted')
})

// ---------------------------------------------------------------------------
// Gate 3 -- votes. Dynamic on community_vote_weight, never hardcoded to season 0.
// ---------------------------------------------------------------------------

test('when votes do not count, the vote gate is not_applicable rather than silently passing', () => {
  const r = evaluateAwardsGate(READY, AFTER_VOTE)
  assert.equal(r.checks.vote, 'not_applicable')
  assert.match(r.detail, /weight=0/)
})

test('when votes count, an unscheduled vote end blocks -- that window can never close', () => {
  // Both vote columns unset on the season, so the phase advances off mainEnd and
  // the vote gate is the one left to answer. (voteStart set with voteEnd null
  // pins the season at main_live instead -- an unscheduled boundary never
  // advances the phase, by policy.)
  const weighted = {
    ...READY,
    communityVoteWeight: 0.7,
    voteEndAt: null,
    season: { ...SEASON_0, voteStartAt: null, voteEndAt: null },
  }
  const r = evaluateAwardsGate(weighted, AFTER_VOTE)
  assert.equal(r.blocked, 'vote_window_open')
  assert.match(r.detail, /never close/)
})

test('when votes count, the tally must be final', () => {
  // ★maxVotes must be set here. READY carries 0 because it models the weight-0
  // season, and a weighted season with a closed window and no votes is now its
  // own block (no_votes_cast) -- this test is about the WINDOW, so give it a
  // tally and let the other test cover the empty one.
  const weighted = { ...READY, communityVoteWeight: 0.7, maxVotes: 12 }
  // 11-14 is inside the vote window: schedule gate catches it first.
  assert.equal(evaluateAwardsGate(weighted, new Date('2026-11-14T00:00:00Z')).blocked, 'schedule_not_reached')
  // ...and once closed, the vote gate passes.
  const after = evaluateAwardsGate(weighted, AFTER_VOTE)
  assert.equal(after.ok, true)
  assert.equal(after.checks.vote, 'pass')
})

test('a weighted season whose vote end sits in the future blocks on the vote gate', () => {
  // Vote window closed for phase purposes (mainEnd passed, no vote window set on
  // the season) but the weight says votes matter and the end date is ahead.
  const odd: AwardsGateInput = {
    season: { ...SEASON_0, voteStartAt: null, voteEndAt: null },
    submittedCount: 10,
    scoredCount: 10,
    communityVoteWeight: 0.5,
    voteEndAt: '2026-12-01T00:00:00Z',
  }
  const r = evaluateAwardsGate(odd, AFTER_VOTE)
  assert.equal(r.blocked, 'vote_window_open')
  assert.equal(r.checks.vote, 'fail')
})

// ---------------------------------------------------------------------------

test('every block carries a phase and a human-readable detail', () => {
  const cases: AwardsGateInput[] = [
    { ...READY, scoredCount: 3 },
    { ...READY, submittedCount: 0, scoredCount: 0 },
    { ...READY, season: { ...SEASON_0, winnerCount: 3 } },
    { ...READY, communityVoteWeight: 0.7, voteEndAt: null },
  ]
  for (const c of cases) {
    const r = evaluateAwardsGate(c, AFTER_VOTE)
    assert.equal(r.ok, false)
    assert.ok(r.phase)
    assert.ok(r.detail.length > 10, `detail too thin: ${r.detail}`)
  }
})

test('a dateless season can never reach the button', () => {
  // Same structural protection as season_1: no open date -> draft -> no podium.
  const teaser: AwardsGateInput = {
    ...READY,
    season: { ...SEASON_0, applicationOpenAt: null, applicationCloseAt: null },
  }
  const r = evaluateAwardsGate(teaser, new Date('2027-01-01T00:00:00Z'))
  assert.equal(r.blocked, 'schedule_not_reached')
  assert.equal(r.phase, 'draft')
})

// ★2026-08-06: season_0's community_vote_weight went 0 -> 0.5, which made a
// closed-but-empty vote window reachable for the first time. Before the weight,
// an uncounted tally could not affect the ranking; with it, computeCommunityScore
// returns null, computeFinalScore turns that into null for every entry, and the
// approval writes an empty podium while reporting success.
test('a weighted season whose window closed with zero votes is blocked', () => {
  const r = evaluateAwardsGate(
    { ...READY, communityVoteWeight: 0.5, maxVotes: 0 },
    new Date('2026-11-16T00:00:00Z'),
  )
  assert.equal(r.ok, false)
  assert.equal(r.blocked, 'no_votes_cast')
  assert.equal(r.checks.vote, 'fail')
  // The other two gates genuinely passed -- the operator needs to know it is the
  // tally that is missing, not the scoring.
  assert.equal(r.checks.schedule, 'pass')
  assert.equal(r.checks.scoring, 'pass')
  // Detail carries the measured numbers, like every other block.
  assert.match(r.detail, /0 votes/)
})

test('one vote is enough to clear the tally gate -- the threshold question is separate', () => {
  const r = evaluateAwardsGate(
    { ...READY, communityVoteWeight: 0.5, maxVotes: 1 },
    new Date('2026-11-16T00:00:00Z'),
  )
  assert.equal(r.ok, true)
  assert.equal(r.checks.vote, 'pass')
})

test('zero votes does NOT block a season where votes do not count', () => {
  // weight 0 means the tally never enters the score, so there is nothing to wait
  // for -- the gate stays vacuous rather than inventing a new reason to block.
  const r = evaluateAwardsGate(
    { ...READY, communityVoteWeight: 0, maxVotes: 0 },
    new Date('2026-11-16T00:00:00Z'),
  )
  assert.equal(r.ok, true)
  assert.equal(r.checks.vote, 'not_applicable')
})
