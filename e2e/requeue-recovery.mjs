#!/usr/bin/env node
/**
 * ★E2E item 4: a render that FAILED after its submission was accepted.
 *
 * This is the case the async design exists for. A participant whose render fails a
 * minute before the deadline has no time to retry, so the submission is accepted
 * anyway (a failed render is deliberately in the submittable set) and the sweep
 * gives it exactly ONE re-render of the same EDL. A second failure is a staff
 * matter -- never an automatic elimination.
 *
 *   POSITIVE  the re-queue is real: the row goes back to 'queued', the deployed
 *             worker renders it, it reaches 'ready' and finalizes into the entry.
 *             "It was requeued" is not the claim; "it came back finished" is.
 *   NEGATIVE  the SECOND failure is not requeued again -- it is reported overdue
 *             and the entry is flagged for staff, with the render left alone
 *             (not auto-failed, which would be a decision that is not the tick's
 *             to take).
 *   CONTROL   both are swept in the SAME tick, alongside a render at its FIRST
 *             failure that must be requeued. Otherwise "not requeued" is
 *             indistinguishable from a sweep that did nothing at all.
 *
 * ★sweepAsyncSubmissions() is global. Before it runs, this harness checks that
 * every accepted-but-unfinalized render in the database belongs to its own
 * fixture, and refuses to sweep if anything else is waiting -- running it here
 * would otherwise finalize somebody's real submission from a laptop.
 *
 *   node --env-file=.env.local --import ./scripts/test-register.mjs e2e/requeue-recovery.mjs
 */
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createZzSeason, mintClips, dropZzSeason } from './zz-season.mjs'

const { createRender, submitRender, sweepAsyncSubmissions } = await import('../lib/studio.ts')

const SEASON = 'zz_lane_a_requeue'
const DEMO_EMAIL = 'studio-demo@oxxovo.ai'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m) } else { fail++; console.log('  ★FAIL', m) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const iso = (msFromNow) => new Date(Date.now() + msFromNow).toISOString()

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
})
const clips = await mintClips(admin, SEASON, demoId, 3)
console.log(`fixture ${SEASON} | demo ${demoId} | ${clips.length} clips`)

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
async function statusOf(id) {
  const { data } = await admin.from('render_jobs').select('status, claim_token, attempts, finalized_at').eq('id', id).maybeSingle()
  return data ?? {}
}
// Make a render fail the way a real one does: 'failed', still carrying the claim
// token of the lane that failed it. ★The token is left in place deliberately --
// that is the state a real failure leaves behind, and clearing it here would make
// "the requeue disowns the previous claim" trivially true. If the worker already
// has the row, wait for it to land rather than fighting the CAS: a half-claimed
// row would test the race, not the recovery.
async function forceFailed(id, note) {
  const staleToken = randomUUID()
  for (let i = 0; i < 90; i++) {
    const { status } = await statusOf(id)
    if (status === 'queued' || status === 'ready' || status === 'failed') {
      const { data } = await admin
        .from('render_jobs')
        .update({
          status: 'failed', claim_token: staleToken, claimed_at: new Date().toISOString(),
          error_message: `lane A harness: ${note}`, updated_at: new Date().toISOString(),
        })
        .eq('id', id).eq('status', status).select('id')
      if (data?.length) return staleToken
    }
    await sleep(2000)
  }
  return null
}
async function waitReady(id, timeoutMs = 300_000) {
  const started = Date.now()
  for (;;) {
    const { status } = await statusOf(id)
    if (status === 'ready' || status === 'failed') return status
    if (Date.now() - started > timeoutMs) return 'timeout'
    await sleep(4000)
  }
}
async function clearApplication() {
  const { data: apps } = await admin.from('genesis_applications').select('id').eq('season_id', SEASON)
  for (const a of apps ?? []) await admin.from('genesis_applications').delete().eq('id', a.id)
}
async function appStateFor(renderId) {
  const { data } = await admin
    .from('genesis_applications')
    .select('studio_submission_state, free_entry_url')
    .eq('studio_application_render_id', renderId).maybeSingle()
  return data ?? {}
}
const statement =
  'This entry is written by the lane A requeue harness to exercise recovery from a failed render, ' +
  'and it is deleted by the same run. It is not a real submission and carries no creative claim.'
const applicant = {
  creatorName: 'Studio Demo', creatorStatement: statement, country: 'US',
  agreedRules: true, agreedPrivacy: true, agreedIntegrity: true,
}
const submit = (renderId) => submitRender({ userId: demoId, email: DEMO_EMAIL, seasonId: SEASON, renderId, applicant })

// ★The guard. sweepAsyncSubmissions() has no season parameter.
async function assertOnlyOurRowsAreWaiting() {
  const { data } = await admin
    .from('render_jobs').select('id, season_id, user_id')
    .not('submit_intent_at', 'is', null).is('finalized_at', null)
  const foreign = (data ?? []).filter((r) => r.season_id !== SEASON)
  if (foreign.length) {
    throw new Error(
      `REFUSING to sweep: ${foreign.length} accepted submission(s) outside ${SEASON} are waiting ` +
      `(${foreign.map((r) => `${r.id}@${r.season_id}`).join(', ')}). This sweep is global.`,
    )
  }
  return (data ?? []).length
}

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
  // ── POSITIVE: one failure, one recovery, all the way to finalized ─────────
  console.log('\nFIRST FAILURE -> REQUEUE -> READY -> FINALIZED')
  const r1 = await newRender()
  const staleToken1 = await forceFailed(r1, 'first failure')
  ok(!!staleToken1, 'fixture: the render is at failed, still holding the failing lane\'s claim token')
  const accepted = await submit(r1)
  ok(accepted.ok, `POSITIVE: a FAILED render can still be submitted before the deadline (${accepted.ok ? 'accepted' : accepted.reason + (accepted.detail ? ' / ' + accepted.detail : '')})`)
  ok((await appStateFor(r1)).studio_submission_state === 'intent',
    `POSITIVE: the entry records the acceptance (state ${(await appStateFor(r1)).studio_submission_state ?? 'none'})`)

  const waiting1 = await assertOnlyOurRowsAreWaiting()
  const tick1 = await sweepAsyncSubmissions()
  console.log(`  tick 1 over ${waiting1} accepted row(s): ${JSON.stringify({ requeued: tick1.requeued, overdue: tick1.overdue, finalized: tick1.finalized })}`)
  ok(tick1.requeued.includes(r1), 'POSITIVE: the tick requeued it')
  // ★Read AFTER the requeue, so the deployed worker may already have claimed it
  // back. Asserting status === 'queued' here would be asserting that the worker is
  // slow. What must be true is that the row is back in the pipeline at all, and
  // that the dead lane's claim no longer owns it.
  const afterRequeue = await statusOf(r1)
  ok(afterRequeue.status !== 'failed', `POSITIVE: it is back in the pipeline (status ${afterRequeue.status})`)
  ok(afterRequeue.claim_token !== staleToken1,
    `POSITIVE: the previous claim was disowned (${afterRequeue.claim_token === null ? 'token cleared' : 'a new lane holds it'})`)
  ok((await appStateFor(r1)).studio_submission_state === 'render_requeued',
    `POSITIVE: the entry says so (state ${(await appStateFor(r1)).studio_submission_state ?? 'none'})`)

  // ★The claim of the whole feature: not "it was requeued" but "it came back".
  const landed = await waitReady(r1)
  ok(landed === 'ready', `POSITIVE: the worker rendered the requeued job to completion (status ${landed})`)
  if (landed === 'ready') {
    await assertOnlyOurRowsAreWaiting()
    const tick2 = await sweepAsyncSubmissions()
    ok(tick2.finalized.includes(r1), `POSITIVE: the next tick finalized it (${JSON.stringify(tick2.budget)})`)
    const app1 = await appStateFor(r1)
    ok(app1.studio_submission_state === 'finalized' && !!app1.free_entry_url,
      `POSITIVE: the entry ends up with the file (state ${app1.studio_submission_state}, url ${app1.free_entry_url ? 'set' : '★null'})`)
  }

  // ── NEGATIVE: the second failure goes to staff, not round two ─────────────
  console.log('\nSECOND FAILURE -> STAFF (with a first-failure control in the same tick)')
  await clearApplication()
  const r2 = await newRender()
  ok(!!(await forceFailed(r2, 'first failure')), 'fixture: second-failure subject starts at failed')
  const accepted2 = await submit(r2)
  ok(accepted2.ok, `fixture: it is accepted (${accepted2.ok ? 'accepted' : accepted2.reason})`)
  await assertOnlyOurRowsAreWaiting()
  const setup = await sweepAsyncSubmissions()
  ok(setup.requeued.includes(r2), 'fixture: its first failure was requeued (this is the setup, not the claim)')
  ok(!!(await forceFailed(r2, 'second failure')), 'fixture: it failed a second time')

  // The control: a render at its FIRST failure, accepted without an application
  // row (one entry per season is already taken above), swept in the same tick.
  const r3 = await newRender()
  ok(!!(await forceFailed(r3, 'first failure (control)')), 'fixture: control render is at failed')
  await admin.from('render_jobs').update({ submit_intent_at: new Date().toISOString() }).eq('id', r3)

  await assertOnlyOurRowsAreWaiting()
  const tick3 = await sweepAsyncSubmissions()
  console.log(`  tick 3: ${JSON.stringify({ requeued: tick3.requeued, overdue: tick3.overdue, finalized: tick3.finalized })}`)
  ok(!tick3.requeued.includes(r2), 'NEGATIVE: the second failure was NOT requeued again')
  ok(tick3.overdue.includes(r2), 'NEGATIVE: it was reported overdue -- the tick channel a human reads')
  const app2 = await appStateFor(r2)
  ok(app2.studio_submission_state === 'render_failed',
    `NEGATIVE: the entry is flagged for staff (state ${app2.studio_submission_state ?? 'none'})`)
  const r2After = await statusOf(r2)
  ok(r2After.status === 'failed', `NEGATIVE: the render is left alone, not auto-anything (status ${r2After.status})`)
  ok(tick3.requeued.includes(r3), 'CONTROL: in that same tick, a first failure WAS requeued -- the sweep was awake')
} finally {
  await teardown()
}

console.log(`\n${fail === 0 ? 'ALL PASS' : '★FAILURES'}  pass ${pass} / fail ${fail}`)
process.exitCode = fail === 0 ? 0 : 1
