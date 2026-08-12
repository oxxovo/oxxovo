#!/usr/bin/env node
/**
 * Draft (Sandbox) tier E2E (live DB). Verifies the Draft-1 migration +
 * Draft-2 server foundations:
 *   1. catalog: 4 active draft rows via the EXACT getActiveModels select;
 *      each promotes_to points at an ACTIVE competition model (else the
 *      promotion form would prefill a dead model)
 *   2. seasons draft-cap column via the EXACT getSeasonStudioConfig select
 *   3. generation_jobs accepts tier='draft' (CHECK extended) -- probe row is
 *      status='failed' (worker-unclaimable) and deleted after
 *   4. cap disjointness: draft vs competition counts never overlap
 *      (eq/neq tier filters partition the user's jobs exactly)
 *   5. gate replicas: submitGeneration/createRender draft checks fire before
 *      CryptoBind (1:1 replica -- server-only code; full-path proof is the
 *      Draft-4 live demo)
 *
 * Run: node --env-file=.env.local scripts/e2e-draft-tier.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('Missing env.'); process.exit(1) }
const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m) } else { fail++; console.log('  FAIL', m) } }

// --- 1. draft catalog (EXACT getActiveModels select) -------------------------
console.log('1. draft catalog')
const { data: models, error: mErr } = await admin
  .from('model_catalog')
  .select('id, tier, display_name, cost_per_second_usd, min_duration_seconds, max_duration_seconds, metadata')
  .eq('active', true)
  .order('cost_per_second_usd', { ascending: true })
if (mErr) { console.error(mErr.message); process.exit(1) }
const drafts = models.filter((m) => m.tier === 'draft')
ok(drafts.length === 4, `4 active draft models (got ${drafts.length})`)
ok(
  drafts.map((m) => m.id).sort().join(',') === 'hailuo-02-std,kling-v3-turbo,seedance2-mini,veo31-lite-draft',
  'draft ids exact',
)
const activeIds = new Set(models.map((m) => m.id))
for (const d of drafts) {
  const to = d.metadata?.promotes_to
  const target = models.find((m) => m.id === to)
  ok(!!target && target.tier !== 'draft', `${d.id} promotes_to '${to}' is an active competition model`)
}
ok(drafts.every((d) => /\s/.test(JSON.stringify(d.metadata)) === false || !/\s/.test(d.metadata?.promotes_to ?? '')), 'promotes_to values byte-clean')
// duration_format sanity (hailuo STANDARD takes duration, unlike pro)
const hs = drafts.find((d) => d.id === 'hailuo-02-std')
ok(hs?.metadata?.duration_format === 'string', 'hailuo-02-std duration_format=string (measured)')
const kt = drafts.find((d) => d.id === 'kling-v3-turbo')
ok(kt?.metadata?.param_whitelist === undefined, 'kling-v3-turbo has NO param_whitelist (turbo lacks negative/cfg)')

// --- 2. seasons draft cap (EXACT getSeasonStudioConfig select) ---------------
console.log('2. seasons draft cap')
const { data: season, error: sErr } = await admin
  .from('seasons')
  .select('studio_round, studio_max_generations_per_round, studio_max_draft_generations_per_round, main_round_start_at, submission_hours, application_video_min_seconds, application_video_max_seconds, main_round_video_min_seconds, main_round_video_max_seconds, studio_compose_enabled, studio_compose_min_seconds, studio_compose_max_seconds')
  .eq('id', 'season_0')
  .single()
ok(!sErr, `config select shape ok (${sErr?.message ?? 'ok'})`)
ok(Number(season?.studio_max_draft_generations_per_round) === 30, 'season_0 draft cap = 30')

// --- 3+4. jobs table: draft tier + cap disjointness ---------------------------
console.log('3. generation_jobs draft tier + cap split')
const { data: donor } = await admin.from('generation_jobs').select('*').limit(1).single()
const mk = (tier) => ({
  ...donor,
  id: randomUUID(),
  tier,
  status: 'failed', // worker claims only 'queued' -- never picked up
  prompt: 'E2E draft-tier probe (safe: failed status, deleted below)',
  user_params: tier === 'draft' ? { user_prompt: 'raw prompt kept for promotion' } : null,
})
const rows = [mk('draft'), mk('draft'), mk('budget')]
for (const r of rows) { delete r.created_at; delete r.updated_at }
const { error: insErr } = await admin.from('generation_jobs').insert(rows)
ok(!insErr, `insert draft+competition probes (${insErr?.message ?? 'ok'})`)

if (!insErr) {
  const base = () => admin
    .from('generation_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', donor.user_id)
    .eq('season_id', donor.season_id)
  const { count: total } = await base()
  const { count: draftN } = await base().eq('tier', 'draft')
  const { count: compN } = await base().neq('tier', 'draft')
  ok(draftN >= 2, `draft count sees probes (${draftN})`)
  ok(draftN + compN === total, `caps partition exactly (${draftN} + ${compN} = ${total})`)

  const { data: back } = await admin
    .from('generation_jobs').select('user_params').eq('id', rows[0].id).single()
  ok(back?.user_params?.user_prompt === 'raw prompt kept for promotion', 'user_prompt survives round-trip (promotion prefill)')

  const { error: delErr } = await admin.from('generation_jobs').delete().in('id', rows.map((r) => r.id))
  ok(!delErr, 'probes deleted')
}

// --- 5. gate replicas (order: ownership -> status -> DRAFT -> cryptobind) ----
console.log('4. gate replicas')
function submitGate(job) {
  if (job.status !== 'ready') return 'not_ready'
  if (job.tier === 'draft') return 'draft_not_submittable'
  return 'proceeds_to_cryptobind'
}
function renderSourceGate(row) {
  if (row.status !== 'ready') return 'source_not_ready'
  if (row.tier === 'draft') return 'source_draft'
  return 'proceeds_to_cryptobind'
}
ok(submitGate({ status: 'ready', tier: 'draft' }) === 'draft_not_submittable', 'submit blocks ready draft')
ok(submitGate({ status: 'ready', tier: 'budget' }) === 'proceeds_to_cryptobind', 'submit passes competition')
ok(renderSourceGate({ status: 'ready', tier: 'draft' }) === 'source_draft', 'compose blocks draft source')
ok(renderSourceGate({ status: 'ready', tier: 'premium' }) === 'proceeds_to_cryptobind', 'compose passes competition source')

console.log(`\n${pass}/${pass + fail} PASS`)
process.exit(fail ? 1 : 0)
