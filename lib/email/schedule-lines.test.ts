// Receipt schedule bullets -- every date from the season row, and none invented.
//
// Falsifiable form. The cases that matter: the same instant must render as the
// same calendar day and time in both languages (PT for both, 2026-08-30 HQ
// policy -- see schedule-lines.ts header), and a null column must remove its
// bullet rather than degrade it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatScheduleDay,
  formatScheduleMoment,
  formatScheduleRange,
  prelimReceiptLines,
  mainReceiptLines,
} from './schedule-lines.ts'

// Season 0, canonical v2. 2026-11-04 08:00Z = Nov 4 00:00 PST.
const CLOSE = '2026-11-04T08:00:00.000Z'
// Awards: 2026-11-17 04:00Z = Nov 16 20:00 PST.
const AWARDS = '2026-11-17T04:00:00.000Z'

test('the same instant is stated in the clock each audience plans against', () => {
  assert.equal(formatScheduleDay(CLOSE, 'en'), 'Nov 4')
  assert.equal(formatScheduleDay(CLOSE, 'ko'), '11월 4일')
})

// ★2026-08-30 (HQ): KR now renders in PT too, same zone as EN (see
// schedule-lines.ts header). The two-zone design this test used to guard
// (KR in Seoul time, a different calendar day from the EN PT date) was
// retired the same day as the chatbot/FAQ token policy -- so the two
// languages must now agree on the same calendar day for the same instant.
test('★the same instant renders as the same calendar day in both languages', () => {
  assert.equal(formatScheduleMoment(AWARDS, 'en'), 'Nov 16, 8:00 PM PT')
  assert.equal(formatScheduleMoment(AWARDS, 'ko'), '11월 16일 오후 8시 미국 서부 시간')
})

// ★Outward copy says PT and only PT (HQ, 2026-08-08). PT is true in every
// season; a fixed "PST" is an hour wrong for a season that runs in July, and
// the same receipt's received-at line already prints PT.
test('★participant copy says PT in both seasons, never PST or PDT', () => {
  const july = '2026-07-15T03:00:00.000Z' // Jul 14 20:00 PDT
  assert.equal(formatScheduleMoment(july, 'en'), 'Jul 14, 8:00 PM PT')
  assert.equal(formatScheduleMoment(AWARDS, 'en'), 'Nov 16, 8:00 PM PT')
})

// ★The operator-facing spelling still follows the DATE, from Intl, never typed.
// Two instants six months apart must produce two different abbreviations -- a
// hardcoded label cannot pass this.
test('the exact label follows the date, not the season', () => {
  const july = '2026-07-15T03:00:00.000Z'
  assert.match(formatScheduleMoment(july, 'en', 'exact') ?? '', /PDT$/)
  assert.match(formatScheduleMoment(AWARDS, 'en', 'exact') ?? '', /PST$/)
})

test('a whole hour drops its minutes in Korean, per the copy', () => {
  assert.equal(formatScheduleMoment(AWARDS, 'ko'), '11월 16일 오후 8시 미국 서부 시간')
  // 2026-11-17 04:30Z = Nov 16 20:30 PST
  assert.equal(formatScheduleMoment('2026-11-17T04:30:00.000Z', 'ko'), '11월 16일 오후 8시 30분 미국 서부 시간')
})

test('half a range is not a range', () => {
  assert.equal(formatScheduleRange(CLOSE, null, 'en'), null)
  assert.equal(formatScheduleRange(null, CLOSE, 'en'), null)
  assert.equal(formatScheduleRange(CLOSE, AWARDS, 'en'), 'Nov 4 – Nov 16')
})

test('unparseable and absent are both null, not a dash', () => {
  assert.equal(formatScheduleDay(null, 'ko'), null)
  assert.equal(formatScheduleDay('nope', 'ko'), null)
  assert.equal(formatScheduleMoment(undefined, 'en'), null)
})

// ★THE ONE THAT GUARDS THE RULE. A season with no dates set must produce NO
// bullets -- not bullets with blanks, and certainly not the dates from the
// copy brief. If this ever returns a line, someone has typed a date into a
// template again.
test('★a season with no schedule produces no bullets at all', () => {
  assert.deepEqual(prelimReceiptLines({}, 'ko'), [])
  assert.deepEqual(prelimReceiptLines({}, 'en'), [])
  assert.deepEqual(mainReceiptLines({}, 'ko'), [])
  assert.deepEqual(mainReceiptLines({}, 'en'), [])
})

test('each bullet appears only when its own column is set', () => {
  assert.deepEqual(prelimReceiptLines({ application_close_at: CLOSE }, 'en'), [
    { label: 'Goes live', value: 'from Nov 4, as each entry clears verification' },
  ])
  assert.deepEqual(
    prelimReceiptLines({ application_close_at: CLOSE, scoring_complete_at: AWARDS }, 'en').length,
    2,
  )
})

test('the main receipt sources both of its bullets', () => {
  const lines = mainReceiptLines(
    {
      community_vote_start_at: '2026-11-13T08:00:00.000Z',
      community_vote_end_at: '2026-11-16T08:00:00.000Z',
      awards_announcement_at: AWARDS,
    },
    'en',
  )
  assert.deepEqual(lines, [
    { label: 'Audience voting', value: 'Nov 13 – Nov 16' },
    { label: 'Winners', value: 'Nov 16, 8:00 PM PT' },
  ])
})

// The vote window can be set while the awards instant is not, and vice versa.
test('one missing column removes one bullet, not both', () => {
  const onlyVote = mainReceiptLines(
    {
      community_vote_start_at: '2026-11-13T08:00:00.000Z',
      community_vote_end_at: '2026-11-16T08:00:00.000Z',
    },
    'ko',
  )
  assert.equal(onlyVote.length, 1)
  assert.equal(onlyVote[0].label, '관객 투표')
})

// ── AI judging bullet: the column existed all along ────────────────────────

const JUDGE_START = '2026-11-05T08:00:00.000Z' // Nov 5 00:00 PT
const JUDGE_END = '2026-11-08T08:00:00.000Z' // Nov 8 00:00 PT

test('both ends known: the bullet is a range', () => {
  const [, judging] = prelimReceiptLines(
    { application_close_at: CLOSE, scoring_start_at: JUDGE_START, scoring_complete_at: JUDGE_END },
    'ko',
  )
  assert.deepEqual(judging, { label: 'AI 심사', value: '11월 5일 ~ 11월 8일' })
})

// ★Each end alone must read as that end, not as the other. "through Nov 8" and
// "from Nov 5" are different promises, and a fallback that printed one when it
// had the other would be a wrong date rather than a missing one.
test('one end known: it says WHICH end', () => {
  const onlyEnd = prelimReceiptLines({ scoring_complete_at: JUDGE_END }, 'en')
  assert.deepEqual(onlyEnd, [{ label: 'AI judging', value: 'through Nov 8' }])
  const onlyStart = prelimReceiptLines({ scoring_start_at: JUDGE_START }, 'en')
  assert.deepEqual(onlyStart, [{ label: 'AI judging', value: 'from Nov 5' }])
})

// ★The results bullet is its own column, not the judging end reused. Nov 8
// 00:00 (scoring_complete_at) and Nov 8 12:00 (prelim_results_announcement_at)
// are twelve hours apart -- if this ever prints the judging end's date at the
// announcement's time (or vice versa), the two columns have been confused.
const RESULTS = '2026-11-08T20:00:00.000Z' // Nov 8 12:00 PT

test('★the results bullet renders from its own column, not the judging end', () => {
  const lines = prelimReceiptLines(
    {
      application_close_at: CLOSE,
      scoring_start_at: JUDGE_START,
      scoring_complete_at: JUDGE_END,
      prelim_results_announcement_at: RESULTS,
    },
    'ko',
  )
  assert.equal(lines.length, 3)
  assert.deepEqual(lines.map((l) => l.label), ['공개', 'AI 심사', '결과 안내'])
  // Nov 8 12:00 PST -- both languages read this in PT now (2026-08-30 policy).
  assert.deepEqual(lines[2], { label: '결과 안내', value: '11월 8일 오후 12시 미국 서부 시간' })
})

// ★Absent stays absent -- the column being null must still omit the bullet,
// the same rule every other bullet in this file follows.
test('no results bullet when its own column is null', () => {
  const lines = prelimReceiptLines(
    { application_close_at: CLOSE, scoring_start_at: JUDGE_START, scoring_complete_at: JUDGE_END },
    'ko',
  )
  assert.equal(lines.length, 2)
  assert.deepEqual(lines.map((l) => l.label), ['공개', 'AI 심사'])
})
