#!/usr/bin/env node
/**
 * Community-vote-weight policy 실측 (one-off).
 *   - every season's community_vote_weight / ai_score_weight (data values)
 *   - the seasons.community_vote_weight column DEFAULT (via information_schema RPC)
 *   - existing platform_config keys (to follow the naming convention)
 *
 * Run: node --env-file=.env.local scripts/inspect-weight-policy.mjs
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

async function main() {
  console.log('weight-policy inspection @ ' + SUPABASE_URL)

  console.log('\n== seasons: weight values ' + '='.repeat(30))
  const { data: seasons, error: sErr } = await admin
    .from('seasons')
    .select('id, season_number, status, community_vote_weight, ai_score_weight')
    .order('season_number')
  if (sErr) console.log('  ! ' + sErr.message)
  else
    for (const s of seasons)
      console.log(
        `  #${s.season_number} ${String(s.id).padEnd(12)} ${String(s.status).padEnd(10)} community=${s.community_vote_weight}  ai=${s.ai_score_weight}`,
      )

  console.log('\n== platform_config keys ' + '='.repeat(32))
  const { data: cfg, error: cErr } = await admin
    .from('platform_config')
    .select('key, value, value_type')
    .order('key')
  if (cErr) console.log('  ! ' + cErr.message)
  else
    for (const r of cfg)
      console.log(`  ${String(r.key).padEnd(36)} = ${JSON.stringify(r.value)}  [${r.value_type ?? '?'}]`)

  console.log('\n== column DEFAULT (information_schema) ' + '='.repeat(18))
  // PostgREST cannot read information_schema directly; try an RPC if present.
  const { data: def, error: dErr } = await admin.rpc('exec_sql', {
    sql: "select column_name, column_default from information_schema.columns where table_schema='public' and table_name='seasons' and column_name in ('community_vote_weight','ai_score_weight')",
  })
  if (dErr) console.log('  (no exec_sql RPC — read CREATE TABLE migration instead) ' + dErr.message)
  else console.log('  ' + JSON.stringify(def))

  console.log('')
}
main().catch((e) => {
  console.error('Unexpected: ' + (e instanceof Error ? e.message : String(e)))
  process.exit(1)
})
