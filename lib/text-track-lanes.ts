// Lane packing for the compose timeline's caption track. PURE -- no React, no
// DOM, no DB, so the rule can be executed by tests instead of eyeballed.
//
// ★WHY THIS IS THE CORRECTNESS OF THE FEATURE, not decoration. The caption track
// exists to show EVERY text layer's show window on one time axis at once
// (interpretation A: several layers, each with one window). If two overlapping
// windows land in the same lane they draw on top of each other, and the second
// one is simply invisible -- the participant sees one caption where they have
// two, moves the wrong bar, and nothing anywhere reports a problem. So "no two
// overlapping windows share a lane" is the feature working, and it is the one
// thing here worth a test.
//
// Extracted from TextTrack.tsx (2026-08-02) for exactly that reason. The
// component keeps the drag/render; this keeps the rule.

/** The minimum a window must have to count as a window. Mirrors TextTrack's
 *  drag clamp; a zero-width window would otherwise "not overlap" anything and
 *  could be packed under a neighbour. */
export type LaneWindow = { startMs: number; endMs: number }

/**
 * Which lane each window goes in, returned in the INPUT order (so the caller can
 * index it with the same index it uses for the layer itself).
 *
 * Greedy first-fit over windows sorted by start: a window takes the first lane
 * whose last occupant has already ended. That is the standard interval-packing
 * result and it uses the fewest lanes possible for a set of intervals.
 *
 * ★Touching is not overlapping. A window starting exactly when another ends
 * (`end <= start`) shares the lane -- captions cut back to back constantly, and
 * putting them on separate rows would make a plain sequence look like a stack.
 *
 * ★Non-finite values are treated as 0 rather than thrown on. This runs during
 * render on state a drag is actively mutating; a NaN mid-gesture must produce a
 * boring layout, not an exception that unmounts the timeline.
 */
export function assignLanes(windows: readonly LaneWindow[]): number[] {
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  const order = windows
    .map((w, i) => ({ i, start: num(w?.startMs), end: num(w?.endMs) }))
    // Stable on equal starts: the earlier layer keeps the upper lane, so adding a
    // layer never reshuffles the ones already on screen.
    .sort((a, b) => a.start - b.start || a.i - b.i)

  const laneEnd: number[] = []
  const lane = new Array<number>(windows.length).fill(0)
  for (const w of order) {
    // A window whose end precedes its start occupies nothing; clamp so it cannot
    // shrink a lane's end and let a later overlapping window slide in under it.
    const end = Math.max(w.end, w.start)
    let k = laneEnd.findIndex((e) => e <= w.start)
    if (k < 0) k = laneEnd.length
    laneEnd[k] = end
    lane[w.i] = k
  }
  return lane
}

/** How many lanes `assignLanes` used. At least 1, so an empty track still has a
 *  row's height instead of collapsing to nothing. */
export function laneCount(lanes: readonly number[]): number {
  return Math.max(1, ...lanes.map((l) => l + 1))
}
