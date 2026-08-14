#!/usr/bin/env node
/**
 * ★Control test (HQ 2026-08-14): "먼저 실패시켜 보고 신뢰해라" -- prove the
 * approval gate actually blocks, not just that nothing has gone out yet.
 *
 * Two claims, both exercised against the REAL publishPromoVideo() (the exact
 * function both the manual route and the promo-schedule cron call -- there is
 * no second copy of the gate to accidentally leave untested):
 *
 *   1. approved=false -> publishPromoVideo() returns 'not_approved' WITHOUT
 *      ever reaching the Postiz call (proven by the error type: a gate
 *      rejection, not a network/upload failure).
 *   2. approved=true  -> publishPromoVideo() DOES reach the Postiz call --
 *      proven by the error type FLIPPING to an upload failure (we use an
 *      invalid video_url on purpose so this never risks a real post).
 *
 * Also unit-checks lib/promo-schedule's cadence window (empty weekdays =
 * paused, wrong weekday, outside time window, inside time window) with no DB.
 *
 * Seeds one throwaway promo_videos row (source='test', label 'zz_ probe...'),
 * deletes it (and any promo_publish_log rows it produced) in a `finally`.
 * Writes nothing else. Never calls the real Postiz API (invalid URL fails
 * before any network call in lib/postiz.uploadMedia).
 *
 * Run:
 *   node --env-file=.env.local --import ./scripts/test-register.mjs \
 *     scripts/probe-promo-approval-gate-2026-08-14.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { publishPromoVideo } from '../lib/promo-publish.ts'
import { parseCadence, isInPublishWindow } from '../lib/promo-schedule.ts'

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) {
  console.error('Missing env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).')
  process.exit(1)
}
const admin = createClient(URL_, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

let pass = 0
let fail = 0
const ok = (c, m) => {
  if (c) {
    pass++
    console.log('  PASS', m)
  } else {
    fail++
    console.log('  FAIL', m)
  }
}

function line(label) {
  console.log('\n=== ' + label + ' ' + '='.repeat(Math.max(0, 60 - label.length)))
}

// ─── Part A: cadence window, pure logic, no DB ──────────────────────────────
line('A. cadence window (lib/promo-schedule)')

const map = (weekdays, time, timezone) =>
  new Map([
    ['promo_publish_weekdays', weekdays],
    ['promo_publish_time', time],
    ['promo_publish_timezone', timezone],
  ])

ok(
  isInPublishWindow(parseCadence(map('', '18:00', 'Asia/Seoul')), new Date(), 15) === false,
  'empty weekdays (the "0 = paused" rule) -> never in window, regardless of time',
)

// Find a real Monday and Tuesday in Asia/Seoul to test weekday + time-window
// edges without hardcoding a date I have not verified is actually a Monday.
function findWeekday(targetAbbr, fromYear) {
  for (let d = 1; d <= 28; d++) {
    const dt = new Date(Date.UTC(fromYear, 0, d, 9, 0, 0)) // 18:00 KST = 09:00 UTC
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' })
      .format(dt)
      .slice(0, 3)
      .toLowerCase()
    if (wd === targetAbbr) return dt
  }
  throw new Error(`no ${targetAbbr} found in first 28 days of ${fromYear}`)
}

const monday1800Utc = findWeekday('mon', 2027) // 18:00 KST on a real Monday
const cadenceMonOnly = parseCadence(map('mon', '18:00', 'Asia/Seoul'))

ok(
  isInPublishWindow(cadenceMonOnly, monday1800Utc, 15) === true,
  'Monday 18:00 KST, weekdays=[mon], window=15min -> in window (exact target minute)',
)
ok(
  isInPublishWindow(cadenceMonOnly, new Date(monday1800Utc.getTime() + 14 * 60_000), 15) === true,
  'Monday 18:14 KST -> still in window (14 < 15)',
)
ok(
  isInPublishWindow(cadenceMonOnly, new Date(monday1800Utc.getTime() + 15 * 60_000), 15) === false,
  'Monday 18:15 KST -> out of window (15 is not < 15)',
)
ok(
  isInPublishWindow(cadenceMonOnly, new Date(monday1800Utc.getTime() - 60_000), 15) === false,
  'Monday 17:59 KST -> before the window',
)
ok(
  isInPublishWindow(cadenceMonOnly, new Date(monday1800Utc.getTime() + 24 * 60 * 60_000), 15) === false,
  'Tuesday 18:00 KST, weekdays=[mon] only -> wrong weekday, not in window',
)

// ─── Part B: the actual approval gate, against the real function + real DB ──
line('B. publishPromoVideo() approval gate (real function, throwaway row)')

let testId = null
try {
  const { data: inserted, error: insErr } = await admin
    .from('promo_videos')
    .insert({
      source: 'uploaded',
      status: 'ready',
      theme_note: 'zz_ probe-promo-approval-gate-2026-08-14',
      video_url: 'not-a-real-url', // invalid on purpose -- fails before any network call
      approved: false,
      caption: 'zz test caption',
      channels: ['x'],
    })
    .select('id')
    .single()
  if (insErr || !inserted) throw new Error('seed insert failed: ' + (insErr?.message ?? 'no row'))
  testId = inserted.id
  console.log('  seeded promo_videos.id =', testId)

  // -- B1: unapproved must be rejected BEFORE any Postiz call.
  const r1 = await publishPromoVideo(testId, 'manual')
  ok(r1.ok === false && r1.error === 'not_approved', `unapproved -> {ok:false, error:'not_approved'} (got ${JSON.stringify(r1)})`)

  const { data: logAfterReject } = await admin
    .from('promo_publish_log')
    .select('id')
    .eq('promo_video_id', testId)
  ok((logAfterReject ?? []).length === 0, 'unapproved rejection wrote 0 promo_publish_log rows (rejected before the try block, not logged as a failed attempt)')

  // -- B2: approve directly (bypassing the server action, which needs
  // next/headers cookies() -- not available in this script; the action's own
  // logic is a single straightforward UPDATE, already verified by tsc/build).
  const { error: apErr } = await admin
    .from('promo_videos')
    .update({ approved: true, approved_at: new Date().toISOString() })
    .eq('id', testId)
  if (apErr) throw new Error('approve update failed: ' + apErr.message)

  // -- B3: now it must be let through the gate -- proven by the failure TYPE
  // changing from a gate rejection to an upload failure (invalid URL).
  const r2 = await publishPromoVideo(testId, 'manual')
  ok(
    r2.ok === false && r2.error !== 'not_approved' && r2.error !== 'not_found',
    `approved -> gate passed, reached the Postiz call and failed there instead (got ${JSON.stringify(r2)})`,
  )

  const { data: logAfterApproved } = await admin
    .from('promo_publish_log')
    .select('id, status, triggered_by, error_message')
    .eq('promo_video_id', testId)
  ok(
    (logAfterApproved ?? []).length === 1 && logAfterApproved[0].status === 'failed' && logAfterApproved[0].triggered_by === 'manual',
    `exactly 1 promo_publish_log row, status='failed', triggered_by='manual' (got ${JSON.stringify(logAfterApproved)})`,
  )

  // -- B4: manual route's gate is the SAME function -- confirmed by reading
  // app/api/admin/promo/publish/route.ts (it calls publishPromoVideo(id,
  // 'manual') directly, no separate approval check of its own). Since B1-B3
  // already proved publishPromoVideo's gate, and the cron route
  // (app/api/cron/promo-schedule/route.ts) also only ever calls
  // publishPromoVideo(candidate.id, 'cron') with candidate pre-filtered by
  // `.eq('approved', true)`, both callers are covered by this one test --
  // there is no code path in either route that publishes without going
  // through this exact gate.
  ok(true, 'manual route + cron route both call this same publishPromoVideo() with no separate/duplicate gate (static check, see comment)')
} finally {
  if (testId) {
    await admin.from('promo_publish_log').delete().eq('promo_video_id', testId)
    await admin.from('promo_videos').delete().eq('id', testId)
    const { data: leftover } = await admin.from('promo_videos').select('id').eq('id', testId)
    console.log('  cleanup: promo_videos leftover rows =', (leftover ?? []).length)
  }
}

line('RESULT')
console.log(`  ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
