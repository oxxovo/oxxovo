// Run: node --import ./scripts/test-register.mjs --test lib/edl-split.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MIN_SPLIT_MS,
  segmentStartsMs,
  totalCompositionMs,
  splitPointFromPlayhead,
  splitSegmentAt,
} from './edl-split.ts'

type Seg = {
  uid: string
  jobId: string
  startMs: number
  endMs: number
  speed?: number
  effects?: Record<string, unknown>
  fit?: 'contain' | 'cover'
}

const seg = (uid: string, jobId: string, startMs: number, endMs: number, extra: Partial<Seg> = {}): Seg => ({
  uid, jobId, startMs, endMs, ...extra,
})
const tr = (afterIndex: number, type = 'crossfade', durationMs = 500) => ({ afterIndex, type, durationMs })

let uidN = 0
const newUid = () => `u${++uidN}`
const opts = (maxClips = 10) => ({ maxClips, newUid })

// A 3-clip timeline: 0-4000, 4000-7000, 7000-9000 in composition time.
const THREE = [seg('a', 'A', 0, 4000), seg('b', 'B', 500, 3500), seg('c', 'C', 1000, 3000)]

// ---- the speed-blind mapping (one place, tested) -------------------------
test('segment starts are the running sum of endMs - startMs (speed-blind, like the server)', () => {
  assert.deepEqual(segmentStartsMs(THREE), [0, 4000, 7000])
  assert.equal(totalCompositionMs(THREE), 9000)
})

test('★speed does NOT change the mapping -- the editor and the server both ignore it', () => {
  const fast = [seg('a', 'A', 0, 4000, { speed: 2 }), seg('b', 'B', 0, 2000, { speed: 0.5 })]
  assert.deepEqual(segmentStartsMs(fast), [0, 4000])
  assert.equal(totalCompositionMs(fast), 6000)
})

test('the playhead maps to a source ms inside the segment it is over', () => {
  assert.deepEqual(splitPointFromPlayhead(THREE, 1500), { index: 0, sourceCutMs: 1500 })
  // segment b is trimmed: composition 4000 is source 500
  assert.deepEqual(splitPointFromPlayhead(THREE, 5000), { index: 1, sourceCutMs: 1500 })
  assert.deepEqual(splitPointFromPlayhead(THREE, 8000), { index: 2, sourceCutMs: 2000 })
})

test('★a playhead exactly ON a boundary splits nothing', () => {
  assert.equal(splitPointFromPlayhead(THREE, 0), null)
  assert.equal(splitPointFromPlayhead(THREE, 4000), null) // boundary a|b
  assert.equal(splitPointFromPlayhead(THREE, 7000), null) // boundary b|c
  assert.equal(splitPointFromPlayhead(THREE, 9000), null) // the very end
  assert.equal(splitPointFromPlayhead(THREE, 99999), null)
  assert.equal(splitPointFromPlayhead([], 100), null)
  assert.equal(splitPointFromPlayhead(THREE, NaN), null)
})

// ---- ① length preservation, ASSERTED rather than claimed -----------------
test('★① a split PRESERVES total composition duration', () => {
  const before = totalCompositionMs(THREE)
  const r = splitSegmentAt(THREE, [], 0, 1500, opts())
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(totalCompositionMs(r.segments), before)
  assert.equal(r.segments.length, THREE.length + 1)
})

test('★① duration is preserved at every legal cut of every segment', () => {
  const before = totalCompositionMs(THREE)
  for (let i = 0; i < THREE.length; i++) {
    const s = THREE[i]
    for (let cut = s.startMs + MIN_SPLIT_MS; cut <= s.endMs - MIN_SPLIT_MS; cut += 137) {
      const r = splitSegmentAt(THREE, [], i, cut, opts())
      assert.equal(r.ok, true, `cut ${cut} in segment ${i}`)
      if (!r.ok) continue
      assert.equal(totalCompositionMs(r.segments), before, `cut ${cut} in segment ${i} changed the total`)
    }
  }
})

test('the two pieces are CONTIGUOUS in source and stay inside the original range', () => {
  const r = splitSegmentAt(THREE, [], 1, 1500, opts())
  assert.equal(r.ok, true)
  if (!r.ok) return
  const [a, b] = [r.segments[1], r.segments[2]]
  assert.equal(a.endMs, b.startMs, 'no gap and no overlap at the cut')
  assert.equal(a.startMs, THREE[1].startMs)
  assert.equal(b.endMs, THREE[1].endMs)
  assert.equal(a.jobId, b.jobId, 'both pieces are the same source clip')
})

test('the second piece gets a NEW uid and the first keeps the original', () => {
  const r = splitSegmentAt(THREE, [], 0, 1500, opts())
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.segments[0].uid, 'a')
  assert.notEqual(r.segments[1].uid, 'a')
  assert.equal(r.selectUid, r.segments[1].uid, 'the playhead sits at the second piece')
  assert.equal(new Set(r.segments.map((s) => s.uid)).size, r.segments.length, 'uids stay unique')
})

// ---- ② transition shift, BOTH directions --------------------------------
test('★② transitions at afterIndex >= i shift +1, and those below i do NOT move', () => {
  const four = [...THREE, seg('d', 'D', 0, 2000)]
  // boundaries: 0|1, 1|2, 2|3
  const transitions = [tr(0, 'crossfade'), tr(1, 'wipe-left'), tr(2, 'circle')]
  const r = splitSegmentAt(four, transitions, 1, 1500, opts())
  assert.equal(r.ok, true)
  if (!r.ok) return
  const byType = Object.fromEntries(r.transitions.map((x) => [x.type, x.afterIndex]))
  assert.equal(byType['crossfade'], 0, 'afterIndex 0 < i=1 must NOT move')
  assert.equal(byType['wipe-left'], 2, 'afterIndex 1 === i must shift to 2')
  assert.equal(byType['circle'], 3, 'afterIndex 2 > i must shift to 3')
})

test('★②the afterIndex === i transition does NOT end up on the new internal boundary', () => {
  // This is the silent failure the design named: a transition authored for the
  // boundary between segment i and i+1 must not migrate into the middle of the clip
  // that was just cut.
  const r = splitSegmentAt(THREE, [tr(0, 'crossfade')], 0, 1500, opts())
  assert.equal(r.ok, true)
  if (!r.ok) return
  const newInternalBoundary = 0 // between r.segments[0] and r.segments[1]
  assert.ok(
    !r.transitions.some((x) => x.afterIndex === newInternalBoundary),
    'a transition is sitting inside the clip that was just split',
  )
  assert.deepEqual(r.transitions.map((x) => x.afterIndex), [1])
})

test('★no transition is CREATED at the new boundary -- a split is a cut', () => {
  const r = splitSegmentAt(THREE, [], 0, 1500, opts())
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.deepEqual(r.transitions, [], 'the split invented a transition')
})

test('transition type and duration are carried through unchanged', () => {
  const r = splitSegmentAt(THREE, [tr(2, 'dip-to-black', 750)], 0, 1500, opts())
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.deepEqual(r.transitions, [{ afterIndex: 3, type: 'dip-to-black', durationMs: 750 }])
})

test('the input arrays are not mutated', () => {
  const segsBefore = JSON.stringify(THREE)
  const transitions = [tr(1)]
  const trBefore = JSON.stringify(transitions)
  splitSegmentAt(THREE, transitions, 0, 1500, opts())
  assert.equal(JSON.stringify(THREE), segsBefore)
  assert.equal(JSON.stringify(transitions), trBefore)
})

// ---- inheritance --------------------------------------------------------
test('both pieces inherit speed / effects / fit identically', () => {
  const styled = [seg('a', 'A', 0, 4000, { speed: 1.5, effects: { contrast: 20 }, fit: 'cover' })]
  const r = splitSegmentAt(styled, [], 0, 2000, opts())
  assert.equal(r.ok, true)
  if (!r.ok) return
  for (const piece of r.segments) {
    assert.equal(piece.speed, 1.5)
    assert.deepEqual(piece.effects, { contrast: 20 })
    assert.equal(piece.fit, 'cover')
  }
})

// ---- ③ the cap boundary, BOTH directions --------------------------------
test('★③ at maxClips-1 the split PASSES; at maxClips it is REFUSED', () => {
  const mk = (n: number) => Array.from({ length: n }, (_, i) => seg(`u${i}`, 'A', 0, 4000))
  // 9 segments + a split = 10 = the cap -> allowed
  const nine = splitSegmentAt(mk(9), [], 0, 1500, opts(10))
  assert.equal(nine.ok, true, 'a 9-segment timeline must still be splittable')
  if (nine.ok) assert.equal(nine.segments.length, 10)
  // 10 segments + a split = 11 > the cap -> refused
  const ten = splitSegmentAt(mk(10), [], 0, 1500, opts(10))
  assert.equal(ten.ok, false)
  if (!ten.ok) assert.equal(ten.reason, 'too_many_clips')
})

test('★③ the cap the editor enforces is the one the SERVER enforces (segments > maxClips)', () => {
  // createRender refuses `segments.length > maxClips`, so a result of exactly maxClips
  // must be accepted here -- an editor stricter than the server would forbid a legal
  // timeline, and a looser one would build a timeline the server then rejects.
  const mk = (n: number) => Array.from({ length: n }, (_, i) => seg(`u${i}`, 'A', 0, 4000))
  for (const cap of [2, 3, 10]) {
    const ok = splitSegmentAt(mk(cap - 1), [], 0, 1500, opts(cap))
    assert.equal(ok.ok, true, `cap ${cap}: ${cap - 1} segments must be splittable`)
    if (ok.ok) assert.equal(ok.segments.length, cap)
    const no = splitSegmentAt(mk(cap), [], 0, 1500, opts(cap))
    assert.equal(no.ok, false, `cap ${cap}: ${cap} segments must be refused`)
  }
})

// ---- refusals -----------------------------------------------------------
test('a bad index is refused', () => {
  for (const i of [-1, 3, 1.5, NaN]) {
    const r = splitSegmentAt(THREE, [], i as number, 1500, opts())
    assert.equal(r.ok, false, `index ${i}`)
    if (!r.ok) assert.equal(r.reason, 'index')
  }
})

test('a cut on or outside the segment bounds is refused', () => {
  const s = THREE[1] // 500..3500
  for (const cut of [s.startMs, s.endMs, s.startMs - 1, s.endMs + 1, 0, NaN]) {
    const r = splitSegmentAt(THREE, [], 1, cut, opts())
    assert.equal(r.ok, false, `cut ${cut}`)
    if (!r.ok) assert.ok(r.reason === 'cut_outside' || r.reason === 'too_short', `got ${r.reason}`)
  }
})

test('★a piece shorter than MIN_SPLIT_MS is refused on EITHER side', () => {
  const s = THREE[0] // 0..4000
  const head = splitSegmentAt(THREE, [], 0, s.startMs + MIN_SPLIT_MS - 1, opts())
  assert.equal(head.ok, false)
  if (!head.ok) assert.equal(head.reason, 'too_short')
  const tail = splitSegmentAt(THREE, [], 0, s.endMs - MIN_SPLIT_MS + 1, opts())
  assert.equal(tail.ok, false)
  if (!tail.ok) assert.equal(tail.reason, 'too_short')
  // and exactly at the minimum, both sides are allowed
  assert.equal(splitSegmentAt(THREE, [], 0, s.startMs + MIN_SPLIT_MS, opts()).ok, true)
  assert.equal(splitSegmentAt(THREE, [], 0, s.endMs - MIN_SPLIT_MS, opts()).ok, true)
})

test('★splitting the same point twice is refused -- no zero-length piece', () => {
  const r1 = splitSegmentAt(THREE, [], 0, 1500, opts())
  assert.equal(r1.ok, true)
  if (!r1.ok) return
  // the new boundary is now at source 1500 for BOTH pieces; cutting there again would
  // leave an empty piece on one side.
  const again = splitSegmentAt(r1.segments, r1.transitions, 0, 1500, opts())
  assert.equal(again.ok, false)
  if (!again.ok) assert.equal(again.reason, 'cut_outside')
})

test('a segment too short to split at all is refused, whatever the cut', () => {
  const tiny = [seg('a', 'A', 0, MIN_SPLIT_MS * 2 - 1)]
  for (let cut = 1; cut < tiny[0].endMs; cut++) {
    assert.equal(splitSegmentAt(tiny, [], 0, cut, opts()).ok, false, `cut ${cut}`)
  }
})

// ---- the cap is checked before the cut ----------------------------------
test('at the cap the answer is the CAP, not the cut -- the actionable one wins', () => {
  const mk = (n: number) => Array.from({ length: n }, (_, i) => seg(`u${i}`, 'A', 0, 4000))
  const r = splitSegmentAt(mk(10), [], 0, 1, opts(10)) // cut is also illegal
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.reason, 'too_many_clips')
})
