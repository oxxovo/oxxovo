// The public-visibility rule, alone. Extracted from lib/watch.ts so the
// growth-engine email can read the same rule instead of a copy; these cases pin
// the behavior across that move -- if the extraction changed anything, one of
// them fails.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isRowPublic, isSeasonPublic } from './watch-visibility.ts'

const PUBLIC = {
  status: 'submitted',
  watch_hidden: false,
  moderation_status: 'approved',
  watch_hold: false,
}

test('an approved, unhidden, unheld entry is public', () => {
  assert.equal(isRowPublic(PUBLIC), true)
})

test('each gate alone is enough to hide it', () => {
  assert.equal(isRowPublic({ ...PUBLIC, status: 'flagged' }), false)
  assert.equal(isRowPublic({ ...PUBLIC, watch_hidden: true }), false)
  assert.equal(isRowPublic({ ...PUBLIC, watch_hold: true }), false)
  assert.equal(isRowPublic({ ...PUBLIC, moderation_status: 'pending' }), false)
  assert.equal(isRowPublic({ ...PUBLIC, moderation_status: 'rejected' }), false)
})

// ★Moderation is allow-list, not deny-list: an unknown or absent verdict keeps
// the film private. A new verdict string added upstream must not publish itself.
test('moderation is an allow list -- null and unknown verdicts stay private', () => {
  assert.equal(isRowPublic({ ...PUBLIC, moderation_status: null }), false)
  assert.equal(isRowPublic({ ...PUBLIC, moderation_status: 'quarantined' }), false)
})

// ★Statuses OTHER than 'flagged' do not hide an entry. 'rejected' is a scoring
// outcome and a rejected prelim entry is still watchable -- folding it in here
// would make a system failure look like a takedown
// ([[project-system-error-not-user-rejection]]).
test('only flagged hides by status -- rejected stays visible', () => {
  assert.equal(isRowPublic({ ...PUBLIC, status: 'rejected' }), true)
  assert.equal(isRowPublic({ ...PUBLIC, status: 'selected' }), true)
})

test('nullable columns read as "not set" rather than throwing', () => {
  assert.equal(isRowPublic({ ...PUBLIC, watch_hidden: null, watch_hold: null }), true)
})

// ── isSeasonPublic (Phase 0-B, HQ 2026-09-27) ───────────────────────────────
// The season-level half of the same public/private decision. Regression target:
// season_test (is_fixture=true, watch_fixture_visible=false) must be excluded --
// this is the exact shape that returned HTTP 200 on /watch/[id] before the fix.
const NON_FIXTURE = { id: 'season_0', season_number: 0, is_fixture: false, watch_fixture_visible: false }
const FIXTURE_SEASON = { id: 'season_test', season_number: 999, is_fixture: true, watch_fixture_visible: false }

test('a normal, non-fixture season is public', () => {
  assert.equal(isSeasonPublic(NON_FIXTURE), true)
})

test('★regression: a fixture season without the exemption is NOT public (the season_test leak)', () => {
  assert.equal(isSeasonPublic(FIXTURE_SEASON), false)
})

test('a fixture season WITH watch_fixture_visible=true stays public (the rehearsal escape hatch)', () => {
  assert.equal(isSeasonPublic({ ...FIXTURE_SEASON, watch_fixture_visible: true }), true)
})

test('watch_fixture_visible missing/null on a fixture season is NOT an exemption -- fail closed', () => {
  assert.equal(isSeasonPublic({ ...FIXTURE_SEASON, watch_fixture_visible: null }), false)
  const { watch_fixture_visible: _omit, ...withoutColumn } = FIXTURE_SEASON
  assert.equal(isSeasonPublic(withoutColumn), false)
})

test('watch_fixture_visible=true on a NON-fixture season changes nothing -- it is public either way', () => {
  assert.equal(isSeasonPublic({ ...NON_FIXTURE, watch_fixture_visible: true }), true)
})

test('the id/number heuristic fallback (isFixtureSeason) is still honored when is_fixture is absent', () => {
  const { is_fixture: _omit, ...heuristicOnly } = FIXTURE_SEASON // id starts with 'season_test'
  assert.equal(isSeasonPublic(heuristicOnly), false)
})
