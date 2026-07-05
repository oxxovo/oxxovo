// STEP 0 -- reset season_test to the fresh "just submitted, nothing scored" state
// so the full pipeline can run for real. Keyed strictly to season_test.
//   node --env-file=.env.local scripts/rehearsal-reset.mjs
//
// Does: stash the pool of real main-round video URLs (re-applied to whoever the
// pipeline actually advances) -> delete season_test scoring_results + social rows
// -> reset all 20 apps to status='pending', no scores/awards/main-video -> reset
// season_test dates to a clean "accepting" baseline (open now, downstream null).
import { writeFileSync } from 'node:fs'
import { admin, SEASON, iso, printState } from './rehearsal-lib.mjs'

const db = admin()

const { data: apps, error } = await db.from('genesis_applications')
  .select('id, creator_name, main_round_video_url').eq('season_id', SEASON)
if (error) { console.error('load apps failed:', error.message); process.exit(1) }
if (!apps?.length) { console.error('no season_test apps found -- aborting'); process.exit(1) }
const ids = apps.map((a) => a.id)

// Stash the real main-round URL pool (submit-main re-applies to actual finalists).
const pool = apps.map((a) => a.main_round_video_url?.trim()).filter(Boolean)
writeFileSync(new URL('./.rehearsal-stash.json', import.meta.url), JSON.stringify({ savedAt: new Date().toISOString(), mainUrlPool: pool }, null, 2))
console.log(`stashed ${pool.length} main-round video URLs -> scripts/.rehearsal-stash.json`)

async function del(table, col, val) {
  const { error } = await db.from(table).delete().eq(col, val)
  if (error && !/does not exist|schema cache/i.test(error.message)) console.log(`  (${table}: ${error.message})`)
}
async function delIn(table) {
  const { error } = await db.from(table).delete().in('application_id', ids)
  if (error && !/does not exist|schema cache/i.test(error.message)) console.log(`  (${table}: ${error.message})`)
}
console.log('clearing scoring_results + social rows for season_test...')
await del('scoring_results', 'season_id', SEASON)
await del('watch_votes', 'season_id', SEASON)
await delIn('watch_likes'); await delIn('watch_views'); await delIn('watch_comments'); await delIn('watch_video_reports')

const { error: upErr } = await db.from('genesis_applications').update({
  status: 'pending', award_rank: null, main_round_video_url: null, main_round_submitted_at: null, ai_score: null,
}).eq('season_id', SEASON)
if (upErr) { console.error('reset apps failed:', upErr.message); process.exit(1) }
console.log('reset 20 apps -> status=pending, no score/award/main-video')

const { error: sErr } = await db.from('seasons').update({
  status: 'draft',
  application_open_at: iso(-5), application_close_at: iso(360),
  scoring_complete_at: null, main_round_start_at: null, main_round_end_at: null,
  community_vote_start_at: null, community_vote_end_at: null, awards_announcement_at: null,
  min_participants: 5, updated_at: new Date().toISOString(),
}).eq('id', SEASON)
if (sErr) { console.error('reset season failed:', sErr.message); process.exit(1) }
console.log('reset season_test dates -> accepting baseline (min_participants=5 for rehearsal)')

await printState(db)
console.log('\nNEXT: node --env-file=.env.local scripts/rehearsal-stage.mjs open')
process.exit(0)
