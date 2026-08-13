// ⑥G 갭 1 -- the count the judging day turns on.
//
// Falsifiable form: the first case is the whole point. Two inputs that the OLD
// panel reported identically (because it only counted rows that exist) must give
// different answers here.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  scoringCoverage,
  isScorable,
  isUnjudged,
  isExhaustedFailed,
  isBlockingFailed,
} from './scoring-coverage.ts'

test('★full coverage and half coverage must not look the same', () => {
  const films = ['a', 'b', 'c', 'd']
  assert.deepEqual(scoringCoverage(films, ['a', 'b', 'c', 'd']), {
    scorable: 4,
    judged: 4,
    unjudged: 0,
  })
  assert.deepEqual(scoringCoverage(films, ['a', 'b']), {
    scorable: 4,
    judged: 2,
    unjudged: 2,
  })
})

// ★An entry with a 'pending' row IS enqueued -- it is waiting, not missing. The
// distinction is the reason unjudged is computed from row PRESENCE rather than
// from judged_status: a status can only exist once the row does.
test('a row of any status counts as judged; absence is what unjudged means', () => {
  assert.equal(scoringCoverage(['a'], ['a']).unjudged, 0)
  assert.equal(scoringCoverage(['a'], []).unjudged, 1)
})

// ★A scoring row that no longer has a film behind it must not cancel out an
// entry that is genuinely missing one. Subtracting totals (2 scorable - 2 rows =
// 0 missing) hides 'b' completely; intersecting finds it.
test('a stray row cannot hide an unjudged entry', () => {
  const c = scoringCoverage(['a', 'b'], ['a', 'withdrawn'])
  assert.deepEqual(c, { scorable: 2, judged: 1, unjudged: 1 })
})

test('entries without a film are not the scorer’s problem', () => {
  // The caller passes only entries that have a preliminary film, so an empty
  // scorable set is a real state (nothing submitted yet) and not a division by
  // zero waiting to happen.
  assert.deepEqual(scoringCoverage([], ['a']), { scorable: 0, judged: 0, unjudged: 0 })
})

test('duplicate ids on either side do not inflate the count', () => {
  assert.deepEqual(scoringCoverage(['a', 'a', 'b'], ['a', 'a']), {
    scorable: 2,
    judged: 1,
    unjudged: 1,
  })
})

// ── the same rule, as a per-row predicate ──────────────────────────────────

test('scorable means there is a film, blanks included', () => {
  assert.equal(isScorable({ free_entry_url: 'https://r2.example/a.mp4' }), true)
  assert.equal(isScorable({ free_entry_url: null }), false)
  assert.equal(isScorable({ free_entry_url: '   ' }), false)
})

// ★The noise case. An applicant who never submitted a film also has
// judged_status === null. Counting them as a coverage gap buries the entries an
// operator can actually act on, which is the same failure as having no
// denominator at all -- a number that does not separate the two states.
test('no film is not a coverage gap; a film with no row is', () => {
  assert.equal(isUnjudged({ free_entry_url: null, judged_status: null }), false)
  assert.equal(isUnjudged({ free_entry_url: 'https://r2.example/a.mp4', judged_status: null }), true)
})

test('a row of any status is not a coverage gap', () => {
  const film = 'https://r2.example/a.mp4'
  for (const st of ['pending', 'in_progress', 'completed', 'failed']) {
    assert.equal(isUnjudged({ free_entry_url: film, judged_status: st }), false, st)
  }
})

// ── ⑥G gap 3 -- the retry-exhausted state countBlockingFailed gates on ────

test('exhausted means failed AND out of retries -- either alone is not enough', () => {
  assert.equal(isExhaustedFailed({ judged_status: 'failed', processing_attempts: 3 }, 3), true)
  assert.equal(isExhaustedFailed({ judged_status: 'failed', processing_attempts: 2 }, 3), false)
  assert.equal(isExhaustedFailed({ judged_status: 'in_progress', processing_attempts: 5 }, 3), false)
  assert.equal(isExhaustedFailed({ judged_status: 'failed', processing_attempts: null }, 3), false)
})

// ★The negative control: an entry already out of the running cannot block a
// finalization it is not part of. This must actually flip false, or the "resolve
// by rejecting/withdrawing" instruction in the banner would be a lie.
test('rejected, withdrawn, and waitlisted rows do not block, even exhausted', () => {
  for (const status of ['rejected', 'withdrawn', 'waitlist']) {
    assert.equal(
      isBlockingFailed({ judged_status: 'failed', processing_attempts: 3, status }, 3),
      false,
      status,
    )
  }
  assert.equal(
    isBlockingFailed({ judged_status: 'failed', processing_attempts: 3, status: 'selected' }, 3),
    true,
  )
})
