// H speed ramp -- GL preview's scrub/seek math (locateComposition,
// segmentSourceEndMs). Run: node --import ./scripts/test-register.mjs --test app/studio/compose/preview.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { locateComposition, segmentSourceEndMs, type PreviewSegment } from './preview.ts'
import { deriveSourceToDisplayTrack, valueAt, type KeyframeTrack } from '../../../lib/edl-keyframes.ts'

const seg = (over: Partial<PreviewSegment> & { jobId: string; startMs: number; endMs: number }): PreviewSegment => ({
  uid: over.jobId,
  ...over,
})

// ---- plain segments (no speedRamp): byte-identical to before H ------------

test('locateComposition: no ramp, source time advances 1:1 with display time (unchanged)', () => {
  const segs = [seg({ jobId: 'a', startMs: 1000, endMs: 4000 })]
  assert.deepEqual(locateComposition(segs, 0), { idx: 0, videoTimeMs: 1000 })
  assert.deepEqual(locateComposition(segs, 1500), { idx: 0, videoTimeMs: 2500 })
  assert.deepEqual(locateComposition(segs, 3000), { idx: 0, videoTimeMs: 4000 })
})

test('locateComposition: no ramp, past-the-end clamps to the last segment\'s endMs', () => {
  const segs = [seg({ jobId: 'a', startMs: 0, endMs: 2000 })]
  assert.deepEqual(locateComposition(segs, 5000), { idx: 0, videoTimeMs: 2000 })
})

test('segmentSourceEndMs: no ramp is exactly endMs', () => {
  assert.equal(segmentSourceEndMs(seg({ jobId: 'a', startMs: 500, endMs: 3500 })), 3500)
})

// ---- ramped segments --------------------------------------------------------

test('locateComposition: constant-2x ramp consumes source at double the display rate', () => {
  const ramp: KeyframeTrack = { points: [{ atMs: 0, value: 2 }, { atMs: 1000, value: 2 }] }
  const segs = [seg({ jobId: 'a', startMs: 100, endMs: 1100, speedRamp: ramp })]
  assert.deepEqual(locateComposition(segs, 0), { idx: 0, videoTimeMs: 100 })
  assert.deepEqual(locateComposition(segs, 500), { idx: 0, videoTimeMs: 100 + 1000 }, 'half the DISPLAY window in -> a full 1000ms of source at 2x')
})

test('segmentSourceEndMs: a ramp\'s true source end can exceed the display span (1x->3x over 2s consumes 4s)', () => {
  const ramp: KeyframeTrack = { points: [{ atMs: 0, value: 1 }, { atMs: 2000, value: 3 }] }
  const s = seg({ jobId: 'a', startMs: 0, endMs: 2000, speedRamp: ramp })
  assert.equal(segmentSourceEndMs(s), 4000, '(1+3)/2 * 2000 = 4000, the exact trapezoid area H\'s editor/server validate against the clip\'s real length')
})

test('locateComposition threads correctly across multiple segments when an earlier one is ramped', () => {
  // seg A: 0..1000 display, flat 2x ramp -> consumes 2000ms of source.
  // seg B: plain, starts right after A in the COMPOSITION timeline (display-time-based spans, unaffected by A's ramp -- H decision ①B).
  const ramp: KeyframeTrack = { points: [{ atMs: 0, value: 2 }, { atMs: 1000, value: 2 }] }
  const segs = [
    seg({ jobId: 'a', startMs: 0, endMs: 1000, speedRamp: ramp }),
    seg({ jobId: 'b', startMs: 5000, endMs: 6000 }),
  ]
  // compMs=1000 is exactly the boundary -> lands in seg B (compMs < acc+span is false for A, moves to B).
  assert.deepEqual(locateComposition(segs, 1000), { idx: 1, videoTimeMs: 5000 })
  assert.deepEqual(locateComposition(segs, 1500), { idx: 1, videoTimeMs: 5500 }, 'B is unramped -- its own source math is untouched by A\'s ramp')
})

// ---- cross-engine parity: THIS is "①②를 신호상대오차로 재라" at the wiring
// level (Stage 1 already proved the underlying math agrees in the abstract;
// this proves the actual GL-preview entry point (locateComposition, using
// integralAt) and the actual worker entry point (deriveSourceToDisplayTrack,
// which speedRampVideoFilter feeds into toFfmpegExpr) land on the SAME
// source position for the SAME display time, through the real functions
// each side actually calls in production, not a hand re-derivation of them.

test('cross-engine: GL preview\'s locateComposition and the worker\'s derived inverse agree on source position within a frame at many sampled display times', () => {
  const ramp: KeyframeTrack = { points: [{ atMs: 0, value: 0.5 }, { atMs: 1200, value: 2.5 }, { atMs: 3000, value: 1 }] }
  const dispMs = 3000
  const segs = [seg({ jobId: 'a', startMs: 200, endMs: 200 + dispMs, speedRamp: ramp })]
  const inv = deriveSourceToDisplayTrack(ramp, dispMs) // the worker's own engine, unmodified

  const FRAME_FLOOR_MS = 1000 / 24
  let maxErr = 0
  for (let i = 0; i <= 100; i++) {
    const dispElapsed = (dispMs * i) / 100
    // GL preview's real entry point:
    const { videoTimeMs } = locateComposition(segs, dispElapsed)
    const glSourceMs = videoTimeMs - segs[0].startMs
    // Round-trip through the worker's inverse (what its ffmpeg expression would evaluate to):
    const workerDispBack = valueAt(inv, glSourceMs)
    maxErr = Math.max(maxErr, Math.abs(workerDispBack - dispElapsed))
  }
  assert.ok(maxErr < FRAME_FLOOR_MS, `cross-engine round-trip error ${maxErr.toFixed(2)}ms >= 1-frame floor ${FRAME_FLOOR_MS.toFixed(2)}ms`)
})
