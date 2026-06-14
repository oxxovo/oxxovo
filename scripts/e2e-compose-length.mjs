#!/usr/bin/env node
/**
 * Compose FINAL length gate E2E (live DB). Verifies studio_compose_min_seconds
 * (migration #5) is enforced: total < min -> too_short, [min,max] -> ok,
 * > max -> too_long. createRender is server-only (cannot be imported outside an
 * RSC), so this replicates its gate + insert path 1:1 against the REAL DB
 * (service role) -- the same convention as e2e-submit-render.mjs.
 *
 * It runs the EXACT season .select() the code uses, so a missing column (i.e.
 * migration not run) surfaces here as a hard error rather than a false pass.
 *
 * Run: node --env-file=.env.local scripts/e2e-compose-length.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { createHmac, createHash } from 'crypto'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SECRET = process.env.STUDIO_CRYPTOBIND_SECRET
if (!URL || !KEY || !SECRET) { console.error('Missing env (URL/SERVICE_ROLE/CRYPTOBIND_SECRET).'); process.exit(1) }
const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const ALGO = 'HMAC-SHA256'
const hmac = (p) => createHmac('sha256', SECRET).update(p, 'utf8').digest('hex')
const sha = (p) => createHash('sha256').update(p, 'utf8').digest('hex')
const v1 = (i) => ['v1', i.pid, i.tid, i.jobId, i.gen, i.modelId, String(i.dur)].join('|')
const edlCanon = (edl) => ['edl1', ...edl.map((s) => `${s.jobId}:${s.startMs}:${s.endMs}`)].join('|')
const srcBundle = (sigs) => sha([...sigs].sort().join('|'))
const v1sr = (i) => ['v1sr', i.pid, i.tid, i.renderId, i.edlHash, i.bundle].join('|')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m) } else { fail++; console.log('  FAIL', m) } }
const created = { userIds: [], genIds: [], renderIds: [] }

// 1:1 replica of createRender's length gate (lib/studio.ts). Returns the reason
// or 'ok'. Mirrors the order: empty -> too_short -> too_long.
function lengthGate(totalMs, minSeconds, maxSeconds) {
  if (totalMs <= 0) return 'empty_edl'
  if (minSeconds > 0 && totalMs < minSeconds * 1000) return 'too_short'
  if (totalMs > maxSeconds * 1000) return 'too_long'
  return 'ok'
}

async function main() {
  // 0. Read season_0 compose params with the EXACT select createRender uses.
  //    If studio_compose_min_seconds is missing, PostgREST errors here.
  const { data: s, error: sErr } = await admin
    .from('seasons')
    .select('studio_compose_enabled, studio_compose_min_seconds, studio_compose_max_seconds, studio_compose_max_clips')
    .eq('id', 'season_0')
    .single()
  if (sErr) throw new Error('season select (migration #5 not run?): ' + sErr.message)
  const tid = 'season_0'
  const minSec = Number(s.studio_compose_min_seconds ?? 0)
  const maxSec = Number(s.studio_compose_max_seconds ?? 30)
  console.log(`season_0: compose_enabled=${s.studio_compose_enabled} min=${minSec}s max=${maxSec}s`)
  ok(s.studio_compose_enabled === true, 'studio_compose_enabled = true')
  ok(minSec === 15, `studio_compose_min_seconds = 15 (live: ${minSec})`)
  ok(maxSec === 30, `studio_compose_max_seconds = 30 (live: ${maxSec})`)

  // model + test user
  const { data: models } = await admin.from('model_catalog').select('id').eq('active', true).limit(1)
  const MODEL_ID = models[0].id
  const email = `compose-len-e2e-${sha(tid + KEY).slice(0, 10)}@oxxovo.test`
  const { data: u } = await admin.auth.admin.createUser({ email, email_confirm: true })
  let userId = u?.user?.id
  if (!userId) { const { data: l } = await admin.auth.admin.listUsers(); userId = l?.users?.find((x) => x.email === email)?.id }
  created.userIds.push(userId)

  // Seed ONE ready 30s clip (valid v1) we can trim to any sub-range.
  const jobId = crypto.randomUUID()
  const gen = new Date(Date.now() - 1000).toISOString()
  const clipDur = 30
  const clipSig = hmac(v1({ pid: userId, tid, jobId, gen, modelId: MODEL_ID, dur: clipDur }))
  created.genIds.push(jobId)
  const { error: gErr } = await admin.from('generation_jobs').insert({
    id: jobId, user_id: userId, season_id: tid, model_id: MODEL_ID, tier: 'budget',
    prompt: 'len e2e clip', duration_seconds: clipDur, status: 'ready',
    video_url: 'https://example.com/len-clip.mp4', estimated_cost_usd: 0, credits_charged: 0,
    cryptobind_pid: userId, cryptobind_tid: tid, cryptobind_generated_at: gen,
    cryptobind_signature: clipSig, cryptobind_algo: ALGO,
  })
  if (gErr) throw new Error('seed clip: ' + gErr.message)

  // Replica of createRender's body for one EDL: gate, then (if ok) the real
  // render_jobs insert with a valid v1sr bind. Returns { reason, renderId? }.
  async function runCreateRender(edl) {
    const maxClips = Number(s.studio_compose_max_clips ?? 10)
    if (edl.length > maxClips) return { reason: 'too_many_clips' }
    let totalMs = 0
    for (const seg of edl) {
      if (seg.startMs < 0 || seg.endMs <= seg.startMs) return { reason: 'bad_segment' }
      totalMs += seg.endMs - seg.startMs
    }
    const gateReason = lengthGate(totalMs, minSec, maxSec)
    if (gateReason !== 'ok') return { reason: gateReason }
    // happy path -> build v1sr + insert (exactly like createRender)
    const ids = [...new Set(edl.map((x) => x.jobId))]
    const sigs = [clipSig]
    const edlHash = sha(edlCanon(edl))
    const bundle = srcBundle(sigs)
    const renderId = crypto.randomUUID()
    const genAt = new Date().toISOString()
    const renderSig = hmac(v1sr({ pid: userId, tid, renderId, edlHash, bundle }))
    const { error: insErr } = await admin.from('render_jobs').insert({
      id: renderId, user_id: userId, season_id: tid, status: 'queued',
      edl, source_job_ids: ids, total_duration_seconds: totalMs / 1000,
      cryptobind_pid: userId, cryptobind_tid: tid, cryptobind_generated_at: genAt, cryptobind_algo: ALGO,
      cryptobind_edl_hash: edlHash, cryptobind_source_bundle: bundle, cryptobind_render_signature: renderSig,
    })
    if (insErr) return { reason: 'failed', detail: insErr.message }
    created.renderIds.push(renderId)
    return { reason: 'ok', renderId, totalSeconds: totalMs / 1000 }
  }

  // --- 3 cases ---
  console.log('\n-- length gate cases (min 15s / max 30s) --')

  // A. 5.1s -- the value that PASSED yesterday; must now be rejected.
  {
    const r = await runCreateRender([{ jobId, startMs: 0, endMs: 5100 }])
    ok(r.reason === 'too_short', `5.1s (yesterday's pass) -> too_short [got: ${r.reason}]`)
    ok(!r.renderId, '5.1s wrote NO render row')
  }
  // boundary: 14.999s just under floor
  {
    const r = await runCreateRender([{ jobId, startMs: 0, endMs: 14999 }])
    ok(r.reason === 'too_short', `14.999s -> too_short [got: ${r.reason}]`)
  }
  // B. 20s -- within [15,30]; must pass and write a row.
  {
    const r = await runCreateRender([{ jobId, startMs: 0, endMs: 20000 }])
    ok(r.reason === 'ok', `20s -> ok [got: ${r.reason}${r.detail ? ' / ' + r.detail : ''}]`)
    ok(!!r.renderId && r.totalSeconds === 20, '20s wrote a render row (total 20s)')
    if (r.renderId) {
      const { data: row } = await admin.from('render_jobs').select('id, status, total_duration_seconds').eq('id', r.renderId).single()
      ok(row?.status === 'queued' && Number(row.total_duration_seconds) === 20, '20s render row persisted (queued, 20s)')
    }
  }
  // boundary: exactly 15s floor + exactly 30s ceiling
  {
    const lo = await runCreateRender([{ jobId, startMs: 0, endMs: 15000 }])
    ok(lo.reason === 'ok', `15.0s (floor) -> ok [got: ${lo.reason}]`)
    const hi = await runCreateRender([{ jobId, startMs: 0, endMs: 30000 }])
    ok(hi.reason === 'ok', `30.0s (ceiling) -> ok [got: ${hi.reason}]`)
  }
  // C. 35s -- over max; two segments of one 30s clip (each within clip dur).
  {
    const r = await runCreateRender([
      { jobId, startMs: 0, endMs: 30000 },
      { jobId, startMs: 0, endMs: 5000 },
    ])
    ok(r.reason === 'too_long', `35s -> too_long [got: ${r.reason}]`)
    ok(!r.renderId, '35s wrote NO render row')
  }
  // boundary: 30.001s just over ceiling
  {
    const r = await runCreateRender([
      { jobId, startMs: 0, endMs: 30000 },
      { jobId, startMs: 0, endMs: 1 },
    ])
    ok(r.reason === 'too_long', `30.001s -> too_long [got: ${r.reason}]`)
  }
}

async function cleanup() {
  try {
    if (created.renderIds.length) await admin.from('render_jobs').delete().in('id', created.renderIds)
    if (created.genIds.length) await admin.from('generation_jobs').delete().in('id', created.genIds)
    for (const uid of created.userIds) if (uid) await admin.auth.admin.deleteUser(uid)
    console.log('cleanup: done')
  } catch (e) { console.log('cleanup error:', e.message) }
}

main()
  .then(cleanup, async (e) => { console.error('\nERROR:', e.message); await cleanup(); process.exit(1) })
  .then(() => {
    console.log(`\n== compose length E2E: ${pass} pass, ${fail} fail ==`)
    process.exit(fail ? 1 : 0)
  })
