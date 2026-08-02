// E2E item 9, the part a test can hold: which render statuses let a participant
// reach the submit control.
//
// THE DEFECT THIS EXISTS FOR (2026-07-31). The server accepted a submission for a
// render that was still queued -- that is the whole point of asynchronous
// submission, because a final REQUESTED before the deadline must count even if
// the queue is busy. The editor rendered its submit form only inside the
// `renderReady` branch. So every server-side test passed while no participant
// could reach the control on any asynchronous path. The list existed twice and
// only one copy was right.
//
// The fix is not a better copy, it is one list (lib/studio-shared.ts) imported by
// both sides. What is left to pin is the list's CONTENT, because the failure mode
// is quiet: dropping 'queued' from it breaks nothing that throws.
//
// ★This is the deterministic half of item 9. It cannot prove the control is on
// the screen -- only a browser against a real deployment does that, which is the
// other half. It does prove that the two sides can no longer disagree.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ASYNC_SUBMIT_STATUSES, isSubmittableRenderStatus } from './studio-shared'

test('a render still in the queue is submittable -- the 2026-07-31 defect', () => {
  assert.ok(isSubmittableRenderStatus('queued'), 'queued must be submittable')
  assert.ok(isSubmittableRenderStatus('rendering'))
  assert.ok(isSubmittableRenderStatus('uploading'))
})

test('a finished render is submittable, and so is a failed one', () => {
  assert.ok(isSubmittableRenderStatus('ready'))
  // A failure inside the 24h buffer is ours to fix (the sweep re-renders once),
  // not grounds for losing the round.
  assert.ok(isSubmittableRenderStatus('failed'))
})

test('an entry is accepted once -- already submitted is not submittable again', () => {
  assert.equal(isSubmittableRenderStatus('submitted'), false)
})

test('nothing accidental counts as a status', () => {
  for (const junk of [null, undefined, '', 'READY', 'Queued', 'done', 'ok']) {
    assert.equal(isSubmittableRenderStatus(junk as string), false, JSON.stringify(junk))
  }
})

test('the exact set, pinned -- adding or dropping one is a deliberate act', () => {
  assert.deepEqual([...ASYNC_SUBMIT_STATUSES], ['queued', 'rendering', 'uploading', 'ready', 'failed'])
})

// ★The structural half: no second copy may come back. A future edit that
// re-introduces a local list in the editor (or in lib/studio.ts) puts the two
// sides back in a position to disagree, which is the actual bug -- so the source
// is checked for it, cheaply, rather than trusted to review.
test('neither side keeps its own copy of the list', () => {
  for (const file of ['../app/studio/compose/ProComposeEditor.tsx', './studio.ts']) {
    const src = readFileSync(new URL(file, import.meta.url), 'utf8')
    const literal = /\[\s*'queued'\s*,\s*'rendering'\s*,\s*'uploading'\s*,\s*'ready'\s*,\s*'failed'\s*\]/
    assert.equal(literal.test(src), false, `${file} declares the status list again -- import it instead`)
    assert.match(src, /isSubmittableRenderStatus|ASYNC_SUBMIT_STATUSES/, `${file} does not use the shared list`)
  }
})
