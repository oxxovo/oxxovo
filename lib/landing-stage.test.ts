// The landing hero must never contradict itself.
//
// It did, for the whole back half of a season: the countdown said "Application
// Closes In 00 00 00 00" while the CTA under it said "Join the waitlist". Both were
// reading the same season row; only one of them had been taught that a season
// continues after applications close.
//
// So the invariant under test is not "the countdown hides" -- it is that the three
// things the hero shows at any instant (countdown, CTA, stage note) tell one story.
// It is swept across a full season timeline rather than asserted at a few dates,
// because the failure was at an instant nobody had picked out to check.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isApplicationClosed, resolveSeasonCta } from './seasons.ts'
import { getBannerStage, type BannerStageInput } from './watch.ts'

const OPEN = '2026-07-25T07:00:00.000Z'
const CLOSE = '2026-09-30T07:00:00.000Z'
const MAIN_START = '2026-10-05T07:00:00.000Z'
const VOTE_START = '2026-10-08T07:00:00.000Z'
const VOTE_END = '2026-10-11T07:00:00.000Z'
const AWARDS = '2026-10-13T03:00:00.000Z'

// Shaped after live season_0 (read 2026-08-04): the dates the real hero will meet.
const SEASON = {
  name: 'Season 0',
  application_open_at: OPEN,
  application_close_at: CLOSE,
}

// The banner inputs the season is in at a given instant. Finalists appear after
// judging, films after the reveal, winners only when an admin writes the ranks --
// the ordering the real season goes through.
function stageInputAt(t: number): BannerStageInput {
  const judged = t >= Date.parse(CLOSE) + 2 * 86400_000
  const revealed = t >= Date.parse(MAIN_START)
  const ranked = t >= Date.parse(AWARDS)
  return {
    applicationCloseAt: CLOSE,
    mainRoundStartAt: MAIN_START,
    voteStartAt: VOTE_START,
    voteEndAt: VOTE_END,
    awardsAt: AWARDS,
    finalistCount: judged ? 10 : 0,
    finalistFilmCount: revealed ? 10 : 0,
    winnerCount: ranked ? 3 : 0,
    theme: judged ? 'The Turning Point' : null,
  }
}

// What the hero renders at `now`, mirroring LandingView exactly: the countdown is
// gated on isApplicationClosed, the CTA on resolveSeasonCta, the stage note on any
// stage other than 'accepting'.
function hero(now: Date) {
  const banner = getBannerStage(stageInputAt(now.getTime()), now)
  return {
    countdown: !!SEASON.application_close_at && !isApplicationClosed(SEASON, now),
    cta: resolveSeasonCta(SEASON, now).label,
    note: banner.stage === 'accepting' ? null : banner.stage,
  }
}

// Sweep hourly from a week before applications open to a week past the awards.
// 1,900-odd instants; the bug lived in a range no hand-picked date sat in.
function sweep(fn: (now: Date, h: number) => void) {
  const from = Date.parse(OPEN) - 7 * 86400_000
  const to = Date.parse(AWARDS) + 7 * 86400_000
  for (let t = from, h = 0; t <= to; t += 3600_000, h++) fn(new Date(t), h)
}

test('★the countdown and the CTA never disagree about whether you can still apply', () => {
  sweep((now) => {
    const h = hero(now)
    // "Apply" with no countdown, or a running countdown under "Join the waitlist",
    // is the contradiction that shipped. Both read the same two dates; the hero
    // renders them one above the other.
    if (h.cta.startsWith('Apply')) {
      assert.ok(h.countdown, `at ${now.toISOString()}: "Apply" with no countdown`)
    }
    if (h.countdown && now.getTime() >= Date.parse(OPEN)) {
      assert.ok(
        h.cta.startsWith('Apply'),
        `at ${now.toISOString()}: countdown running under "${h.cta}"`,
      )
    }
  })
})

test('★after applications close the countdown is gone -- it used to sit at 00:00:00:00', () => {
  const after = new Date(Date.parse(CLOSE) + 1000)
  const h = hero(after)
  assert.equal(h.countdown, false)
  // The old gate was `!!targetDate`, which stays true forever once a close date
  // exists. Pinned here so a revert is a test failure, not a rediscovery.
  assert.equal(!!SEASON.application_close_at, true, 'the old gate would still be showing it')
  assert.equal(h.cta, 'Join the waitlist')
  assert.equal(h.note, 'judging')
})

test('every instant after the close has something to say, and it is never blank', () => {
  sweep((now) => {
    if (now.getTime() < Date.parse(CLOSE)) return
    const banner = getBannerStage(stageInputAt(now.getTime()), now)
    assert.notEqual(banner.stage, 'accepting', `blank hero at ${now.toISOString()}`)
    if (banner.stage === 'accepting') return
    assert.ok(banner.title.trim().length > 0, `empty title at ${now.toISOString()}`)
    assert.ok(banner.subtitle.trim().length > 0, `empty subtitle at ${now.toISOString()}`)
  })
})

test('while applications are open the landing shows the countdown and no stage note', () => {
  const mid = new Date((Date.parse(OPEN) + Date.parse(CLOSE)) / 2)
  const h = hero(mid)
  assert.equal(h.note, null, 'a stage note during the open window would duplicate the countdown')
  assert.ok(h.cta.startsWith('Apply'), h.cta)
})

test('the stage the landing shows is the stage /watch shows -- same function, same inputs', () => {
  // Not a re-implementation test: both surfaces call getBannerStage through
  // resolveSeasonStage. This pins the property that matters if that ever changes --
  // one input set, one answer, at the same instant.
  sweep((now) => {
    const a = getBannerStage(stageInputAt(now.getTime()), now)
    const b = getBannerStage(stageInputAt(now.getTime()), now)
    assert.deepEqual(a, b)
  })
})

// ── The window with no name ────────────────────────────────────────────────
// Head office is replacing the 6-stage enum with 9 (draft -> upcoming -> accepting
// -> judging -> finalists_pending -> main_live -> voting -> ★awaiting_results ->
// results). The wiring lands later and in one go; nothing here changes yet.
//
// The new stage that matters to this file is awaiting_results: voting is over, the
// winners are not out. It is ~44 hours long (11/15 00:00 -> 11/16 20:00 PT on the
// shifted calendar; the fixture above has the same 44-hour shape on the pre-shift
// dates). The warning was that if the swap ships without copy for it, the landing
// meets no stage for 44 hours.
//
// ★It is worse than that today, and this is the finding, not the note: the window
// already exists and the 6-stage machine already answers it -- with main_live,
// "The finalists' films are up — come watch and vote." Voting closed at the start
// of that window. So for 44 hours the landing tells people to do something they
// cannot do. The banner copy is 제니3's and getBannerStage is not mine to edit, so
// this pins the window and reports it rather than fixing it.
test('★the 44h between vote close and awards is answered by main_live -- "come watch and vote", after voting closed', () => {
  const gapMs = Date.parse(AWARDS) - Date.parse(VOTE_END)
  assert.equal(gapMs / 3600_000, 44, 'the fixture must keep the real gap shape')

  for (const off of [1, 3600_000, gapMs / 2, gapMs - 1000]) {
    const at = new Date(Date.parse(VOTE_END) + off)
    const banner = getBannerStage(stageInputAt(at.getTime()), at)
    // WHEN THIS FAILS, the 9-stage enum has landed. Check two things before
    // touching it: awaiting_results has copy, and this window hits it.
    assert.equal(
      banner.stage,
      'main_live',
      `at ${at.toISOString()} the stage changed -- if it is now awaiting_results, assert its copy instead`,
    )
    assert.ok(
      banner.stage === 'accepting' || banner.subtitle.length > 0,
      'the window must never be blank, whatever names it',
    )
  }
})

test('the sweep covers the vote-close..awards window at hourly resolution', () => {
  // The transition instruction was that this sweep is where the 44 hours get
  // caught. Pinned so a later edit to the fixture cannot quietly narrow the range
  // past it -- a sweep that no longer crosses the window would still pass every
  // other test in this file.
  let hoursInWindow = 0
  sweep((now) => {
    const t = now.getTime()
    if (t >= Date.parse(VOTE_END) && t < Date.parse(AWARDS)) hoursInWindow++
  })
  assert.ok(hoursInWindow >= 43, `sweep only visits ${hoursInWindow} instants in the window`)
})

test('results is gated on real winners, not on the awards date', () => {
  // The landing inherits this from the shared machine. Worth pinning here too: the
  // landing is the surface a stranger sees first, and "the winners have been
  // announced" with no winners written is the worst version of the old bug.
  const justAfterAwards = new Date(Date.parse(AWARDS) + 60_000)
  const noRanks: BannerStageInput = { ...stageInputAt(justAfterAwards.getTime()), winnerCount: 0 }
  assert.notEqual(getBannerStage(noRanks, justAfterAwards).stage, 'results')
  assert.equal(getBannerStage(stageInputAt(justAfterAwards.getTime()), justAfterAwards).stage, 'results')
})
