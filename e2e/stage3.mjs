// OXXOVO Stage 3 (AI actor) E2E -- regression for the 2.5 AI-actor pipeline.
//
//   node --env-file=.env.local e2e/stage3.mjs          # ROUTINE (mock, ~$0)
//   node --env-file=.env.local e2e/stage3.mjs --keep   # keep e2e data to inspect
//   node --env-file=.env.local e2e/stage3.mjs --real    # FULL (real fal, opt-in $$)
//
// ROUTINE: seeds placeholder generation artifacts (image jobs + an i2v clip) with
// REAL cryptobind (byte-mirror of lib/cryptobind.ts, same STUDIO_CRYPTOBIND_SECRET)
// -- NO worker, NO fal, $0, and no race with the online Railway worker (nothing is
// left 'queued' for it to claim). Then drives the CONSUMING server actions through
// the real /studio UI (character-library register + compose load) and verifies each
// state + error 0. The real enqueue + worker + fal path is FULL mode only (must be
// run >=1x before launch). getSeasonPhase-style refactors: none (test only).
//
// SCOPE: a dedicated e2e user on the CURRENT season (Studio uses getCurrentSeason,
// so an isolated season is not possible). Cleanup is by user_id -- season_test /
// season_0 / real data are never touched.
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { chromium } from 'playwright'
import { createHmac, createHash, randomUUID } from 'node:crypto'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY
const SECRET = process.env.STUDIO_CRYPTOBIND_SECRET
if (!URL || !ANON || !SRV || !SECRET) throw new Error('missing env (SUPABASE_* / STUDIO_CRYPTOBIND_SECRET)')
const BASE = process.env.E2E_BASE || 'http://localhost:3011'
const EMAIL = 'e2e-studio@oxxovo-e2e.test'
const PASSWORD = process.env.E2E_STUDIO_PASSWORD || 'e2e-studio-oxxovo-2026'
const REAL = process.argv.includes('--real')
const KEEP = process.argv.includes('--keep')
// Registered actor models + the i2v model.
const IMG_MODEL = 'flux2-pro-image'
const I2V_MODEL = 'kling-v3-pro-i2v'
const ACTIVE_MODELS = ['nano-banana-pro', 'flux2-pro-image', 'kling-v3-pro-i2v']
// Reachable placeholder assets (from the Stage-3 probe) so the UI renders them.
const R2 = 'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/stage3_probe'
const PH_IMG = `${R2}/S3A_base_face.jpg`
const PH_VID = `${R2}/S3B_kling_3element_15s.mp4`

const admin = createClient(URL, SRV, { auth: { persistSession: false } })
const log = (m) => console.log(`\n▶ ${m}`)
const sign = (payload) => createHmac('sha256', SECRET).update(payload, 'utf8').digest('hex')
const sha256 = (s) => createHash('sha256').update(s).digest('hex')
const sourceBundle = (sigs) => sha256([...sigs].sort().join('|'))
// cryptobind canonical replicas (must byte-mirror lib/cryptobind.ts)
const v1i = (i) => ['v1i', i.pid, i.tid, i.jobId, i.generatedAt.toISOString(), i.modelId].join('|')
const v1ic = (i) => ['v1ic', i.jobId, i.tid, i.contentHash].join('|')
const v1v = (i) => ['v1v', i.pid, i.tid, i.jobId, i.generatedAt.toISOString(), i.modelId, String(i.durationSeconds), i.parentBundle].join('|')

const checks = []
const check = (name, ok, detail = '') => { checks.push({ name, ok }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`) }

// ── current season (mirror getCurrentSeason: most recently opened) ───────────
async function currentSeason() {
  const nowIso = new Date().toISOString()
  const { data } = await admin.from('seasons').select('id, display_name, main_round_start_at')
    .lte('application_open_at', nowIso).order('application_open_at', { ascending: false }).limit(1).maybeSingle()
  if (!data) throw new Error('no current season')
  return data
}

// ── e2e user (auth) ─────────────────────────────────────────────────────────
async function ensureUser() {
  let page = 1
  for (;;) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === EMAIL)
    if (hit) return hit.id
    if (data.users.length < 200 || page > 50) break
    page++
  }
  const { data, error } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true })
  if (error) throw new Error('createUser: ' + error.message)
  return data.user.id
}

// ── active flag safety (3 mechanisms) ───────────────────────────────────────
async function readActive() {
  const { data } = await admin.from('model_catalog').select('id, active').in('id', ACTIVE_MODELS)
  return Object.fromEntries((data ?? []).map((r) => [r.id, r.active]))
}
async function setActive(on) {
  await admin.from('model_catalog').update({ active: on, updated_at: new Date().toISOString() }).in('id', ACTIVE_MODELS)
}

// ── seed a ready image job (placeholder + REAL v1i + v1ic) ───────────────────
async function seedImage(uid, seasonId, modelId, prompt) {
  const jobId = randomUUID()
  const generatedAt = new Date()
  const cb = { cryptobind_pid: uid, cryptobind_tid: seasonId, cryptobind_generated_at: generatedAt.toISOString(), cryptobind_algo: 'HMAC-SHA256' }
  cb.cryptobind_signature = sign(v1i({ pid: uid, tid: seasonId, jobId, generatedAt, modelId }))
  const contentHash = sha256(`e2e-image-${jobId}`)
  cb.cryptobind_content_hash = contentHash
  cb.cryptobind_content_signature = sign(v1ic({ jobId, tid: seasonId, contentHash }))
  const { error } = await admin.from('generation_jobs').insert({
    id: jobId, user_id: uid, season_id: seasonId, model_id: modelId, tier: 'standard',
    media_type: 'image', prompt, duration_seconds: null, status: 'ready',
    image_url: PH_IMG, r2_key: `e2e/${jobId}.jpg`, estimated_cost_usd: 0, credits_charged: 0,
    created_at: generatedAt.toISOString(), ...cb,
  })
  if (error) throw new Error('seedImage: ' + error.message)
  return { jobId, signature: cb.cryptobind_signature }
}

// ── seed a ready i2v clip (placeholder + REAL v1v + parentBundle) ────────────
async function seedI2v(uid, seasonId, parents, durationSeconds) {
  const jobId = randomUUID()
  const generatedAt = new Date()
  const parentBundle = sourceBundle(parents.map((p) => p.signature))
  const cb = {
    cryptobind_pid: uid, cryptobind_tid: seasonId, cryptobind_generated_at: generatedAt.toISOString(),
    cryptobind_algo: 'HMAC-SHA256', cryptobind_parent_bundle: parentBundle,
    cryptobind_signature: sign(v1v({ pid: uid, tid: seasonId, jobId, generatedAt, modelId: I2V_MODEL, durationSeconds, parentBundle })),
  }
  const { error } = await admin.from('generation_jobs').insert({
    id: jobId, user_id: uid, season_id: seasonId, model_id: I2V_MODEL, tier: 'standard',
    media_type: 'video', prompt: 'e2e i2v clip', duration_seconds: durationSeconds, status: 'ready',
    video_url: PH_VID, r2_key: `e2e/${jobId}.mp4`, estimated_cost_usd: 0, credits_charged: 0,
    parent_image_job_ids: parents.map((p) => p.jobId), created_at: generatedAt.toISOString(), ...cb,
  })
  if (error) throw new Error('seedI2v: ' + error.message)
  return { jobId }
}

// ── teardown (scoped by user_id) ────────────────────────────────────────────
async function teardown(uid) {
  await admin.from('studio_characters').delete().eq('user_id', uid)
  await admin.from('generation_jobs').delete().eq('user_id', uid)
  await admin.from('render_jobs').delete().eq('user_id', uid)
  await admin.from('credit_transactions').delete().eq('user_id', uid)
}

// ── credits (REAL only: real generation charges the participant) ─────────────
async function grantCredits(uid, target) {
  const { data: txs } = await admin.from('credit_transactions').select('amount_credits').eq('user_id', uid)
  const bal = (txs ?? []).reduce((s, r) => s + Number(r.amount_credits), 0)
  if (bal < target) {
    await admin.from('credit_transactions').insert({ user_id: uid, amount_credits: target - bal, type: 'admin_adjust', reason: 'e2e_stage3', metadata: { source: 'e2e-stage3' } })
  }
}

// ── cookie session for the e2e user (same as the studio demo) ────────────────
async function cookies() {
  let caught = []
  const ssr = createServerClient(URL, ANON, { cookies: { getAll: () => [], setAll: (cs) => { caught = cs } } })
  const { error } = await ssr.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (error) throw new Error('signIn: ' + error.message)
  return caught
}

// ═══════════════════════════════════════════════════════════════════════════
// ── REAL helpers: drive true generation via UI + wait for the worker + fal ────
async function waitImages(page, min, timeoutMs) {
  const t0 = Date.now()
  for (;;) {
    if ((await page.locator('section figure img').count()) >= min) return
    if (Date.now() - t0 > timeoutMs) throw new Error(`timeout waiting ${min} image(s) ready`)
    await page.waitForTimeout(3000)
  }
}
async function waitI2vReady(uid, timeoutMs) {
  const t0 = Date.now()
  for (;;) {
    const { data } = await admin.from('generation_jobs').select('id,status,video_url,error_message,parent_image_job_ids')
      .eq('user_id', uid).eq('media_type', 'video').order('created_at', { ascending: false }).limit(4)
    const j = (data ?? []).find((r) => (r.parent_image_job_ids ?? []).length > 0)
    if (j?.status === 'ready' && j.video_url) return j
    if (j?.status === 'failed') throw new Error('i2v FAILED: ' + (j.error_message ?? '').slice(0, 120))
    if (Date.now() - t0 > timeoutMs) throw new Error('i2v timeout' + (j ? ` (status ${j.status})` : ''))
    await new Promise((r) => setTimeout(r, 8000))
  }
}
async function falSpend(uid) {
  const { data } = await admin.from('generation_jobs').select('media_type,status,actual_cost_usd,estimated_cost_usd,error_message')
    .eq('user_id', uid)
  let actual = 0, est = 0, misroute = 0
  for (const j of data ?? []) {
    if (j.actual_cost_usd) actual += Number(j.actual_cost_usd)
    else if ((j.status === 'ready' || j.status === 'failed') && j.estimated_cost_usd) est += Number(j.estimated_cost_usd)
    if ((j.error_message ?? '').includes('no video url')) misroute++ // image misrouted to video path
  }
  return { total: +(actual + est).toFixed(2), misroute }
}

;(async () => {
  console.log(`\n════ Stage 3 E2E | mode=${REAL ? 'REAL (fal $$)' : 'ROUTINE (mock $0)'} ════`)
  const season = await currentSeason()
  console.log(`  season=${season.id} (${season.display_name})`)
  const uid = await ensureUser()
  console.log(`  e2e user=${uid.slice(0, 8)} (${EMAIL})`)

  // ★ active safety (b): abort if any target model is ALREADY active (residual /
  //   concurrent run) so we never overwrite + never mis-revert someone else.
  const prior = await readActive()
  const alreadyOn = ACTIVE_MODELS.filter((m) => prior[m])
  if (alreadyOn.length) {
    console.error(`\n  ABORT: models already active=true: ${alreadyOn.join(', ')}. ` +
      `A prior run may not have reverted (or one is concurrent). Set them false and re-run.`)
    process.exit(3)
  }

  await teardown(uid) // clean slate
  let browser
  let activeFlipped = false
  try {
    log('flip 3 models active=true (test scope; session6=off gates public exposure)')
    await setActive(true)
    activeFlipped = true

    // --- UI setup (common) ---
    log('drive /studio UI: cookie auth + AI actor mode')
    const ck = await cookies()
    browser = await chromium.launch({ headless: true })
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1400 } })
    await ctx.addCookies(ck.map((c) => ({ name: c.name, value: c.value, domain: 'localhost', path: '/', httpOnly: false, sameSite: 'Lax', expires: Math.floor(Date.now() / 1000) + 3600 })))
    await ctx.addInitScript(() => localStorage.setItem('oxxovo_admin_lang', 'ko'))
    const page = await ctx.newPage()
    const errs = []
    page.on('pageerror', (e) => errs.push(e.message))

    const faces = []
    const enterActor = async () => {
      await page.goto(`${BASE}/studio`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForTimeout(2500)
      const sw = page.getByRole('button', { name: 'AI 배우', exact: true })
      await sw.waitFor({ timeout: 12000 }).catch(() => {})
      check('AI actor mode switcher visible (image models active)', (await sw.count()) > 0)
      await sw.click(); await page.waitForTimeout(800)
    }

    if (REAL) {
      // real generation charges the participant -> the e2e user needs credits.
      await grantCredits(uid, 200)
      // --- step 1 (REAL): true t2i generation via worker + fal (FLUX + Path B) ---
      await enterActor()
      log('step 1 (REAL): generate 2 FLUX faces (base + Path B edit) -> worker + fal')
      await page.locator('select').first().selectOption(IMG_MODEL).catch(() => {})
      await page.locator('textarea').first().fill('Photorealistic high-end beauty campaign portrait of a young East Asian woman, luminous dewy skin, small gold hoop earrings, pastel studio background, editorial cosmetics ad, sharp detail.')
      await page.getByRole('button', { name: '생성', exact: true }).click()
      await waitImages(page, 1, 200000)
      await page.getByRole('button', { name: '이 배우로 더 만들기' }).first().click()
      await page.waitForTimeout(700)
      await page.locator('textarea').first().fill('The same woman, three-quarter profile turning toward camera, soft smile, warm beauty lighting, keep the exact same face and the gold hoop earrings.')
      await page.getByRole('button', { name: '생성', exact: true }).click()
      await waitImages(page, 2, 200000)
      const { data: imgRows } = await admin.from('generation_jobs').select('id,status,image_url,error_message').eq('user_id', uid).eq('media_type', 'image')
      check('2 image jobs READY via worker+fal (real)', (imgRows ?? []).length === 2 && imgRows.every((j) => j.status === 'ready' && j.image_url), `${imgRows?.length}`)
      check('image routing correct (0 "no video url" misroute)', (imgRows ?? []).every((j) => !(j.error_message ?? '').includes('no video url')))
    } else {
      // --- step 1 (routine): seed placeholder faces + real cryptobind ---
      log('seed 3 ready image jobs (placeholder + real v1i/v1ic) -- simulates t2i + Path B')
      faces.push(await seedImage(uid, season.id, IMG_MODEL, 'e2e base actor face'))
      faces.push(await seedImage(uid, season.id, IMG_MODEL, 'e2e path-B shot 2'))
      faces.push(await seedImage(uid, season.id, IMG_MODEL, 'e2e path-B shot 3'))
      const { data: imgRows } = await admin.from('generation_jobs').select('id,status,image_url').eq('user_id', uid).eq('media_type', 'image')
      check('3 image jobs ready with image_url', (imgRows ?? []).length === 3 && imgRows.every((j) => j.status === 'ready' && j.image_url), `${imgRows?.length}`)
      await enterActor()
    }

    // --- step 2 (common): register a character (createCharacter) ---
    log('step 2: register a character (createCharacter)')
    await page.getByRole('button', { name: /내 배우/ }).click()
    await page.waitForTimeout(900)
    const readyThumbs = await page.locator('button:has(img)').count()
    check('library register panel shows ready faces', readyThumbs >= 2, `${readyThumbs} thumbs`)
    await page.locator('button:has(img)').first().click()
    await page.waitForTimeout(400)
    // add 1 reference angle so the actor's elements carry a ref (needed for i2v)
    const nRef = Math.min(1, await page.locator('button:has(img.opacity-70)').count())
    for (let r = 0; r < nRef; r++) { await page.locator('button:has(img.opacity-70)').nth(0).click(); await page.waitForTimeout(300) }
    await page.getByPlaceholder('예: KIRA').fill('E2E_ACTOR')
    await page.getByRole('button', { name: '이 배우 등록' }).click()
    await page.getByText('E2E_ACTOR', { exact: false }).first().waitFor({ timeout: 15000 })
    const { data: chars } = await admin.from('studio_characters').select('id,name,frontal_image_job_id,reference_image_job_ids').eq('user_id', uid).is('deleted_at', null)
    check('character registered in library', (chars ?? []).length === 1 && chars[0].name === 'E2E_ACTOR' && chars[0].frontal_image_job_id, `${chars?.length}`)

    if (REAL) {
      // --- step 3 (REAL): true i2v generation (Kling 1 shot 5s) via worker + fal ---
      log('step 3 (REAL): generate 1-shot 5s i2v (Kling) -> worker + fal (~10 min)')
      await page.getByRole('button', { name: '③ 샷 촬영' }).click()
      await page.waitForTimeout(1200)
      await page.locator('section textarea').first().fill('She turns her head slowly toward the camera and gives a soft confident smile, beauty campaign, cinematic.')
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: '영상 생성', exact: true }).click()
      await page.getByText('영상 생성을 시작했습니다', { exact: false }).waitFor({ timeout: 20000 }).catch(() => {})
      log('  waiting for real i2v to render (up to 12 min)...')
      const i2v = await waitI2vReady(uid, 720000)
      check('i2v clip READY via worker+Kling (real)', !!i2v.video_url)
      check('i2v routing correct (0 "no video url" misroute)', !(i2v.error_message ?? '').includes('no video url'))
    } else {
      // --- step 3 (routine): seed the i2v clip + real cryptobind ---
      log('step 3: seed an i2v clip from the actor (simulates createI2vGeneration output)')
      await seedI2v(uid, season.id, faces, 15)
      const { data: vids } = await admin.from('generation_jobs').select('id,status,video_url,parent_image_job_ids').eq('user_id', uid).eq('media_type', 'video')
      check('i2v clip ready with video_url + parents', (vids ?? []).length === 1 && vids[0].status === 'ready' && vids[0].video_url && (vids[0].parent_image_job_ids ?? []).length === 3, `${vids?.length}`)
    }

    log('step 4: compose editor loads the i2v clip in the picker')
    await page.goto(`${BASE}/studio/compose`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(4000)
    const clipVideos = await page.locator('video').count()
    check('compose editor loads the i2v clip (>=1 in picker)', clipVideos >= 1, `${clipVideos} clip video(s)`)

    check('no page errors during the flow', errs.length === 0, errs.slice(0, 2).join(' | '))

    // regression: the image/video split holds -- image jobs carry image_url (not
    // video_url) so they are excluded from the compose picker. Stage 3 image jobs
    // never pollute the existing compose/clip pipeline.
    const { data: allImg } = await admin.from('generation_jobs').select('image_url,video_url').eq('user_id', uid).eq('media_type', 'image')
    check('image jobs kept out of compose (image_url set, video_url null)', (allImg ?? []).length > 0 && (allImg ?? []).every((j) => j.image_url && !j.video_url), `${allImg?.length} image jobs`)

    // REAL: report actual fal spend + worker-routing proof + artifact links
    // (BEFORE teardown; teardown deletes the DB rows but R2 files persist, so the
    // printed URLs stay viewable for TK).
    if (REAL) {
      const spend = await falSpend(uid)
      check('worker routing OK -- 0 "no video url" misroute across all jobs', spend.misroute === 0, `${spend.misroute} misroute`)
      const { data: oImg } = await admin.from('generation_jobs').select('image_url').eq('user_id', uid).eq('media_type', 'image').not('image_url', 'is', null)
      const { data: oVid } = await admin.from('generation_jobs').select('video_url').eq('user_id', uid).eq('media_type', 'video').not('video_url', 'is', null)
      console.log(`\n  ★ REAL fal spend ~ $${spend.total}  (target ~$0.95)  |  misroute = ${spend.misroute}`)
      console.log('  images:\n    ' + (oImg ?? []).map((r) => r.image_url).join('\n    '))
      console.log('  i2v:\n    ' + (oVid ?? []).map((r) => r.video_url).join('\n    '))
    }
  } finally {
    // ★ active safety (a): always revert to false (crash-safe).
    if (activeFlipped) { await setActive(false); console.log('\n  reverted 3 models active=false') }
    if (browser) await browser.close().catch(() => {})
    if (!KEEP) { await teardown(uid); console.log('  torn down e2e user data (--keep to inspect)') }
  }

  const pass = checks.every((c) => c.ok)
  console.log(`\n════ ${pass ? 'PASS' : 'FAIL'}  (${checks.filter((c) => c.ok).length}/${checks.length}) ════`)
  process.exit(pass ? 0 : 1)
})().catch((e) => { console.error('\nHARNESS ERROR:', e.message); process.exit(2) })
