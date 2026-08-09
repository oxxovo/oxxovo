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

async function seed({ label, source, userId = null, active = true, title, signed = true, score }) {
  const id = `zz_cur_${label}_${randomUUID().slice(0, 8)}`
  const audio = Buffer.from(`zz-curation-${id}`)
  const bind = signed
    ? buildMusicAssetBind({ assetId: id, source, contentHash: hashMusicAsset(audio), generatedAt: new Date() })
    : {}
  const { error } = await admin.from('studio_music_assets').insert({
    id, source, user_id: userId, title, mood: 'calm', duration_seconds: 95,
    r2_key: `zz/${id}.m4a`, url: `https://example.invalid/${id}.m4a`,
    status: 'ready', active, license_type: 'library_licensed', provider: 'zz-test-vendor',
    // ★Omitted, not defaulted. `score: undefined` leaves screening_score NULL, which is
    // the case section 6 is actually about -- writing 0 for "unscored" is the bug this
    // harness exists to catch, not something the fixture should quietly do for us.
    ...(score === undefined ? {} : { screening_score: score }),
    ...bind,
  })
  // ★A seed failure is a FAILURE OF THE PREMISE, not a skipped case. If the insert is
  // refused (an unmigrated column, a CHECK) the rows are simply absent, every negative
  // assertion below becomes vacuously true, and the run reports PASS having measured
  // nothing ([[feedback-fixture-seed-failure-vacuous-pass]]).
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

  // ★The ordering contract, executed. These four rows are all UNSCORED, so they tie on
  // screening_score and fall through to title -- which is why this assertion still
  // reads the same after the score became the leading term. Section 6 is where the two
  // orders are made to DISAGREE; on its own this line cannot tell them apart.
  const titles = all.tracks.map((t) => t.title)
  ok(titles.indexOf('ZZ Alpha') < titles.indexOf('ZZ Bravo'), `unscored rows tie and fall to title ascending [${titles.join(' | ')}]`)

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

  // ------------------------------------------------- 6. the audition order --
  //
  // ★THIS IS THE MEASUREMENT THE 100-TRACK BATCH DEPENDS ON. Curation's method is
  // "listen in descending score, stop at the quota". If the order is wrong, 대표님
  // auditions the wrong tracks and the conclusion drawn from the batch -- go to 1,000,
  // or fix the prompts -- is drawn from the wrong sample. Everything else here can be
  // wrong and cost a re-run; this cannot.
  //
  // ★AND THE TITLES ARE CHOSEN SO SCORE ORDER AND TITLE ORDER DISAGREE ON EVERY ROW.
  // Until today reviewScore was hard-coded to null, so the list came back in title
  // order -- and a fixture whose two orders happen to agree would have PASSED against
  // exactly that defect. Read down the score column and up the alphabet:
  //
  //     title              score      by score   by title
  //     ZZ Ord Zulu         90           1st        4th
  //     ZZ Ord Sierra       55           2nd        3rd
  //     ZZ Ord Mike         10           3rd        2nd
  //     ZZ Ord Alfa        NULL          4th        1st        <- exact reversal
  //
  // So title order is the precise reverse of the expected answer. There is no
  // arrangement of these four rows that satisfies both hypotheses.
  console.log('\n6. ★the audition order -- score DESC, unscored last')
  {
    const top = await seed({ label: 'ordz', source: 'library', title: 'ZZ Ord Zulu', score: 90, active: false })
    const mid = await seed({ label: 'ords', source: 'library', title: 'ZZ Ord Sierra', score: 55, active: false })
    const low = await seed({ label: 'ordm', source: 'library', title: 'ZZ Ord Mike', score: 10, active: false })
    const none = await seed({ label: 'orda', source: 'library', title: 'ZZ Ord Alfa', active: false })

    const page = await listMusicForCuration({ q: 'ZZ Ord ' })
    const order = page.tracks.map((t) => t.id)
    const shown = page.tracks.map((t) => `${t.title}=${t.reviewScore}`).join(' | ')

    // ★The premise, asserted before anything is concluded from the order. Four rows in,
    // fewer than four back means the ordering result below is about a different set.
    ok(page.tracks.length === 4, `all four seeded rows come back [${page.tracks.length}] ${shown}`)

    ok(
      order.join() === [top, mid, low, none].join(),
      `descending score, unscored last [${shown}]`,
    )

    // ★The scores are REAL VALUES, not the hard-coded null this replaces. Without this,
    // the order assertion above could pass on title order alone in some other fixture.
    const byId = new Map(page.tracks.map((t) => [t.id, t]))
    ok(byId.get(top)?.reviewScore === 90 && byId.get(low)?.reviewScore === 10,
      `screening_score arrives as a number [top=${byId.get(top)?.reviewScore}, low=${byId.get(low)?.reviewScore}]`)

    // ★NULL, not 0. An unscreened track sorting among the rejects instead of after them
    // is how a track nobody measured gets read as a track that measured badly
    // ([[feedback-absent-is-not-zero]]).
    ok(byId.get(none)?.reviewScore === null,
      `an unscreened row reads as null, not 0 [${byId.get(none)?.reviewScore}]`)
    ok(order[order.length - 1] === none, 'and it sorts LAST -- after the scored rejects, not among them')

    // ★NEGATIVE CONTROL. If the harness cannot distinguish the two hypotheses it proves
    // nothing, so state the rejected one and check it was in fact rejected. Title
    // ascending would have produced the exact reverse.
    const titleOrder = [...page.tracks].sort((x, y) => (x.title ?? '').localeCompare(y.title ?? '')).map((t) => t.id)
    ok(titleOrder.join() !== order.join(),
      'title order and score order genuinely differ here -- the fixture can tell them apart')
    ok(titleOrder.join() === [none, low, mid, top].join(),
      'and title order is the exact reversal, which is what the previous (null-score) code returned')
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
    console.log('COVERED as of 2026-08-09: the audition order end to end (section 6) -- scored rows')
    console.log('             read back through listMusicForCuration in DESCENDING score with unscored')
    console.log('             last, on a fixture whose title order is the exact REVERSE, so the two')
    console.log('             hypotheses cannot both be satisfied. Verified to fail: removing the')
    console.log('             screening_score term from musicCurationOrderTerms() turns 3 of those')
    console.log("             assertions red. PostgREST's NULL placement was measured separately")
    console.log('             (DESC default -> NULLs FIRST; nullsFirst:false -> NULLs last).')
    console.log('★NOT covered: paging past one page -- the order is only proven WITHIN one page, and')
    console.log('             page 2 of a 1,000-track catalogue is where an unstable sort actually')
    console.log('             bites (a row seen twice while another is never seen). Needs more rows')
    console.log('             than a test should create against the live table; the id tie-break that')
    console.log('             guards it is asserted in lib/music-curation-order.test.ts only.')
    console.log('             Also not covered: the worker->column path (seed:music:batch writing a')
    console.log('             transcribed screeningScore) -- that is dry-run verified in the worker,')
    console.log('             not exercised end to end from a manifest to this list.')
    process.exit(fail ? 1 : 0)
  })
