#!/usr/bin/env node
/**
 * ★E2E items 3 and 5: the DEADLINE, and the paths asynchronous submission was
 * not supposed to change.
 *
 *   3. TIME-COMPRESSED DEADLINE
 *      positive  a submission arriving before the close time is accepted
 *      negative  a render submitted a minute AFTER the close is refused -- and
 *                refused as `application_closed`, not for some other reason that
 *                happens to also be a refusal
 *      control   move only the clock back, and that same refused render goes
 *                through. Without this step "refused" could just mean the fixture
 *                was broken, which is the failure this project keeps re-finding.
 *
 *   5. SYNCHRONOUS PATH REGRESSION
 *      positive  a render that is ALREADY rendered still submits in ONE call and
 *                finalizes on the spot (the pre-async behaviour, unchanged)
 *      positive  in a non-compose season a single clip is still a valid entry
 *      negative  in a compose season that same single clip is refused
 *                (`compose_required`) -- the single-path rule still holds
 *
 * Runs on a disposable `zz_` season with re-signed clips (e2e/zz-season.mjs
 * explains why neither season_0 nor season_test may host a clock this test moves).
 * The deployed worker renders the fixture's renders for real -- CPU only, no
 * vendor cost -- and the R2 objects it writes are left orphaned for the go-live
 * cleanup item.
 *
 *   node --env-file=.env.local --import ./scripts/test-register.mjs e2e/deadline-and-sync.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { createZzSeason, mintClips, dropZzSeason } from './zz-season.mjs'

const { createRender, submitRender, submitGeneration, finalizeSubmission } = await import('../lib/studio.ts')

const SEASON = 'zz_lane_a_deadline'
const DEMO_EMAIL = 'studio-demo@oxxovo.ai'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m) } else { fail++; console.log('  ★FAIL', m) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const iso = (msFromNow) => new Date(Date.now() + msFromNow).toISOString()

// ── fixture ─────────────────────────────────────────────────────────────────
let demoId = null
for (let p = 1; p <= 50 && !demoId; p++) {
  const { data } = await admin.auth.admin.listUsers({ page: p, perPage: 200 })
  demoId = data.users.find((u) => (u.email ?? '').toLowerCase() === DEMO_EMAIL)?.id ?? null
  if (data.users.length < 200) break
}
if (!demoId) { console.error('demo account not found'); process.exit(1) }

// A previous crashed run would leave the fixture behind; start from nothing.
await dropZzSeason(admin, SEASON)
const seasonRow = await createZzSeason(admin, SEASON, {
  application_open_at: iso(-3600_000),
  application_close_at: iso(3600_000),
  main_round_start_at: iso(7200_000),
  main_round_end_at: iso(7200_000 + 86_400_000),
  studio_compose_enabled: true,
})
const clips = await mintClips(admin, SEASON, demoId, 3)
console.log(`fixture ${SEASON} (season_number ${seasonRow.season_number}) | demo ${demoId} | ${clips.length} clips`)

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
async function newRender() {
  const res = await createRender({ userId: demoId, seasonId: SEASON, edl: buildEdl() })
  if (!res.ok) throw new Error('createRender: ' + res.reason + (res.detail ? ' / ' + res.detail : ''))
  return res.renderId
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
  'This entry is written by the lane A deadline harness to exercise the submission window and the ' +
  'single-clip path, and it is deleted by the same run. It is not a real submission of any kind.'
const applicant = {
  creatorName: 'Studio Demo', creatorStatement: statement, country: 'US',
  agreedRules: true, agreedPrivacy: true, agreedIntegrity: true,
}
const submit = (renderId) => submitRender({ userId: demoId, email: DEMO_EMAIL, seasonId: SEASON, renderId, applicant })

let torndown = false
async function teardown() {
  if (torndown) return
  torndown = true
  const counts = await dropZzSeason(admin, SEASON)
  console.log(`\ncleanup: ${JSON.stringify(counts)}`)
  if (counts.leftover) console.log('★LEFTOVER rows -- the fixture did not drop cleanly')
  console.log('★orphan R2 objects from these renders remain -- go-live cleanup item')
}
process.on('SIGINT', async () => { await teardown(); process.exit(130) })

try {
  // ── item 3: the deadline ──────────────────────────────────────────────────
  // main_round_start_at sits in the future, so the effective round is the
  // APPLICATION round -- the 72h window this design is about, whose hard cut is
  // application_close_at.
  console.log('\nDEADLINE (application round, time-compressed)')
  const before = await newRender()
  const beforeRes = await submit(before)
  ok(beforeRes.ok, `POSITIVE: a submission an hour before the close is accepted (${beforeRes.ok ? 'accepted' : beforeRes.reason + (beforeRes.detail ? ' / ' + beforeRes.detail : '')})`)
  const { data: acceptedApp } = await admin
    .from('genesis_applications')
    .select('studio_submission_state, studio_application_intent_at')
    .eq('studio_application_render_id', before).maybeSingle()
  ok(!!acceptedApp?.studio_application_intent_at, 'POSITIVE: the acceptance is stamped on the entry (studio_application_intent_at)')

  // The negative uses a DIFFERENT render: one render can only be accepted once,
  // so reusing `before` would be refused as already_submitted and would prove
  // nothing about the deadline.
  await clearApplication()
  const after = await newRender()
  await setSeason({ application_close_at: iso(-60_000) })
  const afterRes = await submit(after)
  ok(
    !afterRes.ok && afterRes.reason === 'application_closed',
    `NEGATIVE: a minute after the close it is refused, as application_closed (${afterRes.ok ? '★ACCEPTED' : afterRes.reason})`,
  )

  await setSeason({ application_close_at: iso(3600_000) })
  const retryRes = await submit(after)
  ok(
    retryRes.ok,
    `CONTROL: with only the clock moved back, that same render is accepted (${retryRes.ok ? 'accepted' : retryRes.reason + (retryRes.detail ? ' / ' + retryRes.detail : '')})`,
  )

  // ── item 5a: the synchronous compose path ─────────────────────────────────
  // A render that is already finished must still submit in ONE call, exactly as
  // it did before the intent/finalize split existed.
  console.log('\nSYNCHRONOUS COMPOSE PATH (render already finished)')
  await clearApplication()
  const sync = await newRender()
  const syncStatus = await waitReady(sync)
  if (syncStatus !== 'ready') {
    ok(false, `could not get a rendered render to submit (worker returned ${syncStatus})`)
  } else {
    const syncRes = await submit(sync)
    ok(syncRes.ok, `POSITIVE: an already-rendered render submits in one call (${syncRes.ok ? 'accepted' : syncRes.reason + (syncRes.detail ? ' / ' + syncRes.detail : '')})`)
    const { data: row } = await admin.from('render_jobs').select('finalized_at, status').eq('id', sync).maybeSingle()
    const { data: app } = await admin
      .from('genesis_applications')
      .select('studio_submission_state, free_entry_url')
      .eq('studio_application_render_id', sync).maybeSingle()
    ok(!!row?.finalized_at, 'POSITIVE: it finalized on the spot -- no sweep needed (finalized_at set)')
    ok(app?.studio_submission_state === 'finalized' && !!app?.free_entry_url,
      `POSITIVE: the entry carries the file immediately (state ${app?.studio_submission_state ?? 'none'}, url ${app?.free_entry_url ? 'set' : '★null'})`)
    const again = await finalizeSubmission(sync)
    ok(again.ok && again.finalized === false, `CONTROL: finalize is idempotent -- nothing left to do (${again.ok ? 'finalized=' + again.finalized : again.reason})`)
  }

  // ── item 5b: single-clip submission (the non-compose path) ────────────────
  console.log('\nSINGLE-CLIP PATH (compose off vs compose on)')
  await clearApplication()
  // The LAST clip: the EDLs above are built from the front of the list, and
  // submitGeneration locks the clip terminal.
  const clip = clips[clips.length - 1]
  const blocked = await submitGeneration({ userId: demoId, email: DEMO_EMAIL, seasonId: SEASON, jobId: clip.id, applicant })
  ok(
    !blocked.ok && blocked.reason === 'compose_required',
    `NEGATIVE: with compose ON a single clip is refused as compose_required (${blocked.ok ? '★ACCEPTED' : blocked.reason})`,
  )
  await setSeason({ studio_compose_enabled: false })
  const single = await submitGeneration({ userId: demoId, email: DEMO_EMAIL, seasonId: SEASON, jobId: clip.id, applicant })
  ok(single.ok, `POSITIVE: with compose OFF the same single clip is a valid entry (${single.ok ? 'accepted' : single.reason + (single.detail ? ' / ' + single.detail : '')})`)
  const { data: singleApp } = await admin
    .from('genesis_applications')
    .select('free_entry_url, studio_application_job_id')
    .eq('season_id', SEASON).maybeSingle()
  ok(
    singleApp?.studio_application_job_id === clip.id && !!singleApp?.free_entry_url,
    `POSITIVE: the entry points at that clip (job ${singleApp?.studio_application_job_id === clip.id ? 'matches' : '★mismatch'}, url ${singleApp?.free_entry_url ? 'set' : '★null'})`,
  )
  const { data: lockedClip } = await admin.from('generation_jobs').select('status').eq('id', clip.id).maybeSingle()
  ok(lockedClip?.status === 'submitted', `POSITIVE: the clip is locked terminal (status ${lockedClip?.status})`)
} finally {
  await teardown()
}

console.log(`\n${fail === 0 ? 'ALL PASS' : '★FAILURES'}  pass ${pass} / fail ${fail}`)
process.exitCode = fail === 0 ? 0 : 1
