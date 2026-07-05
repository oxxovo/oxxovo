// Seed real community votes for the main-round finalists so vote collection +
// tally can be observed. watch_votes.user_id is NOT NULL FK auth.users, so we use
// real auth accounts. Trigger caps 3 votes/person; unique(application_id,user_id).
//   node --env-file=.env.local scripts/rehearsal-seed-votes.mjs [numVotes=12]
import { admin, SEASON, printState } from './rehearsal-lib.mjs'

const db = admin()
const target = parseInt(process.argv[2] ?? '12', 10)

const { data: vids, error } = await db.from('genesis_applications')
  .select('id, creator_name').eq('season_id', SEASON).not('main_round_video_url', 'is', null).order('creator_name')
if (error) { console.error('load videos failed:', error.message); process.exit(1) }
if (!vids?.length) { console.error('no main-round videos -- run submit-main first'); process.exit(1) }

const { data: list, error: uErr } = await db.auth.admin.listUsers({ page: 1, perPage: 200 })
if (uErr) { console.error('listUsers failed:', uErr.message); process.exit(1) }
const users = (list?.users ?? []).map((u) => u.id)
if (!users.length) { console.error('no auth users to vote with'); process.exit(1) }
console.log(`seeding up to ${target} votes across ${vids.length} videos using ${users.length} voters (<=3 each)`)

let cast = 0, u = 0
const perUser = {}
for (let i = 0; cast < target && i < users.length * 3; i++) {
  const uid = users[u % users.length]; u++
  perUser[uid] = perUser[uid] ?? 0
  if (perUser[uid] >= 3) continue
  const vid = vids[cast % vids.length]
  const { error: e } = await db.from('watch_votes').insert({ application_id: vid.id, season_id: SEASON, round: 'main', user_id: uid })
  if (e) { if (!/duplicate|unique|cap|limit/i.test(e.message)) console.log(`  skip: ${e.message}`); continue }
  perUser[uid]++; cast++
  console.log(`  vote ${cast}: ${vid.creator_name}`)
}
console.log(`\ncast ${cast} votes.`)
await printState(db)
process.exit(0)
