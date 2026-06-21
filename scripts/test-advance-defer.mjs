#!/usr/bin/env node
/**
 * E2E test for advance_season_finalists + defer_season_schedule RPCs.
 * Creates throwaway test seasons + applications + scoring_results, exercises
 * every gate, asserts outcomes, and cleans up everything (incl. auth users).
 *
 * Touches ONLY ids/emails prefixed with the test markers below -- never a real
 * season. Run AFTER reports/advance_defer_automation_2026-06.sql is applied.
 *
 *   node --env-file=.env.local scripts/test-advance-defer.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const ADV_SEASON = 'season_test_adv'
const DEF_SEASON = 'season_test_def'
const EMAIL_TAG = 'adv-defer-test'
const sha = (p) => createHash('sha256').update(p).digest('hex')

let pass = true
const ok = (cond, label, extra = '') => {
  if (!cond) pass = false
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
}

const createdUserIds = []

async function makeUser(seed) {
  const email = `${EMAIL_TAG}-${sha(seed).slice(0, 10)}@oxxovo.test`
  const { data } = await admin.auth.admin.createUser({ email, email_confirm: true })
  let uid = data?.user?.id
  if (!uid) {
    const { data: l } = await admin.auth.admin.listUsers()
    uid = l?.users?.find((x) => x.email === email)?.id
  }
  if (uid) createdUserIds.push(uid)
  return { uid, email }
}

async function cloneSeason(srcId, newId, overrides) {
  const { data: src, error } = await admin.from('seasons').select('*').eq('id', srcId).single()
  if (error) throw new Error(`clone read failed: ${error.message}`)
  const row = { ...src, ...overrides, id: newId }
  delete row.created_at
  // GENERATED ALWAYS columns -- cannot be inserted.
  delete row.prize_first
  delete row.prize_second
  delete row.prize_third
  const { error: insErr } = await admin.from('seasons').insert(row)
  if (insErr) throw new Error(`clone insert ${newId} failed: ${insErr.message}`)
}

async function makeApp(seasonId, seed, status) {
  const { uid, email } = await makeUser(`${seasonId}-${seed}`)
  const { data, error } = await admin
    .from('genesis_applications')
    .insert({
      season_id: seasonId, user_id: uid, email,
      creator_name: `test-${seed}`, creator_statement: 'x'.repeat(160),
      ai_service: 'test', agreed_to_rules: true, agreed_to_privacy: true,
      agreed_to_integrity_notice: true, status,
    })
    .select('id')
    .single()
  if (error) throw new Error(`makeApp ${seed} failed: ${error.message}`)
  return data.id
}

async function makeScore(appId, seasonId, { judged, score, flag }) {
  const { error } = await admin.from('scoring_results').insert({
    application_id: appId, season_id: seasonId, round: 'application',
    judged_status: judged, verified_score: score, integrity_flag: flag,
  })
  if (error) throw new Error(`makeScore failed: ${error.message}`)
}

async function cleanup() {
  for (const sid of [ADV_SEASON, DEF_SEASON]) {
    await admin.from('scoring_results').delete().eq('season_id', sid)
    await admin.from('genesis_applications').delete().eq('season_id', sid)
    await admin.from('seasons').delete().eq('id', sid)
  }
  // delete any leftover test users (this run + prior crashed runs)
  const { data: l } = await admin.auth.admin.listUsers({ perPage: 1000 })
  for (const u of l?.users ?? []) {
    if (u.email?.startsWith(EMAIL_TAG)) await admin.auth.admin.deleteUser(u.id)
  }
}

async function advance(seasonId) {
  const { data, error } = await admin.rpc('advance_season_finalists', { p_season_id: seasonId })
  if (error) throw new Error(`advance rpc: ${error.message}`)
  return Array.isArray(data) ? data[0] : data
}
async function defer(seasonId) {
  const { data, error } = await admin.rpc('defer_season_schedule', { p_season_id: seasonId })
  if (error) throw new Error(`defer rpc: ${error.message}`)
  return Array.isArray(data) ? data[0] : data
}
const PAST = (days) => new Date(Date.now() - days * 86400_000).toISOString()

async function main() {
  console.log('=== cleanup (pre) ===')
  await cleanup()

  // ======================= ADVANCEMENT =======================
  console.log('\n=== ADVANCEMENT ===')
  await cloneSeason('season_0', ADV_SEASON, {
    season_number: 9001, name: 'TEST ADV', display_name: 'TEST ADV', status: 'closed',
    application_open_at: PAST(40), application_close_at: PAST(10),
    scoring_start_at: PAST(9), scoring_complete_at: PAST(1),
    main_round_start_at: null, main_round_end_at: null, awards_announcement_at: null,
    min_participants: 50, advance_pct: 0.1, advance_min: 10, advance_max: 50,
    application_defer_count: 0, max_defer_count: 2, defer_extension_days: 7,
    top_n_advance: 0,
  })

  // 12 eligible (scores 90..79), 1 flagged, 1 verifying
  const eligibleIds = []
  for (let i = 0; i < 12; i++) {
    const id = await makeApp(ADV_SEASON, `elig-${i}`, 'eligible')
    await makeScore(id, ADV_SEASON, { judged: 'completed', score: 90 - i, flag: false })
    eligibleIds.push({ id, score: 90 - i })
  }
  const flaggedId = await makeApp(ADV_SEASON, 'flagged', 'flagged')
  await makeScore(flaggedId, ADV_SEASON, { judged: 'completed', score: 95, flag: true })
  const verifyingId = await makeApp(ADV_SEASON, 'verifying', 'verifying')
  await makeScore(verifyingId, ADV_SEASON, { judged: 'in_progress', score: null, flag: false })

  // Gate 1: scoring in progress (verifying present)
  let r = await advance(ADV_SEASON)
  ok(r.blocked === 'scoring_in_progress', 'gate: scoring_in_progress', `(blocked=${r.blocked})`)

  // resolve verifying -> remove it
  await admin.from('scoring_results').delete().eq('application_id', verifyingId)
  await admin.from('genesis_applications').delete().eq('id', verifyingId)

  // Gate 2: flagged pending
  r = await advance(ADV_SEASON)
  ok(r.blocked === 'flagged_pending', 'gate: flagged_pending', `(blocked=${r.blocked})`)

  // admin resolves flagged -> rejected (so it leaves the eligible/flagged pool)
  await admin.from('genesis_applications').update({ status: 'rejected' }).eq('id', flaggedId)

  // Advance for real: 12 eligible, N = clamp(round(1.2),10,50)=10, cap 12 => 10
  r = await advance(ADV_SEASON)
  ok(r.blocked === null || r.blocked === undefined, 'advance: not blocked', `(blocked=${r.blocked})`)
  ok(Number(r.n_target) === 10, 'advance: n_target=10', `(got ${r.n_target})`)
  ok(Number(r.advanced) === 10, 'advance: advanced=10', `(got ${r.advanced})`)
  ok(Number(r.rejected) === 2, 'advance: rejected=2', `(got ${r.rejected})`)

  // Verify: top 10 scores (90..81) selected, 80 & 79 rejected
  const { data: apps } = await admin
    .from('genesis_applications')
    .select('id,status')
    .eq('season_id', ADV_SEASON)
  const byId = new Map(apps.map((a) => [a.id, a.status]))
  const top10 = eligibleIds.filter((e) => e.score >= 81)
  const bottom2 = eligibleIds.filter((e) => e.score <= 80)
  ok(top10.every((e) => byId.get(e.id) === 'selected'), 'advance: top10 selected')
  ok(bottom2.every((e) => byId.get(e.id) === 'rejected'), 'advance: bottom2 rejected')
  ok(byId.get(flaggedId) === 'rejected', 'advance: flagged-resolved untouched (stays rejected)')

  // top_n_advance recorded
  const { data: s2 } = await admin.from('seasons').select('top_n_advance').eq('id', ADV_SEASON).single()
  ok(Number(s2.top_n_advance) === 10, 'advance: season.top_n_advance=10', `(got ${s2.top_n_advance})`)

  // Idempotent re-run
  r = await advance(ADV_SEASON)
  ok(r.blocked === 'already_done', 'advance: idempotent already_done', `(blocked=${r.blocked})`)

  // ======================= DEFERRAL =======================
  console.log('\n=== DEFERRAL ===')
  const closeWas = PAST(1) // 1 day ago so +7 lands in the future
  await cloneSeason('season_0', DEF_SEASON, {
    season_number: 9002, name: 'TEST DEF', display_name: 'TEST DEF', status: 'closed',
    application_open_at: PAST(8), application_close_at: closeWas,
    scoring_start_at: PAST(0.5), scoring_complete_at: new Date(Date.now() + 86400_000).toISOString(),
    main_round_start_at: new Date(Date.now() + 3 * 86400_000).toISOString(),
    main_round_end_at: new Date(Date.now() + 5 * 86400_000).toISOString(),
    awards_announcement_at: new Date(Date.now() + 6 * 86400_000).toISOString(),
    min_participants: 50, application_defer_count: 0, max_defer_count: 2, defer_extension_days: 7,
  })
  // 5 active applicants (< 50)
  for (let i = 0; i < 5; i++) await makeApp(DEF_SEASON, `def-${i}`, 'pending')

  const beforeClose = (await admin.from('seasons').select('application_close_at,awards_announcement_at').eq('id', DEF_SEASON).single()).data
  let d = await defer(DEF_SEASON)
  ok(d.deferred === true, 'defer: deferred=true', `(reason=${d.reason})`)
  ok(Number(d.new_defer_count) === 1, 'defer: count=1', `(got ${d.new_defer_count})`)
  const afterClose = (await admin.from('seasons').select('application_close_at,awards_announcement_at,scoring_complete_at').eq('id', DEF_SEASON).single()).data
  const shift = (new Date(afterClose.application_close_at) - new Date(beforeClose.application_close_at)) / 86400_000
  ok(Math.round(shift) === 7, 'defer: close shifted +7d', `(got ${shift})`)
  const awardShift = (new Date(afterClose.awards_announcement_at) - new Date(beforeClose.awards_announcement_at)) / 86400_000
  ok(Math.round(awardShift) === 7, 'defer: awards shifted +7d too (whole calendar)', `(got ${awardShift})`)

  // re-call: new close now in the future -> not_at_close
  d = await defer(DEF_SEASON)
  ok(d.deferred === false && d.reason === 'not_at_close', 'defer: re-call not_at_close', `(reason=${d.reason})`)

  // max_reached: force count to budget, close back to past
  await admin.from('seasons').update({ application_defer_count: 2, application_close_at: PAST(1) }).eq('id', DEF_SEASON)
  d = await defer(DEF_SEASON)
  ok(d.deferred === false && d.reason === 'max_reached', 'defer: max_reached', `(reason=${d.reason})`)

  // enough: reset count, lower min below applicant count
  await admin.from('seasons').update({ application_defer_count: 0, min_participants: 3 }).eq('id', DEF_SEASON)
  d = await defer(DEF_SEASON)
  ok(d.deferred === false && d.reason === 'enough', 'defer: enough (active>=min)', `(reason=${d.reason})`)

  // ======================= cleanup =======================
  console.log('\n=== cleanup (post) ===')
  await cleanup()

  console.log('\n=== OVERALL: ' + (pass ? 'ALL PASS' : 'FAIL') + ' ===')
  process.exit(pass ? 0 : 1)
}

main().catch(async (e) => {
  console.error('THREW:', e.message)
  try { await cleanup() } catch {}
  process.exit(1)
})
