// ⑥F -- when does "your film is live" go out, and for which round.
//
// Written in the falsifiable form the harness discipline asks for: every case
// below feeds TWO rows that differ in exactly one column and demands DIFFERENT
// answers. A rule rewritten to key off prelim_released_at, or off the hold switch
// alone, cannot pass them.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  videoLiveRounds,
  videoLiveTemplateKey,
  isVotingOpen,
  formatVoteDeadline,
} from './video-live.ts'

const PRELIM = {
  status: 'submitted',
  watch_hidden: false,
  moderation_status: 'approved',
  watch_hold: false,
  free_entry_url: 'https://r2.example/prelim.mp4',
  main_round_video_url: null,
}

const CLOSED = { votingOpen: false }
const OPEN = { votingOpen: true }

// ★The discriminator is the hold, and it is the whole point of ⑥F: the cohort is
// released together, and the mail is what tells the creator it happened.
test('held: no mail. released: exactly the prelim mail', () => {
  assert.deepEqual(videoLiveRounds({ ...PRELIM, watch_hold: true }, CLOSED), [])
  assert.deepEqual(videoLiveRounds(PRELIM, CLOSED), ['application'])
})

// ★A row still in the safety scan at release time is NOT visible, so it must not
// be told it is. It gets its mail on a later tick, when the scan flips it.
test('released but still pending moderation: no mail yet, then one', () => {
  assert.deepEqual(videoLiveRounds({ ...PRELIM, moderation_status: 'pending' }, CLOSED), [])
  assert.deepEqual(videoLiveRounds({ ...PRELIM, moderation_status: 'approved' }, CLOSED), ['application'])
})

test('an admin-hidden or flagged entry is never announced', () => {
  assert.deepEqual(videoLiveRounds({ ...PRELIM, watch_hidden: true }, CLOSED), [])
  assert.deepEqual(videoLiveRounds({ ...PRELIM, status: 'flagged' }, CLOSED), [])
})

test('no file for the round means no mail for the round', () => {
  assert.deepEqual(videoLiveRounds({ ...PRELIM, free_entry_url: null }, CLOSED), [])
  assert.deepEqual(videoLiveRounds({ ...PRELIM, free_entry_url: '   ' }, CLOSED), [])
})

// ★The main mail is a VOTING mail. The film is already visible during the
// processing buffer, but the window is what the email is about, so the window is
// the gate -- not the file, and not the round.
const MAIN = { ...PRELIM, free_entry_url: null, main_round_video_url: 'https://r2.example/main.mp4' }

test('main film present but voting not open: nothing. voting open: the main mail', () => {
  assert.deepEqual(videoLiveRounds(MAIN, CLOSED), [])
  assert.deepEqual(videoLiveRounds(MAIN, OPEN), ['main'])
})

test('both rounds on one row are two separate mails', () => {
  const both = { ...PRELIM, main_round_video_url: 'https://r2.example/main.mp4' }
  assert.deepEqual(videoLiveRounds(both, OPEN), ['application', 'main'])
  // ...and the prelim one does not wait for the vote window.
  assert.deepEqual(videoLiveRounds(both, CLOSED), ['application'])
})

// ★Dedup is per (application_id, template_key). If the two rounds ever shared a
// key, sending the prelim mail would permanently suppress the main one.
test('the two rounds do not share a dedup key', () => {
  assert.notEqual(videoLiveTemplateKey('application'), videoLiveTemplateKey('main'))
  assert.equal(videoLiveTemplateKey('application'), 'video_live_prelim')
  assert.equal(videoLiveTemplateKey('main'), 'video_live_main')
})

// ── vote window ────────────────────────────────────────────────────────────

const START = '2026-11-13T08:00:00.000Z'
const END = '2026-11-17T04:00:00.000Z'
const WINDOW = { community_vote_start_at: START, community_vote_end_at: END }

test('the window is closed before it starts and after it ends', () => {
  assert.equal(isVotingOpen(WINDOW, Date.parse(START) - 1), false)
  assert.equal(isVotingOpen(WINDOW, Date.parse(START)), true)
  assert.equal(isVotingOpen(WINDOW, Date.parse(END) - 1), true)
  // Exclusive end: the instant voting closes, the mail stops going out.
  assert.equal(isVotingOpen(WINDOW, Date.parse(END)), false)
})

// ★An unconfigured window is not an open one. Fail closed -- a voting email
// pointing at a vote nobody can cast is worse than no email.
test('a half-configured window is closed', () => {
  const mid = Date.parse(START) + 3_600_000
  assert.equal(isVotingOpen({ community_vote_start_at: START, community_vote_end_at: null }, mid), false)
  assert.equal(isVotingOpen({ community_vote_start_at: null, community_vote_end_at: END }, mid), false)
  assert.equal(isVotingOpen(null, mid), false)
  assert.equal(isVotingOpen({ community_vote_start_at: 'not a date', community_vote_end_at: END }, mid), false)
})

// ── deadline copy ──────────────────────────────────────────────────────────

test('the deadline rounds DOWN, so it never overstates the time left', () => {
  const now = Date.parse(END) - (2 * 86_400_000 + 14 * 3_600_000 + 59 * 60_000)
  assert.equal(formatVoteDeadline(END, now, 'ko'), '2일 14시간')
  assert.equal(formatVoteDeadline(END, now, 'en'), '2d 14h')
})

test('under a day drops the day unit', () => {
  const now = Date.parse(END) - 5 * 3_600_000
  assert.equal(formatVoteDeadline(END, now, 'ko'), '5시간')
  assert.equal(formatVoteDeadline(END, now, 'en'), '5h')
})

// ★null, not '—'. A caller that cannot say when voting ends must not send the
// mail at all; a dash in the deadline slot is a claim that it has none.
test('past, absent, and unparseable deadlines are null -- not a dash', () => {
  assert.equal(formatVoteDeadline(END, Date.parse(END), 'en'), null)
  assert.equal(formatVoteDeadline(END, Date.parse(END) + 1, 'en'), null)
  assert.equal(formatVoteDeadline(null, Date.parse(START), 'en'), null)
  assert.equal(formatVoteDeadline('nope', Date.parse(START), 'en'), null)
})
