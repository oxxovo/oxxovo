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
  // ★Added with C-2. Leaving these off does not fail to compile -- tsconfig
  // excludes **/*.test.ts -- and the runtime symptom is subtle rather than loud:
  // with no vote window, getSeasonPhase reads the vote as never scheduled and
  // the whole voting interval reports 'awaiting_results'. Caught by the C-4
  // assertion, not by the type system.
  community_vote_start_at: S0.voteStartAt,
  community_vote_end_at: S0.voteEndAt,
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

// ── C-2 LANDED. The "CURRENT" blocks that used to live here are gone ────────
//
// They pinned deriveLobbyMode's own date rule: ENDED from main_round_end_at
// onward, and status='completed' ending a season with no podium. That behaviour
// no longer exists -- deriveLobbyMode is a projection of getSeasonPhase now --
// so keeping the assertions would have meant asserting against the same function
// twice and calling it agreement. Deleted, as the tripwire demanded. The history
// is in the commit that added them; the CANONICAL blocks below are the spec.

test('C-2: deriveLobbyMode and the canonical machine are the same answer', () => {
  // The migration in one assertion: the projection IS the rule, for every
  // sampled instant and both podium states.
  for (const at of Object.values(WHEN)) {
    assert.equal(current(at), canonical(at), at)
  }
  assert.equal(deriveLobbyMode(row, new Date(WHEN.afterAwards), 3), 'ended')
  assert.equal(deriveLobbyMode(row, new Date(WHEN.afterAwards), 0), 'live')
})

test('C-2: the 4d20h window is closed -- the card stays live through the vote', () => {
  // The defect this whole file was opened for. Same three instants that used to
  // read 'ended'.
  for (const at of [WHEN.afterMainEnd, WHEN.duringVote, WHEN.afterVote]) {
    assert.equal(current(at), 'live', at)
  }
})

test('C-2: completed with no podium no longer ends the season', () => {
  // The honesty rule arrives as a consequence of delegating, not as a feature.
  const at = new Date(WHEN.afterAwards)
  assert.equal(deriveLobbyMode({ ...row, status: 'completed' }, at, 0), 'live')
  assert.equal(deriveLobbyMode({ ...row, status: 'completed' }, at, 3), 'ended')
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

test('the window that was wrong measured 116 hours = 4 days 20 hours', () => {
  // Kept after the fix as the size of what was repaired -- the two columns the
  // old and new rules ended the season at. Not a behaviour assertion any more.
  const oldEnd = Date.parse(S0.mainRoundEndAt) // the old rule ended here
  const honestEnd = Date.parse(S0.awardsAt) // the earliest honest end
  const hours = (honestEnd - oldEnd) / 3_600_000
  assert.equal(hours, 116)
  assert.equal(Math.floor(hours / 24), 4)
  assert.equal(hours % 24, 20)

  // And the floor, not the figure: with no podium the card stays live past the
  // awards instant, which is the point.
  assert.equal(canonical(WHEN.afterAwards, 0), 'live')
  assert.equal(canonical(WHEN.afterAwards, 3), 'ended')
})

// ── C-3: the countdown target the migration will break ──────────────────────

test('★C-3: the countdown follows the phase, and never points backwards', () => {
  // The trap this replaces: 'live' now spans main_live, voting and
  // awaiting_results, so a mode-keyed lookup would have handed the client
  // main_round_end_at during the vote -- an instant already in the past.
  const card = (at: string, winners = 0) => seasonToLobbyCard(row, new Date(at), winners)
  const target = (at: string, winners = 0) => card(at, winners).countdownTargetIso

  assert.equal(target(WHEN.beforeClose), S0.applicationCloseAt) // accepting -> close
  assert.equal(target(WHEN.afterClose), S0.mainRoundStartAt) // judging  -> reveal
  assert.equal(target(WHEN.mainLive), S0.mainRoundEndAt) // main_live -> main end
  assert.equal(target(WHEN.duringVote), S0.voteEndAt) // voting -> vote end
  assert.equal(target(WHEN.afterVote), S0.awardsAt) // awaiting -> awards
  assert.equal(target(WHEN.afterAwards, 3), null) // results -> nothing

  // ★The case a phase->boundary map gets wrong. Nov 12 01:00 PST is still
  // 'main_live' (the films are up) but main_round_end_at is already behind us,
  // and the vote does not open until Nov 13. A per-phase lookup returns the
  // stale deadline, the past-guard nulls it, and the card goes blank for a day.
  // The next-scheduled-moment rule counts down to the vote opening instead.
  assert.equal(card(WHEN.afterMainEnd).phase, 'main_live')
  assert.ok(Date.parse(S0.mainRoundEndAt) < Date.parse(WHEN.afterMainEnd))
  assert.equal(target(WHEN.afterMainEnd), S0.voteStartAt)
  assert.equal(card(WHEN.afterMainEnd).countdownTargetKind, 'vote_start')

  // The kind is what makes a label possible: one mode, four different targets.
  assert.equal(card(WHEN.mainLive).countdownTargetKind, 'main_round_end')
  assert.equal(card(WHEN.duringVote).countdownTargetKind, 'vote_end')
  assert.equal(card(WHEN.afterVote).countdownTargetKind, 'awards')
  assert.equal(card(WHEN.afterAwards, 3).countdownTargetKind, null)

  // ★No target is ever in the past. This is the assertion that would have caught
  // the old behaviour, so it is stated over every sampled instant rather than
  // only where the bug was.
  for (const at of Object.values(WHEN)) {
    for (const winners of [0, 3]) {
      const iso = target(at, winners)
      if (iso == null) continue
      assert.ok(Date.parse(iso) > Date.parse(at), `${at} -> ${iso}`)
    }
  }
})

test('★C-3: a past boundary yields no countdown rather than a stuck timer', () => {
  // awaiting_results with the awards date already gone: there is no future
  // instant to count to, and "no countdown" is true where a zeroed timer is not.
  const late = { ...row, awards_announcement_at: S0.voteEndAt }
  const card = seasonToLobbyCard(late, new Date(WHEN.afterAwards), 0)
  assert.equal(card.phase, 'awaiting_results')
  assert.equal(card.mode, 'live')
  assert.equal(card.countdownTargetIso, null)
})

test('★C-4 seam: the card carries the phase the mode collapses', () => {
  // 'live' covers three phases. The copy needs to tell them apart, so the wiring
  // hands the phase over; the wording is not decided here.
  const at = (s: string, w = 0) => seasonToLobbyCard(row, new Date(s), w)
  assert.equal(at(WHEN.mainLive).phase, 'main_live')
  assert.equal(at(WHEN.duringVote).phase, 'voting')
  assert.equal(at(WHEN.afterVote).phase, 'awaiting_results')
  for (const w of [WHEN.mainLive, WHEN.duringVote, WHEN.afterVote]) {
    assert.equal(at(w).mode, 'live', w) // one mode, three phases
  }
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

test('the blocker A was for: completed with no podium reads live, and 8 rows were like that', () => {
  // ★MEASURED 2026-08-07, before C-2 shipped. Across the 14 seasons the lobby
  // rendered, award_rank rows totalled ZERO -- and eight carried
  // status='completed': season_1000..1006 and season_test.
  //
  // getSeasonPhase treats status='completed' as authoritative but still asks for
  // evidence: completed + 0 winners = 'awaiting_results' -> 'live'. So C-2 on its
  // own would have flipped eight finished rehearsals to LIVE on the home page.
  // A (isRehearsalFixture) shipped first for exactly this reason; the assertion
  // below is why that ordering was not optional.
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

  // ...and A is what keeps them off the surface, so the phase above is never
  // rendered for one of them.
  assert.equal(isRehearsalFixture({ id: 'season_1000', season_number: 1000 }), true)

  // With a podium it ends, so this is about missing evidence, not the status
  // field.
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

// ── tripwire: ANSWERED 2026-08-07 ───────────────────────────────────────────
//
// It fired when C-2 landed, exactly as designed, and demanded three things:
//   1. delete the CURRENT blocks -- done, with a note where they stood.
//   2. keep the CANONICAL blocks as the spec -- done, they are unchanged.
//   3. confirm C-3 shipped with it -- done, and it is now asserted rather than
//      confirmed by hand (see the two C-3 tests above).
//
// What replaces it is the inverse claim: the two must now AGREE, everywhere. The
// old tripwire guarded a migration that had not happened; this one guards the
// one thing that could quietly undo it -- someone reintroducing a second rule.

test('★the lobby has exactly one rule for where a season is', () => {
  for (const at of Object.values(WHEN)) {
    for (const winners of [0, 3]) {
      assert.equal(
        deriveLobbyMode(row, new Date(at), winners),
        toLobbyMode(getSeasonPhase(phaseInput(winners), new Date(at)).phase),
        `${at} winners=${winners}`,
      )
    }
  }
})
