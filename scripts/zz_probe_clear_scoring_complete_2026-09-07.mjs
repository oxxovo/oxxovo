// season_test.scoring_complete_at 이 8/31(지난 리허설 사이클) 값으로 남아있어
// 9/6에 추가된 "마감 12h 창" 스로틀(batch.ts pickPending)이 신규 후보를 영원히
// 막는다 -- 실측으로 발견(2026-09-07). 채점 재개를 위해 null로 되돌린다
// (advance 단계에서 다시 채워짐 -- rehearsal-stage.mjs advance).
//   node --env-file=.env.local scripts/zz_probe_clear_scoring_complete_2026-09-07.mjs
import { admin, SEASON, printState } from './rehearsal-lib.mjs'
const db = admin()
const { error } = await db.from('seasons').update({ scoring_complete_at: null }).eq('id', SEASON)
if (error) { console.error(error.message); process.exit(1) }
console.log('scoring_complete_at -> null')
await printState(db)
process.exit(0)
