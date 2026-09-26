// Phase 0-B verification: getWatchVideo() must apply the same fixture gate as
// the LIST (loadWatchVideos()). Read-only -- calls the real code path against
// the live DB with the exact row HQ reproduced the leak on (2026-09-27):
//   b442112b-7b06-4e0a-865b-106de9b7a396 (season_test, a fixture season with
//   watch_fixture_visible=false).
//
// Usage: node --env-file=.env.local --import ./scripts/test-register.mjs --test e2e/phase0-fixture-detail-gate.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { getWatchVideo, getWatchVideos, getCurrentCompetitionStats } from '../lib/watch.ts'

const FIXTURE_APP_ID = 'b442112b-7b06-4e0a-865b-106de9b7a396'

test('★the leak, closed: the season_test fixture video is no longer reachable via getWatchVideo()', async () => {
  const video = await getWatchVideo(FIXTURE_APP_ID, 'application')
  assert.equal(video, null, 'getWatchVideo() must return null for a fixture-season row without watch_fixture_visible -- this is what makes /watch/[id] 404')
})

test('the public list is unaffected: still 0 public (non-fixture) videos', async () => {
  const videos = await getWatchVideos()
  assert.equal(videos.length, 0, 'the list must not change shape from this fix -- season_0 has no applications yet, so this stays 0')
})

test('season_0 competition stats are unaffected: still 0 entries', async () => {
  const stats = await getCurrentCompetitionStats('season_0')
  assert.equal(stats.entries, 0)
})
