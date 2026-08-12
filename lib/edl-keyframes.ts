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
