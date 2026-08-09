#!/usr/bin/env node
/**
 * READ-ONLY measurement for HQ items (1) DDL, (2) failed handling, (3) actor slug.
 * Writes nothing. Service role so RLS cannot hide a row and make absence look real.
 *
 *   node --env-file=.env.local scripts/inspect-hq-2026-08-08.mjs
 */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) throw new Error('missing SUPABASE env')
const db = createClient(URL, KEY, { auth: { persistSession: false } })

const line = (s) => console.log('\n===== ' + s + ' ' + '='.repeat(Math.max(0, 60 - s.length)))

// A column probe that distinguishes "column absent" (42703) from "no rows".
async function hasColumn(table, col) {
  const { error } = await db.from(table).select(col).limit(1)
  if (!error) return { present: true }
  const m = error.message || ''
  if (error.code === '42703' || /column .* does not exist|could not find/i.test(m)) {
    return { present: false, why: m }
  }
  return { present: null, why: `${error.code}: ${m}` }
}

async function probeCols(table, cols) {
  for (const c of cols) {
    const r = await hasColumn(table, c)
    const mark = r.present === true ? 'PRESENT' : r.present === false ? 'ABSENT ' : '???????'
    console.log(`  ${table}.${c.padEnd(42)} ${mark}${r.present === null ? '  ' + r.why : ''}`)
  }
}

async function main() {
  console.log('READ-ONLY probe @ ' + URL)

  // ---------------------------------------------------------------- (1) music
  line('studio_music_assets -- row count + target columns')
  const { count: musicCount, error: mcErr } = await db
    .from('studio_music_assets').select('id', { count: 'exact', head: true })
  console.log('  rows:', mcErr ? 'ERR ' + mcErr.message : musicCount)
  await probeCols('studio_music_assets', [
    'genre', 'bpm', 'sort_order', 'screening_score',
    'source', 'mood', 'active', 'title', 'season_id', 'round', 'duration_seconds',
    'cryptobind_signature', 'status', 'created_at', 'updated_at',
  ])
  const { data: musicSample } = await db.from('studio_music_assets').select('*').limit(2)
  if (musicSample?.[0]) console.log('  live column list:', Object.keys(musicSample[0]).join(', '))

  // -------------------------------------------------------------- (1) seasons
  line('seasons -- fixture flag + schedule columns (existence)')
  await probeCols('seasons', [
    'is_fixture',
    'scoring_start_at', 'scoring_complete_at',
    'application_close_at', 'main_round_start_at', 'awards_announcement_at',
    // candidate names for "results announcement time" -- prove absence, do not assume
    'results_announced_at', 'results_announcement_at', 'prelim_results_at',
    'application_results_announced_at', 'preliminary_results_at',
    'studio_music_enabled', 'studio_music_ai_enabled',
  ])

  line('seasons -- every row (id, number, status, host_type, key dates)')
  const { data: seasons, error: sErr } = await db
    .from('seasons')
    .select('id, season_number, status, host_type, name, application_close_at, scoring_start_at, scoring_complete_at, main_round_start_at, awards_announcement_at, created_at')
    .order('season_number', { ascending: true })
  if (sErr) console.log('  ERR', sErr.message)
  else {
    console.log(`  total rows: ${seasons.length}`)
    for (const s of seasons) {
      console.log(
        `  #${String(s.season_number).padStart(4)}  ${s.id.padEnd(22)} ${String(s.status).padEnd(10)} ` +
        `host=${String(s.host_type ?? 'null').padEnd(9)} close=${s.application_close_at ?? '-'} ` +
        `scoring_start=${s.scoring_start_at ?? '-'} complete=${s.scoring_complete_at ?? '-'}`
      )
    }
    const maxAll = Math.max(...seasons.map((s) => s.season_number ?? 0))
    console.log(`  max(season_number) over ALL rows = ${maxAll}  -> nextNumber today = ${maxAll + 1}`)
  }

  // ------------------------------------------------------------ (3) actors
  line('official_actors -- full rows (leak surface)')
  const { data: actors, error: aErr } = await db.from('official_actors').select('*')
  if (aErr) console.log('  ERR', aErr.message)
  else {
    console.log(`  total rows: ${actors.length}`)
    for (const a of actors) {
      console.log(`  - id=${a.id} slug=${a.slug} display_name=${a.display_name} kind=${a.kind} status=${a.status}`)
      console.log(`    canonical_frontal_url = ${a.canonical_frontal_url}`)
      console.log(`    reference_urls        = ${JSON.stringify(a.reference_urls)}`)
      console.log(`    cryptobind_algo       = ${a.cryptobind_algo}`)
      const prov = JSON.stringify(a.provenance ?? {})
      console.log(`    provenance length     = ${prov.length}`)
      const leak = ['beauty', 'cosmetic', 'lipstick', 'cf', 'campaign', 'advertis']
        .filter((w) => prov.toLowerCase().includes(w))
      console.log(`    provenance leak words = ${leak.join(', ') || '(none)'}`)
      if (actors.length <= 4) console.log('    columns:', Object.keys(a).join(', '))
    }
  }

  // ------------------------------------------------------- (2) failed scoring
  line('scoring_results -- judged_status distribution by season/round')
  const { data: sr, error: srErr } = await db
    .from('scoring_results').select('season_id, round, judged_status, processing_attempts')
  if (srErr) console.log('  ERR', srErr.message)
  else {
    const agg = new Map()
    for (const r of sr) {
      const k = `${r.season_id}|${r.round}|${r.judged_status}`
      agg.set(k, (agg.get(k) ?? 0) + 1)
    }
    for (const [k, v] of [...agg.entries()].sort()) console.log(`  ${k.padEnd(52)} ${v}`)
    const failed = sr.filter((r) => r.judged_status === 'failed')
    console.log(`  failed rows total = ${failed.length}`)
    for (const f of failed) {
      console.log(`    ${f.season_id} ${f.round} attempts=${f.processing_attempts}`)
    }
    const stuck = sr.filter((r) => r.judged_status === 'in_progress')
    console.log(`  in_progress rows (would be skipped forever) = ${stuck.length}`)
  }

  line('genesis_applications -- status distribution by season')
  const { data: ga, error: gaErr } = await db
    .from('genesis_applications').select('season_id, status, free_entry_url, main_round_video_url')
  if (gaErr) console.log('  ERR', gaErr.message)
  else {
    const agg = new Map()
    for (const r of ga) {
      const k = `${r.season_id}|${r.status}`
      agg.set(k, (agg.get(k) ?? 0) + 1)
    }
    for (const [k, v] of [...agg.entries()].sort()) console.log(`  ${k.padEnd(52)} ${v}`)
    const noUrl = ga.filter(
      (r) => !['rejected', 'withdrawn', 'waitlist'].includes(r.status) && r.free_entry_url == null,
    )
    console.log(`  countUndeliverable(free_entry_url) equivalent, all seasons = ${noUrl.length}`)
  }
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
