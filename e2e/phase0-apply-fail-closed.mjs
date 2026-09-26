// Phase 0-B / P0-4 verification: the exact fail-open path HQ found -- a client
// POSTing {"season_id":"season_0",...} to /api/apply bypasses getCurrentSeason()
// entirely (route.ts:106-109 uses getSeasonById(body.season_id) instead) and, on
// season_0's real current shape (status='draft', every date NULL), used to pass
// BOTH server-side gates. Read-only: fetches the real row and calls the real gate
// functions the route calls -- does not POST to a live endpoint (that needs an
// authenticated session, out of scope for a read-only harness).
//
// Usage: node --env-file=.env.local --import ./scripts/test-register.mjs --test e2e/phase0-apply-fail-closed.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { getSeasonById, isBeforeApplicationOpen, isApplicationClosed } from '../lib/seasons.ts'

test('★precondition: season_0 is currently unscheduled (status=draft, application_open_at=null)', async () => {
  const season = await getSeasonById('season_0')
  assert.ok(season, 'season_0 must exist')
  assert.equal(season.status, 'draft')
  assert.equal(season.application_open_at, null)
})

test('★the leak, closed: /api/apply\'s own gate now blocks season_0 as resolved via getSeasonById (the explicit season_id path)', async () => {
  const season = await getSeasonById('season_0')
  // This is byte-for-byte what app/api/apply/route.ts:114 calls with this exact
  // season object when a client sends {"season_id":"season_0"} in the POST body.
  assert.equal(isBeforeApplicationOpen(season), true, 'isBeforeApplicationOpen must block an unscheduled season -- route.ts would now return 403 season_not_open')
})

test('isApplicationClosed is unaffected -- still reads null close_at as open-ended, not closed (by design, untouched)', async () => {
  const season = await getSeasonById('season_0')
  assert.equal(isApplicationClosed(season), false, 'this function is deliberately untouched by P0-4 -- isBeforeApplicationOpen alone is what blocks the submission')
})
