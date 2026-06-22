#!/usr/bin/env node
/**
 * Studio demo cleanup -- wipes every row the demo account created on the SHARED
 * DB after a recording. SAFE BY DEFAULT: dry-run (counts only) unless --apply.
 * Scoped strictly to the single demo user, so prod/real data is never touched.
 *
 *   node --env-file=.env.local scripts/studio-demo-cleanup.mjs           # dry-run
 *   node --env-file=.env.local scripts/studio-demo-cleanup.mjs --apply   # delete
 *
 * Env (optional):
 *   STUDIO_DEMO_EMAIL   demo account email (default studio-demo@oxxovo.ai)
 *   STUDIO_DEMO_DROP_USER=true  also delete the auth user (default keeps it)
 *
 * Deletes (by user_id, genesis_applications by email): render_jobs,
 * generation_jobs, credit_transactions, genesis_applications.
 */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('missing env'); process.exit(1) }

const EMAIL = (process.env.STUDIO_DEMO_EMAIL || 'studio-demo@oxxovo.ai').toLowerCase()
const APPLY = process.argv.includes('--apply')
const DROP_USER = process.env.STUDIO_DEMO_DROP_USER === 'true'
const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

async function findUser(email) {
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error('listUsers: ' + error.message)
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === email)
    if (hit) return hit
    if (data.users.length < 200 || page > 50) return null
    page += 1
  }
}

const user = await findUser(EMAIL)
if (!user) { console.log('demo user not found:', EMAIL, '-- nothing to clean.'); process.exit(0) }
console.log('demo user:', EMAIL, '(id ' + user.id + ')')
console.log('mode:', APPLY ? 'APPLY (deleting)' : 'DRY-RUN (counts only)\n')

// child rows first (FK-safe), genesis_applications by email last.
const byUser = ['render_jobs', 'generation_jobs', 'credit_transactions']
for (const table of byUser) {
  const { count, error } = await admin.from(table).select('id', { count: 'exact', head: true }).eq('user_id', user.id)
  if (error) { console.log('  ', table.padEnd(22), 'count ERR', error.message); continue }
  console.log('  ', table.padEnd(22), (count ?? 0), 'rows')
  if (APPLY && (count ?? 0) > 0) {
    const { error: de } = await admin.from(table).delete().eq('user_id', user.id)
    console.log('     ->', de ? 'DELETE ERR ' + de.message : 'deleted')
  }
}
{
  const { count, error } = await admin.from('genesis_applications').select('id', { count: 'exact', head: true }).ilike('email', EMAIL)
  if (error) console.log('   genesis_applications   count ERR', error.message)
  else {
    console.log('   genesis_applications  ', (count ?? 0), 'rows')
    if (APPLY && (count ?? 0) > 0) {
      const { error: de } = await admin.from('genesis_applications').delete().ilike('email', EMAIL)
      console.log('     ->', de ? 'DELETE ERR ' + de.message : 'deleted')
    }
  }
}

if (DROP_USER) {
  console.log('\n   auth user:', DROP_USER ? 'will drop' : 'keep')
  if (APPLY) {
    const { error } = await admin.auth.admin.deleteUser(user.id)
    console.log('     ->', error ? 'DELETE ERR ' + error.message : 'auth user deleted')
  }
} else {
  console.log('\n   auth user: kept (set STUDIO_DEMO_DROP_USER=true to remove)')
}

console.log(APPLY ? '\ncleanup done.' : '\ndry-run done -- re-run with --apply to delete.')
