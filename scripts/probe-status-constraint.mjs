#!/usr/bin/env node
/**
 * Probe the LIVE genesis_applications status CHECK by attempting to set each
 * candidate value on a throwaway row. No raw SQL needed -- PostgREST surfaces
 * the constraint rejection (23514). Cleans up the row + test user after.
 *
 * Run: node --env-file=.env.local scripts/probe-status-constraint.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const sha = (p) => createHash('sha256').update(p).digest('hex')

const CANDIDATES = ['pending', 'waitlist', 'verifying', 'flagged', 'eligible', 'selected', 'main_round_submitted', 'awarded', 'rejected', 'soak']

async function main() {
  const { data: s } = await admin.from('seasons').select('id').limit(1)
  const tid = s[0].id
  const email = `status-probe-${sha(tid).slice(0, 8)}@oxxovo.test`
  const { data: u } = await admin.auth.admin.createUser({ email, email_confirm: true })
  let uid = u?.user?.id
  if (!uid) { const { data: l } = await admin.auth.admin.listUsers(); uid = l?.users?.find((x) => x.email === email)?.id }

  const { data: row, error: insErr } = await admin.from('genesis_applications').insert({
    season_id: tid, user_id: uid, email, creator_name: 'probe', creator_statement: 'x'.repeat(160),
    ai_service: 'probe', agreed_to_rules: true, agreed_to_privacy: true, agreed_to_integrity_notice: true, status: 'pending',
  }).select('id').single()
  if (insErr) { console.error('insert failed:', insErr.message); process.exit(1) }

  console.log('LIVE genesis_applications.status allowed values:')
  const allowed = [], blocked = []
  for (const st of CANDIDATES) {
    const { error } = await admin.from('genesis_applications').update({ status: st }).eq('id', row.id).select('id').single()
    if (error) { blocked.push(st); console.log(`  BLOCKED  ${st.padEnd(22)} (${error.code})`) }
    else { allowed.push(st); console.log(`  ok       ${st}`) }
  }
  console.log('\nallowed:', allowed.join(', '))
  console.log('blocked:', blocked.join(', '))

  await admin.from('genesis_applications').delete().eq('id', row.id)
  await admin.auth.admin.deleteUser(uid)
}
main().catch((e) => { console.error(e.message); process.exit(1) })
