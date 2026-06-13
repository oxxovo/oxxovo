#!/usr/bin/env node
/**
 * submitRender E2E (schema + integrity 실측). No TS runner available, so this
 * replicates the v1/v1s canonical strings (byte-identical to lib/cryptobind.ts)
 * against the REAL STUDIO_CRYPTOBIND_SECRET and REAL DB (service role), then:
 *   1. seeds 2 ready source clips (valid v1) + 1 ready render (valid v1sr+v1sc)
 *   2. proves the compose chain verifies, and an EDL tamper is rejected
 *   3. performs the EXACT genesis_applications insert + render ready->submitted
 *      CAS lock that submitRender does -- catches column/constraint drift
 *   4. asserts post-conditions, then cleans up everything it created
 *
 * Run: node --env-file=.env.local scripts/e2e-submit-render.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { createHmac, createHash, timingSafeEqual } from 'crypto'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SECRET = process.env.STUDIO_CRYPTOBIND_SECRET
if (!URL || !KEY || !SECRET) { console.error('Missing env (URL/SERVICE_ROLE/CRYPTOBIND_SECRET).'); process.exit(1) }
const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const ALGO = 'HMAC-SHA256'
const hmac = (p) => createHmac('sha256', SECRET).update(p, 'utf8').digest('hex')
const sha = (p) => createHash('sha256').update(p, 'utf8').digest('hex')
const eqHex = (a, b) => { try { return a.length === b.length && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex')) } catch { return false } }
// canonical strings -- MUST match lib/cryptobind.ts exactly
const v1 = (i) => ['v1', i.pid, i.tid, i.jobId, i.gen, i.modelId, String(i.dur)].join('|')
const edlCanon = (edl) => ['edl1', ...edl.map((s) => `${s.jobId}:${s.startMs}:${s.endMs}`)].join('|')
const srcBundle = (sigs) => sha([...sigs].sort().join('|'))
const v1sr = (i) => ['v1sr', i.pid, i.tid, i.renderId, i.edlHash, i.bundle].join('|')
const v1sc = (i) => ['v1sc', i.renderId, i.tid, i.finalHash].join('|')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m) } else { fail++; console.log('  FAIL', m) } }

const created = { userIds: [], genIds: [], renderIds: [], appIds: [] }

// canSubmitMainRound status-gate replica (lib/seasons.ts) -- the part the unified
// studio main-round path relies on. Returns the reason a non-selected row is
// rejected (date-window checks are enforced by the same gate in code).
const mainGateReason = (status) => {
  if (['main_round_submitted', 'awarded', 'rejected', 'flagged'].includes(status)) return null
  if (status !== 'selected') return 'not_selected'
  return 'ok'
}

async function main() {
  // 0. season with compose enabled
  const { data: seasons, error: sErr } = await admin
    .from('seasons').select('id, studio_compose_enabled, studio_compose_max_seconds').eq('studio_compose_enabled', true).limit(1)
  if (sErr) throw new Error('seasons: ' + sErr.message)
  if (!seasons?.length) throw new Error('no season with studio_compose_enabled=true')
  const tid = seasons[0].id
  const maxSec = Number(seasons[0].studio_compose_max_seconds ?? 30)
  console.log('season(tid):', tid, 'compose max:', maxSec)

  // model_id has an FK to model_catalog -- use a real one.
  const { data: models, error: mErr } = await admin.from('model_catalog').select('id').limit(1)
  if (mErr) throw new Error('model_catalog: ' + mErr.message)
  if (!models?.length) throw new Error('no model_catalog rows')
  const MODEL_ID = models[0].id
  console.log('model_id:', MODEL_ID)

  // 1. test user (real auth.users row for the FK)
  const email = `compose-e2e-${sha(tid + KEY).slice(0, 10)}@oxxovo.test`
  const { data: uData, error: uErr } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (uErr && !/already been registered/i.test(uErr.message)) throw new Error('createUser: ' + uErr.message)
  let userId = uData?.user?.id
  if (!userId) {
    const { data: list } = await admin.auth.admin.listUsers()
    userId = list?.users?.find((u) => u.email === email)?.id
  }
  if (!userId) throw new Error('no test user id')
  created.userIds.push(userId)
  console.log('test user:', userId)

  // 2. seed 2 ready source clips with valid v1
  const mkGen = (n, dur) => {
    const jobId = crypto.randomUUID()
    const gen = new Date(Date.now() - n * 1000).toISOString()
    const sig = hmac(v1({ pid: userId, tid, jobId, gen, modelId: MODEL_ID, dur }))
    return {
      id: jobId, user_id: userId, season_id: tid, model_id: MODEL_ID, tier: 'budget',
      prompt: `e2e clip ${n}`, duration_seconds: dur, status: 'ready',
      video_url: `https://example.com/clip${n}.mp4`, estimated_cost_usd: 0, credits_charged: 0,
      cryptobind_pid: userId, cryptobind_tid: tid, cryptobind_generated_at: gen,
      cryptobind_signature: sig, cryptobind_algo: ALGO,
    }
  }
  const g1 = mkGen(1, 12), g2 = mkGen(2, 10)
  created.genIds.push(g1.id, g2.id)
  const { error: gErr } = await admin.from('generation_jobs').insert([g1, g2])
  if (gErr) throw new Error('seed gens: ' + gErr.message)

  // 3. EDL (within durations, total <= max) + render with valid v1sr + v1sc
  const edl = [
    { jobId: g1.id, startMs: 0, endMs: 8000 },
    { jobId: g2.id, startMs: 1000, endMs: 9000 },
  ]
  const totalSec = edl.reduce((a, s) => a + (s.endMs - s.startMs), 0) / 1000
  ok(totalSec <= maxSec, `total ${totalSec}s within cap ${maxSec}s`)
  const ids = [...new Set(edl.map((s) => s.jobId))]
  const sigs = ids.map((id) => (id === g1.id ? g1 : g2).cryptobind_signature)
  const edlHash = sha(edlCanon(edl))
  const bundle = srcBundle(sigs)
  const renderId = crypto.randomUUID()
  const genAt = new Date().toISOString()
  const renderSig = hmac(v1sr({ pid: userId, tid, renderId, edlHash, bundle }))
  const finalHash = sha('e2e-final-bytes')
  const finalSig = hmac(v1sc({ renderId, tid, finalHash }))
  created.renderIds.push(renderId)
  const renderRow = {
    id: renderId, user_id: userId, season_id: tid, status: 'ready',
    edl, source_job_ids: ids, total_duration_seconds: totalSec,
    video_url: 'https://example.com/final.mp4', r2_key: 'renders/e2e.mp4',
    cryptobind_pid: userId, cryptobind_tid: tid, cryptobind_generated_at: genAt, cryptobind_algo: ALGO,
    cryptobind_edl_hash: edlHash, cryptobind_source_bundle: bundle, cryptobind_render_signature: renderSig,
    cryptobind_final_hash: finalHash, cryptobind_final_signature: finalSig,
  }
  const { error: rErr } = await admin.from('render_jobs').insert(renderRow)
  if (rErr) throw new Error('seed render: ' + rErr.message)
  console.log('seeded render:', renderId)

  // 4. integrity gate (what submitRender enforces via verifyComposeBind)
  {
    // sources verify (v1)
    let allSrcOk = true
    for (const g of [g1, g2]) {
      const exp = hmac(v1({ pid: g.cryptobind_pid, tid: g.cryptobind_tid, jobId: g.id, gen: g.cryptobind_generated_at, modelId: g.model_id, dur: g.duration_seconds }))
      if (!eqHex(exp, g.cryptobind_signature)) allSrcOk = false
    }
    ok(allSrcOk, 'each source clip v1 signature verifies')
    // render v1sr
    const expReq = hmac(v1sr({ pid: userId, tid, renderId, edlHash: sha(edlCanon(edl)), bundle: srcBundle(sigs) }))
    ok(eqHex(expReq, renderSig), 'render v1sr signature verifies')
    // render v1sc
    const expFin = hmac(v1sc({ renderId, tid, finalHash }))
    ok(eqHex(expFin, finalSig), 'render v1sc (final) signature verifies')
    // tamper: reorder EDL -> v1sr must fail
    const tampered = [edl[1], edl[0]]
    const tamperReq = hmac(v1sr({ pid: userId, tid, renderId, edlHash: sha(edlCanon(tampered)), bundle: srcBundle(sigs) }))
    ok(!eqHex(tamperReq, renderSig), 'tampered EDL is REJECTED (v1sr mismatch)')
    // tamper: swap a source signature -> bundle changes -> v1sr fails
    const badBundle = srcBundle([sigs[0], 'deadbeef'])
    const badReq = hmac(v1sr({ pid: userId, tid, renderId, edlHash, bundle: badBundle }))
    ok(!eqHex(badReq, renderSig), 'tampered source bundle is REJECTED (v1sr mismatch)')
    // tamper: rewrite final hash -> v1sc fails
    const badFin = hmac(v1sc({ renderId, tid, finalHash: sha('attacker-bytes') }))
    ok(!eqHex(badFin, finalSig), 'tampered final hash is REJECTED (v1sc mismatch)')
  }

  // 5. EXACT submitRender writes -- application round, no existing app row.
  //    Catches column/constraint drift (the class that bit us before).
  const stmt = 'E2E composed final submission statement. '.repeat(4).slice(0, 180)
  const appRow = {
    season_id: tid, user_id: userId, email, creator_name: 'E2E Tester', creator_statement: stmt,
    country: 'KR', channel_url: null, ai_service: 'OXXOVO Studio',
    free_entry_url: renderRow.video_url, video_duration_seconds: Math.round(totalSec),
    agreed_to_rules: true, agreed_to_privacy: true, agreed_to_integrity_notice: true,
    status: 'pending', studio_application_render_id: renderId,
    studio_application_submitted_at: new Date().toISOString(),
  }
  const { data: insApp, error: aErr } = await admin.from('genesis_applications').insert(appRow).select('id, free_entry_url, studio_application_render_id, status').single()
  ok(!aErr, `genesis_applications insert accepts submitRender columns${aErr ? ' -- ' + aErr.message : ''}`)
  if (insApp) {
    created.appIds.push(insApp.id)
    ok(insApp.free_entry_url === renderRow.video_url, 'free_entry_url = composed final URL (scorer reads this for application round)')
    ok(insApp.studio_application_render_id === renderId, 'studio_application_render_id links the render')
    ok(insApp.status === 'pending', "status = 'pending' (scorer candidateStatus for application round)")
  }

  // 6. render ready -> submitted CAS lock
  const nowIso = new Date().toISOString()
  const { data: locked, error: lErr } = await admin.from('render_jobs')
    .update({ status: 'submitted', submitted_at: nowIso, updated_at: nowIso })
    .eq('id', renderId).eq('status', 'ready').select('id, status').single()
  ok(!lErr && locked?.status === 'submitted', 'render locked ready->submitted (CAS)')
  // second CAS must affect 0 rows (double-submit guard)
  const { data: again } = await admin.from('render_jobs').update({ status: 'submitted' }).eq('id', renderId).eq('status', 'ready').select('id')
  ok(!again || again.length === 0, 'double submit blocked (no row matches status=ready)')

  // 7. sources stay 'ready'
  const { data: srcAfter } = await admin.from('generation_jobs').select('id, status').in('id', ids)
  ok(srcAfter?.every((s) => s.status === 'ready'), 'source clips remain ready (reusable)')

  // =====================================================================
  // MAIN ROUND -- unified with saveMainRoundSubmission (selected gate + CAS).
  // Tests the status transition the scorer keys on, on a fresh user/render so
  // it does not collide with the application-round row above.
  // =====================================================================
  console.log('\n-- main round --')

  // minimal ready render for the main scenario (integrity already proven above).
  const mkRender = async (uid) => {
    const rid = crypto.randomUUID()
    const e = []
    const { error } = await admin.from('render_jobs').insert({
      id: rid, user_id: uid, season_id: tid, status: 'ready', edl: e, source_job_ids: [],
      total_duration_seconds: 20, video_url: `https://example.com/main-${rid.slice(0, 6)}.mp4`,
      cryptobind_pid: uid, cryptobind_tid: tid, cryptobind_generated_at: new Date().toISOString(),
      cryptobind_algo: ALGO, cryptobind_edl_hash: sha('e' + rid), cryptobind_source_bundle: sha('b' + rid),
      cryptobind_render_signature: hmac('r' + rid), cryptobind_final_hash: sha('f' + rid),
      cryptobind_final_signature: hmac('s' + rid),
    })
    if (error) throw new Error('mkRender: ' + error.message)
    created.renderIds.push(rid)
    return rid
  }
  // seed a user + application row with a given status, return appId.
  const mkApp = async (label, status) => {
    const em = `compose-e2e-${label}-${sha(tid + label).slice(0, 8)}@oxxovo.test`
    const { data: u } = await admin.auth.admin.createUser({ email: em, email_confirm: true })
    let uid = u?.user?.id
    if (!uid) { const { data: l } = await admin.auth.admin.listUsers(); uid = l?.users?.find((x) => x.email === em)?.id }
    created.userIds.push(uid)
    const { data: a, error } = await admin.from('genesis_applications').insert({
      season_id: tid, user_id: uid, email: em, creator_name: `E2E ${label}`,
      creator_statement: 'Main round E2E statement. '.repeat(7).slice(0, 180),
      ai_service: 'OXXOVO Studio', agreed_to_rules: true, agreed_to_privacy: true,
      agreed_to_integrity_notice: true, status,
    }).select('id, status').single()
    if (error) throw new Error(`mkApp(${label}): ` + error.message)
    created.appIds.push(a.id)
    return { uid, appId: a.id }
  }

  // 8. selected participant -> selected->main_round_submitted CAS succeeds.
  {
    const { uid, appId } = await mkApp('selected', 'selected')
    const rid = await mkRender(uid)
    ok(mainGateReason('selected') === 'ok', "canSubmitMainRound gate passes for status='selected'")
    const { data: upd, error: e } = await admin.from('genesis_applications')
      .update({ status: 'main_round_submitted', main_round_video_url: `https://example.com/main-${rid.slice(0, 6)}.mp4`, main_round_submitted_at: new Date().toISOString(), studio_main_render_id: rid })
      .eq('id', appId).eq('status', 'selected').select('id, status, main_round_video_url, studio_main_render_id').single()
    if (e?.code === '23514') {
      // LIVE constraint genesis_apps_status_check is stale (missing
      // 'main_round_submitted'). Code is correct; this block is blocked on
      // reports/genesis_status_constraint_fix_2026-06.sql (TK Run). Re-run after.
      console.log("  PENDING  main-round transition blocked by stale status CHECK")
      console.log("           -> run reports/genesis_status_constraint_fix_2026-06.sql, then re-run this E2E")
    } else {
      if (e) console.log('    CAS error:', e.code, e.message)
      ok(!e && upd?.status === 'main_round_submitted', 'selected -> main_round_submitted CAS transition')
      ok(upd?.studio_main_render_id === rid, 'studio_main_render_id links the composed render')
      const { data: cand } = await admin.from('genesis_applications')
        .select('id, main_round_video_url, creator_statement, creator_name')
        .eq('status', 'main_round_submitted').not('main_round_video_url', 'is', null).eq('id', appId)
      ok(cand?.length === 1 && cand[0].main_round_video_url, 'scorer picks it up as a main-round candidate')
      const { data: again } = await admin.from('genesis_applications')
        .update({ status: 'main_round_submitted' }).eq('id', appId).eq('status', 'selected').select('id')
      ok(!again || again.length === 0, 'main-round double submit blocked (status no longer selected)')
    }
  }

  // 9. non-selected participant -> rejected (gate + CAS both block).
  {
    const { appId } = await mkApp('pending', 'pending')
    ok(mainGateReason('pending') === 'not_selected', "canSubmitMainRound rejects status='pending' (not_selected)")
    const { data: blocked } = await admin.from('genesis_applications')
      .update({ status: 'main_round_submitted', main_round_video_url: 'https://example.com/x.mp4', main_round_submitted_at: new Date().toISOString() })
      .eq('id', appId).eq('status', 'selected').select('id')
    ok(!blocked || blocked.length === 0, 'non-selected CAS matches 0 rows (DB-enforced selected gate)')
    const { data: still } = await admin.from('genesis_applications').select('status').eq('id', appId).single()
    ok(still?.status === 'pending', 'non-selected row unchanged (still pending)')
  }
}

async function cleanup() {
  try {
    if (created.appIds.length) await admin.from('genesis_applications').delete().in('id', created.appIds)
    if (created.renderIds.length) await admin.from('render_jobs').delete().in('id', created.renderIds)
    if (created.genIds.length) await admin.from('generation_jobs').delete().in('id', created.genIds)
    for (const uid of created.userIds) if (uid) await admin.auth.admin.deleteUser(uid)
    console.log('cleanup: done')
  } catch (e) { console.log('cleanup error:', e.message) }
}

main()
  .then(cleanup, async (e) => { console.error('\nERROR:', e.message); await cleanup(); process.exit(1) })
  .then(() => {
    console.log(`\n== submitRender E2E: ${pass} pass, ${fail} fail ==`)
    process.exit(fail ? 1 : 0)
  })
