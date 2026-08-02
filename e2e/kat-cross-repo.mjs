#!/usr/bin/env node
/**
 * ★E2E item 1: KAT invariance ACROSS THE TWO REPOS.
 *
 * Both repos already ship a KAT (`lib/cryptobind-v2.test.ts` /
 * `src/cryptobind-v2.test.ts`) and both pass. That is not the same claim. Each of
 * those runs one repo's code against THAT repo's golden, so if a canonical string
 * and its golden are edited together in one repo, both suites stay green while the
 * worker signs something the app will refuse -- every submission fails verification
 * at the deadline, and the first person to find out is a participant.
 *
 * So this harness holds the two implementations side by side:
 *
 *   POSITIVE  the same input produces the same canonical string, the same hash and
 *             (same secret) the same signature in BOTH repos -- v1, v1c, v1i, v1ic,
 *             v1v, v1sr, v1sc, v1m -- and a row signed by the WORKER verifies in the
 *             APP, which is the direction that actually happens in production.
 *   NEGATIVE  one byte changed anywhere in that chain must break it: both repos must
 *             move together AND away from the golden, and the app must refuse a
 *             worker signature made under a different secret. A byte-mirror test
 *             that cannot fail is the thing being guarded against here.
 *
 * The golden constants themselves are compared as literals lifted out of the two
 * test files, so neither repo can quietly re-baseline its own KAT. That comparison
 * gets its own falsification case (flip one nibble -> the comparator must object),
 * because a comparison that always passes reads exactly like a passing test.
 *
 * No database, no network, no secret from the environment: the harness pins its own
 * so the numbers are reproducible on any machine.
 *
 *   node --import ./scripts/test-register.mjs e2e/kat-cross-repo.mjs
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { resolveWorkerRepo } from '../scripts/worker-repo.mjs'

// ★Pinned BEFORE the app module is imported. The app reads the secret from the
// environment (the worker takes it as an argument), and a KAT that depends on
// whatever .env.local happens to hold is not a KAT.
const SECRET = 'lane-a-cross-repo-kat-secret'
const OTHER_SECRET = SECRET.slice(0, -1) + 'X' // one byte different, same length
process.env.STUDIO_CRYPTOBIND_SECRET = SECRET

const APP_ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const WORKER_ROOT = resolveWorkerRepo(APP_ROOT)

const app = await import('../lib/cryptobind.ts')
const wrk = await import(pathToFileURL(join(WORKER_ROOT, 'src', 'cryptobind.ts')).href)

let pass = 0
let fail = 0
const ok = (c, m) => {
  if (c) { pass++; console.log('  PASS', m) } else { fail++; console.log('  ★FAIL', m) }
}
// The workhorse: one value computed twice, once per repo.
const same = (label, a, b) =>
  ok(a === b, `${label} matches across repos${a === b ? ` (${String(a).slice(0, 24)}…)` : `\n      app    ${a}\n      worker ${b}`}`)

console.log(`app    ${APP_ROOT}`)
console.log(`worker ${WORKER_ROOT}`)

// ★Control before any comparison: if WORKER_REPO ever resolved back to this repo,
// every line below would compare a value with itself and the run would be a
// 34-line green nothing. The two builders differ in arity (the worker is handed
// the secret; the app reads it from the environment), which is cheap proof that
// two different implementations are actually loaded.
ok(
  app.buildCryptoBind.length === 1 && wrk.buildCryptoBind.length === 2,
  `two distinct implementations are loaded (app arity ${app.buildCryptoBind.length}, worker arity ${wrk.buildCryptoBind.length})`,
)

// ── fixtures ────────────────────────────────────────────────────────────────
// Deliberately not the samples either test file uses: if the two repos' KAT
// samples have drifted, a shared golden cannot reveal it but a shared INPUT can.
const AT = new Date('2026-08-02T00:00:00.000Z')
const PID = '11111111-1111-4111-8111-111111111111'
const TID = 'season_kat'
const JOB = '22222222-2222-4222-8222-222222222222'
const RENDER = '33333333-3333-4333-8333-333333333333'
const HASH_A = 'ab'.repeat(32)
const HASH_B = 'cd'.repeat(32)

const genInput = { jobId: JOB, pid: PID, tid: TID, modelId: 'kling-v3-pro', durationSeconds: 6, generatedAt: AT }
const v1Edl = [
  { jobId: 'clipA', startMs: 0, endMs: 5000 },
  { jobId: 'clipB', startMs: 250, endMs: 7250 },
]
const v2Edl = {
  segments: [
    { jobId: 'clipA', startMs: 0, endMs: 5000, speed: 1.25, effects: { brightness: 0.1, contrast: -0.05 }, fit: 'cover' },
    { jobId: 'clipB', startMs: 250, endMs: 7250 },
  ],
  transitions: [{ afterIndex: 0, type: 'dissolve', durationMs: 500 }],
  global: { grade: 'warm' },
  aspect: '9:16',
  texts: [{ content: 'OXXOVO', startMs: 0, endMs: 2000, x: 0.5, y: 0.1, sizePct: 8, color: '#ffffff', font: 'inter', align: 'center' }],
  music: { assetId: 'lib_elegant_01', gain: 0.6, startMs: 0, fadeInMs: 500, fadeOutMs: 800 },
}

// ── 1. pure canonicalisation + hashing (no secret involved) ─────────────────
console.log('\nCANONICAL / HASH (secret-free)')
same('v1 EDL canonical', app.edlCanonicalString(v1Edl), wrk.edlCanonicalString(v1Edl))
same('v1 EDL hash', app.computeEdlHash(v1Edl), wrk.computeEdlHash(v1Edl))
same('v2 EDL canonical', app.edlCanonicalString(v2Edl), wrk.edlCanonicalString(v2Edl))
same('v2 EDL hash', app.computeEdlHash(v2Edl), wrk.computeEdlHash(v2Edl))
same('generation canonical (v1)', app.canonicalString(genInput), wrk.canonicalString(genInput))
same('image canonical (v1i)', app.imageCanonicalString({ jobId: JOB, pid: PID, tid: TID, modelId: 'seedance2', generatedAt: AT }),
  wrk.imageCanonicalString({ jobId: JOB, pid: PID, tid: TID, modelId: 'seedance2', generatedAt: AT }))
same('i2v canonical (v1v)', app.i2vCanonicalString({ jobId: JOB, pid: PID, tid: TID, modelId: 'kling-v3-pro', durationSeconds: 6, generatedAt: AT, parentBundle: HASH_A }),
  wrk.i2vCanonicalString({ jobId: JOB, pid: PID, tid: TID, modelId: 'kling-v3-pro', durationSeconds: 6, generatedAt: AT, parentBundle: HASH_A }))
same('music asset canonical (v1m)', app.musicAssetCanonicalString({ assetId: 'lib_elegant_01', source: 'library', contentHash: HASH_A }),
  wrk.musicAssetCanonicalString({ assetId: 'lib_elegant_01', source: 'library', contentHash: HASH_A }))
// The bundle sorts before folding, so the two repos must also agree on the ORDER
// rule, not just the hash -- feed it unsorted.
same('source bundle (unsorted input)', app.computeSourceBundle([HASH_B, HASH_A]), wrk.computeSourceBundle([HASH_B, HASH_A]))
same('content hash of bytes', app.hashVideoContent(Buffer.from('lane-a-kat')), wrk.hashVideoContent(Buffer.from('lane-a-kat')))

// ── 2. signatures, same secret both sides ───────────────────────────────────
console.log('\nSIGNATURES (identical secret)')
same('v1 generation signature', app.buildCryptoBind(genInput).cryptobind_signature, wrk.buildCryptoBind(SECRET, genInput).cryptobind_signature)
// v1c is worker-built in production and app-verified; the app exposes no builder,
// so the mirror check runs through the verifier below.
same('v1i image signature', app.buildImageBind({ jobId: JOB, pid: PID, tid: TID, modelId: 'seedance2', generatedAt: AT }).cryptobind_signature,
  wrk.buildImageBind(SECRET, { jobId: JOB, pid: PID, tid: TID, modelId: 'seedance2', generatedAt: AT }).cryptobind_signature)
same('v1ic image content signature', app.buildImageContentBind({ jobId: JOB, tid: TID, contentHash: HASH_A }).cryptobind_content_signature,
  wrk.buildImageContentBind(SECRET, { jobId: JOB, tid: TID, contentHash: HASH_A }).cryptobind_content_signature)
same('v1v i2v signature', app.buildI2vBind({ jobId: JOB, pid: PID, tid: TID, modelId: 'kling-v3-pro', durationSeconds: 6, generatedAt: AT, parentBundle: HASH_A }).cryptobind_signature,
  wrk.buildI2vBind(SECRET, { jobId: JOB, pid: PID, tid: TID, modelId: 'kling-v3-pro', durationSeconds: 6, generatedAt: AT, parentBundle: HASH_A }).cryptobind_signature)

const reqArgs = { pid: PID, tid: TID, renderId: RENDER, edl: v2Edl, sourceSignatures: [HASH_B, HASH_A] }
const appReq = app.buildComposeRequestBind(reqArgs)
const wrkReq = wrk.buildComposeRequestBind(SECRET, reqArgs)
same('v1sr edl hash', appReq.cryptobind_edl_hash, wrkReq.cryptobind_edl_hash)
same('v1sr source bundle', appReq.cryptobind_source_bundle, wrkReq.cryptobind_source_bundle)
same('v1sr request signature', appReq.cryptobind_render_signature, wrkReq.cryptobind_render_signature)

const contentArgs = { renderId: RENDER, tid: TID, finalHash: HASH_B }
same('v1sc content signature', app.buildComposeContentBind(contentArgs).cryptobind_final_signature,
  wrk.buildComposeContentBind(SECRET, contentArgs).cryptobind_final_signature)
const musicArgs = { assetId: 'lib_elegant_01', source: 'library', contentHash: HASH_A, generatedAt: AT }
same('v1m music signature', app.buildMusicAssetBind(musicArgs).cryptobind_signature,
  wrk.buildMusicAssetBind(SECRET, musicArgs).cryptobind_signature)

// ── 3. the direction production actually runs: worker signs, app verifies ───
console.log('\nWORKER SIGNS -> APP VERIFIES')
const wGen = wrk.buildCryptoBind(SECRET, genInput)
const wContent = wrk.buildContentBind(SECRET, { jobId: JOB, tid: TID, contentHash: HASH_A })
const clipRow = {
  id: JOB, model_id: genInput.modelId, duration_seconds: genInput.durationSeconds,
  cryptobind_pid: wGen.cryptobind_pid, cryptobind_tid: wGen.cryptobind_tid,
  cryptobind_generated_at: wGen.cryptobind_generated_at, cryptobind_signature: wGen.cryptobind_signature,
  cryptobind_algo: wGen.cryptobind_algo, ...wContent,
}
ok(app.verifyCryptoBind(clipRow, TID).ok === true, 'a worker-signed clip (v1 + v1c) verifies in the app')

const wRenderRow = {
  id: RENDER, cryptobind_pid: PID, cryptobind_tid: TID, cryptobind_algo: 'HMAC-SHA256',
  cryptobind_render_signature: wrkReq.cryptobind_render_signature,
  ...wrk.buildComposeContentBind(SECRET, contentArgs), edl: v2Edl,
}
ok(app.verifyComposeBind(wRenderRow, TID, [HASH_B, HASH_A]).ok === true,
  'a worker-signed render (v1sr + v1sc) verifies in the app')

// ── 4. NEGATIVE: one byte ───────────────────────────────────────────────────
// Each case changes exactly one byte and expects the mirror to hold while the
// value moves -- both repos must reject, and reject for the same reason.
console.log('\nONE BYTE (must break, in both repos, the same way)')
const bumped = JSON.parse(JSON.stringify(v2Edl))
bumped.segments[0].endMs = 5001 // 5000 -> 5001
ok(app.computeEdlHash(bumped) !== app.computeEdlHash(v2Edl), 'one ms of trim changes the app hash')
same('the changed EDL hash', app.computeEdlHash(bumped), wrk.computeEdlHash(bumped))

const textEdited = JSON.parse(JSON.stringify(v2Edl))
textEdited.texts[0].content = 'OXXOVQ' // one character
ok(app.computeEdlHash(textEdited) !== app.computeEdlHash(v2Edl), 'one character of overlay text changes the app hash')
same('the changed text EDL hash', app.computeEdlHash(textEdited), wrk.computeEdlHash(textEdited))

const durationBumped = { ...genInput, durationSeconds: 7 }
ok(app.buildCryptoBind(durationBumped).cryptobind_signature !== app.buildCryptoBind(genInput).cryptobind_signature,
  'one second of duration changes the v1 signature')
same('the changed v1 signature', app.buildCryptoBind(durationBumped).cryptobind_signature,
  wrk.buildCryptoBind(SECRET, durationBumped).cryptobind_signature)

// ★The secret is the whole security argument: if the two repos disagreed about it
// (different name, different trimming, a stray newline) every signature would be a
// forgery from the other side's point of view. So a DIFFERENT secret must fail.
const forged = { ...clipRow, ...wrk.buildCryptoBind(OTHER_SECRET, genInput) }
const forgedResult = app.verifyCryptoBind(forged, TID)
ok(forgedResult.ok === false && forgedResult.reason === 'signature_mismatch',
  `a clip signed with a one-byte-different secret is refused (${forgedResult.ok ? 'ACCEPTED' : forgedResult.reason})`)

const tamperedContent = { ...clipRow, cryptobind_content_hash: HASH_B }
const tcResult = app.verifyCryptoBind(tamperedContent, TID)
ok(tcResult.ok === false && tcResult.reason === 'content_mismatch',
  `a swapped content hash on a worker-signed clip is refused (${tcResult.ok ? 'ACCEPTED' : tcResult.reason})`)

const tamperedRender = { ...wRenderRow, edl: bumped }
const trResult = app.verifyComposeBind(tamperedRender, TID, [HASH_B, HASH_A])
ok(trResult.ok === false && trResult.reason === 'render_sig_mismatch',
  `an EDL edited after the worker signed it is refused (${trResult.ok ? 'ACCEPTED' : trResult.reason})`)

// ── 5. the goldens themselves must not have been re-baselined ───────────────
// Lifted as literals out of both test files. Only the 64-hex constants are
// compared: the canonical-string goldens are written with different local helpers
// in the two repos ('ab'.repeat(32) vs CH), and their equality is already implied
// -- equal hashes over equal hash functions mean equal inputs.
console.log('\nGOLDEN LITERALS (neither repo may re-baseline alone)')
function goldens(file) {
  const src = readFileSync(file, 'utf8')
  const out = {}
  for (const m of src.matchAll(/const (GOLDEN_\w+)\s*=\s*'([0-9a-f]{64})'/g)) out[m[1]] = m[2]
  return out
}
const appGold = goldens(join(APP_ROOT, 'lib', 'cryptobind-v2.test.ts'))
const wrkGold = goldens(join(WORKER_ROOT, 'src', 'cryptobind-v2.test.ts'))
function compareGoldens(a, b) {
  const names = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
  return names.filter((n) => a[n] !== b[n])
}
const count = Object.keys(appGold).length
ok(count >= 4, `found ${count} hex goldens in the app KAT (a regex that matched nothing would pass everything)`)
ok(Object.keys(wrkGold).length === count, `the worker KAT declares the same number of hex goldens (${Object.keys(wrkGold).length})`)
const drift = compareGoldens(appGold, wrkGold)
ok(drift.length === 0, `every golden is identical in both repos${drift.length ? ' -- DRIFT: ' + drift.join(', ') : ` (${Object.keys(appGold).sort().join(', ')})`}`)
// ★Falsification: the comparator above is only evidence if it can object.
const nibbled = { ...wrkGold }
const firstName = Object.keys(nibbled).sort()[0]
nibbled[firstName] = (nibbled[firstName][0] === '0' ? '1' : '0') + nibbled[firstName].slice(1)
ok(compareGoldens(appGold, nibbled).length === 1, `the golden comparator DOES object to one flipped nibble (${firstName})`)

console.log(`\n${fail === 0 ? 'ALL PASS' : '★FAILURES'}  pass ${pass} / fail ${fail}`)
process.exitCode = fail === 0 ? 0 : 1
