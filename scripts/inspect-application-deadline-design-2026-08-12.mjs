#!/usr/bin/env node
/**
 * READ-ONLY design probe for the application-deadline split (HQ 2026-08-12).
 * No writes. Run: node --env-file=.env.local scripts/inspect-application-deadline-design-2026-08-12.mjs
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
  const { data: s, error } = await admin.from('seasons').select('*').eq('id', 'season_0').maybeSingle()
  if (error) { console.error(error); process.exit(1) }
  if (!s) { console.error('season_0 not found'); process.exit(1) }

  console.log('== season_0 deferral/capacity config ' + '='.repeat(20))
  for (const k of ['min_participants', 'max_applicants', 'defer_extension_days', 'max_defer_count', 'application_defer_count', 'advance_pct', 'advance_min', 'advance_max']) {
    if (k in s) console.log(`  ${k.padEnd(28)} = ${JSON.stringify(s[k])}`)
  }
  console.log('\n== season_0 schedule (relevant) ' + '='.repeat(20))
  for (const k of ['application_open_at', 'application_close_at', 'scoring_start_at', 'scoring_complete_at', 'main_round_start_at', 'main_round_end_at', 'community_vote_start_at', 'community_vote_end_at', 'awards_announcement_at']) {
    if (k in s) console.log(`  ${k.padEnd(28)} = ${fmt(s[k])}`)
  }

  const { count: genesisCount, error: gErr } = await admin
    .from('genesis_applications')
    .select('id', { count: 'exact', head: true })
    .eq('season_id', 'season_0')
    .in('status', ['pending', 'waitlist', 'verifying', 'flagged', 'eligible', 'selected', 'main_round_submitted', 'awarded'])
  console.log('\n== genesis_applications active count (season_0) ' + '='.repeat(10))
  console.log(`  active count = ${genesisCount} (error=${gErr ? gErr.message : 'none'})`)

  const { data: statusBreak } = await admin
    .from('genesis_applications')
    .select('status')
    .eq('season_id', 'season_0')
  const tally = {}
  for (const row of statusBreak ?? []) tally[row.status] = (tally[row.status] ?? 0) + 1
  console.log('  status breakdown =', JSON.stringify(tally))

  const { data: counter, error: cErr } = await admin
    .from('membership_founding_counter')
    .select('*')
    .maybeSingle()
  console.log('\n== membership_founding_counter ' + '='.repeat(20))
  console.log(' ', JSON.stringify(counter), cErr ? cErr.message : '')

  const { data: cfg } = await admin.from('platform_config').select('key, value').order('key')
  console.log('\n== platform_config (ALL keys) ' + '='.repeat(15))
  for (const row of cfg ?? []) console.log(`  ${row.key.padEnd(30)} = ${JSON.stringify(row.value)}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
