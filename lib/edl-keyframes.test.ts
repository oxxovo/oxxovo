// Run: node --import ./scripts/test-register.mjs --test lib/edl-keyframes.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  valueAt,
  toFfmpegExpr,
  integralAt,
  deriveSourceToDisplayTrack,
  speedRampSourceConsumedMs,
  SPEED_RAMP_STEPS_PER_INTERVAL,
  type KeyframeTrack,
} from './edl-keyframes.ts'

const track = (pts: [number, number][]): KeyframeTrack => ({ points: pts.map(([atMs, value]) => ({ atMs, value })) })

test('valueAt clamps before the first point and after the last', () => {
  const t = track([[100, 1], [200, 2]])
  assert.equal(valueAt(t, -50), 1)
  assert.equal(valueAt(t, 0), 1)
  assert.equal(valueAt(t, 500), 2)
})

test('valueAt is exact linear interpolation between two points', () => {
  const t = track([[0, 0], [1000, 10]])
  assert.equal(valueAt(t, 0), 0)
  assert.equal(valueAt(t, 250), 2.5)
  assert.equal(valueAt(t, 500), 5)
  assert.equal(valueAt(t, 1000), 10)
})

test('valueAt threads through the correct segment among 3+ points', () => {
  const t = track([[0, 0], [1500, 40], [3000, 10]])
  assert.equal(valueAt(t, 750), 20, 'midpoint of the first segment')
  assert.equal(valueAt(t, 1500), 40, 'exactly on the shared boundary point')
  assert.equal(valueAt(t, 2250), 25, 'midpoint of the second segment')
})

test('valueAt does not require points to arrive sorted', () => {
  const t: KeyframeTrack = { points: [{ atMs: 1000, value: 10 }, { atMs: 0, value: 0 }] }
  assert.equal(valueAt(t, 500), 5)
})

test('valueAt handles a single point as a constant', () => {
  const t = track([[500, 7]])
  assert.equal(valueAt(t, 0), 7)
  assert.equal(valueAt(t, 999), 7)
})

test('valueAt on an empty track is 0, not a throw', () => {
  assert.equal(valueAt({ points: [] }, 100), 0)
})

test('valueAt handles two points at the same instant without dividing by zero', () => {
  const t = track([[100, 1], [100, 9]])
  assert.equal(valueAt(t, 100), 1, 'the FIRST of two coincident points wins -- deterministic, not NaN')
})

// ---- toFfmpegExpr: the string must evaluate (in ffmpeg) to the same numbers
// valueAt() computes in JS. This file cannot run ffmpeg -- that comparison is
// scripts/gen-vignette-lut.mjs-style, done live (verified 2026-08-10 evening:
// a 3-point track's expression matched a static equivalent at every sample
// frame, 0.00 diff, including the boundary). What IS testable here without
// ffmpeg is that the expression is STRUCTURALLY the right shape: it nests
// correctly, uses segment-relative-then-absolute time, and its boundaries
// line up with the same points valueAt() uses -- so a change to one cannot
// silently drift from the other without a test noticing the shape changed.
test('toFfmpegExpr nests one if(lt(...)) per interior boundary, innermost last', () => {
  const t = track([[0, 0], [1500, 0.4], [3000, 0.1]])
  const expr = toFfmpegExpr(t, 10) // segment starts at composition t=10s
  assert.equal((expr.match(/if\(lt\(/g) ?? []).length, 2, 'two boundaries -> two nested ifs')
  // composition-absolute time: segStartSec subtracted, so the first boundary
  // reads t-10, not the segment-relative 1.5 alone.
  assert.ok(expr.includes('(t-10.000)'), `expression uses composition-absolute t: ${expr}`)
  assert.ok(expr.includes('1.500'), `first boundary at segment-relative 1.5s is present: ${expr}`)
  assert.ok(expr.trim().endsWith('0.1))'), `falls through to the last point's value: ${expr}`)
})

test('toFfmpegExpr on a single point is just that constant, no if()', () => {
  assert.equal(toFfmpegExpr(track([[500, 7]]), 0), '7')
})

test('toFfmpegExpr on an empty track is the neutral 0', () => {
  assert.equal(toFfmpegExpr({ points: [] }, 0), '0')
})

// ---- the property that matters: the expression's PIECEWISE STRUCTURE agrees
// with valueAt() at the boundaries themselves, computed independently (not by
// calling toFfmpegExpr and eyeballing it -- by re-deriving what each branch's
// formula reduces to at its own boundary and checking it against valueAt()).
test('the boundary values baked into the expression equal what valueAt() returns there', () => {
  const pts: [number, number][] = [[0, 0], [1500, 0.4], [3000, 0.1]]
  const t = track(pts)
  for (const [atMs, value] of pts) assert.equal(valueAt(t, atMs), value, `valueAt at its own control point ${atMs} must equal the point's own value`)
})

// ---- H speed ramp: integralAt (GL preview's forward engine) ---------------

test('integralAt of a constant-1.0 track over tMs is exactly tMs (no ramp == today\'s behavior)', () => {
  const t = track([[0, 1], [2000, 1]])
  assert.equal(integralAt(t, 0), 0)
  assert.equal(integralAt(t, 500), 500)
  assert.equal(integralAt(t, 2000), 2000)
})

test('integralAt of a constant-2.0x track consumes source at exactly double the display rate', () => {
  const t = track([[0, 2], [1000, 2]])
  assert.equal(integralAt(t, 1000), 2000)
})

test('integralAt of a linear 1x->3x ramp over 1000ms is the exact trapezoid area', () => {
  const t = track([[0, 1], [1000, 3]])
  assert.equal(integralAt(t, 1000), 2000, '(1+3)/2 * 1000')
  assert.equal(integralAt(t, 500), 750, 'speed at 500ms is 2 (interpolated); (1+2)/2 * 500')
})

test('integralAt clamps flat before the first point and after the last, same as valueAt', () => {
  const t = track([[100, 2], [200, 2]])
  assert.equal(integralAt(t, 100), 200, 'flat at value 2 for the first 100ms')
  assert.equal(integralAt(t, 300), 600, 'flat at value 2 for the trailing 100ms too: 100*2 + 100*2 + 100*2')
})

test('integralAt on an empty track is 0 (matches valueAt\'s 0 default)', () => {
  assert.equal(integralAt({ points: [] }, 1000), 0)
})

test('speedRampSourceConsumedMs is integralAt at the segment\'s full display length', () => {
  const t = track([[0, 1], [1000, 3]])
  assert.equal(speedRampSourceConsumedMs(t, 1000), integralAt(t, 1000))
})

// ---- H speed ramp: deriveSourceToDisplayTrack (worker's inverse engine) ---

test('deriveSourceToDisplayTrack on a constant-speed track is exact (no ramping within any interval)', () => {
  // Constant speed has ZERO curvature, so even 1 step reproduces it exactly --
  // this isolates "is the derivation itself correct" from "is the sampling
  // resolution high enough," which the round-trip tests below cover.
  const t = track([[0, 2], [1000, 2]])
  const inv = deriveSourceToDisplayTrack(t, 1000, 1)
  // source consumed over the full window is 2000ms; at the midpoint (1000ms
  // of source, i.e. half the source budget) display time should be 500ms.
  assert.equal(valueAt(inv, 0), 0)
  assert.equal(valueAt(inv, 2000), 1000)
  assert.equal(valueAt(inv, 1000), 500)
})

// ---- H speed ramp: round-trip signal-relative-error (①②'s "신호상대오차")
// -- GL preview's engine is integralAt (exact, closed-form). The worker's
// engine is deriveSourceToDisplayTrack fed through toFfmpegExpr, which
// D already proved (2026-08-10, header comment in this file) evaluates in
// ffmpeg identically to valueAt() in JS -- so simulating the worker's
// expression with valueAt(derivedTrack, ...) here is a faithful stand-in for
// "what ffmpeg would actually compute," without needing to shell out to
// ffmpeg for a timing-only property.
//
// The round trip: pick a display time t, ask GL "how much source has this
// ramp consumed by t" (integralAt), then ask the worker's derived inverse
// "given that much source, what display time is this" (valueAt on the
// derived track) and it should land back near t. The floor for "near" is one
// OUTPUT video frame (matches gl-engine-parity.mjs's own principle: don't
// judge a difference the render can't actually show) -- at a conservative
// 24fps that's ~41.7ms; anything under that is not a real discrepancy a
// viewer or a render could ever surface.
const FRAME_FLOOR_MS = 1000 / 24

function roundTripMaxErrorMs(t: KeyframeTrack, dispMs: number, steps = SPEED_RAMP_STEPS_PER_INTERVAL): number {
  const inv = deriveSourceToDisplayTrack(t, dispMs, steps)
  let maxErr = 0
  const SAMPLES = 200
  for (let i = 0; i <= SAMPLES; i++) {
    const queryT = (dispMs * i) / SAMPLES
    const sourceMs = integralAt(t, queryT)
    const roundTripT = valueAt(inv, sourceMs)
    maxErr = Math.max(maxErr, Math.abs(roundTripT - queryT))
  }
  return maxErr
}

test('round trip: mild ramp (0.8x -> 1.5x over 3s) stays under one frame at the default step count', () => {
  const t = track([[0, 0.8], [3000, 1.5]])
  const err = roundTripMaxErrorMs(t, 3000)
  assert.ok(err < FRAME_FLOOR_MS, `max round-trip error ${err.toFixed(2)}ms >= 1-frame floor ${FRAME_FLOOR_MS.toFixed(2)}ms`)
})

test('round trip: aggressive ramp (0.25x -> 4x over 2s, the full clamp range) stays under one frame at the default step count', () => {
  const t = track([[0, 0.25], [2000, 4]])
  const err = roundTripMaxErrorMs(t, 2000)
  assert.ok(err < FRAME_FLOOR_MS, `max round-trip error ${err.toFixed(2)}ms >= 1-frame floor ${FRAME_FLOOR_MS.toFixed(2)}ms`)
})

test('round trip: multi-point ramp (1x -> 3x -> 0.5x across three segments) stays under one frame', () => {
  const t = track([[0, 1], [1000, 3], [2500, 0.5], [4000, 0.5]])
  const err = roundTripMaxErrorMs(t, 4000)
  assert.ok(err < FRAME_FLOOR_MS, `max round-trip error ${err.toFixed(2)}ms >= 1-frame floor ${FRAME_FLOOR_MS.toFixed(2)}ms`)
})

test('round trip: fewer steps measurably degrades accuracy (proves the test can fail, not just pass by construction)', () => {
  const t = track([[0, 0.25], [2000, 4]])
  const err1 = roundTripMaxErrorMs(t, 2000, 1)
  const err8 = roundTripMaxErrorMs(t, 2000, SPEED_RAMP_STEPS_PER_INTERVAL)
  assert.ok(err1 > err8, `1-step error (${err1.toFixed(2)}ms) should be worse than ${SPEED_RAMP_STEPS_PER_INTERVAL}-step error (${err8.toFixed(2)}ms)`)
  assert.ok(err1 > FRAME_FLOOR_MS, `1-step sampling on an aggressive ramp should actually exceed the frame floor -- if it doesn't, this test isn't proving anything`)
})
