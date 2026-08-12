// D -- keyframes. Shared, pure: the GL preview calls valueAt() directly every
// frame; the worker calls toFfmpegExpr() once per segment to build a filter
// parameter string. One interpolation, two engines -- the same reason
// lib/gl-effects.ts's colorUniforms() is shared rather than reimplemented
// per side (a second implementation is a drift point, not a convenience).
//
// ★SCOPE (제니2, 2026-08-10): (a) effect parameters + (c) subtitle opacity.
// (b) position/scale is explicitly OUT -- D is "keyframing an existing
// scalar," not "a new transform coordinate system" (④§3's own list has
// aspect ratio, never camera movement). Interpolation is LINEAR ONLY --
// no easing vocabulary, because an easing enum is signature-visible and
// grows the KAT golden set every time it grows, which head office does not
// want touched before launch. Dense control points approximate easing
// without that cost, and adding easing later is still possible as an
// APPEND (old linear-only tracks keep their exact canonical string).
//
// ★VERIFIED, not assumed (2026-08-10 evening): a 3-control-point piecewise
// expression (nested if(lt(t,...)), nesting built by toFfmpegExpr below) was
// rendered and every sample frame -- including the exact boundary frame and
// both neighbors -- matched a static eq=brightness=<same value> constant at
// that instant to 0.00 difference. The nested-if construct is exact.

/** A single parameter's value over time, within one segment. atMs is
 *  SEGMENT-RELATIVE (0 = the segment's own start), never composition-global --
 *  segments already carry startMs/endMs, and a segment-relative track is the
 *  one representation that survives the segment being moved on the timeline
 *  without every control point needing to shift too. */
export type KeyframeTrack = {
  points: { atMs: number; value: number }[]
}

function sortedPoints(track: KeyframeTrack): { atMs: number; value: number }[] {
  return [...track.points].sort((a, b) => a.atMs - b.atMs)
}

/** Linear value at segment-relative tMs. Clamps to the first/last point
 *  outside the track's own range -- a keyframe track never extrapolates. */
export function valueAt(track: KeyframeTrack, tMs: number): number {
  const pts = sortedPoints(track)
  if (!pts.length) return 0
  if (pts.length === 1 || tMs <= pts[0].atMs) return pts[0].value
  const last = pts[pts.length - 1]
  if (tMs >= last.atMs) return last.value
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    if (tMs >= a.atMs && tMs <= b.atMs) {
      if (b.atMs === a.atMs) return a.value // degenerate: two points at the same instant
      const t = (tMs - a.atMs) / (b.atMs - a.atMs)
      return a.value + (b.value - a.value) * t
    }
  }
  return last.value // unreachable given the sort + bounds above; kept for exhaustiveness
}

/**
 * Segment-relative track -> an ffmpeg expression string usable anywhere a
 * filter takes one (`eq=eval=frame:brightness='<this>'`, etc). segStartSec
 * converts the track's segment-relative atMs into the COMPOSITION-absolute
 * seconds ffmpeg's `t` actually counts in -- `t` is never segment-relative.
 *
 * ★MEASURED, not guessed: the nested if(lt(t,boundary),lerp,...) shape below
 * is the exact construct verified against a static equivalent, frame by
 * frame, including at a control-point boundary. Do not change the nesting
 * shape without re-measuring the same way.
 */
export function toFfmpegExpr(track: KeyframeTrack, segStartSec: number): string {
  const pts = sortedPoints(track)
  if (!pts.length) return '0'
  if (pts.length === 1) return String(pts[0].value)
  const relT = `(t-${segStartSec.toFixed(3)})`
  let expr = String(pts[pts.length - 1].value)
  for (let i = pts.length - 2; i >= 0; i--) {
    const a = pts[i], b = pts[i + 1]
    const localA = (a.atMs / 1000).toFixed(3)
    const localB = (b.atMs / 1000).toFixed(3)
    const lerp =
      b.atMs === a.atMs
        ? String(a.value)
        : `(${a.value}+(${b.value}-${a.value})*(${relT}-${localA})/(${localB}-${localA}))`
    expr = `if(lt(${relT},${localB}),${lerp},${expr})`
  }
  return expr
}

// ===========================================================================
// H -- speed ramp (2026-08-12). Decision ①B (제니2/TK): a ramped segment's
// DISPLAY duration is always endMs-startMs, exactly like a speed:1 segment
// today -- unlike the EXISTING static `speed` scalar (SegmentEffect.speed),
// which fixes SOURCE duration and lets DISPLAY duration vary with speed (see
// the worker's normalizeSegment: trims exactly `(endMs-startMs)` of SOURCE,
// then `setpts=(1/speed)*PTS` re-times that fixed source chunk to a NEW,
// speed-derived display length). H's ramp is not a generalization of that
// field -- it inverts which side is fixed, so it never touches `speed`,
// `speedVideoFilter`, or totalMs. A ramped segment's speed track lives on its
// own field (SegmentEffect.speedRamp in cryptobind.ts) and wins over static
// `speed` if a segment somehow carried both (the editor never offers both).
//
// A speedRamp track is a KeyframeTrack exactly like any effect param: atMs is
// segment-relative DISPLAY ms (0..endMs-startMs), value is the playback-speed
// multiplier at that display instant (1.0 = normal, matching speedVideoFilter's
// convention). Decision ② (linear only) makes speed(τ) piecewise-linear in
// display time, so how much SOURCE a display-window [0,tMs] consumes is the
// definite integral of a piecewise-linear function -- exact via the trapezoid
// rule evaluated at every real breakpoint plus the two query endpoints, built
// entirely on valueAt() (no parallel interpolation logic to drift from it).
export function integralAt(track: KeyframeTrack, tMs: number): number {
  if (tMs <= 0) return 0
  const pts = sortedPoints(track)
  const inner = pts.map((p) => p.atMs).filter((a) => a > 0 && a < tMs)
  const knots = [0, ...inner, tMs]
  let acc = 0
  for (let i = 0; i < knots.length - 1; i++) {
    const t0 = knots[i]
    const t1 = knots[i + 1]
    if (t1 <= t0) continue
    acc += ((valueAt(track, t0) + valueAt(track, t1)) / 2) * (t1 - t0)
  }
  return acc
}

// The worker needs the OPPOSITE direction from integralAt: ffmpeg trims a
// SOURCE-time-indexed stream (after `-ss`, PTS counts source-elapsed ms from
// the trim point) and setpts must re-time each source frame onto the FIXED
// display window -- i.e. it needs source-ms -> display-ms, the inverse of
// integralAt's display-ms -> source-ms. Because speed is only piecewise-LINEAR
// in DISPLAY time, its integral (source-ms as a function of display-ms) is
// piecewise-QUADRATIC, and a quadratic's true inverse is not expressible in
// toFfmpegExpr's linear-lerp vocabulary (that would be decision ②'s "3. new
// curve vocabulary," explicitly rejected for H same as it was for D).
//
// The fix used here: sample the true (source-ms, display-ms) curve at `steps`
// evenly-spaced DISPLAY-time points per original keyframe interval (not just
// at the original breakpoints -- between two real speed breakpoints, speed
// itself is still ramping, so the true inverse curve is not linear even
// there) and hand toFfmpegExpr a denser KeyframeTrack built from those
// samples. Between two adjacent samples, actual speed varies by only a
// fraction of the interval's total change, so the piecewise-linear chord is
// close to the true curve -- error shrinks as `steps` grows. This is an
// approximation, not an identity like toFfmpegExpr(valueAt-track) is for D;
// SPEED_RAMP_STEPS_PER_INTERVAL below is chosen from a measured round-trip
// error (see edl-keyframes.test.ts's speed-ramp parity block), not guessed.
export const SPEED_RAMP_STEPS_PER_INTERVAL = 8

export function deriveSourceToDisplayTrack(
  track: KeyframeTrack,
  dispMs: number,
  stepsPerInterval: number = SPEED_RAMP_STEPS_PER_INTERVAL,
): KeyframeTrack {
  const pts = sortedPoints(track)
  const boundaries = [0, ...pts.map((p) => p.atMs).filter((a) => a > 0 && a < dispMs), dispMs]
  const displaySamples = new Set<number>([0, dispMs])
  for (let i = 0; i < boundaries.length - 1; i++) {
    const t0 = boundaries[i]
    const t1 = boundaries[i + 1]
    if (t1 <= t0) continue
    for (let s = 1; s < stepsPerInterval; s++) {
      displaySamples.add(t0 + ((t1 - t0) * s) / stepsPerInterval)
    }
    displaySamples.add(t1)
  }
  const sortedDisplayMs = [...displaySamples].sort((a, b) => a - b)
  return {
    points: sortedDisplayMs.map((displayMs) => ({ atMs: integralAt(track, displayMs), value: displayMs })),
  }
}

/** Total source-ms a ramp consumes over its whole (fixed) display window --
 *  the number the editor/server compare against the source clip's real
 *  duration to decide whether the ramp is even legal (see H's decision:
 *  "가속이 소스를 넘으면 편집기가 막는다" -- this is what "exceeds" means). */
export function speedRampSourceConsumedMs(track: KeyframeTrack, dispMs: number): number {
  return integralAt(track, dispMs)
}
