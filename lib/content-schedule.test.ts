import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseNewsSchedule, computeNewsSlot } from './content-schedule'

const ok = { weekdays: 'mon,tue,wed,thu,fri', time: '07:00', timezone: 'Asia/Seoul' }

test('valid schedule parses', () => {
  const r = parseNewsSchedule(ok)
  assert.equal(r.ok, true)
  if (r.ok) assert.deepEqual(r.cadence.weekdays, ['mon', 'tue', 'wed', 'thu', 'fri'])
})

test('missing key -> config_missing:<key> (each of the three)', () => {
  assert.deepEqual(parseNewsSchedule({ ...ok, weekdays: null }), { ok: false, error: 'config_missing:news_publish_weekdays' })
  assert.deepEqual(parseNewsSchedule({ ...ok, time: null }), { ok: false, error: 'config_missing:news_publish_time' })
  assert.deepEqual(parseNewsSchedule({ ...ok, timezone: null }), { ok: false, error: 'config_missing:news_publish_timezone' })
})

test('the quiet-stop trap: Korean weekdays, one bad token, empty, wrong time, non-IANA timezone all REJECT', () => {
  assert.deepEqual(parseNewsSchedule({ ...ok, weekdays: '월~금' }), { ok: false, error: 'config_invalid:news_publish_weekdays' })
  assert.deepEqual(parseNewsSchedule({ ...ok, weekdays: 'mon,tue,xyz' }), { ok: false, error: 'config_invalid:news_publish_weekdays' })
  assert.deepEqual(parseNewsSchedule({ ...ok, weekdays: '' }), { ok: false, error: 'config_invalid:news_publish_weekdays' })
  assert.deepEqual(parseNewsSchedule({ ...ok, weekdays: 'Mon' }), { ok: false, error: 'config_invalid:news_publish_weekdays' })
  assert.deepEqual(parseNewsSchedule({ ...ok, time: '7:00' }), { ok: false, error: 'config_invalid:news_publish_time' })
  assert.deepEqual(parseNewsSchedule({ ...ok, time: '24:00' }), { ok: false, error: 'config_invalid:news_publish_time' })
  assert.deepEqual(parseNewsSchedule({ ...ok, timezone: 'korea' }), { ok: false, error: 'config_invalid:news_publish_timezone' })
})

function cadence() {
  const r = parseNewsSchedule(ok)
  if (!r.ok) throw new Error('fixture')
  return r.cadence
}

// 2026-10-05 is a Monday. 07:00 KST = 22:00 UTC the previous day.
test('before the deadline: Monday 04:00 KST, 120 min lead -> today 07:00 KST, not late', () => {
  const now = new Date('2026-10-04T19:00:00Z') // Mon 04:00 KST
  const s = computeNewsSlot(now, 120, cadence())
  assert.ok(s)
  assert.equal(s!.publishAt.toISOString(), '2026-10-04T22:00:00.000Z') // Mon 07:00 KST
  assert.equal(s!.lateForSlot, false)
})

test('missed slot: Monday 06:30 KST, 120 min lead -> next slot Tuesday, LATE (control for the case above)', () => {
  const now = new Date('2026-10-04T21:30:00Z') // Mon 06:30 KST; today 07:00 is still ahead of now
  const s = computeNewsSlot(now, 120, cadence())
  assert.ok(s)
  assert.equal(s!.publishAt.toISOString(), '2026-10-05T22:00:00.000Z') // Tue 07:00 KST
  assert.equal(s!.lateForSlot, true)
})

test('weekend skip: Friday 08:00 KST -> Monday slot, late (Friday slot gone)', () => {
  const now = new Date('2026-10-08T23:00:00Z') // Fri 2026-10-09 08:00 KST
  const s = computeNewsSlot(now, 120, cadence())
  assert.ok(s)
  assert.equal(s!.publishAt.toISOString(), '2026-10-11T22:00:00.000Z') // Mon 2026-10-12 07:00 KST
  assert.equal(s!.lateForSlot, false) // slotNow is also Monday: nothing was missed today
})

test('publishAt is never earlier than now + lead', () => {
  for (const mins of [0, 60, 120, 600]) {
    const now = new Date('2026-10-04T20:00:00Z')
    const s = computeNewsSlot(now, mins, cadence())
    assert.ok(s)
    assert.ok(s!.publishAt.getTime() >= now.getTime() + mins * 60_000)
  }
})

test('boundary: slot exactly now+lead is accepted only with the skew margin (no lead_too_short race)', () => {
  // Now = 05:00 KST, lead = 120 -> now+lead is exactly 07:00 KST, the slot.
  const now = new Date('2026-10-04T20:00:00Z')
  const s = computeNewsSlot(now, 120, cadence())
  assert.ok(s)
  // With the 30 s margin the slot must move to the NEXT day rather than land on the boundary.
  assert.equal(s!.publishAt.toISOString(), '2026-10-05T22:00:00.000Z')
  assert.equal(s!.lateForSlot, true)
})
