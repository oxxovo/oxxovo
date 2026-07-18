// Stage 3 Part 4: compose source-clip verify routing.
// Run: node --import ./scripts/test-register.mjs --test lib/studio-verify.stage3.test.ts
// Proves (a) the REGRESSION guarantee -- a parent-less normal video clip takes the
// exact old v1/v1c path -- and (b) the new i2v parent chain rejects tampering.
process.env.STUDIO_CRYPTOBIND_SECRET = 'stage3-test-secret-not-for-prod'

import test from 'node:test'
import assert from 'node:assert/strict'
import { verifySourceClipCrypto } from './studio-verify.ts'
import { buildCryptoBind, buildImageBind, buildImageContentBind, buildI2vBind, computeSourceBundle } from './cryptobind.ts'

const TID = 'season_alpha'
const OTHER_TID = 'season_beta'
const PID = 'user_1'
const AT = new Date('2026-07-18T00:00:00.000Z')
const none = () => undefined

// A normal video clip (v1). Content left null (verifyCryptoBind skips it).
function videoClip(id: string, opts: { tid?: string } = {}) {
  const tid = opts.tid ?? TID
  const b = buildCryptoBind({ jobId: id, pid: PID, tid, modelId: 'kling-v3-pro', durationSeconds: 5, generatedAt: AT })
  return {
    id,
    media_type: 'video',
    parent_image_job_ids: [] as string[],
    model_id: 'kling-v3-pro',
    duration_seconds: 5,
    cryptobind_content_hash: null,
    cryptobind_content_signature: null,
    ...b,
  }
}

function imageParent(id: string, opts: { tid?: string } = {}) {
  const tid = opts.tid ?? TID
  const b = buildImageBind({ jobId: id, pid: PID, tid, modelId: 'ideogram-character', generatedAt: AT })
  const c = buildImageContentBind({ jobId: id, tid, contentHash: 'ab'.repeat(32) })
  return {
    row: {
      id,
      media_type: 'image',
      model_id: 'ideogram-character',
      cryptobind_content_hash: c.cryptobind_content_hash,
      cryptobind_content_signature: c.cryptobind_content_signature,
      ...b,
    },
    signature: b.cryptobind_signature,
  }
}

function i2vClip(id: string, parentIds: string[], parentSignatures: string[]) {
  const parentBundle = computeSourceBundle(parentSignatures)
  const b = buildI2vBind({
    jobId: id, pid: PID, tid: TID, modelId: 'kling-v3-pro-i2v', durationSeconds: 15, generatedAt: AT, parentBundle,
  })
  return {
    id,
    media_type: 'video',
    parent_image_job_ids: parentIds,
    model_id: 'kling-v3-pro-i2v',
    duration_seconds: 15,
    cryptobind_content_hash: null,
    cryptobind_content_signature: null,
    ...b,
  }
}

test('REGRESSION: parent-less normal video clip verifies via the old v1 path', () => {
  const clip = videoClip('vid1')
  let getParentCalled = false
  const r = verifySourceClipCrypto(clip, TID, () => {
    getParentCalled = true
    return undefined
  })
  assert.equal(r.ok, true)
  assert.equal((r as { signature: string }).signature, clip.cryptobind_signature)
  assert.equal(getParentCalled, false) // parent loader must NOT be touched for normal clips
})

test('REGRESSION: tampered normal video clip rejects', () => {
  const clip = videoClip('vid1')
  const r = verifySourceClipCrypto({ ...clip, cryptobind_signature: 'd'.repeat(64) }, TID, none)
  assert.equal(r.ok, false)
})

test('REGRESSION: normal clip from another season rejects on tid', () => {
  const clip = videoClip('vid1', { tid: OTHER_TID })
  const r = verifySourceClipCrypto(clip, TID, none)
  assert.equal(r.ok, false)
  assert.match((r as { detail: string }).detail, /tid_mismatch/)
})

test('i2v happy path: clip + parents verify', () => {
  const p1 = imageParent('img1')
  const p2 = imageParent('img2')
  const clip = i2vClip('vid1', ['img1', 'img2'], [p1.signature, p2.signature])
  const parents: Record<string, any> = { img1: p1.row, img2: p2.row }
  const r = verifySourceClipCrypto(clip, TID, (id) => parents[id])
  assert.equal(r.ok, true)
})

test('i2v TAMPER: parent swap -> parentBundle mismatch', () => {
  const p1 = imageParent('img1')
  const p2 = imageParent('img2')
  const p3 = imageParent('img3')
  const clip = i2vClip('vid1', ['img1', 'img2'], [p1.signature, p2.signature])
  // Attacker swaps a parent row (and its id) after the clip was signed.
  const parents: Record<string, any> = { img1: p1.row, img2: p3.row }
  const r = verifySourceClipCrypto({ ...clip, parent_image_job_ids: ['img1', 'img2'] }, TID, (id) => parents[id])
  assert.equal(r.ok, false)
  assert.match((r as { detail: string }).detail, /parent_bundle_mismatch/)
})

test('i2v TAMPER: missing/external parent (no v1i row) rejects', () => {
  const p1 = imageParent('img1')
  const clip = i2vClip('vid1', ['img1', 'imgX'], [p1.signature, 'external'])
  const parents: Record<string, any> = { img1: p1.row } // imgX not present
  const r = verifySourceClipCrypto(clip, TID, (id) => parents[id])
  assert.equal(r.ok, false)
  assert.match((r as { detail: string }).detail, /not_found/)
})

test('i2v TAMPER: cross-season parent rejects on tid', () => {
  const p1 = imageParent('img1')
  const pBeta = imageParent('img2', { tid: OTHER_TID }) // valid but different season
  const clip = i2vClip('vid1', ['img1', 'img2'], [p1.signature, pBeta.signature])
  const parents: Record<string, any> = { img1: p1.row, img2: pBeta.row }
  const r = verifySourceClipCrypto(clip, TID, (id) => parents[id])
  assert.equal(r.ok, false)
  assert.match((r as { detail: string }).detail, /tid_mismatch/)
})

test('i2v TAMPER: parent image content (v1ic) tamper rejects', () => {
  const p1 = imageParent('img1')
  const p2 = imageParent('img2')
  const clip = i2vClip('vid1', ['img1', 'img2'], [p1.signature, p2.signature])
  const tamperedP2 = { ...p2.row, cryptobind_content_signature: 'c'.repeat(64) }
  const parents: Record<string, any> = { img1: p1.row, img2: tamperedP2 }
  const r = verifySourceClipCrypto(clip, TID, (id) => parents[id])
  assert.equal(r.ok, false)
  assert.match((r as { detail: string }).detail, /content_mismatch/)
})
