#!/usr/bin/env node
/**
 * ★E2E ⑤: the prelim anti-copy hold, and the straggler it used to swallow.
 *
 * The hold keeps every prelim entry invisible until the cohort is published at
 * once, so an early submitter's video cannot be copied by a later entrant. The
 * part that was never tested is where it meets asynchronous submission: an entry
 * accepted before the deadline can FINALIZE up to 24h later, and finalize stamps
 * the hold at publish time. Stamping the season switch there put that entry back
 * under the hold -- released cohort or not. With the auto release the next hourly
 * tick frees it; with the MANUAL release nobody does, and that one participant is
 * invisible for the rest of the competition with nothing reporting it.
 *
 *   NEGATIVE  hold on, not released -> the entry is absent from the public list
 *   POSITIVE  release -> the same entry appears, and the season is marked
 *   ★POSITIVE  an entry finalized AFTER the release is public IMMEDIATELY
 *   ★NEGATIVE  the identical entry in a season that has NOT been released is
 *              held -- same code, same path, only the release marker differs
 *   CONTROL   with the hold switched OFF the entry is public straight away, so a
 *             "held" result cannot be some unrelated reason for invisibility
 *   IDEMPOTENT a second release matches nothing, and does not move the timestamp
 *   INVARIANT  status / score / submission columns are untouched by a release
 *
 * ★Visibility is read through getWatchVideos -- the query /watch serves -- not by
 * re-reading the watch_hold column. The column is what the code sets; the list is
 * what a participant sees, and those are different claims.
 *
 * ★Needs the prelim_released_at migration
 * (reports/prelim_released_at_migration_2026-08.sql). Without it the release
 * marker cannot be written, the code holds fail-closed, and this harness says so
 * instead of pretending to pass.
 *
 *   node --env-file=.env.local --import ./scripts/test-register.mjs e2e/prelim-hold.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { createZzSeason, mintClips, dropZzSeason } from './zz-season.mjs'

const { createRender, submitRender } = await import('../lib/studio.ts')
const { releasePrelimHoldCore } = await import('../lib/watch-hold.ts')
const { getWatchVideos } = await import('../lib/watch.ts')

const SEASON = 'zz_lane_a_hold'
const DEMO_EMAIL = 'studio-demo@oxxovo.ai'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m) } else { fail++; console.log('  ★FAIL', m) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const iso = (msFromNow) => new Date(Date.now() + msFromNow).toISOString()

// ── the migration this depends on ───────────────────────────────────────────
const { error: colErr } = await admin.from('seasons').select('prelim_released_at').limit(1)
if (colErr) {
  // ★Refuse rather than 'pass'. Without the column the release cannot be marked,
  // the code holds fail-closed, and every assertion below would be measuring the
  // pre-migration behaviour while reading like a green run.
  console.error(`★CANNOT RUN: seasons.prelim_released_at is missing (${colErr.message}).`)
  console.error('   Run reports/prelim_released_at_migration_2026-08.sql first.')
  process.exitCode = 2
} else {

  let demoId = null
  for (let p = 1; p <= 50 && !demoId; p++) {
    const { data } = await admin.auth.admin.listUsers({ page: p, perPage: 200 })
    demoId = data.users.find((u) => (u.email ?? '').toLowerCase() === DEMO_EMAIL)?.id ?? null
    if (data.users.length < 200) break
  }
  if (!demoId) { console.error('demo account not found'); process.exit(1) }

  await dropZzSeason(admin, SEASON)
  const seasonRow = await createZzSeason(admin, SEASON, {
    application_open_at: iso(-3600_000),
    application_close_at: iso(3600_000),
    main_round_start_at: iso(7200_000),
    main_round_end_at: iso(7200_000 + 86_400_000),
    studio_compose_enabled: true,
    studio_prelim_hold_enabled: true,
    studio_prelim_auto_publish: false,
    prelim_released_at: null,
  })
  const clips = await mintClips(admin, SEASON, demoId, 3)
  console.log(`fixture ${SEASON} | demo ${demoId} | ${clips.length} clips | hold ON, not released`)

  const minMs = Number(seasonRow.studio_compose_min_seconds ?? 15) * 1000
  const maxClips = Number(seasonRow.studio_compose_max_clips ?? 10)
  function buildEdl() {
    const edl = []
    let total = 0
    while (total < minMs && edl.length < maxClips) {
      const c = clips[edl.length % clips.length]
      const ms = Math.max(1000, Number(c.duration_seconds ?? 4) * 1000)
      edl.push({ jobId: c.id, startMs: 0, endMs: ms })
      total += ms
    }
    return edl
  }
  async function waitReady(id, timeoutMs = 300_000) {
    const started = Date.now()
    for (;;) {
      const { data } = await admin.from('render_jobs').select('status').eq('id', id).maybeSingle()
      if (data?.status === 'ready' || data?.status === 'failed') return data.status
      if (Date.now() - started > timeoutMs) return 'timeout'
      await sleep(4000)
    }
  }
  async function clearApplication() {
    const { data: apps } = await admin.from('genesis_applications').select('id').eq('season_id', SEASON)
    for (const a of apps ?? []) await admin.from('genesis_applications').delete().eq('id', a.id)
  }
  async function setSeason(patch) {
    const { error } = await admin.from('seasons').update(patch).eq('id', SEASON)
    if (error) throw new Error('season update: ' + error.message)
  }
  const statement =
    'This entry is written by the lane A prelim-hold harness to exercise the anti-copy hold and its ' +
    'release, and it is deleted by the same run. It is not a real submission of any kind.'
  const applicant = {
    creatorName: 'Studio Demo', creatorStatement: statement, country: 'US',
    agreedRules: true, agreedPrivacy: true, agreedIntegrity: true,
  }

  // ★A submitted, finalized, PUBLISHABLE entry: rendered first, so submitRender
  // finalizes in one call and the entry carries its file. Moderation must be
  // approved too, or the row is invisible for a reason that has nothing to do with
  // the hold -- and this harness would then measure nothing.
  async function publishOne(label) {
    await clearApplication()
    const res = await createRender({ userId: demoId, seasonId: SEASON, edl: buildEdl() })
    if (!res.ok) throw new Error(`createRender (${label}): ${res.reason}`)
    const status = await waitReady(res.renderId)
    if (status !== 'ready') throw new Error(`render never landed (${label}): ${status}`)
    const sub = await submitRender({ userId: demoId, email: DEMO_EMAIL, seasonId: SEASON, renderId: res.renderId, applicant })
    if (!sub.ok) throw new Error(`submitRender (${label}): ${sub.reason}`)
    const { data: app } = await admin
      .from('genesis_applications')
      .select('id, watch_hold, free_entry_url, status, moderation_status')
      .eq('studio_application_render_id', res.renderId).maybeSingle()
    // The local run has no moderation key, so the scan returns 'pending' by design
    // (fail-safe). Approve it here: the hold is the thing under test.
    if (app && app.moderation_status !== 'approved') {
      await admin.from('genesis_applications').update({ moderation_status: 'approved' }).eq('id', app.id)
    }
    return { renderId: res.renderId, appId: app?.id ?? null, held: !!app?.watch_hold, url: app?.free_entry_url ?? null }
  }
  const isPublic = async (appId) =>
    (await getWatchVideos({ seasonId: SEASON })).some((v) => v.id === appId)
  const releasedAt = async () =>
    (await admin.from('seasons').select('prelim_released_at').eq('id', SEASON).maybeSingle()).data?.prelim_released_at ?? null

  let torndown = false
  async function teardown() {
    if (torndown) return
    torndown = true
    const counts = await dropZzSeason(admin, SEASON)
    console.log(`\ncleanup: ${JSON.stringify(counts)}`)
    if (counts.leftover) console.log('★LEFTOVER rows -- the fixture did not drop cleanly')
    console.log('★orphan R2 objects from these renders remain -- npm run r2:orphans')
  }
  process.on('SIGINT', async () => { await teardown(); process.exit(130) })

  try {
    // ── 1. held: stamped, and absent from the list a participant is served ────
    console.log('\nHOLD ON, NOT RELEASED')
    const first = await publishOne('first')
    ok(first.held, `NEGATIVE: the finalized entry is stamped held (watch_hold=${first.held})`)
    ok(!!first.url, `fixture: it does carry its file (${first.url ? 'url set' : '★null'}) -- otherwise invisibility proves nothing`)
    ok(!(await isPublic(first.appId)), 'NEGATIVE: it is ABSENT from getWatchVideos -- the query /watch serves')

    // ── 2. release publishes it, and marks the season ─────────────────────────
    console.log('\nRELEASE')
    const before = await admin
      .from('genesis_applications').select('status, moderation_status, studio_submission_state, studio_application_submitted_at')
      .eq('id', first.appId).maybeSingle()
    const rel = await releasePrelimHoldCore(SEASON)
    ok(rel.released === 1 && !rel.error, `POSITIVE: the release published exactly the held cohort (released ${rel.released}${rel.error ? ', error ' + rel.error : ''})`)
    const marked = await releasedAt()
    ok(!!marked, `POSITIVE: the season is marked released (${marked ?? '★null'})`)
    ok(await isPublic(first.appId), 'POSITIVE: the entry now appears in the public list')
    const after = await admin
      .from('genesis_applications').select('status, moderation_status, studio_submission_state, studio_application_submitted_at')
      .eq('id', first.appId).maybeSingle()
    ok(
      JSON.stringify(before.data) === JSON.stringify(after.data),
      `INVARIANT: the release touched visibility only -- status/state/submitted_at unchanged${JSON.stringify(before.data) === JSON.stringify(after.data) ? '' : `\n      before ${JSON.stringify(before.data)}\n      after  ${JSON.stringify(after.data)}`}`,
    )

    // ── 3. idempotence: a second release finds nothing and does not re-stamp ──
    const again = await releasePrelimHoldCore(SEASON)
    ok(again.released === 0 && !again.error, `IDEMPOTENT: the second release published 0 (${again.released})`)
    ok(await releasedAt() === marked, 'IDEMPOTENT: the release timestamp still says when the cohort actually went out')

    // ── 4. ★the straggler: finalized AFTER the release ────────────────────────
    // Same season, same code path, cohort already released.
    console.log('\n★STRAGGLER (finalized after the cohort was released)')
    const late = await publishOne('straggler')
    ok(!late.held, `POSITIVE: it is NOT held (watch_hold=${late.held})`)
    ok(await isPublic(late.appId), 'POSITIVE: it is public immediately -- no second release needed')

    // ★The pairing, and it is the whole point: put the season back to
    // "not released" and run the identical scenario. Only the marker differs.
    await setSeason({ prelim_released_at: null })
    const notReleased = await publishOne('straggler control')
    ok(notReleased.held, `NEGATIVE: with the marker cleared, the identical entry IS held (watch_hold=${notReleased.held})`)
    ok(!(await isPublic(notReleased.appId)), 'NEGATIVE: and it is absent from the public list')

    // ── 5. control: hold OFF publishes straight away ──────────────────────────
    console.log('\nCONTROL (hold switched OFF)')
    await setSeason({ studio_prelim_hold_enabled: false, prelim_released_at: null })
    const unheld = await publishOne('hold off')
    ok(!unheld.held, `CONTROL: with the hold off nothing is stamped (watch_hold=${unheld.held})`)
    ok(await isPublic(unheld.appId), 'CONTROL: and it is public at once -- so "held" above was the hold, not some other filter')
  } finally {
    await teardown()
  }

  console.log(`\n${fail === 0 ? 'ALL PASS' : '★FAILURES'}  pass ${pass} / fail ${fail}`)
  process.exitCode = fail === 0 ? 0 : 1

}