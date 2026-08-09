#!/usr/bin/env node
// READ-ONLY. Prints the music switch stage the live database is actually at.
//
// ★WHY THIS EXISTS. The season-0 music design (reports/lane_c_music_c_plan_design_
// 2026-08-07.md §3) describes a four-stage switch and says season 0 stops at stage 2.
// Which stage the database is at decides what every music boundary test may assert --
// and on 2026-08-08 the design document's own §4 test 2 named a combination the live
// row does not hold. So the stage is MEASURED here and printed, rather than carried
// in prose from one document to the next.
//
// Writes: ZERO. Every statement below is a select.
//
//   node --env-file=.env.local scripts/inspect-music-state.mjs

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (use --env-file=.env.local)')
  process.exit(2)
}
const db = createClient(url, key, { auth: { persistSession: false } })

const MUSIC_PRICE_KEYS = ['studio_music_gen_cost_usd', 'studio_music_gen_cost_per_second_usd']

// ---- seasons -------------------------------------------------------------
const { data: seasons, error: se } = await db
  .from('seasons')
  .select('id, studio_music_enabled, studio_music_ai_enabled, studio_music_max_generations_per_round, studio_round')
  .order('id')
if (se) throw new Error('seasons: ' + se.message)

console.log('=== seasons: music columns ===')
for (const s of seasons) {
  console.log(
    `  ${String(s.id).padEnd(14)} master=${String(s.studio_music_enabled).padEnd(5)} ` +
      `ai=${String(s.studio_music_ai_enabled).padEnd(5)} cap=${String(s.studio_music_max_generations_per_round)} ` +
      `round=${String(s.studio_round)}`,
  )
}

// ---- platform_config -----------------------------------------------------
const { data: cfg, error: ce } = await db.from('platform_config').select('key, value').like('key', '%music%').order('key')
if (ce) throw new Error('platform_config: ' + ce.message)
console.log(`\n=== platform_config keys matching %music%: ${cfg.length} ===`)
for (const c of cfg) console.log(`  ${c.key} = ${c.value}`)
if (!cfg.length) console.log('  (none)')

const priced = MUSIC_PRICE_KEYS.filter((k) => cfg.some((c) => c.key === k))
console.log(`  -> of the two PRICE keys, present: ${priced.length ? priced.join(', ') : 'NEITHER'}`)

// ---- assets --------------------------------------------------------------
const { data: assets, error: ae } = await db.from('studio_music_assets').select('source, status, active, user_id')
if (ae) throw new Error('studio_music_assets: ' + ae.message)
const tally = new Map()
for (const r of assets) {
  const k = `source=${r.source} status=${r.status} active=${r.active}`
  tally.set(k, (tally.get(k) ?? 0) + 1)
}
console.log(`\n=== studio_music_assets: ${assets.length} rows ===`)
if (!tally.size) console.log('  (no rows -- the 1,000-track load is stage 1 and has not run)')
for (const [k, n] of [...tally].sort()) console.log(`  ${String(n).padStart(5)}  ${k}`)

// ---- the stage verdict, per season ---------------------------------------
// The stages are the design document's: 1 load, 2 master on, 3 price, 4 ai on.
console.log('\n=== switch stage per season (design §3: season 0 stops at 2) ===')
const libraryLoaded = assets.some((r) => r.source === 'library')
for (const s of seasons) {
  const master = s.studio_music_enabled === true
  const ai = s.studio_music_ai_enabled === true
  const stages = []
  if (libraryLoaded) stages.push(1)
  if (master) stages.push(2)
  if (priced.length) stages.push(3)
  if (ai) stages.push(4)
  const done = stages.length ? stages.join(',') : 'none'

  // What a caller will actually get, derived from the SAME rules the server uses
  // (lib/music-gate.ts evaluateMusicGate, lib/music-gen.ts step order).
  const pickerVerdict = master ? 'list returns rows (subject to active + signature)' : 'list returns EMPTY (master off)'
  const genVerdict = !master ? 'music_disabled' : !ai ? 'music_ai_disabled' : priced.length ? '(reaches price/balance)' : 'music_not_priced'

  console.log(`  ${String(s.id).padEnd(14)} stages done: ${done}`)
  console.log(`    picker    : ${pickerVerdict}`)
  console.log(`    generation: ${genVerdict}`)
  if (ai && !priced.length) {
    console.log('    ★OUT OF ORDER: stage 4 is on with stage 3 absent. Generation is refused wholesale.')
  }
}

console.log('\nWrites performed: 0')
