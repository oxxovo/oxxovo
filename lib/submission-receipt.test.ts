// ⑤ -- who gets a "we have your film" receipt, and what it says about the file.
//
// Falsifiable form: each case feeds two rows differing in one column and demands
// different answers. A rule rewritten to key on "there is a film" instead of on
// the Studio submission column cannot pass the second test -- which is the one
// that matters, because that rewrite is the obvious one.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  submissionReceiptRounds,
  submissionReceiptTemplate,
  submissionFileState,
} from './submission-receipt.ts'
import { videoLiveTemplateKey } from './video-live.ts'

const SUBMITTED_AT = '2026-11-03T18:00:00.000Z'

// The defect, stated as a test: a Studio submission is an act nobody was told
// about. Same row before and after that act must give different answers.
test('a Studio submission earns a receipt; an entry that has not submitted does not', () => {
  assert.deepEqual(
    submissionReceiptRounds({ studio_application_submitted_at: null, free_entry_url: null }),
    [],
  )
  assert.deepEqual(
    submissionReceiptRounds({ studio_application_submitted_at: SUBMITTED_AT, free_entry_url: null }),
    ['application'],
  )
})

// ★The discriminator is the Studio column, NOT the film. An entry that applied
// with a URL already got ApplicationReceived at apply time, and a second receipt
// for the same act is worse than none.
test('a URL entry has a film but no second receipt', () => {
  assert.deepEqual(
    submissionReceiptRounds({
      studio_application_submitted_at: null,
      free_entry_url: 'https://youtube.com/watch?v=abc',
    }),
    [],
  )
})

// ★Asynchronous submission: accepted before the deadline, file up to the
// processing buffer later. The receipt goes out at acceptance and says which of
// the two it is -- waiting for the file would mean silence through the window
// that participants are most anxious about.
test('accepted with no file yet is processing; accepted with a file is complete', () => {
  const accepted = { studio_application_submitted_at: SUBMITTED_AT, free_entry_url: null }
  assert.equal(submissionFileState(accepted, 'application'), 'processing')
  assert.equal(
    submissionFileState({ ...accepted, free_entry_url: 'https://r2.example/final.mp4' }, 'application'),
    'complete',
  )
})

test('a blank URL is not a file', () => {
  assert.equal(
    submissionFileState({ studio_application_submitted_at: SUBMITTED_AT, free_entry_url: '   ' }, 'application'),
    'processing',
  )
})

// ★Dedup is per (application_id, template_key). The receipt and the
// film-is-live notice are two different mails about the same entry, and if they
// ever shared a key one would permanently suppress the other.
test('the receipt does not share a dedup key with the film-is-live notice', () => {
  assert.equal(submissionReceiptTemplate('application'), 'studio_submission_received')
  assert.notEqual(submissionReceiptTemplate('application'), videoLiveTemplateKey('application'))
  assert.notEqual(submissionReceiptTemplate('application'), submissionReceiptTemplate('main'))
})
