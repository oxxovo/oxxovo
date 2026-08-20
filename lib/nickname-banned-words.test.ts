// Three separate rules (제니3 2026-08-19), tested separately on purpose --
// merging them into one check is exactly the mistake that would let either
// failure mode back in silently. See lib/nickname-banned-words.ts header.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeLookalikes, matchesWholeWord, matchesSubstring } from './nickname-banned-words'

test('rule 3: lookalike normalization', () => {
  assert.equal(normalizeLookalikes('0xx0v0'), 'oxxovo')
  assert.equal(normalizeLookalikes('OXXOVO'), 'oxxovo')
  assert.equal(normalizeLookalikes('@dmin'), 'admin')
  assert.equal(normalizeLookalikes('h3ll5'), 'hells') // 3->e, 5->s
  assert.equal(normalizeLookalikes('안성재'), '안성재') // non-Latin untouched
})

test('rule 1: general list is word-boundary, not substring', () => {
  // the exact case 제니3 flagged: a real name containing a banned FRAGMENT
  // must not trip the general list.
  assert.equal(matchesWholeWord('안성재', '성'), false)
  assert.equal(matchesWholeWord('김성', '성'), false)
  assert.equal(matchesWholeWord('성재', '성'), false)
  // the term standing alone still matches.
  assert.equal(matchesWholeWord('성', '성'), true)
  assert.equal(matchesWholeWord('bad word here', 'bad'), true)
  assert.equal(matchesWholeWord('badminton', 'bad'), false)
})

test('rule 2: impersonation list IS substring, deliberately looser than rule 1', () => {
  assert.equal(matchesSubstring(normalizeLookalikes('OXXOVO_KIRA'), 'oxxovo'), true)
  assert.equal(matchesSubstring(normalizeLookalikes('0xx0v0_studio'), 'oxxovo'), true)
  assert.equal(matchesSubstring(normalizeLookalikes('kira'), 'oxxovo'), false)
})
