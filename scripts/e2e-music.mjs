#!/usr/bin/env node
/**
 * AI music E2E (live DB, season_test). Covers the vendor-free half of Stage 6:
 * gate OFF / gate ON / per-round cap / refund idempotency / v1m re-hash /
 * provenance rejection / claim-token CAS.
 *
 * ★IT IMPORTS THE REAL FUNCTIONS. The older e2e scripts replicate the code under
 * test 1:1 because the `@/` alias was unresolvable outside a bundler; the test
 * resolve hook handles it now, so this calls createMusicGeneration,
 * refundMusicGeneration and finalizeMusicGeneration themselves. A harness that
 * re-implements what it is testing keeps passing after the real code drifts --
 * this repo has been bitten by exactly that twice (a parity harness measuring a
 * hand-written copy of the worker's filters, a CI job that never installed
 * dependencies).
 *
 * ★WHAT IT CANNOT COVER, and does not pretend to: provider -> R2 -> ready. There
 * is no adapter (no vendor confirmed), so no track can be generated. Those
 * assertions arrive with the adapter.
 *
 * Run:
 *   node --env-file=.env.local --import ./scripts/test-register.mjs scripts/e2e-music.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { createMusicGeneration, refundMusicGeneration, finalizeMusicGeneration, countMusicGenerationsForRound } from '../lib/music-gen.ts'
import { getMusicGate } from '../lib/music-gate.ts'
import { hashMusicAsset, buildMusicAssetBind, verifyMusicAssetBind } from '../lib/cryptobind.ts'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SECRET = process.env.STUDIO_CRYPTOBIND_SECRET
if (!URL || !KEY || !SECRET) {
  console.error('Missing env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / STUDIO_CRYPTOBIND_SECRET).')
  process.exit(1)
}
const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

// ★season_test only. season_0 is live and is never read or written here.
const SEASON = 'season_test'
const ROUND = 'application'

let pass = 0
let fail = 0
const ok = (c, m) => {
  if (c) { pass++; console.log('  PASS', m) } else { fail++; console.log('  FAIL', m) }
}
const created = { userIds: [], assetIds: [], txIds: [], cfgKeys: [] }
let seasonRestore = null

async function setSeason(fields) {
  const { error } = await admin.from('seasons').update(fields).eq('id', SEASON)
  if (error) throw new Error('setSeason: ' + error.message)
}

async function setConfig(key, value) {
  const { data: prior } = await admin.from('platform_config').select('key').eq('key', key).maybeSingle()
  if (!prior) created.cfgKeys.push(key)
  const { error } = await admin.from('platform_config').upsert({ key, value: String(value) })
  if (error) throw new Error(`setConfig(${key}): ` + error.message)
}

async function grantCredits(userId, credits) {
  const { data, error } = await admin
    .from('credit_transactions')
    .insert({ user_id: userId, amount_credits: credits, type: 'admin_adjust', reason: 'e2e_music' })
    .select('id')
  if (error) throw new Error('grantCredits: ' + error.message)
  created.txIds.push(...(data ?? []).map((r) => r.id))
}

async function makeUser() {
  const email = `e2e-music-${randomUUID().slice(0, 8)}@example.invalid`
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (error) throw new Error('createUser: ' + error.message)
  created.userIds.push(data.user.id)
  return data.user.id
}

async function main() {
  // ---------------------------------------------------------------- guard ---
  // ★Refuse to run if music is already switched on for the test season. A
  // previous run killed mid-way would otherwise have its leftover state read as
  // this run's setup, and the teardown would then turn OFF something that was
  // deliberately ON.
  const before = await admin
    .from('seasons')
    .select('studio_music_enabled, studio_music_ai_enabled, studio_music_max_generations_per_round')
    .eq('id', SEASON)
    .maybeSingle()
  if (before.error || !before.data) throw new Error(`cannot read ${SEASON}: ${before.error?.message ?? 'no row'}`)
  if (before.data.studio_music_enabled || before.data.studio_music_ai_enabled) {
    throw new Error(`${SEASON} already has music switched on -- refusing to run (leftover state from an aborted run?)`)
  }
  seasonRestore = { ...before.data }
  console.log(`season under test: ${SEASON} (restoring ${JSON.stringify(seasonRestore)} at teardown)`)

  const userId = await makeUser()
  const req = { userId, seasonId: SEASON, round: ROUND, prompt: 'warm lo-fi piano, gentle', durationSeconds: 20 }

  // ------------------------------------------------------------- 1. OFF -----
  console.log('\n1. gate OFF -- the master switch')
  {
    const g = await getMusicGate(SEASON)
    ok(g.enabled === false && g.aiEnabled === false, 'gate reads closed')
    const r = await createMusicGeneration(req)
    ok(r.ok === false && r.reason === 'music_disabled', `refused music_disabled [got: ${r.reason}]`)
    const { count } = await admin
      .from('studio_music_assets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    ok((count ?? 0) === 0, 'wrote NO asset row')
  }

  // --------------------------------------------- 2. master ON, ai OFF -------
  console.log('\n2. master ON + ai OFF -- library only, generation still refused')
  {
    await setSeason({ studio_music_enabled: true, studio_music_ai_enabled: false })
    const g = await getMusicGate(SEASON)
    ok(g.enabled === true && g.aiEnabled === false, 'gate reads library-only')
    const r = await createMusicGeneration(req)
    ok(r.ok === false && r.reason === 'music_ai_disabled', `refused music_ai_disabled [got: ${r.reason}]`)
  }

  // ------------------------------------------------------- 3. both ON -------
  console.log('\n3. both ON -- the guards that sit before any spend')
  {
    await setSeason({ studio_music_ai_enabled: true })
    ok((await getMusicGate(SEASON)).aiEnabled === true, 'gate reads open')

    const empty = await createMusicGeneration({ ...req, prompt: '   ' })
    ok(empty.reason === 'music_prompt_empty', `empty prompt refused [got: ${empty.reason}]`)

    const long = await createMusicGeneration({ ...req, prompt: 'x'.repeat(501) })
    ok(long.reason === 'music_prompt_too_long', `over-long prompt refused [got: ${long.reason}]`)

    const dur = await createMusicGeneration({ ...req, durationSeconds: 0 })
    ok(dur.reason === 'music_duration', `zero duration refused [got: ${dur.reason}]`)

    // Copyright mimicry is refused BEFORE a credit is spent.
    const imit = await createMusicGeneration({ ...req, prompt: 'a track in the style of a famous band' })
    ok(imit.reason === 'music_imitation', `imitation phrasing refused [got: ${imit.reason}]`)

    const { count } = await admin
      .from('studio_music_assets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    ok((count ?? 0) === 0, 'still NO asset row -- every refusal is pre-spend')
  }

  // ------------------------------------------- 4. moderation fail-closed ----
  console.log('\n4. moderation, with no OPENAI_API_KEY present')
  {
    const r = await createMusicGeneration(req)
    if (!process.env.OPENAI_API_KEY) {
      // ★This is the DESIGNED behaviour, not a broken test. For AI music the scan
      // is the pre-spend gate, so "could not clear" refuses rather than queues.
      // It also means the cap and price checks sit BEHIND it and are unreachable
      // through this path without a key -- which is why they are driven directly
      // below rather than skipped.
      ok(r.ok === false && r.reason === 'music_moderation', `unscannable prompt refused, nothing charged [got: ${r.reason}]`)
      const { count } = await admin
        .from('credit_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'generation_charge')
      ok((count ?? 0) === 0, 'no charge row for a prompt we could not clear')
    } else {
      ok(r.ok === false && r.reason === 'music_not_priced', `priced check reached; unpriced refused [got: ${r.reason}]`)
    }
  }

  // ------------------------------------------------------------ 5. cap ------
  console.log('\n5. per-round cap -- counted in ROWS, not balance')
  {
    await setSeason({ studio_music_max_generations_per_round: 2 })
    // Seed rows the way the enqueue path does, so the counter sees real state.
    for (const status of ['queued', 'generating', 'ready']) {
      const id = randomUUID()
      const { error } = await admin.from('studio_music_assets').insert({
        id, source: 'ai', user_id: userId, season_id: SEASON, round: ROUND,
        title: '', mood: '', prompt: 'e2e', duration_seconds: 20, status, active: true,
      })
      if (error) throw new Error('seed asset: ' + error.message)
      created.assetIds.push(id)
    }
    const used = await countMusicGenerationsForRound(userId, SEASON, ROUND)
    ok(used === 3, `queued+generating+ready all occupy a slot [counted ${used}]`)

    // ★A rich participant must not be able to buy past the ceiling. The cap is
    // checked before price/balance for exactly this reason.
    await grantCredits(userId, 100000)
    const r = await createMusicGeneration(req)
    ok(r.reason === 'music_cap_reached', `over cap refused despite a huge balance [got: ${r.reason}]`)

    // A failed row frees its slot -- that is what makes a refund whole.
    await admin.from('studio_music_assets').update({ status: 'failed' }).eq('id', created.assetIds[0])
    const after = await countMusicGenerationsForRound(userId, SEASON, ROUND)
    ok(after === 2, `a 'failed' row releases its cap slot [counted ${after}]`)
  }

  // ------------------------------------------------- 6. refund idempotency --
  console.log('\n6. refund -- idempotent, and it does not invent money')
  {
    const assetId = randomUUID()
    await admin.from('studio_music_assets').insert({
      id: assetId, source: 'ai', user_id: userId, season_id: SEASON, round: ROUND,
      title: '', mood: '', prompt: 'e2e refund', duration_seconds: 20, status: 'generating', active: true,
    })
    created.assetIds.push(assetId)
    const { data: ch } = await admin
      .from('credit_transactions')
      .insert({ user_id: userId, amount_credits: -7, type: 'generation_charge', reason: 'studio_music_ai', metadata: { music_asset_id: assetId, cost_usd: 0.05 } })
      .select('id')
    created.txIds.push(...(ch ?? []).map((r) => r.id))

    const first = await refundMusicGeneration({ assetId, detail: 'e2e' })
    ok(first.ok && first.refunded === 7, `first refund returns the charged amount [${first.refunded}]`)
    const second = await refundMusicGeneration({ assetId, detail: 'e2e again' })
    ok(second.ok && second.refunded === 0, `second refund is a no-op [${second.refunded}]`)

    const { data: refunds } = await admin
      .from('credit_transactions')
      .select('id')
      .eq('type', 'refund')
      .eq('metadata->>music_asset_id', assetId)
    created.txIds.push(...(refunds ?? []).map((r) => r.id))
    ok((refunds?.length ?? 0) === 1, `exactly ONE refund row exists [${refunds?.length}]`)

    // A never-charged asset must not produce a refund out of nothing.
    const orphan = randomUUID()
    await admin.from('studio_music_assets').insert({
      id: orphan, source: 'ai', user_id: userId, season_id: SEASON, round: ROUND,
      title: '', mood: '', prompt: 'e2e orphan', duration_seconds: 20, status: 'generating', active: true,
    })
    created.assetIds.push(orphan)
    const none = await refundMusicGeneration({ assetId: orphan, detail: 'e2e' })
    ok(none.ok && none.refunded === 0, 'an uncharged asset refunds nothing')
  }

  // ------------------------------------ 7. finalize: provenance + v1m -------
  console.log('\n7. finalize -- provenance is required, and v1m binds the exact bytes')
  {
    const assetId = randomUUID()
    await admin.from('studio_music_assets').insert({
      id: assetId, source: 'ai', user_id: userId, season_id: SEASON, round: ROUND,
      title: '', mood: '', prompt: 'e2e finalize', duration_seconds: 20, status: 'generating', active: true,
    })
    created.assetIds.push(assetId)
    const audio = Buffer.from('OXXOVO-e2e-audio-bytes-' + assetId)
    const good = {
      provider: 'e2e-vendor',
      providerModel: 'e2e-vendor/v1',
      generatedAt: new Date(),
      licenseType: 'commercial_redistributable',
    }

    const bad = await finalizeMusicGeneration({
      assetId, audio, durationSeconds: 20, r2Key: 'music/x', url: 'https://x/y.m4a',
      provenance: { ...good, licenseType: 'royalty_free' },
    })
    ok(bad.ok === false && /unrecognised license_type/.test(bad.errorMessage ?? ''), 'a licence label outside our enumeration is refused')

    const noModel = await finalizeMusicGeneration({
      assetId, audio, durationSeconds: 20, r2Key: 'music/x', url: 'https://x/y.m4a',
      provenance: { ...good, providerModel: '' },
    })
    ok(noModel.ok === false, 'provenance with no model is refused')

    // ★Claim-token CAS: a stale attempt must not finalize a row it no longer owns.
    await admin.from('studio_music_assets').update({ claim_token: randomUUID() }).eq('id', assetId)
    const stale = await finalizeMusicGeneration({
      assetId, audio, durationSeconds: 20, r2Key: 'music/x', url: 'https://x/y.m4a',
      provenance: good, claimToken: randomUUID(),
    })
    ok(stale.ok === false, 'a finalize carrying the wrong claim token is refused')

    const okRes = await finalizeMusicGeneration({
      assetId, audio, durationSeconds: 20, r2Key: 'music/e2e.m4a', url: 'https://x/e2e.m4a', provenance: good,
    })
    ok(okRes.ok === true, `finalize succeeds with valid provenance [${okRes.errorMessage ?? ''}]`)

    const { data: row } = await admin
      .from('studio_music_assets')
      .select('status, provider, provider_model, provider_generated_at, license_type, cryptobind_content_hash, cryptobind_signature, cryptobind_generated_at')
      .eq('id', assetId)
      .maybeSingle()
    ok(row?.status === 'ready', 'row is ready')
    ok(row?.provider === 'e2e-vendor' && row?.provider_model === 'e2e-vendor/v1', 'provider + model recorded')
    ok(row?.license_type === 'commercial_redistributable', 'licence recorded')
    ok(!!row?.provider_generated_at, 'vendor timestamp recorded')
    // ★The vendor stamp and the signing stamp are different instants by design.
    ok(row?.provider_generated_at !== row?.cryptobind_generated_at, 'provider_generated_at is NOT the cryptobind timestamp')

    // v1m re-hash: recompute from the same bytes -> verifies; tamper -> fails.
    const same = verifyMusicAssetBind(
      { cryptobind_content_hash: row.cryptobind_content_hash, cryptobind_signature: row.cryptobind_signature, cryptobind_algo: 'HMAC-SHA256', id: assetId, source: 'ai' },
      hashMusicAsset(audio),
    )
    ok(same.ok === true, `v1m verifies against a re-hash of the same bytes [${same.reason ?? ''}]`)

    const tampered = Buffer.concat([audio, Buffer.from('!')])
    const diff = verifyMusicAssetBind(
      { cryptobind_content_hash: row.cryptobind_content_hash, cryptobind_signature: row.cryptobind_signature, cryptobind_algo: 'HMAC-SHA256', id: assetId, source: 'ai' },
      hashMusicAsset(tampered),
    )
    ok(diff.ok === false, `one changed byte breaks verification [${diff.reason ?? 'STILL VALID'}]`)

    // The signature is over (assetId, source, contentHash) -- a rebuild with the
    // same inputs must be identical, or the canonical drifted.
    const rebuilt = buildMusicAssetBind({ assetId, source: 'ai', contentHash: hashMusicAsset(audio), generatedAt: new Date() })
    ok(rebuilt.cryptobind_signature === row.cryptobind_signature, 'v1m signature is reproducible (canonical unchanged)')
  }
}

async function cleanup() {
  try {
    if (seasonRestore) await admin.from('seasons').update(seasonRestore).eq('id', SEASON)
    if (created.assetIds.length) await admin.from('studio_music_assets').delete().in('id', created.assetIds)
    // Remove every ledger row this run created, including refunds it triggered.
    const { data: mine } = await admin
      .from('credit_transactions')
      .select('id')
      .in('user_id', created.userIds.length ? created.userIds : ['00000000-0000-0000-0000-000000000000'])
    const ids = [...new Set([...created.txIds, ...(mine ?? []).map((r) => r.id)])]
    if (ids.length) await admin.from('credit_transactions').delete().in('id', ids)
    if (created.cfgKeys.length) await admin.from('platform_config').delete().in('key', created.cfgKeys)
    for (const uid of created.userIds) if (uid) await admin.auth.admin.deleteUser(uid)
    console.log('\ncleanup: season restored, test rows removed')
  } catch (e) {
    console.log('\n★cleanup error (check for leftovers):', e.message)
  }
}

main()
  .then(cleanup, async (e) => {
    console.error('\nERROR:', e.message)
    await cleanup()
    process.exit(1)
  })
  .then(() => {
    console.log(`\n== music E2E: ${pass} pass, ${fail} fail ==`)
    console.log('not covered here (no vendor adapter): provider -> R2 -> ready')
    process.exit(fail ? 1 : 0)
  })
