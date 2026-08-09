// Splitting one timeline clip into two. PURE -- no React, no DB, so the rule is
// executed by tests instead of eyeballed through a component. Same reason
// lib/text-track-lanes.ts, lib/music-picker-scope.ts and lib/music-curation-order.ts
// exist.
//
// ★WHAT A SPLIT IS HERE. `startMs`/`endMs` on a segment are a TRIM INSIDE THE SOURCE
// CLIP (the server refuses `endMs > duration + 1`), and composition time is the running
// sum of `endMs - startMs`. So a split replaces one segment with two adjacent segments
// that share the same `jobId`:
//
//   before  [{jobId:A, startMs:0,    endMs:4000}]
//   after   [{jobId:A, startMs:0,    endMs:1500},
//            {jobId:A, startMs:1500, endMs:4000}]     <- cut at source ms 1500
//
// ★THE CUT POINT IS NOT A JUDGEMENT CALL, and measuring is what settled that. `speed`
// is live (0.25-4x per clip, signature-visible as `;spd=`), so source-time vs
// timeline-time looked like the open question. It is not: the editor's totalMs, its clip
// widths and its segment starts ALL compute length as `endMs - startMs`, and so does
// the server's createRender. Editor and server share one speed-blind model, so
// composition time maps 1:1 onto source trim and the mapping is forced --
// `segmentStartsMs` below is that model, in one place, tested.
// ★That speed does not affect length is a SEPARATE matter and is deliberately not
// touched here: changing it moves totalMs, the min/max duration gates, the signature
// and the KAT goldens at once.
//
// ★SIGNATURE. `segCanonical` serialises segments POSITIONALLY with no count field, so a
// split adds one `|`-joined entry: no new field, no new section, no APPEND-ONLY
// question, and the KAT goldens are untouched. Zero worker changes -- several segments
// sharing one jobId is already a live path (e2e/reachability-queued-submit.mjs reuses
// demo clips to reach the season's minimum length).
// ★The signature OF a split composition does of course differ; it is a different
// timeline. Without that distinction the next reader concludes splits do not re-sign.
//
// ★AND A SPLIT PRESERVES TOTAL DURATION -- (1500-0) + (4000-1500) === (4000-0). That is
// what makes it cheap: texts and the music bed are addressed in COMPOSITION time, and
// the min/max duration gates read the same total, so all of them are untouched by
// construction rather than by care. lib/edl-split.test.ts asserts it instead of this
// comment claiming it.

/** Only the fields the split rule needs. The editor's Segment is a superset. */
export type SplitSegment = {
  uid: string
  jobId: string
  startMs: number
  endMs: number
}

export type SplitTransition = { afterIndex: number; type: string; durationMs: number }

/**
 * ★Smallest piece a split may leave, on either side.
 *
 * The server only requires `endMs > startMs`, which permits a 1ms sliver -- a clip
 * nobody can see, grab or trim, produced by a control that reported success.
 *
 * ★120ms IS NOT A SOURCED NUMBER. It is roughly 3-4 frames at 30fps, and the honest
 * reason is "the smallest piece a hand can still grab on the timeline". There is no
 * measurement behind it, so it is ONE constant with that said out loud rather than a
 * threshold sprinkled through the UI.
 */
export const MIN_SPLIT_MS = 120

export type SplitReason =
  /** index is not a segment */
  | 'index'
  /** the cap counts SEGMENTS, and a split adds one */
  | 'too_many_clips'
  /** the cut is not strictly inside the segment */
  | 'cut_outside'
  /** one of the two pieces would be shorter than MIN_SPLIT_MS */
  | 'too_short'

export type SplitResult<S, T> =
  | { ok: true; segments: S[]; transitions: T[]; selectUid: string }
  | { ok: false; reason: SplitReason }

/**
 * Composition start time of each segment. Speed-blind, matching the editor and the
 * server (see the header).
 */
export function segmentStartsMs(segments: readonly SplitSegment[]): number[] {
  const out: number[] = []
  let acc = 0
  for (const s of segments) {
    out.push(acc)
    acc += Math.max(0, s.endMs - s.startMs)
  }
  return out
}

/** Total composition length, the same sum the server's createRender computes. */
export function totalCompositionMs(segments: readonly SplitSegment[]): number {
  return segments.reduce((a, s) => a + Math.max(0, s.endMs - s.startMs), 0)
}

/**
 * Which segment the playhead is over, and the SOURCE ms that composition time maps to.
 *
 * Returns null when the playhead is not strictly inside a segment -- exactly on a
 * boundary there is nothing to cut, and past the end there is no segment.
 */
export function splitPointFromPlayhead(
  segments: readonly SplitSegment[],
  playheadMs: number,
): { index: number; sourceCutMs: number } | null {
  if (!Number.isFinite(playheadMs)) return null
  const starts = segmentStartsMs(segments)
  const p = Math.round(playheadMs)
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]
    const span = Math.max(0, s.endMs - s.startMs)
    const from = starts[i]
    const to = from + span
    // strictly inside: a cut ON a boundary splits nothing
    if (p > from && p < to) return { index: i, sourceCutMs: s.startMs + (p - from) }
  }
  return null
}

/**
 * Split `segments[index]` at `sourceCutMs`, shifting transitions to follow.
 *
 * ★TRANSITIONS MUST MOVE, and this is the silent one. `afterIndex` is a POSITION
 * ("between segment k and k+1"). Splitting at `index` inserts a segment, so:
 *
 *   afterIndex <  index   unchanged
 *   afterIndex >= index   +1
 *
 * ★The `afterIndex === index` case is why. That transition sat between the original
 * segment and the NEXT one. Left alone it would move to the boundary the split just
 * created -- putting a dissolve in the middle of what used to be one clip, and taking
 * it off the boundary it was authored for. No error, no warning, and the creator would
 * only notice on the rendered final.
 *
 * ★No transition is created at the new boundary: a split is a CUT. Inserting a dissolve
 * would put something in the picture, and in the signature, that nobody asked for.
 *
 * Validation order is index -> cap -> cut -> length: the cap is a hard bound that does
 * not depend on where the cut falls, so it answers first and stays actionable.
 */
export function splitSegmentAt<S extends SplitSegment, T extends SplitTransition>(
  segments: readonly S[],
  transitions: readonly T[],
  index: number,
  sourceCutMs: number,
  opts: { maxClips: number; newUid: () => string },
): SplitResult<S, T> {
  if (!Number.isInteger(index) || index < 0 || index >= segments.length) return { ok: false, reason: 'index' }

  // ★DECISION A (approved 2026-08-08): the clip cap counts SEGMENTS, so a split spends
  // a slot. The server is the authority (`segments.length > maxClips` ->
  // too_many_clips), and disagreeing here would let the editor build a timeline the
  // server then refuses. If head office ever makes splits free, that is a server rule
  // change plus a cap re-confirmation -- this UI is unchanged by it.
  if (segments.length + 1 > opts.maxClips) return { ok: false, reason: 'too_many_clips' }

  const seg = segments[index]
  const cut = Math.round(sourceCutMs)
  if (!Number.isFinite(cut) || cut <= seg.startMs || cut >= seg.endMs) return { ok: false, reason: 'cut_outside' }
  if (cut - seg.startMs < MIN_SPLIT_MS || seg.endMs - cut < MIN_SPLIT_MS) return { ok: false, reason: 'too_short' }

  // ★Both halves inherit speed / effects / fit identically. A split means "cut this
  // clip in two", not "reset the grade" -- the spread carries every field the editor
  // has, including ones added later, so this does not need revisiting per feature.
  const first: S = { ...seg, endMs: cut }
  const secondUid = opts.newUid()
  const second: S = { ...seg, uid: secondUid, startMs: cut }

  const nextSegments = [...segments.slice(0, index), first, second, ...segments.slice(index + 1)]
  const nextTransitions = transitions.map((tr) =>
    tr.afterIndex >= index ? ({ ...tr, afterIndex: tr.afterIndex + 1 } as T) : tr,
  )

  // The playhead sits at the start of the second piece, so that is what gets selected.
  return { ok: true, segments: nextSegments, transitions: nextTransitions, selectUid: secondUid }
}
