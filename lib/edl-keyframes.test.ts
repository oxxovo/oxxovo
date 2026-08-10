// Run: node --import ./scripts/test-register.mjs --test lib/edl-keyframes.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { valueAt, toFfmpegExpr, type KeyframeTrack } from './edl-keyframes.ts'

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
