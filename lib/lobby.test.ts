// C-0. The home TOURNAMENTS card says a season has ENDED while its main round is
// showing and community voting is open. Recorded here BEFORE it is fixed.
//
// ★WHY A TEST AND NOT A NOTE. The C-stage migration (deriveLobbyMode ->
// toLobbyMode(getSeasonPhase)) is going to change what the card says on the most
// visible surface we have. If the only record of the old behaviour is prose, the
// migration lands and nobody can tell a fix from a regression. So both answers
// are pinned as executable facts, and the disagreement between them is pinned
// too -- see the tripwire at the bottom.
//
// ★THE DELTA, and where the number comes from (jenny2 asked for the arithmetic).
// One line: the two rules end the season at DIFFERENT COLUMNS.
//
//   current  deriveLobbyMode: endish = main_round_end_at ?? awards_announcement_at
//                             t >= endish              -> 'ended'
//   canonical toLobbyMode:    'ended' only from phase 'results', and getSeasonPhase
//                             reaches 'results' only at awards_announcement_at
//                             AND with winnerCount > 0
//
// season_0, measured from the live row 2026-08-07:
//   main_round_end_at      2026-11-12 00:00 PST   <- current card flips to ENDED
//   awards_announcement_at 2026-11-16 20:00 PST   <- earliest canonical 'ended'
//   difference             116 hours = 4 days 20 hours
//
// Both endpoints are after the 2026-11-01 fall-back, so both are PST and the
// subtraction needs no DST correction (see lib/dst-boundaries.test.ts). And 116h
// is the FLOOR, not the figure: 'results' also needs an approved podium, so if
// award_rank is written late the wrong state runs on past the awards date --
// indefinitely, since nothing else moves the card.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deriveLobbyMode, isRehearsalFixture, seasonToLobbyCard, tallyWinnerCounts } from './lobby'
import { getSeasonPhase, toLobbyMode } from './season-phase'

// ── the live row, written out ───────────────────────────────────────────────
// Values transcribed from season_0 on 2026-08-07, in UTC so the offsets are
// visible rather than implied. PT equivalents are in the comments.
const S0 = {
  applicationOpenAt: '2026-07-25T07:00:00.000Z', // Jul 25 00:00 PDT
  applicationCloseAt: '2026-11-04T08:00:00.000Z', // Nov  4 00:00 PST
  mainRoundStartAt: '2026-11-09T08:00:00.000Z', // Nov  9 00:00 PST
  mainRoundEndAt: '2026-11-12T08:00:00.000Z', // Nov 12 00:00 PST
  voteStartAt: '2026-11-13T08:00:00.000Z', // Nov 13 00:00 PST
  voteEndAt: '2026-11-16T08:00:00.000Z', // Nov 16 00:00 PST
  awardsAt: '2026-11-17T04:00:00.000Z', // Nov 16 20:00 PST
}

// The lobby's row shape (schedule columns only -- it never reads counts today).
const row = {
  id: 'season_0',
  name: 'SEASON 0',
  display_name: 'SEASON 0 - THE LAST HOPE',
  season_number: 0,
  status: 'active',
  season_theme: null,
  poster_url: null,
  lobby_featured: true,
  host_type: 'official',
  total_prize_pool: 0,
  prize_first: 0,
  application_open_at: S0.applicationOpenAt,
  application_close_at: S0.applicationCloseAt,
  main_round_start_at: S0.mainRoundStartAt,
  main_round_end_at: S0.mainRoundEndAt,
  awards_announcement_at: S0.awardsAt,
}

// The canonical machine needs the two evidence counts the lobby does not read
// today. finalistCount is genuinely irrelevant HERE -- 'finalists_pending',
// 'judging' and 'main_live' all fold to 'live' -- so it stays 0 and the tests
// below only vary winnerCount, which does change the answer.
const phaseInput = (winnerCount: number) => ({
  status: 'active',
  applicationOpenAt: S0.applicationOpenAt,
  applicationCloseAt: S0.applicationCloseAt,
  scoringStartAt: null,
  mainRoundStartAt: S0.mainRoundStartAt,
  mainRoundEndAt: S0.mainRoundEndAt,
  voteStartAt: S0.voteStartAt,
  voteEndAt: S0.voteEndAt,
  awardsAt: S0.awardsAt,
  finalistCount: 0,
  winnerCount,
})

const canonical = (at: string, winnerCount = 0) =>
  toLobbyMode(getSeasonPhase(phaseInput(winnerCount), new Date(at)).phase)
const current = (at: string) => deriveLobbyMode(row, new Date(at))

// Sample instants, one per meaningful segment of season_0's calendar.
const WHEN = {
  beforeClose: '2026-11-01T08:00:00.000Z', // Nov  1 00:00 PDT -- accepting
  afterClose: '2026-11-06T08:00:00.000Z', // Nov  6 -- judging
  mainLive: '2026-11-10T08:00:00.000Z', // Nov 10 -- main round showing
  afterMainEnd: '2026-11-12T09:00:00.000Z', // Nov 12 01:00 PST -- films up, vote not open
  duringVote: '2026-11-14T08:00:00.000Z', // Nov 14 -- COMMUNITY VOTING OPEN
  afterVote: '2026-11-16T12:00:00.000Z', // Nov 16 04:00 PST -- vote closed, no podium
  afterAwards: '2026-11-17T05:00:00.000Z', // Nov 16 21:00 PST -- past the awards instant
}

// ── what the card says TODAY (pinned; this is the defect, not the goal) ─────

test('CURRENT: the card reads ENDED from main_round_end_at onward', () => {
  assert.equal(current(WHEN.beforeClose), 'accepting')
  assert.equal(current(WHEN.afterClose), 'live')
  assert.equal(current(WHEN.mainLive), 'live')
  // ★From here the home page calls the tournament over.
  assert.equal(current(WHEN.afterMainEnd), 'ended')
  assert.equal(current(WHEN.duringVote), 'ended') // voting is OPEN
  assert.equal(current(WHEN.afterVote), 'ended')
  assert.equal(current(WHEN.afterAwards), 'ended')
})

test('CURRENT: no podium changes nothing -- the date alone ends the season', () => {
  // The card cannot tell "announced" from "the announcement date passed", because
  // it never looks at award_rank. That is the same honesty gap getBannerStage
  // already closed on Watch.
  assert.equal(current(WHEN.afterAwards), 'ended')
})

// ── what the canonical machine says for the same instants ───────────────────

test('CANONICAL: the season stays live through the main round, the vote, and the wait', () => {
  assert.equal(canonical(WHEN.beforeClose), 'accepting')
  assert.equal(canonical(WHEN.afterClose), 'live')
  assert.equal(canonical(WHEN.mainLive), 'live')
  assert.equal(canonical(WHEN.afterMainEnd), 'live')
  assert.equal(canonical(WHEN.duringVote), 'live')
  assert.equal(canonical(WHEN.afterVote), 'live') // awaiting_results is not 'ended'
})

test('CANONICAL: ended needs an approved podium, not just the awards date', () => {
  assert.equal(canonical(WHEN.afterAwards, 0), 'live') // date passed, no winners
  assert.equal(canonical(WHEN.afterAwards, 3), 'ended') // winners recorded
})

// ── the delta, as arithmetic ────────────────────────────────────────────────

test('★the disagreement is 116 hours = 4 days 20 hours, and that is the floor', () => {
  const flipsNow = Date.parse(S0.mainRoundEndAt) // current rule ends here
  const flipsCanonical = Date.parse(S0.awardsAt) // canonical cannot end before here
  const hours = (flipsCanonical - flipsNow) / 3_600_000
  assert.equal(hours, 116)
  assert.equal(Math.floor(hours / 24), 4)
  assert.equal(hours % 24, 20)

  // Every hour in between, the two rules disagree -- sampled at both ends and the
  // middle so the claim is about the interval, not about three lucky points.
  for (const at of [WHEN.afterMainEnd, WHEN.duringVote, WHEN.afterVote]) {
    assert.equal(current(at), 'ended', at)
    assert.equal(canonical(at), 'live', at)
  }

  // ★FLOOR, not figure: with no podium approved, the disagreement does not end at
  // the awards instant. It just keeps going.
  assert.equal(current(WHEN.afterAwards), 'ended')
  assert.equal(canonical(WHEN.afterAwards, 0), 'live')
})

// ── C-3: the countdown target the migration will break ──────────────────────

test('★C-3 trap: today "live" implies main_round_end_at, which stops being true', () => {
  // countdownTarget is keyed on the MODE. Today 'live' means exactly
  // "closed, main round not over", so main_round_end_at is always ahead.
  const live = seasonToLobbyCard(row, new Date(WHEN.mainLive))
  assert.equal(live.mode, 'live')
  assert.equal(live.countdownTargetIso, S0.mainRoundEndAt)
  assert.ok(Date.parse(live.countdownTargetIso!) > Date.parse(WHEN.mainLive))

  // After the migration 'live' also covers voting and awaiting-results, and the
  // same lookup would hand the client an instant IN THE PAST -- the countdown
  // renders '—'. Proof that the target is stale at that point, computed against
  // the current code so the trap is recorded rather than predicted:
  assert.ok(Date.parse(S0.mainRoundEndAt) < Date.parse(WHEN.duringVote))

  // So C-3 is not cosmetic: the target has to be keyed on the PHASE, and a target
  // already in the past has to become null rather than a countdown to nothing.
})

// ── C-1: the winner tally, and what it exposed ──────────────────────────────

test('C-1: the tally counts per season and ignores rows with no season', () => {
  assert.deepEqual(
    tallyWinnerCounts([
      { season_id: 'season_0' },
      { season_id: 'season_0' },
      { season_id: 'season_0' },
      { season_id: 'season_1' },
      { season_id: null },
    ]),
    { season_0: 3, season_1: 1 },
  )
  assert.deepEqual(tallyWinnerCounts([]), {})
})

test('C-1: an empty tally cannot make a card claim a result', () => {
  // fetchWinnerCounts returns {} when the query fails, so this is the shape of
  // every failure mode: unknown -> 0 -> the season is not 'ended'. The opposite
  // default would announce a podium nobody approved.
  const counts = tallyWinnerCounts([])
  assert.equal(counts['season_0'] ?? 0, 0)
  assert.equal(canonical(WHEN.afterAwards, counts['season_0'] ?? 0), 'live')
})

test('★C-2 BLOCKER: completed with no podium reads live, and 8 seasons are like that', () => {
  // ★MEASURED 2026-08-07, not hypothesised. Across the 14 seasons the lobby
  // renders, award_rank rows total ZERO -- and eight of them carry
  // status='completed': season_1000..1006 (rehearsal fixtures) and season_test.
  //
  // getSeasonPhase treats status='completed' as authoritative but still asks for
  // evidence: completed + 0 winners = 'awaiting_results', which toLobbyMode maps
  // to 'live'. So shipping C-2 today would flip eight finished rehearsal seasons
  // from ENDED to LIVE on the home page.
  //
  // That is the canonical behaving correctly on rows that should not be on the
  // public lobby at all -- isOfficialPublic filters host_type and drafts, and
  // nothing filters rehearsal fixtures. Recorded here so C-2 cannot ship without
  // an answer to it.
  const rehearsal = {
    status: 'completed',
    applicationOpenAt: S0.applicationOpenAt,
    applicationCloseAt: S0.applicationCloseAt,
    scoringStartAt: null,
    mainRoundStartAt: S0.mainRoundStartAt,
    mainRoundEndAt: S0.mainRoundEndAt,
    voteStartAt: S0.voteStartAt,
    voteEndAt: S0.voteEndAt,
    awardsAt: S0.awardsAt,
    finalistCount: 0,
    winnerCount: 0,
  }
  const at = new Date(WHEN.afterAwards)
  assert.equal(getSeasonPhase(rehearsal, at).phase, 'awaiting_results')
  assert.equal(toLobbyMode(getSeasonPhase(rehearsal, at).phase), 'live')

  // The current rule short-circuits on the status alone, which is why the eight
  // read ENDED today.
  assert.equal(deriveLobbyMode({ ...row, status: 'completed' }, at), 'ended')

  // With a podium the two agree, so this is about missing evidence, not about
  // the status field.
  assert.equal(toLobbyMode(getSeasonPhase({ ...rehearsal, winnerCount: 3 }, at).phase), 'ended')
})

// ── A: the fixture filter that has to land before C-2 ───────────────────────

test('A: every season on the lobby today is classified, and the split is the measured one', () => {
  // The exact population read from the base table on 2026-08-07. Written out so
  // this is a claim about real rows, not about a rule agreeing with itself.
  const real = [
    { id: 'season_0', season_number: 0 },
    { id: 'season_1', season_number: 1 },
    { id: 'season_2', season_number: 2 },
    { id: 'season_3', season_number: 3 },
    { id: 'season_4', season_number: 4 },
  ]
  const fixtures = [
    { id: 'season_test2', season_number: 998 },
    { id: 'season_test', season_number: 999 },
    { id: 'season_1000', season_number: 1000 },
    { id: 'season_1001', season_number: 1001 },
    { id: 'season_1002', season_number: 1002 },
    { id: 'season_1003', season_number: 1003 },
    { id: 'season_1004', season_number: 1004 },
    { id: 'season_1005', season_number: 1005 },
    { id: 'season_1006', season_number: 1006 },
  ]
  assert.equal(real.length + fixtures.length, 14)
  for (const s of real) assert.equal(isRehearsalFixture(s), false, s.id)
  for (const s of fixtures) assert.equal(isRehearsalFixture(s), true, s.id)
})

test('A: both clauses are load-bearing -- neither alone covers the population', () => {
  // season_1000 follows no id convention: the number clause is what catches it.
  assert.equal(isRehearsalFixture({ id: 'season_1000', season_number: 1000 }), true)
  // zz_ sits BELOW the band on purpose (e2e/zz-season.mjs picks 997 so it is not
  // the newest season): the prefix clause is what catches it.
  assert.equal(isRehearsalFixture({ id: 'zz_deadline_997', season_number: 997 }), true)
  // ...and 997 is above 900 anyway, which is the point of not cutting at 998.
  assert.equal(isRehearsalFixture({ id: 'anything', season_number: 997 }), true)
})

test('A: the harness seasons the E2E files actually use are covered', () => {
  for (const id of ['season_e2e', 'season_loadtest', 'season_test', 'zz_anything']) {
    // season_number deliberately low, so only the prefix clause can catch these.
    assert.equal(isRehearsalFixture({ id, season_number: 5 }), true, id)
  }
})

test('★A: the stated limitation is real, and pinned so it is not mistaken for coverage', () => {
  // A future rehearsal season numbered below 900 with an unrecognised id LEAKS.
  // This assertion documents the hole rather than papering over it: the durable
  // fix is a column on seasons (head office), and until then the guard is the
  // naming/numbering rule written into the rehearsal runbook.
  assert.equal(isRehearsalFixture({ id: 'rehearsal_nov', season_number: 7 }), false)
})

test('A: the threshold leaves room that a real season will not reach', () => {
  // season_0 runs ~2 months end to end. Even at a monthly cadence the boundary is
  // ~75 years out. Pinned so a future edit has to argue with a number.
  assert.equal(isRehearsalFixture({ id: 'season_120', season_number: 120 }), false)
  assert.equal(isRehearsalFixture({ id: 'season_899', season_number: 899 }), false)
  assert.equal(isRehearsalFixture({ id: 'season_900', season_number: 900 }), true)
})

test('★A must land before C-2, and this says why in one assertion', () => {
  // A completed fixture with no podium is 'live' under the canonical. With the
  // filter it never reaches a card at all, so C-2's tripwire fires for season_0
  // and not for nine rehearsal rows.
  const fixture = { id: 'season_1003', season_number: 1003 }
  assert.equal(isRehearsalFixture(fixture), true)
  assert.equal(
    toLobbyMode(
      getSeasonPhase(
        { ...phaseInput(0), status: 'completed' },
        new Date(WHEN.afterAwards),
      ).phase,
    ),
    'live', // what the card WOULD say if the row were still rendered
  )
})

// ── tripwire ────────────────────────────────────────────────────────────────

test('★TRIPWIRE: the two rules disagree. When they stop, this file is done', () => {
  // The moment C-2 lands, deriveLobbyMode delegates to the canonical and this
  // assertion fails. That failure is the SUCCESS signal, and it is deliberate:
  //
  //   1. delete the CURRENT blocks above (they describe behaviour that no longer
  //      exists),
  //   2. keep the CANONICAL blocks -- they become the spec,
  //   3. check that C-3 shipped with it, or the card will count down to a past
  //      instant for 4 of those 5 days.
  //
  // A migration that quietly makes a test pass teaches nobody anything. This one
  // has to be answered.
  assert.notEqual(current(WHEN.duringVote), canonical(WHEN.duringVote))
})
