#!/usr/bin/env node
/**
 * Studio demo seed -- prepares a contained demo account on the SHARED DB so a
 * promo recording needs no prod exposure. All demo data hangs off ONE user, so
 * studio-demo-cleanup.mjs can wipe it by user_id afterward.
 *
 *   node --env-file=.env.local scripts/studio-demo-seed.mjs
 *
 * Env (optional):
 *   STUDIO_DEMO_EMAIL     demo account email  (default studio-demo@oxxovo.ai)
 *   STUDIO_DEMO_PASSWORD  demo account password (default set below)
 *   STUDIO_DEMO_CREDITS   credits to top the balance up to (default 500)
 *
 * Read-mostly: creates the auth user if missing and grants credits up to the
 * target balance. Never deletes. Never prints secrets.
 */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const EMAIL = (process.env.STUDIO_DEMO_EMAIL || 'studio-demo@oxxovo.ai').toLowerCase()
const PASSWORD = process.env.STUDIO_DEMO_PASSWORD || 'demo-oxxovo-studio-2026'
const TARGET = Number(process.env.STUDIO_DEMO_CREDITS || '500')

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

let user = await findUser(EMAIL)
if (!user) {
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
  })
  if (error) throw new Error('createUser: ' + error.message)
  user = data.user
  console.log('created demo user:', EMAIL, '(id ' + user.id + ')')
} else {
  console.log('demo user exists:', EMAIL, '(id ' + user.id + ')')
}

// Current balance = SUM(amount_credits).
const { data: txs, error: be } = await admin
  .from('credit_transactions').select('amount_credits').eq('user_id', user.id)
if (be) throw new Error('balance: ' + be.message)
const balance = (txs ?? []).reduce((s, r) => s + Number(r.amount_credits), 0)
console.log('current balance:', balance, 'credits')

if (balance < TARGET) {
  const top = TARGET - balance
  const { error } = await admin.from('credit_transactions').insert({
    user_id: user.id, amount_credits: top, type: 'admin_adjust',
    reason: 'studio_demo_seed', metadata: { source: 'studio-demo-seed' },
  })
  if (error) throw new Error('grant: ' + error.message)
  console.log('granted', top, 'credits -> balance', TARGET)
} else {
  console.log('balance already >= target (' + TARGET + '), no grant')
}

console.log('\nLogin for recording:  email=' + EMAIL + '  (password via STUDIO_DEMO_PASSWORD)')
console.log('Next: run the worker (STUDIO_DEV_MODE=true) to populate ready clips, then record.')
console.log('Cleanup after:  node --env-file=.env.local scripts/studio-demo-cleanup.mjs --apply')
