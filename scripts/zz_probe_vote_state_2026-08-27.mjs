#!/usr/bin/env node
// Read-only probe: current community_vote_max_per_user values across seasons,
// and the live enforce_watch_vote_limit function definition (DB is the source
// of truth for DB objects -- [[feedback-db-object-absence-unprovable-by-repo]]).
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('Missing env.'); process.exit(1) }
const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

async function main() {
  const { data: seasons, error: sErr } = await admin
    .from('seasons')
    .select('id, name, is_fixture, community_vote_max_per_user, community_vote_start_at, community_vote_end_at')
    .order('id')
  if (sErr) { console.error('seasons read failed:', sErr.message); process.exit(1) }
  console.log('=== seasons.community_vote_max_per_user ===')
  for (const s of seasons ?? []) {
    console.log(`  ${s.id.padEnd(20)} fixture=${String(s.is_fixture).padEnd(5)} cap=${s.community_vote_max_per_user} start=${s.community_vote_start_at} end=${s.community_vote_end_at}`)
  }

  const { data: fnDef, error: fErr } = await admin.rpc('pg_get_functiondef_by_name', { fn_name: 'enforce_watch_vote_limit' }).catch(() => ({ data: null, error: { message: 'rpc not found' } }))
  if (fErr) {
    // fall back to raw SQL via a one-off select using information_schema (no exec-sql rpc assumed)
    console.log('\n(no pg_get_functiondef_by_name rpc -- skipping function dump; will check via routines catalog)')
    const { data: routines, error: rErr } = await admin
      .from('pg_proc' /* likely blocked by RLS/no grant; best-effort */)
      .select('proname')
      .eq('proname', 'enforce_watch_vote_limit')
      .catch(() => ({ data: null, error: { message: 'no access' } }))
    if (rErr) console.log('  pg_proc direct read blocked:', rErr.message)
    else console.log('  pg_proc rows:', JSON.stringify(routines))
  } else {
    console.log('\n=== enforce_watch_vote_limit() live def ===\n', fnDef)
  }
}

main().then(() => process.exit(0), (e) => { console.error('ERROR:', e.message); process.exit(1) })
