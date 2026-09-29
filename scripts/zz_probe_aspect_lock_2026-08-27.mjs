#!/usr/bin/env node
/**
 * Real-path control-group check for the aspect-ratio lock (TK judged 2026-08-27):
 * calls the REAL createRender from lib/studio.ts (not a replica) against a zz_
 * fixture season with aspect_ratio='9:16' locked, and confirms:
 *   - requesting aspect:'16:9' -> rejected (aspect_locked)
 *   - requesting aspect:'9:16' -> ok
 * Also confirms a season with aspect_ratio=NULL still allows both (no
 * regression -- free choice unchanged).
 *
 * Live-DB write probe, C7 discipline: inactive (is_fixture=true, never a
 * public season), zz_-prefixed ids, cleanup in a finally block, reports
 * exactly what was created/deleted.
 *
 * Run: node --import ./scripts/test-register.mjs --env-file=.env.local scripts/zz_probe_aspect_lock_2026-08-27.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { createHmac, randomUUID } from 'crypto'
import { createRender } from '../lib/studio.ts'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SECRET = process.env.STUDIO_CRYPTOBIND_SECRET
if (!URL || !KEY || !SECRET) { console.error('Missing env.'); process.exit(1) }
const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const hmac = (p) => createHmac('sha256', SECRET).update(p, 'utf8').digest('hex')
const v1 = (i) => ['v1', i.pid, i.tid, i.jobId, i.gen, i.modelId, String(i.dur)].join('|')

const created = { seasonIds: [], userIds: [], genIds: [], renderIds: [] }
let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m) } else { fail++; console.log('  FAIL', m) } }

async function cloneFixtureSeason(suffix, aspectRatio) {
  const { data: base, error: bErr } = await admin.from('seasons').select('*').eq('id', 'season_0').single()
  if (bErr) throw new Error('season_0 read: ' + bErr.message)
  const id = `zz_aspectlock_${suffix}_2026-08-27`
  const row = { ...base, id, name: `zz aspect-lock probe (${suffix})`, is_fixture: true, season_number: suffix === 'locked' ? 9803 : 9804, studio_round: 'application', aspect_ratio: aspectRatio }
  delete row.updated_at
  delete row.created_at
  delete row.prize_first
  delete row.prize_second
  delete row.prize_third
  const { error: iErr } = await admin.from('seasons').insert(row)
  if (iErr) throw new Error(`insert fixture season ${id}: ${iErr.message}`)
  created.seasonIds.push(id)
  return id
}

async function seedClip(seasonId, modelId) {
  const email = `aspectlock-e2e-${Math.random().toString(36).slice(2, 10)}@oxxovo.test`
  const { data: u, error: uErr } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (uErr) throw new Error('createUser: ' + uErr.message)
  const userId = u.user.id
  created.userIds.push(userId)
  const jobId = randomUUID()
  const gen = new Date(Date.now() - 1000).toISOString()
  const clipDur = 30
  const clipSig = hmac(v1({ pid: userId, tid: seasonId, jobId, gen, modelId, dur: clipDur }))
  const { error: gErr } = await admin.from('generation_jobs').insert({
    id: jobId, user_id: userId, season_id: seasonId, model_id: modelId, tier: 'budget',
    prompt: 'aspect-lock probe clip', duration_seconds: clipDur, status: 'ready',
    video_url: 'https://example.com/aspectlock-probe.mp4', estimated_cost_usd: 0, credits_charged: 0,
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

  console.log('== locked to 9:16 ==')
  const lockedSeasonId = await cloneFixtureSeason('locked', '9:16')
  const { userId: lu, jobId: lj } = await seedClip(lockedSeasonId, modelId)

  const rWrong = await createRender({ userId: lu, seasonId: lockedSeasonId, edl: { segments: [{ jobId: lj, startMs: 0, endMs: 20000 }], aspect: '16:9' } })
  console.log('  request 16:9 on 9:16-locked season ->', JSON.stringify(rWrong))
  ok(rWrong.ok === false && rWrong.reason === 'aspect_locked' && rWrong.detail === '9:16', '16:9 request -> aspect_locked (detail=9:16)')

  const rRight = await createRender({ userId: lu, seasonId: lockedSeasonId, edl: { segments: [{ jobId: lj, startMs: 0, endMs: 20000 }], aspect: '9:16' } })
  console.log('  request 9:16 on 9:16-locked season ->', JSON.stringify(rRight))
  ok(rRight.ok === true, '9:16 request -> ok')
  if (rRight.ok && rRight.renderId) created.renderIds.push(rRight.renderId)

  console.log('\n== unlocked (aspect_ratio=NULL) -- no regression ==')
  const freeSeasonId = await cloneFixtureSeason('free', null)
  const { userId: fu, jobId: fj } = await seedClip(freeSeasonId, modelId)

  const rFree169 = await createRender({ userId: fu, seasonId: freeSeasonId, edl: { segments: [{ jobId: fj, startMs: 0, endMs: 20000 }], aspect: '16:9' } })
  console.log('  request 16:9 on unlocked season ->', JSON.stringify(rFree169))
  ok(rFree169.ok === true, 'unlocked: 16:9 request -> ok')
  if (rFree169.ok && rFree169.renderId) created.renderIds.push(rFree169.renderId)

  const rFree916 = await createRender({ userId: fu, seasonId: freeSeasonId, edl: { segments: [{ jobId: fj, startMs: 0, endMs: 20000 }], aspect: '9:16' } })
  console.log('  request 9:16 on unlocked season ->', JSON.stringify(rFree916))
  ok(rFree916.ok === true, 'unlocked: 9:16 request -> ok')
  if (rFree916.ok && rFree916.renderId) created.renderIds.push(rFree916.renderId)
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
    console.log(`\n== aspect lock real-path probe: ${pass} pass, ${fail} fail ==`)
    process.exit(fail ? 1 : 0)
  })
