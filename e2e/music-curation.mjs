#!/usr/bin/env node
/**
 * [3] Curation -- the read and the one write, against a real database.
 *
 * ★WHY A HARNESS FOR A SCREEN. Two claims in lib/music-curation.ts would otherwise
 * be comments only, and both are load-bearing:
 *   1. the update is scoped to source='library' IN THE STATEMENT, so an id list
 *      arriving from a browser cannot switch off a participant's own AI track;
 *   2. the select names only columns that exist. The grid columns (genre / bpm /
 *      sort_order) and [2.5]'s score are NOT migrated, and PostgREST's response to
 *      an unknown column is what cost a submission with no file on 2026-08-03
 *      ([[feedback-postgrest-unknown-column-silent]]). With 0 rows in the table,
 *      "the page rendered" would prove nothing -- an empty list looks identical to
 *      a refused statement.
 *
 * ★WRITES: `zz_`-prefixed asset rows and one throwaway user, deleted in a finally
 * which reports the count the table returned to. season_test only; season_0 is
 * never touched. No credits, no vendor: $0.
 *
 * Run:
 *   npm run test:music-curation
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { listMusicForCuration, setMusicActive } from '../lib/music-curation.ts'
import { MUSIC_CURATION_PAGE_SIZE } from '../lib/music-curation-order.ts'
import { hashMusicAsset, buildMusicAssetBind } from '../lib/cryptobind.ts'

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SECRET = process.env.STUDIO_CRYPTOBIND_SECRET
if (!URL_ || !KEY || !SECRET) {
  console.error('Missing env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / STUDIO_CRYPTOBIND_SECRET).')
  process.exit(1)
}
const admin = createClient(URL_, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

let pass = 0
let fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m) } else { fail++; console.log('  FAIL', m) } }

const created = { userIds: [], assetIds: [] }

async function seed({ label, source, userId = null, active = true, title, signed = true }) {
  const id = `zz_cur_${label}_${randomUUID().slice(0, 8)}`
  const audio = Buffer.from(`zz-curation-${id}`)
  const bind = signed
    ? buildMusicAssetBind({ assetId: id, source, contentHash: hashMusicAsset(audio), generatedAt: new Date() })
    : {}
  const { error } = await admin.from('studio_music_assets').insert({
    id, source, user_id: userId, title, mood: 'calm', duration_seconds: 95,
    r2_key: `zz/${id}.m4a`, url: `https://example.invalid/${id}.m4a`,
    status: 'ready', active, license_type: 'library_licensed', provider: 'zz-test-vendor', ...bind,
  })
  if (error) throw new Error(`seed(${label}): ${error.message}`)
  created.assetIds.push(id)
  return id
}

async function activeOf(id) {
  const { data } = await admin.from('studio_music_assets').select('active').eq('id', id).maybeSingle()
  return data?.active ?? null
}

async function main() {
  const { data: u, error: uErr } = await admin.auth.admin.createUser({
    email: `e2e-curation-${randomUUID().slice(0, 8)}@example.invalid`,
    email_confirm: true,
  })
  if (uErr) throw new Error('createUser: ' + uErr.message)
  created.userIds.push(u.user.id)

  const startCount = (await admin.from('studio_music_assets').select('id', { count: 'exact', head: true })).count ?? 0
  console.log(`studio_music_assets at start: ${startCount} | page size: ${MUSIC_CURATION_PAGE_SIZE}`)

  // ---------------------------------------------------------------- 1. read --
  console.log('\n1. the read -- the select survives a real database')
  const bTrack = await seed({ label: 'b', source: 'library', title: 'ZZ Bravo', active: true })
  const aTrack = await seed({ label: 'a', source: 'library', title: 'ZZ Alpha', active: false })
  const unsigned = await seed({ label: 'u', source: 'library', title: 'ZZ Unsigned', active: true, signed: false })
  const foreignAi = await seed({ label: 'ai', source: 'ai', userId: u.user.id, title: 'ZZ Participant Track', active: false })

  const all = await listMusicForCuration({ q: 'ZZ ' })
  ok(all.tracks.length === 3, `the three seeded LIBRARY rows come back [${all.tracks.length}]`)
  ok(!all.tracks.some((t) => t.id === foreignAi),
    'a participant AI row is NOT in the curation list (curation is library-only)')
  ok(all.tracks.every((t) => t.source === 'library'), 'every returned row is source=library')

  // ★The ordering contract, executed. title ascending, so Alpha precedes Bravo.
  const titles = all.tracks.map((t) => t.title)
  ok(titles.indexOf('ZZ Alpha') < titles.indexOf('ZZ Bravo'), `ordered by title ascending [${titles.join(' | ')}]`)

  // ★The column set is real: if any selected column did not exist, these would be
  // undefined rather than values, and the empty table would have hidden it.
  const alpha = all.tracks.find((t) => t.id === aTrack)
  ok(alpha?.durationSeconds === 95, `duration_seconds came back as a number [${alpha?.durationSeconds}]`)
  ok(alpha?.licenseType === 'library_licensed', `license_type came back [${alpha?.licenseType}]`)
  ok(alpha?.provider === 'zz-test-vendor', `provider came back [${alpha?.provider}]`)
  ok(alpha?.active === false && (await activeOf(aTrack)) === false, 'active reflects the row')
  ok(all.tracks.find((t) => t.id === unsigned)?.signed === false,
    'an unsigned row is flagged -- it can never be offered whatever active says')
  ok(all.tracks.find((t) => t.id === bTrack)?.signed === true, 'and a signed row is not flagged')

  // -------------------------------------------------------------- 2. filters --
  console.log('\n2. filters and counts')
  const onlyActive = await listMusicForCuration({ q: 'ZZ ', filter: 'active' })
  const onlyWithheld = await listMusicForCuration({ q: 'ZZ ', filter: 'withheld' })
  ok(onlyActive.tracks.every((t) => t.active === true), 'the active filter returns only active rows')
  ok(onlyWithheld.tracks.every((t) => t.active === false), 'the withheld filter returns only withheld rows')
  ok(onlyActive.tracks.length + onlyWithheld.tracks.length === all.tracks.length,
    `the two filters partition the set [${onlyActive.tracks.length} + ${onlyWithheld.tracks.length} = ${all.tracks.length}]`)
  // ★The catalogue counts must NOT move with the filter -- a target you cannot
  // count against is not a target.
  ok(onlyActive.libraryTotal === all.libraryTotal && onlyActive.activeTotal === all.activeTotal,
    `catalogue counts are filter-independent [library=${all.libraryTotal}, active=${all.activeTotal}]`)
  ok(all.withheldTotal === all.libraryTotal - all.activeTotal, 'withheld = library - active')
  ok(all.unsignedTotal >= 1, `the unsigned count sees the unsigned row [${all.unsignedTotal}]`)

  // --------------------------------------------------------------- 3. write --
  console.log('\n3. the write -- and what it refuses to touch')
  {
    const res = await setMusicActive([aTrack], true)
    ok(res.ok === true && res.changed === 1, `activating one library row reports 1 changed [${JSON.stringify(res)}]`)
    ok((await activeOf(aTrack)) === true, 'and the row is actually active now')

    const off = await setMusicActive([aTrack, bTrack], false)
    ok(off.ok === true && off.changed === 2, `a bulk withhold reports 2 changed [${JSON.stringify(off)}]`)
    ok((await activeOf(aTrack)) === false && (await activeOf(bTrack)) === false, 'both rows are withheld')
  }

  // ★THE CLAIM THAT MATTERS. An id list is an id list -- the statement itself must
  // refuse a participant's own track, not the UI that usually builds the list.
  console.log('\n4. ★a participant AI row cannot be switched off through curation')
  {
    const beforeVal = await activeOf(foreignAi)
    const res = await setMusicActive([foreignAi], true)
    ok(res.ok === false, `the update is REFUSED rather than silently doing nothing [${JSON.stringify(res)}]`)
    ok((await activeOf(foreignAi)) === beforeVal,
      `the participant row is untouched [active still ${beforeVal}]`)

    // Mixed list: the library row changes, the AI row does not, and the caller is
    // TOLD the counts disagreed instead of reading it as success.
    const mixed = await setMusicActive([aTrack, foreignAi], true)
    ok(mixed.ok === false && mixed.error === 'partial',
      `a mixed list reports 'partial', not success [${JSON.stringify(mixed)}]`)
    ok((await activeOf(aTrack)) === true, 'the library row in the mixed list did change')
    ok((await activeOf(foreignAi)) === beforeVal, 'the AI row in the mixed list did NOT change')
  }

  console.log('\n5. input hygiene')
  {
    ok((await setMusicActive([], true)).ok === false, 'an empty id list is refused')
    const ghost = await setMusicActive([`zz_cur_ghost_${randomUUID().slice(0, 8)}`], true)
    ok(ghost.ok === false, `an id that matches nothing is refused, not reported as success [${JSON.stringify(ghost)}]`)
    const dupes = await setMusicActive([aTrack, aTrack], false)
    ok(dupes.ok === true && dupes.changed === 1, `a duplicated id counts once [${JSON.stringify(dupes)}]`)
  }
}

async function cleanup() {
  try {
    if (created.assetIds.length) await admin.from('studio_music_assets').delete().in('id', created.assetIds)
    for (const uid of created.userIds) if (uid) await admin.auth.admin.deleteUser(uid)
    const { count } = await admin.from('studio_music_assets').select('id', { count: 'exact', head: true })
    const { data: left } = await admin.from('studio_music_assets').select('id').like('id', 'zz_cur_%')
    console.log(`\ncleanup: ${created.assetIds.length} asset row(s), ${created.userIds.length} user(s) deleted`)
    console.log(`         studio_music_assets is back to ${count ?? 0} rows; zz_cur_ leftovers: ${left?.length ?? 0}`)
    if (left?.length) console.log('         ★LEFTOVERS: ' + left.map((r) => r.id).join(', '))
  } catch (e) {
    console.log('\n★cleanup error (check for leftovers named zz_cur_*):', e.message)
  }
}

main()
  .then(cleanup, async (e) => {
    console.error('\nERROR:', e.message)
    await cleanup()
    process.exit(1)
  })
  .then(() => {
    console.log(`\n== music curation: ${pass} pass, ${fail} fail ==`)
    console.log('NOT covered: the score ordering ([2.5] is not built and no score column exists),')
    console.log('             and paging past one page (needs more rows than a test should create).')
    process.exit(fail ? 1 : 0)
  })
