#!/usr/bin/env node
/**
 * READ-ONLY: dump every schedule/date column of season_0 (and siblings) as stored in the DB.
 * No writes. Run: node --env-file=.env.local scripts/inspect-season0-dates.mjs
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env.')
  process.exit(1)
}
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PT = 'America/Los_Angeles'
function fmt(v) {
  if (v === null || v === undefined) return String(v)
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  const pt = new Intl.DateTimeFormat('en-CA', {
    timeZone: PT, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d)
  return `${d.toISOString()}  (PT ${pt})`
}

async function main() {
  console.log('season dates @ ' + SUPABASE_URL)
  console.log('now = ' + fmt(new Date().toISOString()))

  const { data, error } = await admin.from('seasons').select('*').eq('id', 'season_0').maybeSingle()
  if (error) { console.error(error); process.exit(1) }
  if (!data) { console.error('season_0 not found'); process.exit(1) }

  const keys = Object.keys(data).sort()
  const dateish = keys.filter((k) => /_at$|_date$|deadline|open|close|start|end/i.test(k))
  console.log('\n== season_0 schedule columns ' + '='.repeat(30))
  for (const k of dateish) console.log(`  ${k.padEnd(34)} = ${fmt(data[k])}`)

  console.log('\n== season_0 status/flags ' + '='.repeat(30))
  for (const k of ['status', 'is_active', 'name', 'theme', 'capacity', 'max_participants', 'watch_scores_public', 'studio_round', 'studio_music_enabled', 'studio_prelim_hold_enabled']) {
    if (k in data) console.log(`  ${k.padEnd(34)} = ${JSON.stringify(data[k])}`)
  }

  console.log('\n== all seasons (id / status / application_close_at) ' + '='.repeat(10))
  const { data: all } = await admin
    .from('seasons')
    .select('id,status,application_open_at,application_close_at')
    .order('id')
  for (const s of all ?? []) {
    console.log(`  ${String(s.id).padEnd(16)} ${String(s.status).padEnd(12)} open=${fmt(s.application_open_at)}  close=${fmt(s.application_close_at)}`)
  }

  console.log('\n== non-date season_0 columns (for reference) ' + '='.repeat(10))
  console.log('  ' + keys.filter((k) => !dateish.includes(k)).join(', '))
}

main().catch((e) => { console.error(e); process.exit(1) })
