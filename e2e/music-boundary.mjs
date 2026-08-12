#!/usr/bin/env node
/**
 * ③b -- the four music boundary tests (design §4 of
 * reports/lane_c_music_c_plan_design_2026-08-07.md).
 *
 * WHAT THIS IS FOR. The boundaries are already IN the code. The risk named in the
 * design is not that they are missing, it is that they disappear quietly -- a
 * branch nobody executes is a branch that can be deleted or inverted by a later
 * edit and still ship. So this harness executes them.
 *
 * ★WHAT WAS ALREADY COVERED, checked before writing a line of this (the standing
 * rule: look, do not copy the brief). scripts/e2e-music.mjs (32/32) ALREADY covers
 * design test 2's generation half (`music_not_priced`, its line 168) and design
 * test 3's cap (`music_cap_reached` despite a large balance, plus a 'failed' row
 * releasing its slot). lib/music-picker-scope.test.ts (11/11) covers design test
 * 4's list half as a pure rule. Re-implementing those here would add passes and no
 * information. What NO test touched, measured 2026-08-08:
 *   - `listMusicAssets` -- ZERO references in e2e/, scripts/ or any unit test. The
 *     picker read had never been executed against a database at all.
 *   - `resolveMusicSignature` / `music_not_owned` -- ZERO references. No e2e passes
 *     music in an EDL (grepped: no 'music' in any of the four render e2e files),
 *     so the render-side music gate had never run.
 * This file covers those, and states the boundary each case belongs to.
 *
 * ★AND THE FIRST RUN CORRECTED TWO THINGS I HAD WRITTEN MYSELF (section 5). The
 * 2026-08-07 refusals for a NULL `active` and for a third `source` defend against
 * rows this database will not store: `active` is NOT NULL and `source` carries
 * `studio_music_assets_source_check`. Both were written as though the states were
 * live. They are not, and the first draft of this harness "passed" them VACUOUSLY --
 * the insert failed, so the row was absent, so "not in the picker" was trivially
 * true and the render refused it as `music_not_found` for the wrong reason. That is
 * the failure mode the design warned about in another place ("on the boundary you
 * cannot tell normal from truncated"). The cases are now SKIPPED with the
 * constraint named. ★The code stays exactly as it is: it is the second line behind
 * a constraint, which is worth having and costs nothing
 * ([[feedback-policy-obsolete-code-stays-inactive]]).
 *
 * ★AND IT CORRECTS THE DESIGN DOCUMENT. §4 test 2 says the unpriced-but-listable
 * combination "is the live state and so can be verified today on season_0". It is
 * not. Measured 2026-08-08 (scripts/inspect-music-state.mjs, writes 0): season_0 is
 * `studio_music_enabled=false, studio_music_ai_enabled=false`, platform_config
 * holds ZERO keys matching %music%, and studio_music_assets has 0 rows -- none of
 * the four switch stages has run. So today season_0 refuses generation with
 * `music_disabled` (the MASTER switch, before the AI switch and long before the
 * price check), and its picker returns EMPTY rather than "the library, normally".
 * That is asserted below as the live baseline, so the correction is a test and not
 * a remark.
 *
 * ★WRITES. season_test only -- season_0 is never written and is only read for the
 * baseline above. Two throwaway auth users, `zz_`-prefixed asset ids so a leftover
 * sorts to the bottom of any listing, the season's music columns restored, and
 * cleanup in a finally that reports the row count it returned the table to.
 * No credits are granted and no vendor is called: $0.
 *
 * Run:
 *   npm run test:music-boundary
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
// ★The real functions, not copies. A harness that re-implements what it tests
// keeps passing after the code drifts -- this repo has been bitten by that twice.
import { listMusicAssets, resolveMusicSignature, createRender } from '../lib/studio.ts'
import { getMusicGate } from '../lib/music-gate.ts'
import { hashMusicAsset, buildMusicAssetBind } from '../lib/cryptobind.ts'

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SECRET = process.env.STUDIO_CRYPTOBIND_SECRET
if (!URL_ || !KEY || !SECRET) {
  console.error('Missing env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / STUDIO_CRYPTOBIND_SECRET).')
  process.exit(1)
}
const admin = createClient(URL_, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const SEASON = 'season_test'
const LIVE_SEASON = 'season_0' // read-only, for the baseline correction

let pass = 0
let fail = 0
const ok = (c, m) => {
  if (c) { pass++; console.log('  PASS', m) } else { fail++; console.log('  FAIL', m) }
}
const skip = (m, why) => console.log(`  SKIP ${m}\n       why: ${why}`)

const created = { userIds: [], assetIds: [] }
let seasonRestore = null

async function makeUser(tag) {
  const email = `e2e-music-boundary-${tag}-${randomUUID().slice(0, 8)}@example.invalid`
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (error) throw new Error('createUser: ' + error.message)
  created.userIds.push(data.user.id)
  return data.user.id
}

async function setSeason(fields) {
  const { error } = await admin.from('seasons').update(fields).eq('id', SEASON)
  if (error) throw new Error('setSeason: ' + error.message)
}

/**
 * Insert one ready, correctly SIGNED music asset.
 *
 * ★The signature is real. If the v1m bind were fake or absent,
 * resolveMusicSignature would refuse every case with `music_cryptobind_failed` --
 * which is a pass-looking refusal for the wrong reason, and would hide whether the
 * ownership branch works at all. The bytes are a per-asset unique buffer because
 * the loader refuses a content-hash clash.
 */
async function seedAsset({ label, source, userId = null, active = true, status = 'ready', url = 'https://example.invalid/zz.m4a' }) {
  const id = `zz_mb_${label}_${randomUUID().slice(0, 8)}`
  const audio = Buffer.from(`zz-music-boundary-${id}`)
  const contentHash = hashMusicAsset(audio)
  const bind = buildMusicAssetBind({ assetId: id, source, contentHash, generatedAt: new Date() })
  // Column set mirrors the worker's seedLibraryTrack upsert (src/music-library.ts).
  // ★`genre`/`bpm`/`sort_order` are deliberately absent: that migration is 지수
  // 본체's and has not run, and PostgREST refuses a statement with ONE unknown
  // column SILENTLY, taking the whole insert with it.
  const row = {
    id,
    source,
    user_id: userId,
    title: `zz boundary ${label}`,
    mood: 'calm',
    duration_seconds: 20,
    r2_key: `zz/${id}.m4a`,
    url,
    status,
    active,
    ...bind,
  }
  const { error } = await admin.from('studio_music_assets').insert(row)
  if (error) return { id, error: error.message }
  created.assetIds.push(id)
  return { id, contentHash }
}

const bed = (assetId, source) => ({
  assetId,
  source,
  volume: 60,
  clipVolume: 100,
  startMs: 0,
  endMs: 20000,
  fadeInMs: 500,
  fadeOutMs: 500,
})

async function ledgerCount() {
  const { count, error } = await admin.from('credit_transactions').select('id', { count: 'exact', head: true })
  if (error) throw new Error('ledgerCount: ' + error.message)
  return count ?? 0
}

async function main() {
  // ---------------------------------------------------------------- guard ----
  // Refuse to run on leftover state: otherwise an aborted run's switches read as
  // this run's setup, and teardown turns OFF something somebody meant to be ON.
  const { data: before, error: bErr } = await admin
    .from('seasons')
    .select('studio_music_enabled, studio_music_ai_enabled, studio_music_max_generations_per_round')
    .eq('id', SEASON)
    .maybeSingle()
  if (bErr || !before) throw new Error(`cannot read ${SEASON}: ${bErr?.message ?? 'no row'}`)
  if (before.studio_music_enabled || before.studio_music_ai_enabled) {
    throw new Error(`${SEASON} already has music switched on -- refusing to run (leftover state from an aborted run?)`)
  }
  seasonRestore = { ...before }
  const assetsAtStart = (await admin.from('studio_music_assets').select('id', { count: 'exact', head: true })).count ?? 0
  console.log(`season under test: ${SEASON} | studio_music_assets at start: ${assetsAtStart}`)
  console.log(`restoring at teardown: ${JSON.stringify(seasonRestore)}`)

  const userA = await makeUser('a')
  const userB = await makeUser('b')

  // ============================================================ baseline ====
  // ★The design document's test-2 claim, checked rather than repeated.
  console.log(`\n0. LIVE BASELINE -- what ${LIVE_SEASON} actually refuses today (read-only)`)
  {
    const g = await getMusicGate(LIVE_SEASON)
    ok(g.enabled === false, `${LIVE_SEASON} master switch is OFF [enabled=${g.enabled}]`)
    const { data: cfg } = await admin.from('platform_config').select('key').like('key', '%music%')
    ok((cfg ?? []).length === 0, `${LIVE_SEASON} era platform_config holds no music keys [${(cfg ?? []).length}]`)

    // The consequence, and it is the opposite of "the list returns normally":
    const { enabled, assets } = await listMusicAssets(LIVE_SEASON, userA)
    ok(enabled === false && assets.length === 0,
      `picker returns EMPTY, not the library -- so design §4 test 2 cannot be verified on ${LIVE_SEASON} today [enabled=${enabled}, ${assets.length} assets]`)
  }

  // ==================================================== boundary 1 =========
  // §4-1: selecting a track never touches the ledger.
  console.log('\n1. BOUNDARY 1 -- choosing is a READ. The ledger does not move.')
  {
    await setSeason({ studio_music_enabled: true, studio_music_ai_enabled: false })
    const g = await getMusicGate(SEASON)
    ok(g.enabled === true && g.aiEnabled === false, 'gate reads library-only (season 0 shape)')

    const lib = await seedAsset({ label: 'lib_active', source: 'library', active: true })
    ok(!lib.error, `seeded an active library track${lib.error ? ' -- ' + lib.error : ''}`)

    const ledgerBefore = await ledgerCount()
    const first = await listMusicAssets(SEASON, userA)
    const second = await listMusicAssets(SEASON, userA)
    const ledgerAfter = await ledgerCount()

    // ★A ledger assertion over an EMPTY list is vacuous -- it would pass if the
    // picker were broken. So the list must have returned the track first.
    ok(first.assets.some((a) => a.id === lib.id), `the active library track IS offered [${first.assets.length} assets]`)
    ok(ledgerAfter === ledgerBefore,
      `credit_transactions unchanged across two picker reads [${ledgerBefore} -> ${ledgerAfter}]`)
    ok(second.assets.length === first.assets.length, 'a repeated read is idempotent (no row created by reading)')
    ok(first.truncated === false, `read is not truncated, so the count means what it says [truncated=${first.truncated}]`)
  }

  // ==================================================== boundary 2 =========
  // §4-2: the two halves must hold AT THE SAME TIME. e2e-music already proves the
  // generation half; the half nobody had run is that the picker keeps working
  // while generation is refused.
  console.log('\n2. BOUNDARY 2 -- generation refused for price, and the picker STILL lists')
  {
    // ai ON with no price keys configured: the stage-4-before-stage-3 mistake.
    await setSeason({ studio_music_enabled: true, studio_music_ai_enabled: true })
    const { data: priceKeys } = await admin
      .from('platform_config')
      .select('key')
      .in('key', ['studio_music_gen_cost_usd', 'studio_music_gen_cost_per_second_usd'])
    const unpriced = (priceKeys ?? []).length === 0
    if (!unpriced) {
      skip('price keys are absent', `platform_config now HAS ${(priceKeys ?? []).map((k) => k.key).join(', ')} -- someone ran stage 3; this case needs the unpriced state`)
    } else {
      const g = await getMusicGate(SEASON)
      ok(g.aiEnabled === true, 'ai switch ON while price keys are absent (the out-of-order state)')
      const list = await listMusicAssets(SEASON, userA)
      ok(list.enabled === true && list.assets.length > 0,
        `the picker is UNAFFECTED by the unpriced generation path [${list.assets.length} assets]`)
      const ledgerBefore = await ledgerCount()
      await listMusicAssets(SEASON, userA)
      ok((await ledgerCount()) === ledgerBefore, 'and still no ledger movement while the ai switch is on')
    }
    await setSeason({ studio_music_enabled: true, studio_music_ai_enabled: false })
  }

  // ==================================================== boundary 3 =========
  // §4-3 is [season 1] and its generation half is covered by e2e-music. The part
  // that is NOT covered anywhere: at the cap, the LIBRARY is still free to pick.
  console.log('\n3. BOUNDARY 3 -- at the AI cap, library selection is still free')
  {
    const g = await getMusicGate(SEASON)
    ok(g.cap === 15, `the season cap value is 15 as measured live [cap=${g.cap}]`)
    // Occupy a cap slot with an AI row owned by A, then prove picking is unaffected.
    const own = await seedAsset({ label: 'ai_own', source: 'ai', userId: userA, active: false })
    ok(!own.error, `seeded an AI row owned by the participant${own.error ? ' -- ' + own.error : ''}`)
    const ledgerBefore = await ledgerCount()
    const list = await listMusicAssets(SEASON, userA)
    ok(list.assets.some((a) => a.source === 'library'), 'library tracks remain offered alongside an owned AI row')
    // ★active=false, not NULL, and the distinction is the point: an AI row is
    // offered to its owner regardless of `active`, because curation is a library
    // concept. NULL would have said the same thing more sharply, but the column
    // rejects it -- see section 5.
    ok(list.assets.some((a) => a.id === own.id),
      'and the participant OWN ai row is offered even with active=false (curation is a library concept)')
    ok((await ledgerCount()) === ledgerBefore, 'no ledger movement')
    skip('the 16th generation is refused music_cap_reached',
      'that is design §4-3, already covered by scripts/e2e-music.mjs with cap=2; repeating it at 15 would add a pass and no information')
  }

  // ==================================================== boundary 4 =========
  // §4-4: another participant's AI track is absent from the list AND refused by
  // the render. The list half was a pure unit test; the RENDER half is new here,
  // and so are the two 2026-08-07 refusals.
  console.log("\n4. BOUNDARY 4 -- another participant's AI track: not listed, and refused at render")
  {
    const foreign = await seedAsset({ label: 'ai_other', source: 'ai', userId: userB, active: true })
    ok(!foreign.error, `seeded an AI row owned by SOMEONE ELSE${foreign.error ? ' -- ' + foreign.error : ''}`)
    const inactive = await seedAsset({ label: 'lib_inactive', source: 'library', active: false })
    const activeLib = await seedAsset({ label: 'lib_ok', source: 'library', active: true })

    // ---- the LIST half, now against a real database ----
    const list = await listMusicAssets(SEASON, userA)
    const ids = new Set(list.assets.map((a) => a.id))
    ok(!ids.has(foreign.id), "another participant's AI track is NOT in the list")
    ok(!ids.has(inactive.id), 'an inactive library track is NOT in the list')
    ok(ids.has(activeLib.id), 'an active library track IS in the list (the filter is not refusing everything)')

    // ---- the RENDER half: the gate nothing had ever executed ----
    // ★BOTH DIRECTIONS. A gate that refuses everything passes a refusal-only test.
    const accept = await resolveMusicSignature(admin, bed(activeLib.id, 'library'), userA, true)
    ok(accept.ok === true && typeof accept.signature === 'string' && accept.signature.length > 0,
      `render ACCEPTS an active library bed and returns its v1m signature [${accept.ok ? 'ok' : accept.reason}]`)

    const notOwned = await resolveMusicSignature(admin, bed(foreign.id, 'ai'), userA, true)
    ok(notOwned.ok === false && notOwned.reason === 'music_not_owned',
      `render REFUSES another participant's AI bed [got: ${notOwned.ok ? 'ACCEPTED' : notOwned.reason}]`)

    const ownedByB = await resolveMusicSignature(admin, bed(foreign.id, 'ai'), userB, true)
    ok(ownedByB.ok === true, `and the SAME row is accepted for its owner [${ownedByB.ok ? 'ok' : ownedByB.reason}]`)

    const inactiveRender = await resolveMusicSignature(admin, bed(inactive.id, 'library'), userA, true)
    ok(inactiveRender.ok === false && inactiveRender.reason === 'music_not_found',
      `render REFUSES an inactive library bed [got: ${inactiveRender.ok ? 'ACCEPTED' : inactiveRender.reason}]`)

    const gateOff = await resolveMusicSignature(admin, bed(activeLib.id, 'library'), userA, false)
    ok(gateOff.ok === false && gateOff.reason === 'music_disabled',
      `render REFUSES any bed when the season gate is off [got: ${gateOff.ok ? 'ACCEPTED' : gateOff.reason}]`)

    // ---- createRender writes nothing on a refusal ----
    // ★This is NOT a test of the music gate, and labelling it as one would be the
    // mistake this file exists to avoid. createRender checks clip sources BEFORE
    // the music step, so a placeholder jobId is refused first and the music branch
    // is never reached -- the assertion below would pass with the music gate
    // deleted. What it does establish, and the only thing claimed: a refused
    // timeline leaves no render_jobs row behind. The music gate itself is proven
    // above, at the function that owns it.
    const viaRender = await createRender({
      userId: userA,
      seasonId: SEASON,
      edl: { segments: [{ jobId: randomUUID(), startMs: 0, endMs: 20000 }], music: bed(foreign.id, 'ai') },
    })
    console.log(`  INFO createRender refused earlier than the music step: ${viaRender.reason}${viaRender.detail ? ' / ' + viaRender.detail : ''}`)
    const { count: renderRows } = await admin
      .from('render_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userA)
    ok(viaRender.ok === false && (renderRows ?? 0) === 0,
      `a refused timeline leaves NO render_jobs row [${renderRows ?? 0}]`)
  }

  // ==================================================== boundary 5 =========
  // ★MEASURED, because the design took the opposite position and could not check
  // it from the repo ([[feedback-db-object-absence-unprovable-by-repo]]). Two of
  // the refusals added on 2026-08-07 defend against row shapes this database will
  // not store. That does not make the code wrong or removable -- it makes it the
  // SECOND line rather than the only one, and the difference belongs in writing
  // instead of in an engineer's head.
  console.log('\n5. WHAT THE COLUMNS THEMSELVES REFUSE (the shape of the defence)')
  {
    const nullActive = await seedAsset({ label: 'probe_null', source: 'library', active: null })
    const isNotNull = !!nullActive.error && /not-null|not null/i.test(nullActive.error)
    ok(isNotNull,
      `studio_music_assets.active is NOT NULL -- a library row cannot be "undecided" in this database [${nullActive.error ? nullActive.error.slice(0, 90) : 'INSERT SUCCEEDED'}]`)
    if (isNotNull) {
      skip("the picker withholds a library row whose active is NULL",
        'unreachable: the column is NOT NULL, so no such row can exist. musicPickerPathOk still compares === true (lib/music-picker-scope.test.ts asserts it on a synthetic row) and that stays, as defence behind the constraint -- not because the state is live.')
    }

    const third = await seedAsset({ label: 'probe_src', source: 'upload', active: true })
    const hasCheck = !!third.error && /check constraint/i.test(third.error)
    ok(hasCheck,
      `a third source value is refused by a CHECK constraint [${third.error ? third.error.slice(0, 90) : 'INSERT SUCCEEDED -- no CHECK exists'}]`)
    if (hasCheck) {
      skip('the render refuses a third source value',
        "unreachable: studio_music_assets_source_check blocks the row. resolveMusicSignature's explicit else stays, as defence behind the constraint.")
    } else {
      const thirdRender = await resolveMusicSignature(admin, bed(third.id, 'upload'), userA, true)
      ok(thirdRender.ok === false,
        `render REFUSES a third source value [got: ${thirdRender.ok ? 'ACCEPTED' : thirdRender.reason}]`)
      console.log('  INFO no CHECK on `source` -- the code refusal IS the only line, so it must not be removed.')
    }
  }
}

async function cleanup() {
  try {
    if (seasonRestore) await admin.from('seasons').update(seasonRestore).eq('id', SEASON)
    if (created.assetIds.length) await admin.from('studio_music_assets').delete().in('id', created.assetIds)
    // Nothing here grants credits, so a ledger row for these users would itself be
    // a finding. Sweep by user_id anyway rather than trust that.
    if (created.userIds.length) {
      const { data: mine } = await admin.from('credit_transactions').select('id').in('user_id', created.userIds)
      if (mine?.length) {
        console.log(`  ★unexpected ${mine.length} ledger row(s) for the test users -- removing, and this is a finding`)
        await admin.from('credit_transactions').delete().in('id', mine.map((r) => r.id))
      }
    }
    for (const uid of created.userIds) if (uid) await admin.auth.admin.deleteUser(uid)

    // ★State what the table returned to. A cleanup nobody verified is a cleanup
    // nobody did (go-live checklist C7).
    const { count } = await admin.from('studio_music_assets').select('id', { count: 'exact', head: true })
    const { data: leftovers } = await admin.from('studio_music_assets').select('id').like('id', 'zz_mb_%')
    console.log(`\ncleanup: season restored, ${created.assetIds.length} asset row(s) and ${created.userIds.length} user(s) deleted`)
    console.log(`         studio_music_assets is back to ${count ?? 0} rows; zz_mb_ leftovers: ${leftovers?.length ?? 0}`)
    if (leftovers?.length) console.log('         ★LEFTOVERS: ' + leftovers.map((r) => r.id).join(', '))
  } catch (e) {
    console.log('\n★cleanup error (check for leftovers named zz_mb_*):', e.message)
  }
}

main()
  .then(cleanup, async (e) => {
    console.error('\nERROR:', e.message)
    await cleanup()
    process.exit(1)
  })
  .then(() => {
    console.log(`\n== music boundary: ${pass} pass, ${fail} fail ==`)
    console.log('covered here : the picker read against a real DB, and the render-side music gate (both directions)')
    console.log('covered by    scripts/e2e-music.mjs : music_not_priced, music_cap_reached, refunds, v1m re-hash')
    console.log('covered by    lib/music-picker-scope.test.ts : the list rule as pure logic (11 cases)')
    console.log('measured here: active is NOT NULL, and source carries studio_music_assets_source_check (section 5)')
    console.log('NOT covered  : provider -> R2 -> ready (no vendor adapter), and season_0 with its switches ON')
    process.exit(fail ? 1 : 0)
  })
