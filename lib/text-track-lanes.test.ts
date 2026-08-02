import test from 'node:test'
import assert from 'node:assert/strict'
import { assignLanes, laneCount, type LaneWindow } from './text-track-lanes'

const w = (startMs: number, endMs: number): LaneWindow => ({ startMs, endMs })

// The invariant the caption track exists for, checked directly rather than
// through the lane numbers: no two windows that overlap in time may end up on
// the same row, because the later one would be drawn under the earlier one and
// simply not be there.
function assertNoOverlapWithinLane(windows: LaneWindow[], lanes: number[]): void {
  for (let a = 0; a < windows.length; a++) {
    for (let b = a + 1; b < windows.length; b++) {
      if (lanes[a] !== lanes[b]) continue
      const overlap = windows[a].startMs < windows[b].endMs && windows[b].startMs < windows[a].endMs
      assert.equal(
        overlap,
        false,
        `windows ${a} (${windows[a].startMs}..${windows[a].endMs}) and ${b} ` +
          `(${windows[b].startMs}..${windows[b].endMs}) overlap but share lane ${lanes[a]}`,
      )
    }
  }
}

test('a plain sequence stays on one lane', () => {
  // Back-to-back captions are the common case; stacking them would make an
  // ordinary sequence look like overlapping layers.
  const ws = [w(0, 1000), w(1000, 2000), w(2000, 3000)]
  assert.deepEqual(assignLanes(ws), [0, 0, 0])
  assert.equal(laneCount(assignLanes(ws)), 1)
})

test('touching windows share a lane; overlapping ones do not', () => {
  assert.deepEqual(assignLanes([w(0, 1000), w(1000, 2000)]), [0, 0])
  assert.deepEqual(assignLanes([w(0, 1000), w(999, 2000)]), [0, 1])
})

test('overlapping windows never share a lane', () => {
  const cases: LaneWindow[][] = [
    [w(0, 1000), w(500, 1500), w(900, 2000)],
    [w(0, 5000), w(100, 200), w(150, 250), w(4900, 6000)],
    // Input deliberately not sorted by start.
    [w(3000, 4000), w(0, 3500), w(1000, 1200), w(1100, 1300)],
    // Fully contained inside another.
    [w(0, 10_000), w(2000, 3000), w(2500, 2600)],
  ]
  for (const ws of cases) assertNoOverlapWithinLane(ws, assignLanes(ws))
})

test('lanes are returned in INPUT order, not sorted order', () => {
  // The caller indexes this with the same index it uses for the layer, so a
  // result in sorted order would silently attach bars to the wrong rows.
  const ws = [w(2000, 3000), w(0, 1000), w(500, 2500)]
  const lanes = assignLanes(ws)
  assert.equal(lanes.length, 3)
  assert.equal(lanes[1], 0, 'the earliest window takes the first lane')
  assert.notEqual(lanes[1], lanes[2], 'w(0,1000) and w(500,2500) overlap')
  assertNoOverlapWithinLane(ws, lanes)
})

test('equal starts keep input order, so adding a layer does not reshuffle', () => {
  const ws = [w(1000, 2000), w(1000, 3000), w(1000, 1500)]
  assert.deepEqual(assignLanes(ws), [0, 1, 2])
})

test('uses the fewest lanes the overlaps require', () => {
  // Three mutually overlapping windows need three lanes; two disjoint pairs need
  // two. A packer that just used one lane per window would pass the overlap
  // invariant and still be wrong.
  assert.equal(laneCount(assignLanes([w(0, 3000), w(1000, 4000), w(2000, 5000)])), 3)
  assert.equal(laneCount(assignLanes([w(0, 1000), w(500, 1500), w(2000, 3000), w(2500, 3500)])), 2)
})

test('an empty track still reports one lane', () => {
  // Otherwise the track's height computes from 0 lanes and the row collapses.
  assert.deepEqual(assignLanes([]), [])
  assert.equal(laneCount([]), 1)
})

test('a mid-drag NaN produces a layout, not an exception', () => {
  // assignLanes runs during render while a pointer drag mutates the window. An
  // exception here unmounts the timeline; a boring answer does not.
  const ws = [w(0, 1000), { startMs: NaN, endMs: 500 } as LaneWindow, w(2000, 3000)]
  const lanes = assignLanes(ws)
  assert.equal(lanes.length, 3)
  for (const l of lanes) assert.ok(Number.isInteger(l) && l >= 0)
})

test('a backwards window cannot let a later overlapping one hide under it', () => {
  // endMs < startMs occupies nothing. Clamped, so it cannot pull a lane's end
  // backwards and admit a window that really does overlap its neighbour.
  const ws = [w(0, 5000), w(3000, 1000), w(3100, 4000)]
  assertNoOverlapWithinLane(ws, assignLanes(ws))
})
