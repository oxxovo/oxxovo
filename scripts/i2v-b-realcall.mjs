// ⑪B -- ONE real Kling V3 Pro i2v call: 6 shots x 2s, on the demo account, in
// season_test. Approved envelope: $2.016 / 26 credits.
//
//   node --env-file=.env.local --import ./scripts/test-register.mjs scripts/i2v-b-realcall.mjs
//     -> DRY RUN. Prints the exact fal input, the derived cost and credits, and
//        every guard's verdict. Writes nothing, spends nothing.
//
//   ... scripts/i2v-b-realcall.mjs --confirm
//     -> enqueues the job (the real server function, real charge) and then WATCHES
//        it. ★It does not run a worker. The job is left for the Railway worker to
//        claim, which is the whole point: STUDIO_DEV_MODE on a local worker swaps
//        the model and the length for the cheapest ones while the credit charge
//        stays at the price of the model that was asked for.
//
//   ... scripts/i2v-b-realcall.mjs --watch <jobId>     -> resume watching
//   ... scripts/i2v-b-realcall.mjs --verify <jobId>    -> artifact verification only
//
// VERIFICATION IS OF THE ARTIFACT, NOT THE ROW. --verify downloads the mp4 and
// (a) ffprobes the container for duration / streams / audio, (b) counts scene cuts
// with ffmpeg so "6 shots" is a measurement rather than a request, and
// (c) recomputes both CryptoBind stages from the bytes: the v1v generation
// signature (over the row's own fields + the parent-image bundle) and the v1c
// content signature (over sha256 of the file that was actually delivered).
import { createClient } from '@supabase/supabase-js'
import { createHmac, createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { writeFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createI2vGeneration } from '../lib/studio.ts'

const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY
const SECRET = process.env.STUDIO_CRYPTOBIND_SECRET
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, SRV, { auth: { persistSession: false } })

const CONFIRM = process.argv.includes('--confirm')
// ★Read the value only when the flag is actually present. `indexOf` returns -1 for
// an absent flag and argv[0] is the node binary, so the naive `indexOf(f) + 1` form
// makes every run look like `--watch C:\...\node.exe`.
const flagValue = (f) => { const i = process.argv.indexOf(f); return i === -1 ? null : process.argv[i + 1] ?? null }
const WATCH_ID = flagValue('--watch')
const VERIFY_ID = flagValue('--verify')

// The approved envelope. Hardcoded HERE on purpose: this is not an operational
// parameter, it is the number that was approved. If the catalogue has drifted, the
// run must stop and be re-approved rather than quietly spend a different amount.
const APPROVED_COST_USD = 2.016
const APPROVED_CREDITS = 26

const SEASON_ID = 'season_test'
const DEMO_EMAIL = 'studio-demo@oxxovo.ai'
const MODEL_ID = 'kling-v3-pro-i2v'

// 6 shots x 2s. One generation, one actor, six framings -- which is the only thing
// ⑪ is trying to measure: does the face survive six cuts inside one call.
// Deliberately free of any product/category language, so the stored prompt cannot
// hint at a competition theme.
const SHOTS = [
  { prompt: 'She lifts her eyes to the camera and holds a calm, steady gaze, soft key light, shallow depth of field, cinematic portrait.', durationSeconds: 2 },
  { prompt: 'Medium shot from her left side as she turns her head slowly toward the lens, hair moving slightly, warm rim light.', durationSeconds: 2 },
  { prompt: 'Tight close-up on her face as she blinks once and a small smile begins, luminous even skin, soft shadows.', durationSeconds: 2 },
  { prompt: 'She tilts her chin down and looks up again through her lashes, quiet confidence, studio background out of focus.', durationSeconds: 2 },
  { prompt: 'Wider shot as she straightens her shoulders and faces front, hands relaxed, even frontal lighting.', durationSeconds: 2 },
  { prompt: 'Final close-up as she looks just off camera and exhales, expression settling, slow gentle push in.', durationSeconds: 2 },
]

const line = (m) => console.log(m)
const hr = () => line('-'.repeat(76))
const fail = (m) => { console.error(`\n★ABORT: ${m}`); process.exit(3) }

const sign = (payload) => createHmac('sha256', SECRET).update(payload, 'utf8').digest('hex')
const sha256 = (b) => createHash('sha256').update(b).digest('hex')
// byte-mirrors lib/cryptobind.ts
const v1vCanon = (i) => ['v1v', i.pid, i.tid, i.jobId, i.generatedAt, i.modelId, String(i.durationSeconds), i.parentBundle].join('|')
const v1cCanon = (i) => ['v1c', i.jobId, i.tid, i.contentHash].join('|')
const bundleOf = (sigs) => sha256([...sigs].sort().join('|'))

const run = (cmd, args) =>
  new Promise((res) => execFile(cmd, args, { maxBuffer: 64 * 1024 * 1024 }, (e, so, se) => res({ code: e ? (e.code ?? 1) : 0, stdout: so, stderr: se })))

async function resolveDemoUid() {
  for (let page = 1; page <= 50; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === DEMO_EMAIL)
    if (hit) return hit.id
    if (data.users.length < 200) break
  }
  return null
}

// ═══════════════════════════════════════════════════════════════════════════
// artifact verification
// ═══════════════════════════════════════════════════════════════════════════
async function verify(jobId) {
  const { data: job } = await admin.from('generation_jobs').select('*').eq('id', jobId).maybeSingle()
  if (!job) fail(`job ${jobId} not found`)
  hr()
  line(`VERIFY  ${jobId}`)
  hr()
  line(`  status            ${job.status}`)
  line(`  model_id          ${job.model_id}`)
  line(`  duration_seconds  ${job.duration_seconds}`)
  line(`  fal_request_id    ${job.fal_request_id ?? '-'}`)
  line(`  credits_charged   ${job.credits_charged}`)
  line(`  estimated_cost    $${job.estimated_cost_usd}`)
  line(`  actual_cost_usd   ${job.actual_cost_usd == null ? 'null' : '$' + job.actual_cost_usd}`)
  line(`  worker_finished   ${job.worker_finished_at ?? '-'}`)
  line(`  video_url         ${job.video_url ?? '-'}`)
  if (job.error_message) line(`  error_message     ${job.error_message}`)
  const mp = job.user_params?.i2v_input?.multi_prompt ?? []
  line(`  multi_prompt      ${mp.length} shots, durations=[${mp.map((s) => s.duration).join(',')}]`)

  // ★no-dev-mode-swap proof: the row was charged for Kling at 12s. If a dev-mode
  // worker had claimed it, the effective model and length would be the cheapest
  // model's, and actual_cost_usd is computed from the EFFECTIVE model.
  const swapProof = Number(job.actual_cost_usd) === Number(job.estimated_cost_usd)
  line(`  dev-mode swap?    ${swapProof ? 'NO (actual == estimated, effective model = requested)' : '★YES/UNKNOWN -- actual != estimated'}`)

  if (!job.video_url) { line('\n  no artifact yet -- nothing to probe'); return }

  const dir = await mkdtemp(join(tmpdir(), 'i2vb-'))
  const file = join(dir, `${jobId}.mp4`)
  const res = await fetch(job.video_url)
  if (!res.ok) fail(`download ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(file, buf)
  line(`\n  downloaded        ${buf.length} bytes -> ${file}`)

  // ── ffprobe: container truth ────────────────────────────────────────────────
  const probe = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file])
  if (probe.code !== 0) fail('ffprobe failed: ' + probe.stderr.slice(0, 300))
  const meta = JSON.parse(probe.stdout)
  const v = (meta.streams ?? []).find((s) => s.codec_type === 'video')
  const a = (meta.streams ?? []).find((s) => s.codec_type === 'audio')
  const dur = Number(meta.format?.duration)
  hr()
  line('  ── ffprobe ──')
  line(`  duration          ${dur.toFixed(3)}s   (requested 6 x 2s = 12s)`)
  line(`  video             ${v ? `${v.codec_name} ${v.width}x${v.height} ${v.r_frame_rate} fps, ${v.nb_frames ?? '?'} frames` : 'ABSENT'}`)
  line(`  audio             ${a ? `${a.codec_name} ${a.sample_rate}Hz ch=${a.channels} dur=${a.duration ?? '?'}` : '★ABSENT (catalogue says generate_audio: true)'}`)
  const durOk = Math.abs(dur - 12) <= 0.6
  line(`  duration verdict  ${durOk ? 'MATCHES 12s' : `★MISMATCH -- got ${dur.toFixed(3)}s, not 12s`}`)

  // ── scene cuts: is "6 shots" true in the pixels? ──────────────────────────
  // 6 shots means 5 internal cuts. Scene detection is a threshold, so this is
  // reported as a measurement at three thresholds rather than a single verdict --
  // one threshold's number alone would be a coin flip on a soft dissolve.
  hr()
  line('  ── scene cuts (6 shots => expect 5 internal cuts) ──')
  for (const th of [0.2, 0.3, 0.4]) {
    const sc = await run('ffmpeg', ['-hide_banner', '-i', file, '-filter:v', `select='gt(scene,${th})',showinfo`, '-f', 'null', '-'])
    const times = [...(sc.stderr ?? '').matchAll(/pts_time:([0-9.]+)/g)].map((m) => Number(m[1]))
    line(`  threshold ${th}     ${times.length} cut(s) at [${times.map((t) => t.toFixed(2)).join(', ')}]`)
  }

  // ── CryptoBind recomputation (both stages, from the bytes) ────────────────
  hr()
  line('  ── CryptoBind recomputation ──')
  const parentIds = job.parent_image_job_ids ?? []
  const { data: parents } = await admin.from('generation_jobs').select('id, cryptobind_signature').in('id', parentIds)
  const reBundle = bundleOf((parents ?? []).map((p) => String(p.cryptobind_signature)))
  const bundleOk = reBundle === job.cryptobind_parent_bundle
  line(`  parents           ${parentIds.length} image job(s)`)
  line(`  parent bundle     ${bundleOk ? 'MATCH' : '★MISMATCH'}  recomputed=${reBundle.slice(0, 16)}… stored=${String(job.cryptobind_parent_bundle).slice(0, 16)}…`)

  const reV1v = sign(v1vCanon({
    pid: job.cryptobind_pid, tid: job.cryptobind_tid, jobId: job.id,
    generatedAt: new Date(job.cryptobind_generated_at).toISOString(),
    modelId: job.model_id, durationSeconds: job.duration_seconds, parentBundle: job.cryptobind_parent_bundle,
  }))
  const v1vOk = reV1v === job.cryptobind_signature
  line(`  v1v (generation)  ${v1vOk ? 'MATCH' : '★MISMATCH'}  recomputed=${reV1v.slice(0, 16)}… stored=${String(job.cryptobind_signature).slice(0, 16)}…`)

  const fileHash = sha256(buf)
  const hashOk = fileHash === job.cryptobind_content_hash
  line(`  content hash      ${hashOk ? 'MATCH' : '★MISMATCH'}  file=${fileHash.slice(0, 16)}… stored=${String(job.cryptobind_content_hash).slice(0, 16)}…`)
  const reV1c = job.cryptobind_content_hash ? sign(v1cCanon({ jobId: job.id, tid: job.cryptobind_tid, contentHash: job.cryptobind_content_hash })) : null
  const v1cOk = reV1c === job.cryptobind_content_signature
  line(`  v1c (content)     ${reV1c ? (v1cOk ? 'MATCH' : '★MISMATCH') : '★ABSENT'}  ${reV1c ? `recomputed=${reV1c.slice(0, 16)}… stored=${String(job.cryptobind_content_signature).slice(0, 16)}…` : ''}`)

  // negative control: one byte of the canonical changed must NOT verify, or the
  // comparison above proves nothing.
  const tampered = sign(v1vCanon({
    pid: job.cryptobind_pid, tid: job.cryptobind_tid, jobId: job.id,
    generatedAt: new Date(job.cryptobind_generated_at).toISOString(),
    modelId: job.model_id, durationSeconds: Number(job.duration_seconds) + 1, parentBundle: job.cryptobind_parent_bundle,
  }))
  line(`  negative control  ${tampered !== job.cryptobind_signature ? 'REFUSED (duration+1 does not verify)' : '★ACCEPTED -- the check is vacuous'}`)

  hr()
  const all = [durOk, bundleOk, v1vOk, hashOk, v1cOk, swapProof, !!v && !!a]
  line(`  ARTIFACT VERDICT  ${all.every(Boolean) ? 'ALL PASS' : '★SEE ★ LINES ABOVE'}`)
  line(`  local copy        ${file}`)
}

// ═══════════════════════════════════════════════════════════════════════════
// watch (no worker is started here -- this only reads)
// ═══════════════════════════════════════════════════════════════════════════
async function watch(jobId, timeoutMs = 1_500_000) {
  const t0 = Date.now()
  let last = null
  hr()
  line(`WATCH   ${jobId}   (reading only -- no local worker)`)
  hr()
  for (;;) {
    const { data: j } = await admin
      .from('generation_jobs')
      .select('status, fal_request_id, video_url, error_message, actual_cost_usd, worker_started_at, worker_finished_at, attempts')
      .eq('id', jobId)
      .maybeSingle()
    const el = ((Date.now() - t0) / 1000).toFixed(0)
    const key = `${j?.status}|${j?.fal_request_id}`
    if (key !== last) {
      line(`  +${String(el).padStart(5)}s  status=${j?.status} attempts=${j?.attempts} fal=${j?.fal_request_id ?? '-'}${j?.error_message ? ' ERR=' + String(j.error_message).slice(0, 100) : ''}`)
      last = key
    }
    if (j?.status === 'ready' && j.video_url) { line(`\n  READY after ${el}s`); return { ok: true, elapsedSec: Number(el) } }
    if (j?.status === 'failed') { line(`\n  FAILED after ${el}s: ${j.error_message}`); return { ok: false, elapsedSec: Number(el) } }
    if (Date.now() - t0 > timeoutMs) { line(`\n  TIMEOUT after ${el}s (status=${j?.status}) -- the job row is untouched; re-run with --watch`); return { ok: false, timeout: true } }
    await new Promise((r) => setTimeout(r, 10000))
  }
}

// ═══════════════════════════════════════════════════════════════════════════
;(async () => {
  if (!SRV || !SECRET) fail('missing SUPABASE_SERVICE_ROLE_KEY / STUDIO_CRYPTOBIND_SECRET')

  if (VERIFY_ID) { await verify(VERIFY_ID); process.exit(0) }
  if (WATCH_ID) { const r = await watch(WATCH_ID); await verify(WATCH_ID); process.exit(r.ok ? 0 : 1) }

  line(`\n════ ⑪B  Kling i2v 6 shots x 2s  |  mode=${CONFIRM ? '★CONFIRM (real fal $$)' : 'DRY RUN ($0)'} ════\n`)

  // ── guard 1: this process must not be a dev-mode environment ─────────────
  // The near-miss: STUDIO_DEV_MODE=true makes a worker swap the model and the
  // length for the cheapest ones, while the participant's charge stays at the
  // price of the model they asked for. Nothing about this run should sit in an
  // environment where that variable is set at all.
  if (process.env.STUDIO_DEV_MODE) fail(`STUDIO_DEV_MODE is set (${process.env.STUDIO_DEV_MODE}) -- unset it. A dev-mode worker swaps the model and bills the original price.`)
  if (process.env.FAL_FAKE) fail(`FAL_FAKE is set (${process.env.FAL_FAKE}) -- a mock produces no real video.`)
  line('  guard  STUDIO_DEV_MODE / FAL_FAKE unset .......... OK')

  // ── guard 2: the queue must be empty, so the claim we observe is ours ────
  const { data: busy } = await admin.from('generation_jobs').select('id, status, model_id').in('status', ['queued', 'processing', 'generating', 'uploading'])
  if ((busy ?? []).length) fail(`${busy.length} job(s) already queued/in flight -- ${busy.map((b) => b.id.slice(0, 8) + ':' + b.status).join(', ')}. Wait, so the claim observed is this job's.`)
  line('  guard  queue empty (0 in flight) ................. OK')

  // ── guard 3: the catalogue still prices what was approved ────────────────
  const { data: model } = await admin.from('model_catalog').select('*').eq('id', MODEL_ID).maybeSingle()
  if (!model) fail(`${MODEL_ID} not in model_catalog`)
  const total = SHOTS.reduce((a, s) => a + s.durationSeconds, 0)
  if (SHOTS.length !== 6) fail(`expected 6 shots, have ${SHOTS.length}`)
  if (total !== 12) fail(`expected 12s total, have ${total}s`)
  if (total < model.min_duration_seconds || total > model.max_duration_seconds) fail(`${total}s outside [${model.min_duration_seconds}, ${model.max_duration_seconds}]`)
  if (model.metadata?.accepts_multi_prompt !== true) fail('catalogue says this model does not accept multi_prompt')
  if (Array.isArray(model.metadata?.durations) && model.metadata.durations.length) {
    fail(`catalogue now carries a durations enum ${JSON.stringify(model.metadata.durations)} -- the worker would SNAP 12s and the cost basis changes`)
  }
  const cost = Number(model.cost_per_second_usd) * total
  if (Math.abs(cost - APPROVED_COST_USD) > 0.0005) fail(`cost drifted: $${cost.toFixed(4)} vs approved $${APPROVED_COST_USD}. Re-approval needed.`)
  line(`  guard  price ${model.cost_per_second_usd}/s x ${total}s = $${cost.toFixed(4)} == approved  OK`)

  // ── guard 4: credits derived, then compared to the approved number ───────
  const { data: pcfg } = await admin.from('platform_config').select('key, value').in('key', ['studio_margin_rate', 'studio_credit_usd_value', 'studio_daily_generation_cap'])
  const cmap = new Map((pcfg ?? []).map((r) => [r.key, r.value]))
  const margin = Number(cmap.get('studio_margin_rate'))
  const creditUsd = Number(cmap.get('studio_credit_usd_value'))
  if (!Number.isFinite(margin) || !Number.isFinite(creditUsd) || creditUsd <= 0) fail(`pricing config unusable (margin=${cmap.get('studio_margin_rate')} creditUsd=${cmap.get('studio_credit_usd_value')})`)
  const credits = Math.ceil((cost * (1 + margin)) / creditUsd)
  if (credits !== APPROVED_CREDITS) fail(`credits ${credits} != approved ${APPROVED_CREDITS} (margin=${margin}, creditUsd=${creditUsd})`)
  line(`  guard  ceil($${cost.toFixed(4)} x ${1 + margin} / ${creditUsd}) = ${credits} credits == approved  OK`)
  line(`         (daily fal cap = ${cmap.get('studio_daily_generation_cap') ?? 'unset'})`)

  // ── guard 5: the account, the actor, and the reference images ────────────
  const uid = await resolveDemoUid()
  if (!uid) fail(`${DEMO_EMAIL} not found`)
  const { data: txs } = await admin.from('credit_transactions').select('amount_credits').eq('user_id', uid)
  const balance = (txs ?? []).reduce((s, r) => s + Number(r.amount_credits), 0)
  if (balance < credits) fail(`balance ${balance} < ${credits} credits`)
  line(`  guard  ${DEMO_EMAIL} balance ${balance} >= ${credits} ....... OK`)

  const { data: chars } = await admin
    .from('studio_characters')
    .select('id, name, status, frontal_image_job_id, reference_image_job_ids')
    .eq('user_id', uid).eq('season_id', SEASON_ID).is('deleted_at', null)
  if ((chars ?? []).length !== 1) fail(`expected exactly 1 live character in ${SEASON_ID}, found ${(chars ?? []).length}`)
  const ch = chars[0]
  if (!ch.frontal_image_job_id) fail('character has no frontal image')
  // ★The 422 lesson. Job 649ed536 (2026-07-18) sent elements[0].reference_image_urls
  // as [] and came back Unprocessable Entity; the run 44 minutes later with
  // references attached succeeded on the same 3x5s shape. fal's schema documents
  // "1-3 images supported". So an actor with no reference angle is a guaranteed
  // charge-fail-refund roundtrip, and this refuses to spend on one.
  const refs = ch.reference_image_job_ids ?? []
  if (refs.length < 1) fail(`character ${ch.name} has 0 reference images. Job 649ed536 sent reference_image_urls:[] and got fal 422; the schema says "1-3 images supported".`)
  line(`  guard  actor "${ch.name}" ${ch.id.slice(0, 8)} frontal + ${refs.length} ref(s) .. OK`)

  const parentIds = [...new Set([ch.frontal_image_job_id, ...refs])]
  const { data: pRows } = await admin.from('generation_jobs').select('id, status, image_url, cryptobind_signature, season_id, media_type').in('id', parentIds)
  for (const p of pRows ?? []) {
    if (p.status !== 'ready' || !p.image_url) fail(`parent image ${p.id.slice(0, 8)} is ${p.status} / url=${!!p.image_url}`)
    if (p.media_type !== 'image') fail(`parent ${p.id.slice(0, 8)} is media_type=${p.media_type}`)
    if (p.season_id !== SEASON_ID) fail(`parent ${p.id.slice(0, 8)} is in ${p.season_id}, not ${SEASON_ID}`)
  }
  if ((pRows ?? []).length !== parentIds.length) fail(`only ${(pRows ?? []).length}/${parentIds.length} parent images resolve`)
  line(`  guard  ${parentIds.length} parent image(s) ready + signed + in season .. OK`)

  // ── the fal input that will be sent, printed in full before any spend ────
  hr()
  line('  fal input (assembled server-side, internal R2 urls only):')
  line(`    start_image_url = ${pRows.find((p) => p.id === ch.frontal_image_job_id).image_url}`)
  line(`    elements[0].reference_image_urls = ${refs.length} url(s)`)
  line('    multi_prompt:')
  SHOTS.forEach((s, i) => line(`      ${i + 1}. duration="${s.durationSeconds}"  ${s.prompt}`))
  line(`    catalogue input_params = ${JSON.stringify(model.metadata?.input_params ?? {})}`)
  hr()

  if (!CONFIRM) {
    line(`\n  DRY RUN -- nothing enqueued, $0 spent.`)
    line(`  Re-run with --confirm to spend $${cost.toFixed(3)} / ${credits} credits.`)
    process.exit(0)
  }

  // ── enqueue through the real server function ─────────────────────────────
  line(`\n  enqueuing via createI2vGeneration (real charge, real CryptoBind)…`)
  const t0 = Date.now()
  const res = await createI2vGeneration({
    userId: uid,
    seasonId: SEASON_ID,
    modelId: MODEL_ID,
    characterId: ch.id,
    shots: SHOTS,
  })
  if (!res.ok) fail(`createI2vGeneration refused: ${res.reason}${res.detail ? ' / ' + res.detail : ''}  (no charge, $0)`)
  line(`  ENQUEUED  jobId=${res.jobId}  credits=${res.credits}`)
  if (res.credits !== APPROVED_CREDITS) line(`  ★NOTE: charged ${res.credits} credits, approved ${APPROVED_CREDITS}`)
  line(`\n  ★No local worker is running. Waiting for the Railway worker to claim it.`)
  line(`  If this window dies: node --env-file=.env.local --import ./scripts/test-register.mjs scripts/i2v-b-realcall.mjs --watch ${res.jobId}`)

  const w = await watch(res.jobId)
  line(`\n  enqueue -> terminal state: ${((Date.now() - t0) / 1000).toFixed(0)}s wall clock`)
  await verify(res.jobId)
  process.exit(w.ok ? 0 : 1)
})().catch((e) => { console.error('\nHARNESS ERROR:', e?.stack ?? e?.message ?? e); process.exit(2) })
