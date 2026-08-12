// Stage 3 CryptoBind v1i/v1ic/v1v -- tamper-rejection regression tests.
// Run: node --conditions=react-server --test lib/cryptobind.stage3.test.ts
// (--conditions=react-server neutralises the `server-only` import; Node strips
//  the TS types natively. The secret is set below before any sign() call.)
process.env.STUDIO_CRYPTOBIND_SECRET = 'stage3-test-secret-not-for-prod'

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildImageBind,
  buildImageContentBind,
  buildI2vBind,
  verifyImageBind,
  verifyI2vBind,
  computeSourceBundle,
} from './cryptobind.ts'

// Cross-repo Known-Answer vectors. The IDENTICAL constants live in the worker
// test (oxxovo-studio/src/cryptobind.stage3.test.ts). If either repo's canonical
// string or algorithm drifts by one byte, one side stops matching -> the v1ic
// silent-failure risk is caught in CI, not in production.
const KAT = {
  secret: 'kat-secret',
  v1i: '043419a5efe3f964bd0bbfbea351c89c8c0a08fc9b27eed6d58905dc28e8e371',
  v1ic: '2f14b1dbb32038046ca1051154eece1e992e024d1c0a829b81118a414bbb9377',
  v1v: '6e6d5c4c83ba025aa622862234220a003077efdc7f28d92649c6227579eb259d',
}

const TID = 'season_alpha'
const OTHER_TID = 'season_beta'
const PID = 'user_1'
const GEN_AT = new Date('2026-07-18T00:00:00.000Z')
const HEX64 = (c: string) => c.repeat(64)

// A platform-generated image job (v1i) + its worker content stamp (v1ic).
function imageJob(jobId: string, opts: { pid?: string; tid?: string; model?: string } = {}) {
  const pid = opts.pid ?? PID
  const tid = opts.tid ?? TID
  const model = opts.model ?? 'ideogram-character'
  const b = buildImageBind({ jobId, pid, tid, modelId: model, generatedAt: GEN_AT })
  const c = buildImageContentBind({ jobId, tid, contentHash: HEX64('a') })
  const row = {
    id: jobId,
    cryptobind_pid: pid,
    cryptobind_tid: tid,
    cryptobind_generated_at: b.cryptobind_generated_at,
    cryptobind_signature: b.cryptobind_signature,
    cryptobind_algo: b.cryptobind_algo,
    model_id: model,
    cryptobind_content_hash: c.cryptobind_content_hash,
    cryptobind_content_signature: c.cryptobind_content_signature,
  }
  return { row, signature: b.cryptobind_signature }
}

// An i2v clip (v1v) bound to the given parent image signatures. Content left
// unstamped here (i2v content uses v1c, exercised by the existing v1/v1c tests).
function i2vJob(jobId: string, parentSignatures: string[], opts: { tid?: string } = {}) {
  const tid = opts.tid ?? TID
  const parentBundle = computeSourceBundle(parentSignatures)
  const b = buildI2vBind({
    jobId, pid: PID, tid, modelId: 'kling-v3-pro-i2v', durationSeconds: 15, generatedAt: GEN_AT, parentBundle,
  })
  const row = {
    id: jobId,
    cryptobind_pid: PID,
    cryptobind_tid: tid,
    cryptobind_generated_at: b.cryptobind_generated_at,
    cryptobind_signature: b.cryptobind_signature,
    cryptobind_algo: b.cryptobind_algo,
    model_id: 'kling-v3-pro-i2v',
    duration_seconds: 15,
    cryptobind_parent_bundle: b.cryptobind_parent_bundle,
    cryptobind_content_hash: null,
    cryptobind_content_signature: null,
  }
  return { row }
}

test('happy path: genuine image + i2v verify ok', () => {
  const p1 = imageJob('img1')
  const p2 = imageJob('img2')
  assert.deepEqual(verifyImageBind(p1.row, TID), { ok: true })
  const v = i2vJob('vid1', [p1.signature, p2.signature])
  assert.deepEqual(verifyI2vBind(v.row, TID, [p1.signature, p2.signature]), { ok: true })
})

test('TAMPER 1 -- parent image swap: bundle recomputed from live parents differs', () => {
  const p1 = imageJob('img1')
  const p2 = imageJob('img2')
  const p3 = imageJob('img3') // attacker substitutes a different image after signing
  const v = i2vJob('vid1', [p1.signature, p2.signature])
  const r = verifyI2vBind(v.row, TID, [p1.signature, p3.signature])
  assert.equal(r.ok, false)
  assert.equal((r as { reason: string }).reason, 'parent_bundle_mismatch')
})

test('TAMPER 2 -- parentBundle forged to match swapped parents: v1v signature still fails', () => {
  const p1 = imageJob('img1')
  const p2 = imageJob('img2')
  const p3 = imageJob('img3')
  const v = i2vJob('vid1', [p1.signature, p2.signature])
  // Attacker rewrites the stored bundle to match the swapped parents so the
  // bundle check would pass -- but cannot re-sign v1v without the secret.
  const forged = { ...v.row, cryptobind_parent_bundle: computeSourceBundle([p1.signature, p3.signature]) }
  const r = verifyI2vBind(forged, TID, [p1.signature, p3.signature])
  assert.equal(r.ok, false)
  assert.equal((r as { reason: string }).reason, 'signature_mismatch')
})

test('TAMPER 3 -- external image (no valid v1i signature) cannot qualify as a parent', () => {
  const p1 = imageJob('img1')
  // An externally-hosted pixel has no platform generation_jobs row / v1i sig.
  // Modelled as a row carrying a bogus signature -> rejected as a parent image.
  const external = { ...p1.row, cryptobind_signature: HEX64('d') }
  const r = verifyImageBind(external, TID)
  assert.equal(r.ok, false)
  assert.equal((r as { reason: string }).reason, 'signature_mismatch')
})

test('TAMPER 4 -- cross-season reference: image + i2v both reject on TID', () => {
  const pAlt = imageJob('imgX', { tid: OTHER_TID }) // valid, but a DIFFERENT season
  const ri = verifyImageBind(pAlt.row, TID)
  assert.equal(ri.ok, false)
  assert.equal((ri as { reason: string }).reason, 'tid_mismatch')

  const p1 = imageJob('img1', { tid: OTHER_TID })
  const p2 = imageJob('img2', { tid: OTHER_TID })
  const vBeta = i2vJob('vidB', [p1.signature, p2.signature], { tid: OTHER_TID })
  const rv = verifyI2vBind(vBeta.row, TID, [p1.signature, p2.signature])
  assert.equal(rv.ok, false)
  assert.equal((rv as { reason: string }).reason, 'tid_mismatch')
})

test('image content tamper (v1ic critical cross-repo path) rejects', () => {
  const p1 = imageJob('img1')
  const tampered = { ...p1.row, cryptobind_content_signature: HEX64('c') }
  const r = verifyImageBind(tampered, TID)
  assert.equal(r.ok, false)
  assert.equal((r as { reason: string }).reason, 'content_mismatch')
})

test('unsupported algo rejects', () => {
  const p1 = imageJob('img1')
  const r = verifyImageBind({ ...p1.row, cryptobind_algo: 'MD5' }, TID)
  assert.equal(r.ok, false)
  assert.equal((r as { reason: string }).reason, 'unsupported_algo')
})

test('KAT: main-app signatures match the cross-repo known-answer vectors', () => {
  const prev = process.env.STUDIO_CRYPTOBIND_SECRET
  process.env.STUDIO_CRYPTOBIND_SECRET = KAT.secret
  try {
    const at = new Date('2026-01-01T00:00:00.000Z')
    assert.equal(
      buildImageBind({ jobId: 'job1', pid: 'p', tid: 't', modelId: 'model1', generatedAt: at }).cryptobind_signature,
      KAT.v1i,
    )
    assert.equal(
      buildImageContentBind({ jobId: 'job1', tid: 't', contentHash: 'ab'.repeat(32) }).cryptobind_content_signature,
      KAT.v1ic,
    )
    assert.equal(
      buildI2vBind({
        jobId: 'job2', pid: 'p', tid: 't', modelId: 'model1', durationSeconds: 15, generatedAt: at,
        parentBundle: 'deadbeefbundle',
      }).cryptobind_signature,
      KAT.v1v,
    )
  } finally {
    process.env.STUDIO_CRYPTOBIND_SECRET = prev
  }
})
