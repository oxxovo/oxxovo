// The boundary of the overdue rule, without waiting 46 minutes for it.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { overdueRows, stuckAlertHtml, SCORING_LEASE_ALERT_MS } from './scoring-lease-watch'

const NOW = Date.UTC(2026, 10, 5, 12, 0, 0) // 2026-11-05 12:00Z, inside season_0 scoring
const THRESHOLD = 60 * 60_000 // 60 minutes
const at = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString()

const row = (over: Partial<Parameters<typeof overdueRows>[0][number]> = {}) => ({
  application_id: 'app-1',
  season_id: 'season_0',
  round: 'application',
  processing_attempts: 1,
  started_at: at(90),
  ...over,
})

test('a claim younger than the threshold is not overdue', () => {
  assert.equal(overdueRows([row({ started_at: at(0) })], NOW, THRESHOLD).length, 0)
  assert.equal(overdueRows([row({ started_at: at(59) })], NOW, THRESHOLD).length, 0)
})

test('★the boundary is inclusive at exactly the threshold', () => {
  // A row claimed exactly one threshold ago HAS used its whole lease. Excluding
  // it would leave the oldest possible row reported as healthy for one tick.
  assert.equal(overdueRows([row({ started_at: at(60) })], NOW, THRESHOLD).length, 1)
  assert.equal(overdueRows([row({ started_at: at(61) })], NOW, THRESHOLD).length, 1)
})

test('★a NULL started_at is overdue, not healthy', () => {
  // startScoringRow stamps started_at on both the INSERT and the UPDATE path, so
  // an in_progress row without one is a row whose age cannot be computed. "I
  // cannot tell" has to surface as "look at this". The alternative -- treating
  // unknown as fine -- is exactly the failure the whole lease exists to end.
  const [r] = overdueRows([row({ started_at: null })], NOW, THRESHOLD)
  assert.ok(r, 'a NULL claim time is reported')
  assert.equal(r.ageMinutes, -1, 'and is flagged as unmeasurable rather than given a fake age')
  // Also for an unparseable value, which is the same class of unknown.
  assert.equal(overdueRows([row({ started_at: 'not-a-date' })], NOW, THRESHOLD).length, 1)
})

test('oldest first, and the age is reported in whole minutes', () => {
  const rows = [
    row({ application_id: 'young', started_at: at(70) }),
    row({ application_id: 'oldest', started_at: at(300) }),
    row({ application_id: 'middle', started_at: at(120) }),
  ]
  const out = overdueRows(rows, NOW, THRESHOLD)
  assert.deepEqual(
    out.map((r) => r.applicationId),
    ['oldest', 'middle', 'young'],
  )
  assert.deepEqual(
    out.map((r) => r.ageMinutes),
    [300, 120, 70],
  )
})

test('the fields the alert needs survive the projection', () => {
  const [r] = overdueRows(
    [row({ application_id: 'a-9', season_id: 'season_0', round: 'main', processing_attempts: 3 })],
    NOW,
    THRESHOLD,
  )
  assert.deepEqual(r, {
    applicationId: 'a-9',
    seasonId: 'season_0',
    round: 'main',
    attempts: 3,
    ageMinutes: 90,
  })
  // A null attempt count reads as 0 rather than crashing the alert body.
  const [z] = overdueRows([row({ processing_attempts: null })], NOW, THRESHOLD)
  assert.equal(z.attempts, 0)
})

test('★the alert says the worker is down, not that a score is slow', () => {
  const html = stuckAlertHtml({
    thresholdMinutes: 60,
    stuck: overdueRows([row(), row({ application_id: 'app-2', started_at: null })], NOW, THRESHOLD),
  })
  // The distinction is the whole value of the mail: the worker reclaims its own
  // stale claims every batch, so rows this old mean nothing is running.
  assert.match(html, /worker is not running/)
  // And that no counter reports them, which is why this mail exists at all.
  assert.match(html, /pickPending/)
  assert.match(html, /not <code>failed<\/code>/)
  // System fault, never a participant's -- the standing rule.
  assert.match(html, /not a participant one/)
  assert.match(html, /app-1/)
  assert.match(html, /started_at is NULL/)
})

test('the default alert threshold sits above the worker own reclaim window', () => {
  // The worker reclaims at 2 x ITEM_DEADLINE_MS = 46.3 min. Alerting sooner than
  // that would mail about rows the worker is about to fix by itself.
  assert.ok(
    SCORING_LEASE_ALERT_MS >= 47 * 60_000,
    `alert threshold ${SCORING_LEASE_ALERT_MS}ms must exceed the worker's 46.3min reclaim`,
  )
})
