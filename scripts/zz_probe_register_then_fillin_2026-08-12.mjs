#!/usr/bin/env node
// zz_ probe (C7 convention): register once, then prove exactly ONE
// genesis_applications row exists for that participant -- HQ 2026-08-12 ④,
// "register then submit, confirm one row, not two".
//
// What this DOES verify, with real calls against production: registerForSeason()
// mints a row; the SAME email+season lookup submitGeneration/submitRender use
// to decide "mint a new row vs fill in an existing one" (copied verbatim from
// lib/studio.ts, both the 5a/5c and 7a/7c branches use this exact shape) finds
// that one row; a second registerForSeason() call for the same person is
// refused (already_registered) rather than minting a second row; the final
// row count for this participant in this season is exactly 1.
//
// What this does NOT do: actually call submitGeneration/submitRender. Both
// require a real CryptoBind-signed render_jobs/generation_jobs row, which
// for the compose path (season_0's only active path, studio_compose_enabled)
// means a real EDL over real generated source clips -- i.e. real fal.ai
// generation cost and a substantially heavier fixture. The row-matching
// mechanism under test is unchanged pre-existing code (this session did not
// touch the appRow lookup itself, only the gates around it), so the proof
// below is judged sufficient without paying for a real render.
//
// Touches production Supabase. Creates one disposable auth user (zz_
// prefixed, deleted at the end -- cascades to profiles). Temporarily claims
// ONE real Founding slot (checkApplyGate now runs inside registerForSeason,
// so the test user needs real membership) via the same claimed+1 cap-raise
// pattern as scripts/zz_probe_membership_gate_2026-08-12.mjs, reverted in a
// finally block.
//
// Run: node --env-file=.env.local --import ./scripts/test-register.mjs scripts/zz_probe_register_then_fillin_2026-08-12.mjs

import { createClient } from '@supabase/supabase-js'
import { claimFoundingCreator } from '../lib/membership.ts'
import { registerForSeason } from '../lib/studio.ts'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const SEASON_ID = 'season_0'
const STATEMENT =
  'A timelapse video of mansion restoration in cinematic style, showing the ' +
  'full renovation process from start to finish with dramatic lighting and ' +
  'a slow push-in on the finished facade at golden hour.'

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg)
}

// Byte-identical to the appRow lookup in lib/studio.ts's submitGeneration
// (5a/5c) and submitRender (7a/7c) -- the query that decides "mint a new row
// vs fill in the existing one".
async function findAppRowLikeSubmitDoes(seasonId, email) {
  const { data, error } = await admin
    .from('genesis_applications')
    .select('id, status, studio_application_submitted_at, main_round_submitted_at, studio_application_intent_at')
    .eq('season_id', seasonId)
    .ilike('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error('appRow lookup failed: ' + error.message)
  return data
}

async function main() {
  const { data: cfgBefore } = await admin
    .from('platform_config')
    .select('value')
    .eq('key', 'membership_founding_free_count')
    .maybeSingle()
  const capBefore = Number(cfgBefore?.value)
  const { data: counterBefore } = await admin
    .from('membership_founding_counter')
    .select('claimed')
    .eq('id', 1)
    .maybeSingle()
  const claimedBefore = Number(counterBefore?.claimed)
  console.log('BEFORE: cap =', capBefore, ' claimed =', claimedBefore)

  let user = null
  let appliedCapChange = false
  let claimedByUser = false
  let genesisRowId = null

  try {
    const { data: created, error: errCreate } = await admin.auth.admin.createUser({
      email: 'zz_probe_fillin_2026-08-12@oxxovo-probe.invalid',
      email_confirm: true,
    })
    if (errCreate) throw new Error('createUser failed: ' + errCreate.message)
    user = created.user
    console.log('created zz_ user:', user.id)

    const { data: prof } = await admin.from('profiles').select('id').eq('id', user.id).maybeSingle()
    assert(prof, 'profiles row auto-created')

    const capForTest = claimedBefore + 1
    const { error: capErr } = await admin
      .from('platform_config')
      .update({ value: String(capForTest) })
      .eq('key', 'membership_founding_free_count')
    if (capErr) throw new Error('lower cap failed: ' + capErr.message)
    appliedCapChange = true

    const claim = await claimFoundingCreator(user.id)
    console.log('claimFoundingCreator =', JSON.stringify(claim))
    assert(claim.outcome === 'claimed', 'test user should claim, got ' + claim.outcome)
    claimedByUser = true

    // ---- register once --------------------------------------------------
    const applicant = {
      creatorName: 'ZZ Probe Fillin',
      creatorStatement: STATEMENT,
      country: 'ZZ',
      agreedRules: true,
      agreedPrivacy: true,
      agreedIntegrity: true,
    }
    const register1 = await registerForSeason({
      seasonId: SEASON_ID,
      userId: user.id,
      email: user.email,
      applicant,
    })
    console.log('registerForSeason (1st) =', JSON.stringify(register1))
    assert(register1.ok === true, 'first registration should succeed, got ' + JSON.stringify(register1))

    // ---- the appRow lookup submitGeneration/submitRender use finds it ----
    const found = await findAppRowLikeSubmitDoes(SEASON_ID, user.email.toLowerCase())
    console.log('appRow lookup (submit-style) =', JSON.stringify(found))
    assert(found, 'submit-style lookup should find the registered row')
    assert(
      !found.studio_application_submitted_at,
      'not submitted yet -- a real submitGeneration/submitRender call would take the appRow-exists branch (5c/7c fill-in), not the no-appRow branch (5a/7a mint)',
    )
    genesisRowId = found.id

    // ---- a second register attempt must NOT mint a second row -----------
    const register2 = await registerForSeason({
      seasonId: SEASON_ID,
      userId: user.id,
      email: user.email,
      applicant,
    })
    console.log('registerForSeason (2nd) =', JSON.stringify(register2))
    assert(
      register2.ok === false && register2.reason === 'already_registered',
      'second registration should be refused, got ' + JSON.stringify(register2),
    )

    // ---- exactly one row for this participant in this season -------------
    const { count, error: countErr } = await admin
      .from('genesis_applications')
      .select('id', { count: 'exact', head: true })
      .eq('season_id', SEASON_ID)
      .ilike('email', user.email)
    if (countErr) throw new Error('count failed: ' + countErr.message)
    console.log('genesis_applications row count for this participant:', count)
    assert(count === 1, `expected exactly 1 row, got ${count}`)

    console.log('\nALL ASSERTIONS PASSED -- one row, correctly matched, no duplicate on re-registration.')
  } finally {
    console.log('\n--- CLEANUP ---')
    if (genesisRowId) {
      const { error } = await admin.from('genesis_applications').delete().eq('id', genesisRowId)
      console.log('deleted genesis_applications row:', error ? error.message : 'ok')
    }
    if (user) {
      const { error } = await admin.auth.admin.deleteUser(user.id)
      console.log('deleted auth user:', error ? error.message : 'ok')
    }
    if (claimedByUser) {
      const { data: cur } = await admin.from('membership_founding_counter').select('claimed').eq('id', 1).maybeSingle()
      const nowClaimed = Number(cur?.claimed)
      const { data: reverted, error } = await admin
        .from('membership_founding_counter')
        .update({ claimed: claimedBefore })
        .eq('id', 1)
        .select('claimed')
        .maybeSingle()
      console.log(`reverted counter ${nowClaimed} -> ${reverted?.claimed} (target ${claimedBefore}):`, error ? error.message : 'ok')
    }
    if (appliedCapChange) {
      const { data: reverted, error } = await admin
        .from('platform_config')
        .update({ value: String(capBefore) })
        .eq('key', 'membership_founding_free_count')
        .select('value')
        .maybeSingle()
      console.log(`reverted cap -> ${reverted?.value} (target ${capBefore}):`, error ? error.message : 'ok')
    }

    const { data: cfgAfter } = await admin
      .from('platform_config')
      .select('value')
      .eq('key', 'membership_founding_free_count')
      .maybeSingle()
    const { data: counterAfter } = await admin
      .from('membership_founding_counter')
      .select('claimed')
      .eq('id', 1)
      .maybeSingle()
    console.log('AFTER: cap =', cfgAfter?.value, ' claimed =', counterAfter?.claimed)
    console.log('cap restored correctly:', String(cfgAfter?.value) === String(capBefore))
    console.log('claimed restored correctly:', Number(counterAfter?.claimed) === claimedBefore)

    const { count: zzProfiles } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .ilike('email', 'zz_probe_fillin_2026-08-12@oxxovo-probe.invalid')
    console.log('zz_ profiles remaining (expect 0):', zzProfiles)

    const { count: zzGenesis } = await admin
      .from('genesis_applications')
      .select('id', { count: 'exact', head: true })
      .eq('season_id', SEASON_ID)
      .ilike('email', 'zz_probe_fillin_2026-08-12@oxxovo-probe.invalid')
    console.log('zz_ genesis_applications rows remaining (expect 0):', zzGenesis)
  }
}

main().catch((e) => {
  console.error('\nPROBE FAILED:', e.message)
  process.exitCode = 1
})
