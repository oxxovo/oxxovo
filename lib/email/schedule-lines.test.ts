// Receipt schedule bullets -- every date from the season row, and none invented.
//
// Falsifiable form. The cases that matter: the same instant must render in two
// different clocks for the two languages, and a null column must remove its
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

// Season 0, canonical v2. 2026-11-04 08:00Z = Nov 4 00:00 PST = Nov 4 17:00 KST.
const CLOSE = '2026-11-04T08:00:00.000Z'
// Awards: 2026-11-17 04:00Z = Nov 16 20:00 PST = Nov 17 13:00 KST.
const AWARDS = '2026-11-17T04:00:00.000Z'

test('the same instant is stated in the clock each audience plans against', () => {
  assert.equal(formatScheduleDay(CLOSE, 'en'), 'Nov 4')
  assert.equal(formatScheduleDay(CLOSE, 'ko'), '11월 4일')
})

// ★The awards instant is a DIFFERENT CALENDAR DAY in the two zones -- Nov 16
// evening in California is Nov 17 afternoon in Seoul. A formatter that rendered
// one date for both languages would tell half the audience the wrong day.
test('★a single instant can be two different days, and both must be right', () => {
  assert.equal(formatScheduleMoment(AWARDS, 'en'), 'Nov 16, 8:00 PM PST')
  assert.equal(formatScheduleMoment(AWARDS, 'ko'), '11월 17일 오후 1시(한국 시간)')
})

// ★The zone abbreviation comes from Intl, never typed. Season 0 runs after the
// 2026-11-01 change so it is PST; a July season is PDT and a hardcoded string
// would be an hour wrong with nothing to catch it.
test('the zone label follows the date, not the season', () => {
  const july = '2026-07-15T03:00:00.000Z' // Jul 14 20:00 PDT
  assert.match(formatScheduleMoment(july, 'en') ?? '', /PDT$/)
  assert.match(formatScheduleMoment(AWARDS, 'en') ?? '', /PST$/)
})

test('a whole hour drops its minutes in Korean, per the copy', () => {
  assert.equal(formatScheduleMoment(AWARDS, 'ko'), '11월 17일 오후 1시(한국 시간)')
  // 2026-11-17 04:30Z = 13:30 KST
  assert.equal(formatScheduleMoment('2026-11-17T04:30:00.000Z', 'ko'), '11월 17일 오후 1시 30분(한국 시간)')
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
    { label: 'Winners', value: 'Nov 16, 8:00 PM PST' },
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
