#!/usr/bin/env node
/**
 * Real-path control-group check for the minimum-age-18 gate TK just confirmed
 * via SQL (platform_config.application_min_age=18). Calls the REAL
 * registerForSeason from lib/studio.ts (not a replica) against a zz_ fixture
 * season cloned from season_0 (studio_round forced to 'application').
 *   age 17 -> expect rejected (under_min_age, detail=18)
 *   age 18 -> expect accepted
 *
 * Live-DB write probe, C7 discipline: inactive (is_fixture=true), zz_-prefixed
 * ids, cleanup in a finally block, reports exactly what was created/deleted.
 *
 * Run: node --import ./scripts/test-register.mjs --env-file=.env.local scripts/zz_probe_min_age_2026-08-27.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { registerForSeason } from '../lib/studio.ts'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('Missing env.'); process.exit(1) }
const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const created = { seasonIds: [], userIds: [], appIds: [] }
let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m) } else { fail++; console.log('  FAIL', m) } }

async function cloneFixtureSeason() {
  const { data: base, error: bErr } = await admin.from('seasons').select('*').eq('id', 'season_0').single()
  if (bErr) throw new Error('season_0 read: ' + bErr.message)
  const id = `zz_minage_2026-08-27`
  const row = { ...base, id, name: 'zz min-age probe', is_fixture: true, season_number: 9805, studio_round: 'application' }
  delete row.updated_at
  delete row.created_at
  delete row.prize_first
  delete row.prize_second
  delete row.prize_third
  const { error: iErr } = await admin.from('seasons').insert(row)
  if (iErr) throw new Error(`insert fixture season ${id}: ${iErr.message}`)
  created.seasonIds.push(id)
  return id
}

async function makeEligibleUser(label) {
  const email = `minage-${label}-e2e-${Math.random().toString(36).slice(2, 10)}@oxxovo.test`
  const { data: u, error: uErr } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (uErr) throw new Error('createUser: ' + uErr.message)
  const userId = u.user.id
  created.userIds.push(userId)
  const { error: pErr } = await admin.from('profiles').update({
    display_name: `MinAgeProbe${label}`,
    membership_tier: 'creator',
    membership_status: 'active',
    membership_source: 'founding_free',
    membership_started_at: new Date().toISOString(),
    membership_expires_at: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
  }).eq('id', userId)
  if (pErr) throw new Error('profile setup: ' + pErr.message)
  return { userId, email }
}

async function main() {
  const seasonId = await cloneFixtureSeason()

  const { userId: u17, email: e17 } = await makeEligibleUser('17')
  const r17 = await registerForSeason({
    seasonId, userId: u17, email: e17,
    applicant: { creatorName: 'Probe Seventeen', creatorStatement: 'x'.repeat(180), age: 17, agreedRules: true, agreedPrivacy: true, agreedIntegrity: true },
  })
  console.log('  age 17 ->', JSON.stringify(r17))
  ok(r17.ok === false && r17.reason === 'under_min_age' && r17.detail === '18', 'age 17 -> under_min_age (detail=18)')

  const { userId: u18, email: e18 } = await makeEligibleUser('18')
  const r18 = await registerForSeason({
    seasonId, userId: u18, email: e18,
    applicant: { creatorName: 'Probe Eighteen', creatorStatement: 'x'.repeat(180), age: 18, agreedRules: true, agreedPrivacy: true, agreedIntegrity: true },
  })
  console.log('  age 18 ->', JSON.stringify(r18))
  ok(r18.ok === true, 'age 18 -> ok')
  if (r18.ok) {
    const { data: appRow } = await admin.from('genesis_applications').select('id').eq('season_id', seasonId).ilike('email', e18).maybeSingle()
    if (appRow) created.appIds.push(appRow.id)
  }
}

async function cleanup() {
  const report = { ...created }
  try {
    if (created.appIds.length) await admin.from('genesis_applications').delete().in('id', created.appIds)
    for (const uid of created.userIds) if (uid) await admin.auth.admin.deleteUser(uid)
    if (created.seasonIds.length) await admin.from('seasons').delete().in('id', created.seasonIds)
    console.log('\ncleanup: deleted', JSON.stringify(report))
  } catch (e) {
    console.log('\ncleanup ERROR (manual check needed):', e.message, JSON.stringify(report))
  }
}

main()
  .then(cleanup, async (e) => { console.error('\nERROR:', e.message); await cleanup(); process.exit(1) })
  .then(() => {
    console.log(`\n== min-age real-path probe: ${pass} pass, ${fail} fail ==`)
    process.exit(fail ? 1 : 0)
  })
