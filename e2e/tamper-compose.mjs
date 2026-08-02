#!/usr/bin/env node
/**
 * ★E2E items 3-5: the attack surface asynchronous submission ADDED.
 *
 * Before it, a submission was one moment: verify and write. Now there are two --
 * intent (at the deadline, the render may still be running) and finalize (later,
 * when the file lands) -- and the row is writable in between. So every tamper has
 * to be refused at BOTH phases, and the two swaps that only exist because of the
 * gap have to be refused too:
 *
 *   T1 EDL             a segment changed after signing
 *   T2 source bundle   a source clip swapped out from under the render
 *   T3 render sig      the v1sr signature itself replaced
 *   S1 EDL swapped AFTER intent was accepted
 *   S2 video_url repointed AFTER intent was accepted
 *
 * ★It calls the REAL server paths (createRender / submitRender /
 * finalizeSubmission) and the REAL secret. Nothing about the canonical strings is
 * reproduced here -- an older harness in scripts/ hand-copied them, which is the
 * mistake of measuring your own copy.
 *
 * ★Runs against the REAL database (C7): renders + one application row on the
 * isolated studio-demo account, removed in a `finally`, counts reported.
 * The deployed worker renders these for real (CPU only, no vendor cost) and the
 * R2 objects it writes are left orphaned -- listed for the go-live cleanup item.
 *
 *   node --env-file=.env.local --import ./scripts/test-register.mjs e2e/tamper-compose.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { createRender, submitRender, finalizeSubmission } from '../lib/studio.ts'

const DEMO_EMAIL = 'studio-demo@oxxovo.ai'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m) } else { fail++; console.log('  ★FAIL', m) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── fixtures ────────────────────────────────────────────────────────────────
let demoId = null
for (let p = 1; p <= 50 && !demoId; p++) {
  const { data } = await admin.auth.admin.listUsers({ page: p, perPage: 200 })
  demoId = data.users.find((u) => (u.email ?? '').toLowerCase() === DEMO_EMAIL)?.id ?? null
  if (data.users.length < 200) break
}
const { data: season } = await admin
  .from('seasons')
  .select('id, studio_compose_min_seconds, studio_compose_max_clips')
  .eq('status', 'active')
  .maybeSingle()
const { data: clips } = await admin
  .from('generation_jobs')
  .select('id, duration_seconds')
  .eq('user_id', demoId).eq('season_id', season.id).eq('status', 'ready').eq('media_type', 'video')
  .is('deleted_at', null).order('created_at', { ascending: true })
if (!demoId || !season || !clips?.length) { console.error('fixtures missing'); process.exit(1) }

const minMs = Number(season.studio_compose_min_seconds ?? 15) * 1000
const maxClips = Number(season.studio_compose_max_clips ?? 10)
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

const madeRenders = []
async function newRender() {
  const res = await createRender({ userId: demoId, seasonId: season.id, edl: buildEdl() })
  if (!res.ok) throw new Error('createRender: ' + res.reason)
  madeRenders.push(res.renderId)
  return res.renderId
}
async function waitReady(id, timeoutMs = 240_000) {
  const started = Date.now()
  for (;;) {
    const { data } = await admin.from('render_jobs').select('status').eq('id', id).maybeSingle()
    if (data?.status === 'ready') return true
    if (data?.status === 'failed') return false
    if (Date.now() - started > timeoutMs) return false
    await sleep(4000)
  }
}
// The application row is per (season, email); every case must start clean or the
// second submission is refused for being a duplicate rather than for the tamper.
async function clearApplication() {
  const { data: apps } = await admin
    .from('genesis_applications').select('id').eq('season_id', season.id).ilike('email', DEMO_EMAIL)
  for (const a of apps ?? []) await admin.from('genesis_applications').delete().eq('id', a.id)
  return (apps ?? []).length
}
// The real field names and the real bounds (STATEMENT_MIN 150 / MAX 250) -- a
// harness that guesses the applicant shape fails on validation and tells you
// nothing about the tamper it was written for.
const statement =
  'This entry is written by the lane A tamper harness to exercise the two-phase submission path, ' +
  'and it is deleted by the same run. It is not a real submission and carries no creative claim.'
const applicant = {
  creatorName: 'Studio Demo',
  creatorStatement: statement,
  country: 'US',
  agreedRules: true,
  agreedPrivacy: true,
  agreedIntegrity: true,
}

async function submit(renderId) {
  return submitRender({ userId: demoId, email: DEMO_EMAIL, seasonId: season.id, renderId, applicant })
}

console.log(`season ${season.id} | demo ${demoId} | ${clips.length} clips`)
try {
  await clearApplication()

  // ── T1-T3 at the INTENT phase (render still in flight) ────────────────────
  console.log('\nINTENT phase (render not yet landed)')
  for (const [label, tamper] of [
    ['T1 EDL segment changed after signing', async (id) => {
      const { data } = await admin.from('render_jobs').select('edl').eq('id', id).maybeSingle()
      const edl = JSON.parse(JSON.stringify(data.edl))
      const segs = Array.isArray(edl) ? edl : edl.segments
      segs[0].endMs = segs[0].endMs - 500
      await admin.from('render_jobs').update({ edl }).eq('id', id)
    }],
    ['T2 source clip swapped out of the bundle', async (id) => {
      const { data } = await admin.from('render_jobs').select('source_job_ids').eq('id', id).maybeSingle()
      const ids = [...data.source_job_ids]
      const other = clips.find((c) => !ids.includes(c.id))
      if (other) ids[0] = other.id
      else ids.pop() // fewer sources still changes the bundle
      await admin.from('render_jobs').update({ source_job_ids: ids }).eq('id', id)
    }],
    ['T3 v1sr signature replaced', async (id) => {
      await admin.from('render_jobs')
        .update({ cryptobind_render_signature: 'f'.repeat(64) })
        .eq('id', id)
    }],
  ]) {
    const id = await newRender()
    await tamper(id)
    const res = await submit(id)
    ok(!res.ok, `${label} -> intent refused (${res.ok ? 'ACCEPTED' : res.reason + (res.detail ? ' / ' + res.detail : '')})`)
    if (res.ok) { console.log('  ★STOPPING: a tampered render was accepted at intent'); break }
    await clearApplication()
  }

  // ── FINALIZE phase ────────────────────────────────────────────────────────
  // ★The sequence matters and the first version of this harness got it wrong.
  // Taking intent on a render that is ALREADY ready makes submitRender finalize
  // on the spot -- there is no second phase left, so finalizeSubmission returns
  // "nothing to do" and every tamper below it reads as PASS while proving
  // nothing. The control caught that. The real window is: intent while the render
  // is still in flight, the worker lands it, THEN the tamper, THEN finalize.
  console.log('\nFINALIZE phase (intent taken while queued, render lands, then tampered)')

  async function intentThenLand() {
    const id = await newRender()
    await clearApplication()
    const intent = await submit(id) // still queued -> records intent only
    if (!intent.ok) return { id, err: 'intent ' + intent.reason }
    const { data: afterIntent } = await admin
      .from('render_jobs').select('status, submit_intent_at, finalized_at').eq('id', id).maybeSingle()
    if (afterIntent?.finalized_at) return { id, err: 'submitRender finalized immediately -- not the async window' }
    if (!afterIntent?.submit_intent_at) return { id, err: 'no intent recorded' }
    if (!(await waitReady(id))) return { id, err: 'render never landed' }
    return { id }
  }

  // ★CONTROL FIRST. Every case below reads success as "finalize refused", so if an
  // UNTAMPERED render also fails to finalize, the results underneath are not
  // evidence -- they are a broken fixture, which is the exact failure this project
  // has hit three times.
  const ctl = await intentThenLand()
  const ctlFin = ctl.err ? null : await finalizeSubmission(ctl.id)
  const controlFinalized = !!(ctlFin && ctlFin.ok && ctlFin.finalized)
  ok(controlFinalized, `CONTROL: intent-while-queued then finalize DOES finalize (${ctl.err ?? (ctlFin.ok ? 'finalized=' + ctlFin.finalized : ctlFin.reason)})`)

  if (!controlFinalized) {
    console.log('  ★STOPPING: without a working control the tamper cases prove nothing')
  } else {
    for (const [label, tamper] of [
      ['S1 EDL segment changed AFTER intent', async (id) => {
        const { data } = await admin.from('render_jobs').select('edl').eq('id', id).maybeSingle()
        const edl = JSON.parse(JSON.stringify(data.edl))
        const segs = Array.isArray(edl) ? edl : edl.segments
        segs[0].endMs = segs[0].endMs - 500
        await admin.from('render_jobs').update({ edl }).eq('id', id)
      }],
      ['T2 source clip swapped AFTER intent', async (id) => {
        const { data } = await admin.from('render_jobs').select('source_job_ids').eq('id', id).maybeSingle()
        const ids = [...data.source_job_ids]
        const other = clips.find((c) => !ids.includes(c.id))
        if (other) ids[0] = other.id; else ids.pop()
        await admin.from('render_jobs').update({ source_job_ids: ids }).eq('id', id)
      }],
      ['T3 v1sc content signature replaced AFTER intent', async (id) => {
        await admin.from('render_jobs').update({ cryptobind_final_signature: 'f'.repeat(64) }).eq('id', id)
      }],
      ['S2 video_url repointed AFTER intent', async (id) => {
        await admin.from('render_jobs')
          .update({ video_url: 'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/cf/v3/cf_01_lumea_premium.mp4' })
          .eq('id', id)
      }],
    ]) {
      const c = await intentThenLand()
      if (c.err) { ok(false, `${label} -> could not set up the async window (${c.err})`); continue }
      await tamper(c.id)
      const fin = await finalizeSubmission(c.id)
      const refused = !fin.ok || fin.finalized === false
      ok(refused, `${label} -> finalize refused (${fin.ok ? (fin.finalized ? '★FINALIZED' : 'not finalized') : fin.reason})`)
      if (!refused) { console.log('  ★STOPPING: a tampered render finalized'); break }
    }

    // ★The other half of the byte check, and it is not a tamper: an UNREADABLE
    // file must not be treated as a wrong one. R2 having a bad minute cannot cost
    // a participant their entry, so this must defer (try again next tick, overdue
    // if it persists) and must NOT mark the application finalize_rejected.
    const u = await intentThenLand()
    if (u.err) {
      ok(false, `UNREADABLE: could not set up the async window (${u.err})`)
    } else {
      await admin.from('render_jobs')
        .update({ video_url: 'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/renders/does-not-exist-lane-a.mp4' })
        .eq('id', u.id)
      const fin = await finalizeSubmission(u.id)
      const deferred = fin.ok === true && fin.finalized === false
      ok(deferred, `UNREADABLE file -> deferred, not refused (${fin.ok ? 'finalized=' + fin.finalized : 'reason ' + fin.reason})`)
      const { data: app } = await admin
        .from('genesis_applications').select('studio_submission_state')
        .eq('studio_application_render_id', u.id).maybeSingle()
      ok(
        app?.studio_submission_state !== 'finalize_rejected',
        `UNREADABLE file -> the entry is NOT marked finalize_rejected (state ${app?.studio_submission_state ?? 'none'})`,
      )
    }
  }
} finally {
  const removedApps = await clearApplication()
  for (const id of madeRenders) await admin.from('render_jobs').delete().eq('id', id)
  const { data: leftovers } = await admin.from('render_jobs').select('id').in('id', madeRenders.length ? madeRenders : ['-'])
  const { count } = await admin.from('render_jobs').select('id', { count: 'exact', head: true })
  const { count: appCount } = await admin
    .from('genesis_applications').select('id', { count: 'exact', head: true }).eq('season_id', season.id)
  console.log(`\ncleanup: ${madeRenders.length} renders deleted (leftover ${leftovers?.length ?? '?'}), ` +
    `${removedApps} application row(s) removed | render_jobs total ${count} | ${season.id} applications ${appCount}`)
  console.log('★orphan R2 objects from these renders remain -- go-live cleanup item')
}

console.log(`\n${fail === 0 ? 'ALL PASS' : '★FAILURES'}  pass ${pass} / fail ${fail}`)
process.exitCode = fail === 0 ? 0 : 1
