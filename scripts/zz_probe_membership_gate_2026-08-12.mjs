#!/usr/bin/env node
// zz_ probe (C7 convention): temporarily lower the REAL Founding cap by
// exactly +1 over the current claimed count, force a genuine 101st-equivalent
// claim to fail, confirm checkApplyGate() -- the same function
// registerForSeason/submitGeneration/submitRender now all call at mint time
// -- rejects the blocked user and accepts the one who claimed, then revert
// EVERYTHING in a finally block.
//
// Touches production Supabase (qrnkovokjmimagrwjebs). Creates two disposable
// auth users (zz_ prefixed, deleted at the end -- cascades to profiles via
// FK). Temporarily claims ONE real Founding slot (reverted by decrementing
// the counter back and deleting the auth user, whose profile row -- carrying
// the claim -- is removed by the cascade). Temporarily lowers
// membership_founding_free_count (reverted to its read-before value, not a
// hardcoded 100, in case it has changed since this was written).
//
// Run: node --env-file=.env.local --import ./scripts/test-register.mjs scripts/zz_probe_membership_gate_2026-08-12.mjs
// (test-hooks.mjs stubs next/headers + lib/email/send.tsx as of this same
// change -- lib/studio.ts importing checkApplyGate pulled both into the
// graph of anything that reaches lib/studio.ts or lib/membership.ts at all,
// which broke lib/dst-boundaries.test.ts until those two stubs were added.)

import { createClient } from '@supabase/supabase-js'
import { checkApplyGate, claimFoundingCreator } from '../lib/membership.ts'
import { registerForSeason } from '../lib/studio.ts'

const SEASON_ID = 'season_0'
const STATEMENT =
  'A timelapse video of mansion restoration in cinematic style, showing the ' +
  'full renovation process from start to finish with dramatic lighting and ' +
  'a slow push-in on the finished facade at golden hour.' // 150-250 chars target

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg)
}

async function main() {
  console.log('STATEMENT length =', STATEMENT.length, '(need 150-250)')
  assert(STATEMENT.length >= 150 && STATEMENT.length <= 250, 'fixture statement length')

  // ---- BEFORE state -------------------------------------------------------
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
  assert(Number.isInteger(capBefore) && capBefore > 0, 'cap readable')
  assert(Number.isInteger(claimedBefore) && claimedBefore >= 0, 'claimed readable')

  let userA = null
  let userB = null
  let appliedCapChange = false
  let claimedByA = false
  let genesisRowIdForA = null

  try {
    // ---- create two disposable auth users ---------------------------------
    const { data: createdA, error: errA } = await admin.auth.admin.createUser({
      email: `zz_probe_founding_a_2026-08-12@oxxovo-probe.invalid`,
      email_confirm: true,
    })
    if (errA) throw new Error('createUser A failed: ' + errA.message)
    userA = createdA.user
    console.log('created zz_ user A:', userA.id)

    const { data: createdB, error: errB } = await admin.auth.admin.createUser({
      email: `zz_probe_founding_b_2026-08-12@oxxovo-probe.invalid`,
      email_confirm: true,
    })
    if (errB) throw new Error('createUser B failed: ' + errB.message)
    userB = createdB.user
    console.log('created zz_ user B:', userB.id)

    // profiles row must exist for claimFoundingCreator (FK-backed). Confirm
    // the auth trigger created it; if not, this probe stops here rather than
    // inventing a workaround for a different, unrelated gap.
    for (const [label, u] of [['A', userA], ['B', userB]]) {
      const { data: prof } = await admin.from('profiles').select('id').eq('id', u.id).maybeSingle()
      assert(prof, `profiles row auto-created for user ${label}`)
    }

    // ---- lower the cap to EXACTLY one more claim than current -------------
    const capForTest = claimedBefore + 1
    const { error: capErr } = await admin
      .from('platform_config')
      .update({ value: String(capForTest) })
      .eq('key', 'membership_founding_free_count')
    if (capErr) throw new Error('lower cap failed: ' + capErr.message)
    appliedCapChange = true
    console.log('cap temporarily set to', capForTest)

    // ---- A claims the last slot (positive control) -------------------------
    const claimA = await claimFoundingCreator(userA.id)
    console.log('claimFoundingCreator(A) =', JSON.stringify(claimA))
    assert(claimA.outcome === 'claimed', 'A should claim the last slot, got ' + claimA.outcome)
    claimedByA = true

    // ---- B is the 101st-equivalent: quota is now full ----------------------
    const claimB = await claimFoundingCreator(userB.id)
    console.log('claimFoundingCreator(B) =', JSON.stringify(claimB))
    assert(claimB.outcome === 'quota_full', 'B should be quota_full, got ' + claimB.outcome)

    // ---- checkApplyGate at the real Founding boundary. Same import
    // (lib/membership.ts, real code) and same call as registerForSeason/
    // submitGeneration's 5a/submitRender's 7a all now make at mint time.
    const gateA = await checkApplyGate(userA.id)
    console.log('checkApplyGate(A) =', JSON.stringify(gateA))
    assert(gateA.ok === true, 'A (claimed) should pass the gate')

    const gateB = await checkApplyGate(userB.id)
    console.log('checkApplyGate(B) =', JSON.stringify(gateB))
    assert(gateB.ok === false && gateB.reason === 'membership_required', 'B (blocked) should fail membership_required')

    // ---- end-to-end: the ACTUAL registerForSeason() function, not a
    // reimplementation of its gate check.
    const applicant = {
      creatorName: 'ZZ Probe',
      creatorStatement: STATEMENT,
      country: 'ZZ',
      agreedRules: true,
      agreedPrivacy: true,
      agreedIntegrity: true,
    }

    const registerB = await registerForSeason({
      seasonId: SEASON_ID,
      userId: userB.id,
      email: userB.email,
      applicant,
    })
    console.log('registerForSeason(B) =', JSON.stringify(registerB))
    assert(
      registerB.ok === false && registerB.reason === 'membership_required',
      'registerForSeason(B) should reject membership_required, got ' + JSON.stringify(registerB),
    )

    const registerA = await registerForSeason({
      seasonId: SEASON_ID,
      userId: userA.id,
      email: userA.email,
      applicant,
    })
    console.log('registerForSeason(A) =', JSON.stringify(registerA))
    assert(registerA.ok === true, 'registerForSeason(A) should succeed, got ' + JSON.stringify(registerA))

    const { data: rowA } = await admin
      .from('genesis_applications')
      .select('id')
      .eq('season_id', SEASON_ID)
      .ilike('email', userA.email)
      .maybeSingle()
    genesisRowIdForA = rowA?.id ?? null
    assert(genesisRowIdForA, 'genesis_applications row for A should exist for cleanup')

    console.log('\nALL ASSERTIONS PASSED.')
  } finally {
    console.log('\n--- CLEANUP ---')
    // genesis_applications row (A's real registration in season_0)
    if (genesisRowIdForA) {
      const { error } = await admin.from('genesis_applications').delete().eq('id', genesisRowIdForA)
      console.log('deleted genesis_applications row for A:', error ? error.message : 'ok')
    }
    // auth users (cascades profiles via FK -- verified below)
    if (userA) {
      const { error } = await admin.auth.admin.deleteUser(userA.id)
      console.log('deleted auth user A:', error ? error.message : 'ok')
    }
    if (userB) {
      const { error } = await admin.auth.admin.deleteUser(userB.id)
      console.log('deleted auth user B:', error ? error.message : 'ok')
    }
    // Founding counter: A's claim really incremented it. Decrement back iff
    // we actually claimed (idempotent-safe: only touches it once).
    if (claimedByA) {
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
    // cap
    if (appliedCapChange) {
      const { data: reverted, error } = await admin
        .from('platform_config')
        .update({ value: String(capBefore) })
        .eq('key', 'membership_founding_free_count')
        .select('value')
        .maybeSingle()
      console.log(`reverted cap -> ${reverted?.value} (target ${capBefore}):`, error ? error.message : 'ok')
    }

    // ---- verify restored state, and that both zz_ rows are actually gone --
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
      .ilike('email', 'zz_probe_founding_%_2026-08-12@oxxovo-probe.invalid')
    console.log('zz_ profiles remaining (expect 0):', zzProfiles)

    const { count: zzGenesis } = await admin
      .from('genesis_applications')
      .select('id', { count: 'exact', head: true })
      .eq('season_id', SEASON_ID)
      .ilike('email', 'zz_probe_founding_%_2026-08-12@oxxovo-probe.invalid')
    console.log('zz_ genesis_applications rows remaining (expect 0):', zzGenesis)
  }
}

main().catch((e) => {
  console.error('\nPROBE FAILED:', e.message)
  process.exitCode = 1
})
