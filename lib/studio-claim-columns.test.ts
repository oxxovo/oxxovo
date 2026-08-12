import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CLAIM_COLUMN, type StudioLeaseTable } from './studio-claim-columns'

// The sweep itself is DB-bound and belongs to the E2E. What is worth pinning in
// CI is the mapping, because it is the thing that quietly goes wrong: a table
// gains a lane, nobody adds it here, and its rows are simply never recovered --
// no error, no log, just money sitting in a status forever.

test('every Studio lane table has a claim column', () => {
  const tables: StudioLeaseTable[] = ['generation_jobs', 'render_jobs', 'studio_music_assets']
  for (const t of tables) {
    assert.equal(typeof CLAIM_COLUMN[t], 'string', `${t} has no claim column`)
    assert.ok(CLAIM_COLUMN[t].length > 0)
  }
  // No extras either: an entry here with no lane behind it is a claim about the
  // schema that nothing checks.
  assert.deepEqual(Object.keys(CLAIM_COLUMN).sort(), [...tables].sort())
})

// ★generation_jobs deliberately does NOT use claimed_at. It sets
// worker_started_at at claim and nowhere else, so that IS the claim time, and a
// second column meaning the same thing would leave no way to tell which one
// anything trusts. This asserts the decision so a later "let's make them
// consistent" has to argue with a failing test rather than a comment.
test('generation_jobs reuses worker_started_at rather than gaining a duplicate column', () => {
  assert.equal(CLAIM_COLUMN.generation_jobs, 'worker_started_at')
})

test('the tables that do carry a dedicated stamp use the same name as each other', () => {
  assert.equal(CLAIM_COLUMN.render_jobs, 'claimed_at')
  assert.equal(CLAIM_COLUMN.studio_music_assets, 'claimed_at')
})
