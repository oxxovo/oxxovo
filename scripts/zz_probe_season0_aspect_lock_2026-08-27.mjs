#!/usr/bin/env node
/**
 * Real-path control-group check against season_0 ITSELF (not a zz_ fixture
 * clone) for the 9:16 aspect lock TK just confirmed via SQL. Calls the REAL
 * createRender from lib/studio.ts. Only an isolated test user + one temporary
 * generation_jobs clip are created and cleaned up -- season_0's own row is
 * never written to.
 *
 * Run: node --import ./scripts/test-register.mjs --env-file=.env.local scripts/zz_probe_season0_aspect_lock_2026-08-27.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { createHmac, randomUUID } from 'crypto'
import { createRender } from '../lib/studio.ts'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SECRET = process.env.STUDIO_CRYPTOBIND_SECRET
if (!URL || !KEY || !SECRET) { console.error('Missing env.'); process.exit(1) }
const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const SEASON_ID = 'season_0'

const hmac = (p) => createHmac('sha256', SECRET).update(p, 'utf8').digest('hex')
const v1 = (i) => ['v1', i.pid, i.tid, i.jobId, i.gen, i.modelId, String(i.dur)].join('|')

const created = { userIds: [], genIds: [], renderIds: [] }
let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m) } else { fail++; console.log('  FAIL', m) } }

async function main() {
  const { data: seasonRow, error: sErr } = await admin.from('seasons').select('id, aspect_ratio').eq('id', SEASON_ID).single()
  if (sErr) throw new Error('season_0 read: ' + sErr.message)
  console.log('season_0.aspect_ratio =', seasonRow.aspect_ratio)
  ok(seasonRow.aspect_ratio === '9:16', 'season_0.aspect_ratio is 9:16 (confirmed live before probing)')

  const { data: models, error: mErr } = await admin.from('model_catalog').select('id').eq('active', true).limit(1)
  if (mErr || !models?.length) throw new Error('no active model found')
  const modelId = models[0].id

  const email = `s0-aspectlock-e2e-${Math.random().toString(36).slice(2, 10)}@oxxovo.test`
  const { data: u, error: uErr } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (uErr) throw new Error('createUser: ' + uErr.message)
  const userId = u.user.id
  created.userIds.push(userId)

  const jobId = randomUUID()
  const gen = new Date(Date.now() - 1000).toISOString()
  const clipDur = 30 // within application_video_* bounds (15-30s) so the length gate does not mask the aspect check
  const clipSig = hmac(v1({ pid: userId, tid: SEASON_ID, jobId, gen, modelId, dur: clipDur }))
  const { error: gErr } = await admin.from('generation_jobs').insert({
    id: jobId, user_id: userId, season_id: SEASON_ID, model_id: modelId, tier: 'budget',
    prompt: 'season_0 aspect-lock probe clip', duration_seconds: clipDur, status: 'ready',
    video_url: 'https://example.com/s0-aspectlock-probe.mp4', estimated_cost_usd: 0, credits_charged: 0,
    cryptobind_pid: userId, cryptobind_tid: SEASON_ID, cryptobind_generated_at: gen,
    cryptobind_signature: clipSig, cryptobind_algo: 'HMAC-SHA256',
  })
  if (gErr) throw new Error('seed clip: ' + gErr.message)
  created.genIds.push(jobId)

  const rWrong = await createRender({ userId, seasonId: SEASON_ID, edl: { segments: [{ jobId, startMs: 0, endMs: 20000 }], aspect: '16:9' } })
  console.log('  request 16:9 on season_0 ->', JSON.stringify(rWrong))
  ok(rWrong.ok === false && rWrong.reason === 'aspect_locked' && rWrong.detail === '9:16', '16:9 request on season_0 -> aspect_locked (detail=9:16)')

  const rRight = await createRender({ userId, seasonId: SEASON_ID, edl: { segments: [{ jobId, startMs: 0, endMs: 20000 }], aspect: '9:16' } })
  console.log('  request 9:16 on season_0 ->', JSON.stringify(rRight))
  ok(rRight.ok === true, '9:16 request on season_0 -> ok')
  if (rRight.ok && rRight.renderId) created.renderIds.push(rRight.renderId)
}

async function cleanup() {
  const report = { ...created }
  try {
    if (created.renderIds.length) await admin.from('render_jobs').delete().in('id', created.renderIds)
    if (created.genIds.length) await admin.from('generation_jobs').delete().in('id', created.genIds)
    for (const uid of created.userIds) if (uid) await admin.auth.admin.deleteUser(uid)
    console.log('\ncleanup: deleted', JSON.stringify(report), '-- season_0 row itself untouched')
  } catch (e) {
    console.log('\ncleanup ERROR (manual check needed):', e.message, JSON.stringify(report))
  }
}

main()
  .then(cleanup, async (e) => { console.error('\nERROR:', e.message); await cleanup(); process.exit(1) })
  .then(() => {
    console.log(`\n== season_0 aspect lock real-path probe: ${pass} pass, ${fail} fail ==`)
    process.exit(fail ? 1 : 0)
  })
