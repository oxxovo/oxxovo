#!/usr/bin/env node
/**
 * Stage 1 (CameraDirector) foundation E2E (live DB). Verifies:
 *   1. studio_presets migration: 8 active rows, expected groups/order
 *   2. model_catalog metadata: prompt_style on the 2 bracket models only,
 *      param_whitelist on kling-v3-pro only -- via the EXACT .select() the
 *      code (getActiveModels/getActivePresets) uses, so a missing column or
 *      row surfaces as a hard error, not a false pass
 *   3. prompt assembly + advanced-param validation (1:1 replica of
 *      lib/studio-shared.ts assemblePresetPrompt + lib/studio.ts
 *      validateAdvancedParams -- server-only, cannot be imported here; same
 *      convention as e2e-compose-length.mjs)
 *   4. generation_jobs.user_params jsonb round-trip on the REAL table.
 *      The probe row is inserted with status='failed' so the LIVE worker
 *      (which claims only 'queued') can never pick it up, and deleted after.
 *
 * Run: node --env-file=.env.local scripts/e2e-stage1-presets.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('Missing env (URL/SERVICE_ROLE).'); process.exit(1) }
const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m) } else { fail++; console.log('  FAIL', m) } }

// --- replicas (lib/studio-shared.ts + lib/studio.ts) -----------------------
function assemblePresetPrompt(userPrompt, preset, promptStyle) {
  const p = userPrompt.trim()
  if (!preset) return p
  return promptStyle === 'bracket'
    ? `${preset.bracket_tags} ${p}. ${preset.desc_text}`
    : `${p}. ${preset.desc_text}`
}
function validateAdvancedParams(advanced, whitelist) {
  const out = {}
  for (const [key, raw] of Object.entries(advanced)) {
    if (raw === undefined || raw === null) continue
    const rule = whitelist?.[key]
    if (!rule) return { ok: false, key }
    if (rule.type === 'string') {
      if (typeof raw !== 'string') return { ok: false, key }
      const s = raw.trim()
      if (!s) continue
      if (typeof rule.max_len === 'number' && s.length > rule.max_len) return { ok: false, key }
      out[key] = s
    } else if (rule.type === 'number') {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return { ok: false, key }
      if (typeof rule.min === 'number' && raw < rule.min) return { ok: false, key }
      if (typeof rule.max === 'number' && raw > rule.max) return { ok: false, key }
      out[key] = raw
    } else {
      return { ok: false, key }
    }
  }
  return { ok: true, params: out }
}

// --- 1. presets (EXACT getActivePresets select) -----------------------------
console.log('1. studio_presets')
const { data: presets, error: pErr } = await admin
  .from('studio_presets')
  .select('id, group_id, label_en, bracket_tags, desc_text, preview_url, sort_order')
  .eq('active', true)
  .order('sort_order', { ascending: true })
if (pErr) { console.error('presets query failed: ' + pErr.message); process.exit(1) }
ok(presets.length === 8, `8 active presets (got ${presets.length})`)
ok(presets.map((p) => p.id).join(',') === 'A1,A2,A3,D1,D2,B1,B2,B3', 'sort order A1..B3')
ok(presets.every((p) => ['action', 'drama', 'beauty'].includes(p.group_id)), 'groups valid')
ok(presets.every((p) => p.preview_url && p.preview_url.includes('stage1-backup')), 'preview URLs present')

// --- 2. model metadata (EXACT getActiveModels select) -----------------------
console.log('2. model_catalog metadata')
const { data: models, error: mErr } = await admin
  .from('model_catalog')
  .select('id, tier, display_name, cost_per_second_usd, min_duration_seconds, max_duration_seconds, metadata')
  .eq('active', true)
  .order('cost_per_second_usd', { ascending: true })
if (mErr) { console.error('models query failed: ' + mErr.message); process.exit(1) }
const byId = Object.fromEntries(models.map((m) => [m.id, m.metadata ?? {}]))
ok(byId['hailuo-02-pro']?.prompt_style === 'bracket', 'hailuo-02-pro prompt_style=bracket')
ok(byId['video-01-director']?.prompt_style === 'bracket', 'video-01-director prompt_style=bracket')
const bracketCount = models.filter((m) => (m.metadata ?? {}).prompt_style === 'bracket').length
ok(bracketCount === 2, `bracket on exactly 2 models (got ${bracketCount})`)
const wl = byId['kling-v3-pro']?.param_whitelist
ok(wl?.negative_prompt?.type === 'string' && wl?.negative_prompt?.max_len === 500, 'kling whitelist negative_prompt')
ok(wl?.cfg_scale?.type === 'number' && wl?.cfg_scale?.min === 0 && wl?.cfg_scale?.max === 1, 'kling whitelist cfg_scale')
const wlCount = models.filter((m) => (m.metadata ?? {}).param_whitelist).length
ok(wlCount === 1, `whitelist on exactly 1 model (got ${wlCount})`)

// --- 3. assembly + validation logic -----------------------------------------
console.log('3. assembly + validation')
const A1 = presets.find((p) => p.id === 'A1')
const USER = 'a knight riding through a burning forest'
ok(
  assemblePresetPrompt(USER, A1, 'bracket') === `${A1.bracket_tags} ${USER}. ${A1.desc_text}`,
  'bracket assembly = [tags] user. desc',
)
ok(assemblePresetPrompt(USER, A1, null) === `${USER}. ${A1.desc_text}`, 'NL assembly = user. desc')
ok(assemblePresetPrompt(`  ${USER}  `, null, null) === USER, 'no preset -> trimmed prompt untouched')

ok(validateAdvancedParams({ negative_prompt: 'blurry', cfg_scale: 0.5 }, wl).ok === true, 'valid advanced accepted')
ok(validateAdvancedParams({ seed: 7 }, wl).key === 'seed', 'non-whitelisted key rejected with key')
ok(validateAdvancedParams({ cfg_scale: 1.5 }, wl).key === 'cfg_scale', 'out-of-range rejected')
ok(validateAdvancedParams({ negative_prompt: 'x'.repeat(501) }, wl).key === 'negative_prompt', 'overlong rejected')
ok(validateAdvancedParams({ negative_prompt: '   ' }, wl).ok === true, 'empty-after-trim skipped, not error')
ok(validateAdvancedParams({ negative_prompt: 'x' }, null).key === 'negative_prompt', 'no whitelist -> any key rejected')

// --- 4. user_params round-trip on the real table -----------------------------
console.log('4. generation_jobs.user_params round-trip')
const { data: donor, error: dErr } = await admin
  .from('generation_jobs')
  .select('*')
  .limit(1)
  .single()
if (dErr) { console.error('no donor row available: ' + dErr.message); process.exit(1) }
const probeId = randomUUID()
const probeParams = { preset_id: 'A1', advanced: { negative_prompt: 'blurry', cfg_scale: 0.5 } }
const insRow = { ...donor, id: probeId, status: 'failed', user_params: probeParams, prompt: 'E2E stage1 probe (safe: failed status, deleted below)' }
delete insRow.created_at
delete insRow.updated_at
const { error: insErr } = await admin.from('generation_jobs').insert(insRow)
ok(!insErr, `insert with user_params (${insErr?.message ?? 'ok'})`)
if (!insErr) {
  const { data: back } = await admin.from('generation_jobs').select('user_params, status').eq('id', probeId).single()
  // jsonb does not preserve key order -> compare values, not serialization.
  const b = back?.user_params
  ok(
    b?.preset_id === 'A1' && b?.advanced?.negative_prompt === 'blurry' && b?.advanced?.cfg_scale === 0.5 &&
      Object.keys(b ?? {}).length === 2 && Object.keys(b?.advanced ?? {}).length === 2,
    'jsonb round-trip (order-insensitive)',
  )
  ok(back?.status === 'failed', 'probe row is worker-unclaimable (failed)')
  const { error: delErr } = await admin.from('generation_jobs').delete().eq('id', probeId)
  ok(!delErr, 'probe row deleted')
}

console.log(`\n${pass}/${pass + fail} PASS`)
process.exit(fail ? 1 : 0)
