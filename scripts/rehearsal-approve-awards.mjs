// Assign 1/2/3 awards -- mirrors the admin action approveTop3Awards (rank by
// server-authoritative final_score; season_test is Soak so final == verified main
// score). This is the human-in-the-loop step: the REAL path is an admin clicking
// "Approve" in /admin/seasons/season_test/main-results (which also fires payout
// emails). This script is the automation-test equivalent and does NOT email (test
// addresses @pipeline-test.local would bounce).
//   node --env-file=.env.local scripts/rehearsal-approve-awards.mjs
import { admin, SEASON, printState } from './rehearsal-lib.mjs'

const db = admin()
const [{ data: apps }, { data: sr }] = await Promise.all([
  db.from('genesis_applications').select('id, creator_name').eq('season_id', SEASON).not('main_round_submitted_at', 'is', null),
  db.from('scoring_results').select('application_id, verified_score, judged_status').eq('season_id', SEASON).eq('round', 'main'),
])
const score = new Map()
for (const s of sr ?? []) score.set(s.application_id, s.judged_status === 'completed' ? s.verified_score : null)

const ranked = (apps ?? [])
  .map((a) => ({ a, final: score.get(a.id) ?? null }))
  .filter((r) => r.final != null)
  .sort((x, y) => y.final - x.final)

if (!ranked.length) { console.error('no completed main-round scores -- run the MAIN worker first'); process.exit(1) }

const top3 = ranked.slice(0, 3)
console.log('server-ranked main round (top of pool):')
ranked.slice(0, 6).forEach((r, i) => console.log(`  #${i + 1} ${String(r.a.creator_name).padEnd(18)} final=${Math.round(r.final)}`))

for (let i = 0; i < top3.length; i++) {
  const rank = i + 1
  const { error } = await db.from('genesis_applications').update({ award_rank: rank, status: 'awarded' }).eq('id', top3[i].a.id)
  if (error) { console.error(`award ${rank} failed:`, error.message); process.exit(1) }
  console.log(`  awarded rank ${rank}: ${top3[i].a.creator_name}`)
}

await printState(db)
console.log('\nPIPELINE COMPLETE. (Real launch: award via /admin main-results so payout emails fire.)')
process.exit(0)
