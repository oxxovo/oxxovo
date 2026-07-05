// Simulate the "본선 제출" step: after advancement selects finalists (status=
// 'selected'), give each a main-round video (from the stashed real URL pool) and
// mark it submitted so the MAIN scoring worker (candidateStatus='main_round_submitted')
// will pick it up. Real launch = creators submit via the UI; here we script it.
//   node --env-file=.env.local scripts/rehearsal-submit-main.mjs
import { readFileSync } from 'node:fs'
import { admin, SEASON, iso, printState } from './rehearsal-lib.mjs'

const db = admin()
const { data: finalists, error } = await db.from('genesis_applications')
  .select('id, creator_name').eq('season_id', SEASON).eq('status', 'selected').order('creator_name')
if (error) { console.error('load finalists failed:', error.message); process.exit(1) }
if (!finalists?.length) { console.error("no status='selected' rows -- run stage 'advance' first (after prelim scoring)"); process.exit(1) }

let pool = []
try { pool = JSON.parse(readFileSync(new URL('./.rehearsal-stash.json', import.meta.url))).mainUrlPool ?? [] } catch {}
if (!pool.length) { console.error('empty main-URL stash -- run rehearsal-reset.mjs first'); process.exit(1) }

console.log(`assigning main-round videos to ${finalists.length} finalists (pool=${pool.length})`)
for (let i = 0; i < finalists.length; i++) {
  const f = finalists[i]
  const url = pool[i % pool.length] // round-robin so every finalist gets a real video
  const { error: e } = await db.from('genesis_applications')
    .update({ status: 'main_round_submitted', main_round_video_url: url, main_round_submitted_at: iso(0) }).eq('id', f.id)
  if (e) { console.error(`  ${f.creator_name}: ${e.message}`); process.exit(1) }
  console.log(`  ${f.creator_name} -> main_round_submitted`)
}

await printState(db)
console.log("\nNEXT: rehearsal-stage.mjs main-open  ->  main-close  ->  RUN MAIN WORKER (ROUND=main)")
process.exit(0)
