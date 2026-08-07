// ⑪B preflight -- READ ONLY. Zero writes, zero fal calls.
//
//   node --env-file=.env.local scripts/inspect-i2v-b-preflight.mjs
//
// Answers, from the live DB, everything the 6-shot Kling i2v real call depends on
// BEFORE any money moves: which season the Studio path resolves to, what the
// catalogue actually charges per second, whether 6x2s clears the model's own
// duration bounds, whether a reusable ready character exists (so the run costs
// the i2v call and nothing else), the demo account's credit balance, the round
// cap headroom, and whether a worker is alive to claim the job.
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const j = (v) => JSON.stringify(v, null, 2)

// ── 1. which season does the Studio path resolve to (mirror getCurrentSeason) ──
const nowIso = new Date().toISOString()
const { data: cur } = await admin
  .from('seasons')
  .select('id, display_name, status, application_open_at, application_close_at, main_round_start_at, main_round_end_at, studio_round')
  .lte('application_open_at', nowIso)
  .order('application_open_at', { ascending: false })
  .limit(1)
  .maybeSingle()
console.log('== getCurrentSeason() mirror ==')
console.log(j(cur))

const { data: seasons } = await admin
  .from('seasons')
  .select('id, status, application_open_at, application_close_at, main_round_start_at, studio_round, studio_max_generations_per_round, studio_max_draft_generations_per_round, studio_max_image_generations_per_round, studio_max_draft_image_generations_per_round')
  .in('id', ['season_0', 'season_test'])
console.log('\n== candidate seasons (caps + studio_round) ==')
console.log(j(seasons))

// ── 2. the i2v catalogue row -- price and duration bounds ─────────────────────
const { data: model } = await admin
  .from('model_catalog')
  .select('*')
  .eq('id', 'kling-v3-pro-i2v')
  .maybeSingle()
console.log('\n== model_catalog kling-v3-pro-i2v ==')
console.log(j(model))
if (model) {
  const total = 12
  console.log(`\n  6 shots x 2s = ${total}s`)
  console.log(`  bounds: min=${model.min_duration_seconds} max=${model.max_duration_seconds} -> ${total >= model.min_duration_seconds && total <= model.max_duration_seconds ? 'IN RANGE' : '★OUT OF RANGE (createI2vGeneration returns bad_duration, $0 spent)'}`)
  console.log(`  est cost = ${model.cost_per_second_usd} x ${total} = $${(Number(model.cost_per_second_usd) * total).toFixed(4)}`)
}

// ── 3. credit pricing (so the credit figure is derived, not quoted) ───────────
const { data: cfg } = await admin.from('platform_config').select('key, value').like('key', '%credit%')
console.log('\n== platform_config credit keys ==')
console.log(j(cfg))

// ── 4. accounts: the demo account and the stage3 e2e account ─────────────────
const wanted = ['studio-demo@oxxovo.ai', 'e2e-studio@oxxovo-e2e.test']
const found = {}
for (let page = 1; page <= 50; page++) {
  const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 })
  for (const u of data.users) {
    const e = (u.email ?? '').toLowerCase()
    if (wanted.includes(e)) found[e] = u.id
  }
  if (data.users.length < 200) break
}
console.log('\n== accounts ==')
console.log(j(found))

for (const [email, uid] of Object.entries(found)) {
  console.log(`\n---- ${email}  (${uid}) ----`)
  const { data: txs } = await admin.from('credit_transactions').select('amount_credits').eq('user_id', uid)
  const bal = (txs ?? []).reduce((s, r) => s + Number(r.amount_credits), 0)
  console.log(`  credit balance = ${bal}  (need 26)`)

  const { data: chars } = await admin
    .from('studio_characters')
    .select('id, name, season_id, status, frontal_image_job_id, reference_image_job_ids, deleted_at')
    .eq('user_id', uid)
  console.log(`  studio_characters (${(chars ?? []).length}):`)
  for (const c of chars ?? []) {
    console.log(`    ${c.id} name=${c.name} season=${c.season_id} status=${c.status} deleted=${c.deleted_at ? 'YES' : '-'} frontal=${c.frontal_image_job_id ? 'Y' : '-'} refs=${(c.reference_image_job_ids ?? []).length}`)
  }

  const { data: imgs } = await admin
    .from('generation_jobs')
    .select('id, season_id, model_id, status, image_url, cryptobind_signature, created_at')
    .eq('user_id', uid)
    .eq('media_type', 'image')
    .order('created_at', { ascending: false })
  console.log(`  image jobs (${(imgs ?? []).length}):`)
  for (const i of (imgs ?? []).slice(0, 12)) {
    console.log(`    ${i.id.slice(0, 8)} season=${i.season_id} model=${i.model_id} status=${i.status} url=${i.image_url ? 'Y' : '-'} sig=${i.cryptobind_signature ? 'Y' : '-'} ${i.created_at}`)
  }

  const { data: vids } = await admin
    .from('generation_jobs')
    .select('id, season_id, model_id, status, duration_seconds, video_url, estimated_cost_usd, actual_cost_usd, credits_charged, error_message, created_at')
    .eq('user_id', uid)
    .eq('media_type', 'video')
    .order('created_at', { ascending: false })
  console.log(`  video jobs (${(vids ?? []).length}):`)
  for (const v of (vids ?? []).slice(0, 12)) {
    console.log(`    ${v.id.slice(0, 8)} season=${v.season_id} model=${v.model_id} status=${v.status} dur=${v.duration_seconds} est=$${v.estimated_cost_usd} act=${v.actual_cost_usd == null ? 'null' : '$' + v.actual_cost_usd} cr=${v.credits_charged} url=${v.video_url ? 'Y' : '-'} ${v.created_at}${v.error_message ? ' ERR=' + String(v.error_message).slice(0, 60) : ''}`)
  }
}

// ── 4b. the fal input of every i2v job that already ran ──────────────────────
// ★The only evidence of what Kling actually accepts is the input of a call that
// already came back 'ready'. One 15s i2v also came back 422 -- both are here, so
// the 6x2s shape is compared against a success and a refusal, not against a guess.
const { data: i2vJobs } = await admin
  .from('generation_jobs')
  .select('id, status, duration_seconds, estimated_cost_usd, actual_cost_usd, credits_charged, fal_request_id, error_message, user_params, created_at, cryptobind_signature, cryptobind_parent_bundle, cryptobind_generated_at, cryptobind_pid, cryptobind_tid, video_url, r2_key')
  .eq('model_id', 'kling-v3-pro-i2v')
  .order('created_at', { ascending: false })
console.log('\n== every kling-v3-pro-i2v job ever, with its fal input ==')
for (const v of i2vJobs ?? []) {
  const mp = v.user_params?.i2v_input?.multi_prompt
  console.log(`\n  ${v.id} ${v.status} dur=${v.duration_seconds} act=${v.actual_cost_usd == null ? 'null' : '$' + v.actual_cost_usd} cr=${v.credits_charged} fal=${v.fal_request_id ?? '-'} ${v.created_at}`)
  if (v.error_message) console.log(`    error: ${v.error_message}`)
  console.log(`    multi_prompt shots = ${Array.isArray(mp) ? mp.length : 'ABSENT'}`)
  if (Array.isArray(mp)) for (const s of mp) console.log(`      duration=${JSON.stringify(s.duration)} (${typeof s.duration}) prompt="${String(s.prompt).slice(0, 70)}"`)
  console.log(`    elements = ${JSON.stringify(v.user_params?.i2v_input?.elements ?? null)?.slice(0, 300)}`)
  console.log(`    start_image_url = ${v.user_params?.i2v_input?.start_image_url ?? '-'}`)
  console.log(`    video_url = ${v.video_url ?? '-'}`)
  console.log(`    cb: sig=${v.cryptobind_signature} parentBundle=${v.cryptobind_parent_bundle} gen=${v.cryptobind_generated_at} pid=${v.cryptobind_pid} tid=${v.cryptobind_tid}`)
}

// ── 5. is a worker alive? (last claimed/finished jobs across the whole table) ──
const { data: recent } = await admin
  .from('generation_jobs')
  .select('id, user_id, season_id, media_type, model_id, status, created_at, updated_at, actual_cost_usd, fal_request_id')
  .order('created_at', { ascending: false })
  .limit(12)
console.log('\n== last 12 generation_jobs (worker liveness) ==')
for (const r of recent ?? []) {
  console.log(`  ${r.created_at} ${String(r.media_type).padEnd(5)} ${String(r.model_id).padEnd(20)} ${String(r.status).padEnd(10)} act=${r.actual_cost_usd == null ? 'null' : '$' + r.actual_cost_usd} fal=${r.fal_request_id ?? '-'} season=${r.season_id}`)
}
const { data: stuck } = await admin
  .from('generation_jobs')
  .select('id, status, created_at, model_id, season_id')
  .in('status', ['queued', 'processing'])
console.log(`\n  queued/processing right now: ${(stuck ?? []).length}`)
for (const s of stuck ?? []) console.log(`    ${s.id.slice(0, 8)} ${s.status} ${s.model_id} ${s.season_id} ${s.created_at}`)

process.exit(0)
