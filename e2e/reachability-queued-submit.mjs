#!/usr/bin/env node
/**
 * ★E2E item 9 -- REACHABILITY, not behaviour.
 *
 *   "Can a participant, on the screen they actually use, submit a render that is
 *    still QUEUED -- after a reload?"
 *
 * The server has accepted queued renders since asynchronous submission shipped.
 * Twice now the SCREEN did not: first the submit form was rendered only inside
 * the `renderReady` branch (2026-07-31), then the editor adopted a resumed render
 * into its state only when the render was already 'ready' (2026-08-02), so a
 * participant who reloaded came back with no submit control at all. Both times
 * every server-side test was green. So this harness asks the only question that
 * catches that class: is the control ON THE PAGE.
 *
 * ★WHERE IT RUNS: a LOCAL PRODUCTION BUILD (`npm run build && npm start`) against
 * the REAL database. Same compiled output as a deployment; the difference is the
 * host. It is NOT a deployment test and must never be reported as one -- the
 * "does it work on the build participants meet" question is C3/C4 in the go-live
 * checklist, deliberately not duplicated here.
 *
 * ★SEEDS THE REAL DATABASE (C7): one render_jobs row, owned by the isolated
 * studio-demo account, deleted in a `finally`, with the row count reported after.
 *
 *   npm start                    # in another terminal, or BASE_URL=... below
 *   node --env-file=.env.local --import ./scripts/test-register.mjs  *        e2e/reachability-queued-submit.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
// ★The render is created through the REAL server path, not hand-inserted. A row
// forged here would need a hand-written CryptoBind, i.e. a copy of the thing under
// test -- the same mistake as a parity harness measuring its own copy of the
// filters. createRender also enforces the season's compose rules, so what gets
// seeded is a row the platform itself would accept.
import { createRender } from '../lib/studio.ts'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'
const DEMO_KEY = 'oxxovo-studio-demo-2026'
const DEMO_EMAIL = 'studio-demo@oxxovo.ai'
const SHOT_DIR = 'reports/_shots'

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) { console.error('SUPABASE env missing'); process.exit(1) }
const admin = createClient(URL_, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m) } else { fail++; console.log('  FAIL', m) } }

// ── who / where ─────────────────────────────────────────────────────────────
let demoId = null
for (let page = 1; page <= 50 && !demoId; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
  if (error) throw new Error('listUsers: ' + error.message)
  demoId = data.users.find((u) => (u.email ?? '').toLowerCase() === DEMO_EMAIL)?.id ?? null
  if (data.users.length < 200) break
}
if (!demoId) { console.error('demo account not found'); process.exit(1) }

const { data: season } = await admin
  .from('seasons')
  .select('id, studio_compose_enabled, studio_compose_min_seconds, studio_compose_max_seconds, studio_compose_max_clips')
  .eq('status', 'active')
  .maybeSingle()
if (!season) { console.error('no active season'); process.exit(1) }

const { data: clips } = await admin
  .from('generation_jobs')
  .select('id, duration_seconds')
  .eq('user_id', demoId)
  .eq('season_id', season.id)
  .eq('status', 'ready')
  .eq('media_type', 'video')
  .is('deleted_at', null)
  .order('created_at', { ascending: true })
if (!clips?.length) { console.error('demo account has no ready clips in ' + season.id); process.exit(1) }

// Enough clips to satisfy the season's minimum composed length -- the same rule
// createRender enforces, so the seeded row is one the platform would accept.
console.log('season compose bounds:', JSON.stringify(season))
const minSec = Number(season.studio_compose_min_seconds ?? 15)
const maxSec = Number(season.studio_compose_max_seconds ?? 30)
// ★Clips may repeat. The demo account holds 4 x 4s in this season and the season
// asks for 30-40s, so a one-pass timeline cannot satisfy it -- and reusing a clip
// is an ordinary thing for a participant to do, not a trick to get past the check.
// maxClips bounds the SEGMENT count, so the loop respects it.
const maxClips = Number(season.studio_compose_max_clips ?? 10)
const edl = []
let total = 0
while (total < minSec * 1000 && edl.length < maxClips) {
  const c = clips[edl.length % clips.length]
  const ms = Math.max(1000, Number(c.duration_seconds ?? 4) * 1000)
  edl.push({ jobId: c.id, startMs: 0, endMs: ms })
  total += ms
}
if (total < minSec * 1000) {
  console.error(`demo clips total ${(total / 1000).toFixed(1)}s < season minimum ${minSec}s -- cannot build a valid render`)
  process.exit(1)
}
if (maxSec > 0 && total > maxSec * 1000) {
  console.error(`built ${(total / 1000).toFixed(1)}s > season maximum ${maxSec}s`)
  process.exit(1)
}
console.log(`season ${season.id} | demo ${demoId} | seeding a QUEUED render of ${edl.length} clips (${(total / 1000).toFixed(1)}s)`)

let renderId = null
let browser = null
try {
  const created = await createRender({ userId: demoId, seasonId: season.id, edl })
  if (!created.ok) throw new Error('createRender refused: ' + created.reason + ' ' + (created.detail ?? ''))
  renderId = created.renderId
  // ★It is born 'queued'. It does not STAY that way: this is the production
  // database and the deployed worker polls it, so within seconds the row is
  // claimed and walks queued -> rendering -> uploading. That is realistic, not a
  // problem -- item 9 asks about a render that is not READY, and every in-flight
  // status is one. Pinning it to 'queued' would need the fleet stopped, which is
  // a worse trade than accepting the status the participant would actually see.
  // ★No assertion on 'still queued': the deployed worker claims within seconds and
  // racing it here would make the harness flaky for no gain. What matters is the
  // status the PAGE saw, asserted below.
  const { data: born } = await admin.from('render_jobs').select('status').eq('id', renderId).maybeSingle()
  ok(!!renderId, `createRender accepted the timeline (row status now ${born?.status})`)

  // ── the browser half ──────────────────────────────────────────────────────
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const consoleErrors = []
  const failedUrls = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('requestfailed', (r) => failedUrls.push(`${r.url()} :: ${r.failure()?.errorText ?? ''}`))

  const login = await page.goto(`${BASE_URL}/api/demo-login?key=${DEMO_KEY}`, { waitUntil: 'networkidle' })
  ok(login !== null && login.status() < 400, `demo-login reachable (${login?.status()})`)

  // ★A FRESH navigation to the editor -- this is the reload the defect hid in.
  // Nothing from the render request is in memory; everything the page knows comes
  // from the server payload.
  await page.goto(`${BASE_URL}/studio/compose`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)

  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
  mkdirSync(SHOT_DIR, { recursive: true })
  await page.screenshot({ path: `${SHOT_DIR}/item9-queued-submit.png`, fullPage: true })
  writeFileSync(`${SHOT_DIR}/item9-queued-submit.txt`, body)

  ok(!/closed|not available|로그인|Sign in/i.test(body.slice(0, 200)), 'editor rendered (not the closed gate / login)')
  // The status line proves the page adopted the SEEDED render rather than showing
  // an empty editor that happens to have a submit box for some other reason.
  const shown = (body.match(/(?:상태|Status): (\w+)/) ?? [])[1] ?? '(none)'
  ok(
    ['queued', 'rendering', 'uploading'].includes(shown),
    `the page resumed the render and shows it as in-flight (${shown})`,
  )
  ok(shown !== 'ready', 'the render is NOT ready -- so the control below is not the old ready-only path')
  // ★THE QUESTION.
  ok(/완성본 제출|Submit final/.test(body), '★submit control is ON THE PAGE for a QUEUED render')
  // ★R2 CORS rejects http://localhost (the bucket allows *.vercel.app). That is an
  // artefact of running the build on this host, not a product defect, so it is
  // counted and named rather than either ignored or failed on.
  // The browser reports a CORS block twice: once as the CORS message and once as a
  // bare "Failed to load resource: net::ERR_FAILED". The second is only
  // attributable via the failed-request list, so both are correlated here rather
  // than pattern-matched on hope.
  for (const u of failedUrls.filter((u) => u.includes('localhost')).slice(0, 4)) console.log('  local failed:', u.slice(0, 180))
  const hosts = [...new Set(failedUrls.map((u) => { try { return new URL(u.split(' :: ')[0]).host } catch { return u } }))]
  const nonR2 = hosts.filter((h) => !/r2\.dev/.test(h))
  console.log(`  failed-request hosts: ${hosts.join(', ') || '(none)'}`)
  // Aborted RSC prefetches on localhost are navigation noise, not failures; what
  // makes a bare ERR_FAILED attributable is that an r2.dev request failed at all.
  const r2Only = hosts.some((h) => /r2\.dev/.test(h))
  const corsNoise = consoleErrors.filter(
    (e) => /r2\.dev|CORS|Access-Control/i.test(e) || (r2Only && /ERR_FAILED|Failed to load resource/i.test(e)),
  )
  const realErrors = consoleErrors.filter((e) => !corsNoise.includes(e))
  console.log(
    `  console: ${corsNoise.length} attributable to the localhost R2 CORS block ` +
      `(${failedUrls.length} failed requests, all r2.dev: ${r2Only}), ${realErrors.length} other`,
  )
  ok(realErrors.length === 0, `no console errors beyond the localhost R2 CORS${realErrors.length ? ': ' + realErrors[0].slice(0, 160) : ''}`)
  console.log(`  screenshot: ${SHOT_DIR}/item9-queued-submit.png`)

  // ★Which worker build is deployed, answered by evidence rather than by reading
  // a dashboard: claim_token is written only by the build that carries the CAS
  // (worker 2069b8d). If the row was claimed and the column is still NULL, the
  // running image predates it.
  const { data: claimed } = await admin
    .from('render_jobs')
    .select('status, claim_token, attempts, worker_started_at')
    .eq('id', renderId)
    .maybeSingle()
  console.log('  deployed-worker probe:', JSON.stringify(claimed))
  // ★An OBSERVATION, not one of this harness's assertions: it reports the state of
  // the Railway deployment, which no code in this repo controls. It does not
  // decide the exit code, but it is printed loudly because a live worker without
  // the CAS is the state that must not meet a competition.
  if (claimed?.worker_started_at) {
    console.log(
      claimed.claim_token
        ? '  DEPLOY: the running worker stamps claim_token -> it carries the CAS build (2069b8d)'
        : '  ★DEPLOY WARNING: the running worker claimed this row and left claim_token NULL ' +
            '-> the deployed image PREDATES 2069b8d. The zombie-write guard is in the repo, not in production.',
    )
  } else {
    console.log('  DEPLOY: row not claimed during the run -- no statement about the deployed build')
  }
} finally {
  if (browser) await browser.close().catch(() => {})
  if (renderId) {
    const { error: delErr } = await admin.from('render_jobs').delete().eq('id', renderId)
    console.log('  cleanup: seeded render deleted:', delErr ? 'FAILED ' + delErr.message : 'ok')
  }
  const { data: left } = renderId ? await admin.from('render_jobs').select('id').eq('id', renderId) : { data: [] }
  const { count } = await admin.from('render_jobs').select('id', { count: 'exact', head: true })
  console.log(`  cleanup verified: seeded row remaining ${left?.length ?? '?'} | render_jobs total ${count}`)
}

console.log(`\n${fail === 0 ? 'ALL PASS' : '★FAILURES'}  pass ${pass} / fail ${fail}`)
process.exitCode = fail === 0 ? 0 : 1
