#!/usr/bin/env node
/**
 * ★HQ 판정 2 (2026-08-27) control-group check: calls the REAL createRender
 * from lib/studio.ts (not a hand-copied replica) against two zz_ fixture
 * seasons cloned from season_0 with studio_round forced to 'application' /
 * 'main' (so resolveEffectiveRound is deterministic regardless of the
 * clock), and checks the four boundary durations TK asked for:
 *   prelim 14s -> too_short, 15s -> ok
 *   main   34s -> too_short, 35s -> ok
 * against season_0's OWN live bounds (application 15/30, main 35/40),
 * copied onto the fixture rows by cloning season_0's row.
 *
 * Live-DB write probe, C7 discipline: inactive (is_fixture=true, never a
 * public season), zz_-prefixed ids, cleanup in a finally block, this report
 * states exactly what was created and that it was deleted.
 *
 * Run: node --import ./scripts/test-register.mjs --env-file=.env.local scripts/zz_probe_length_gate_2026-08-27.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'
import { randomUUID } from 'crypto'
import { createRender } from '../lib/studio.ts'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SECRET = process.env.STUDIO_CRYPTOBIND_SECRET
if (!URL || !KEY || !SECRET) { console.error('Missing env (URL/SERVICE_ROLE/CRYPTOBIND_SECRET).'); process.exit(1) }
const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const hmac = (p) => createHmac('sha256', SECRET).update(p, 'utf8').digest('hex')
const v1 = (i) => ['v1', i.pid, i.tid, i.jobId, i.gen, i.modelId, String(i.dur)].join('|')

const created = { seasonIds: [], userIds: [], genIds: [], renderIds: [] }
let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m) } else { fail++; console.log('  FAIL', m) } }

async function cloneFixtureSeason(suffix, forcedRound) {
  const { data: base, error: bErr } = await admin.from('seasons').select('*').eq('id', 'season_0').single()
  if (bErr) throw new Error('season_0 read: ' + bErr.message)
  const id = `zz_lengthgate_${suffix}_2026-08-27`
  const row = {
    ...base,
    id,
    name: `zz length-gate probe (${suffix})`,
    is_fixture: true,
    season_number: suffix === 'app' ? 9801 : 9802,
    studio_round: forcedRound, // fixed, not 'both' -- resolveEffectiveRound short-circuits on this
  }
  delete row.updated_at
  delete row.created_at
  // Generated columns (pool * pct) -- Postgres refuses a direct INSERT into these.
  delete row.prize_first
  delete row.prize_second
  delete row.prize_third
  const { error: iErr } = await admin.from('seasons').insert(row)
  if (iErr) throw new Error(`insert fixture season ${id}: ${iErr.message}`)
  created.seasonIds.push(id)
  return id
}

async function seedClip(seasonId, modelId) {
  const email = `lengthgate-e2e-${Math.random().toString(36).slice(2, 10)}@oxxovo.test`
  const { data: u, error: uErr } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (uErr) throw new Error('createUser: ' + uErr.message)
  const userId = u.user.id
  created.userIds.push(userId)

  const jobId = randomUUID()
  const gen = new Date(Date.now() - 1000).toISOString()
  const clipDur = 60 // long enough source to trim any of our test durations out of
  const clipSig = hmac(v1({ pid: userId, tid: seasonId, jobId, gen, modelId, dur: clipDur }))
  const { error: gErr } = await admin.from('generation_jobs').insert({
    id: jobId, user_id: userId, season_id: seasonId, model_id: modelId, tier: 'budget',
    prompt: 'length-gate probe clip', duration_seconds: clipDur, status: 'ready',
    video_url: 'https://example.com/lengthgate-probe.mp4', estimated_cost_usd: 0, credits_charged: 0,
    cryptobind_pid: userId, cryptobind_tid: seasonId, cryptobind_generated_at: gen,
    cryptobind_signature: clipSig, cryptobind_algo: 'HMAC-SHA256',
  })
  if (gErr) throw new Error('seed clip: ' + gErr.message)
  created.genIds.push(jobId)
  return { userId, jobId }
}

async function main() {
  const { data: models, error: mErr } = await admin.from('model_catalog').select('id').eq('active', true).limit(1)
  if (mErr || !models?.length) throw new Error('no active model found')
  const modelId = models[0].id

  console.log('== prelim (application_video_min/max) ==')
  const appSeasonId = await cloneFixtureSeason('app', 'application')
  const { userId: appUser, jobId: appJob } = await seedClip(appSeasonId, modelId)

  const r14 = await createRender({ userId: appUser, seasonId: appSeasonId, edl: [{ jobId: appJob, startMs: 0, endMs: 14000 }] })
  console.log('  14s ->', JSON.stringify(r14))
  ok(r14.ok === false && r14.reason === 'too_short', '14s (prelim) -> too_short via REAL createRender')

  const r15 = await createRender({ userId: appUser, seasonId: appSeasonId, edl: [{ jobId: appJob, startMs: 0, endMs: 15000 }] })
  console.log('  15s ->', JSON.stringify(r15))
  ok(r15.ok === true, '15s (prelim) -> ok via REAL createRender')
  if (r15.ok && r15.renderId) created.renderIds.push(r15.renderId)

  console.log('\n== main (main_round_video_min/max) ==')
  const mainSeasonId = await cloneFixtureSeason('main', 'main')
  const { userId: mainUser, jobId: mainJob } = await seedClip(mainSeasonId, modelId)

  const r34 = await createRender({ userId: mainUser, seasonId: mainSeasonId, edl: [{ jobId: mainJob, startMs: 0, endMs: 34000 }] })
  console.log('  34s ->', JSON.stringify(r34))
  ok(r34.ok === false && r34.reason === 'too_short', '34s (main) -> too_short via REAL createRender')

  const r35 = await createRender({ userId: mainUser, seasonId: mainSeasonId, edl: [{ jobId: mainJob, startMs: 0, endMs: 35000 }] })
  console.log('  35s ->', JSON.stringify(r35))
  ok(r35.ok === true, '35s (main) -> ok via REAL createRender')
  if (r35.ok && r35.renderId) created.renderIds.push(r35.renderId)
}

async function cleanup() {
  const report = { ...created }
  try {
    if (created.renderIds.length) await admin.from('render_jobs').delete().in('id', created.renderIds)
    if (created.genIds.length) await admin.from('generation_jobs').delete().in('id', created.genIds)
    for (const uid of created.userIds) if (uid) await admin.auth.admin.deleteUser(uid)
    if (created.seasonIds.length) await admin.from('seasons').delete().in('id', created.seasonIds)
    console.log('\ncleanup: deleted', JSON.stringify(report))
  } catch (e) {
    console.log('\ncleanup ERROR (manual check needed):', e.message, JSON.stringify(report))
  }
}

main()
  .then(cleanup, async (e) => { console.error('\nERROR:', e.message); await cleanup(); process.exit(1) })
  .then(() => {
    console.log(`\n== length gate real-path probe: ${pass} pass, ${fail} fail ==`)
    process.exit(fail ? 1 : 0)
  })
