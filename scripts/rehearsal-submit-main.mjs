// Simulate the "본선 제출" step: after advancement selects finalists (status=
// 'selected'), assign each the curated finals-6 video + short title (from the
// stashed real URL pool) and mark it submitted so the MAIN scoring worker
// (candidateStatus='main_round_submitted') will pick it up. Real launch =
// creators submit via the UI; here we script it.
//   node --env-file=.env.local scripts/rehearsal-submit-main.mjs
//
// 제니3 확정 2026-08-30: 예선 리허설의 본선 6편은 임의 풀이 아니라 고정된 6편이다
// (패션 A01 base/fusion/wearable + A02 fabric + A03 street + A04 morph). 6명에게
// 정확히 하나씩 -- round-robin 금지(중복/누락 시 이행표가 깨진다). 제목은 전부
// 한두 단어로 통일(AI가 프레임+텍스트를 같이 보므로, 한쪽만 길면 그 편이 유리해짐).
//
// ★고정값을 여기 직접 박아둔 이유: rehearsal-reset.mjs(STEP 0)가 매 실행마다
// .rehearsal-stash.json 전체를 "지금 배정된 main_round_video_url"로 다시 써버린다
// (부분 병합이 아니라 파일 전체 재작성). 리허설을 처음부터 다시 돌리면 그 파일에
// 넣어둔 고정 6편 목록이 그대로 지워진다 -- 외부 stash 파일에 의존하지 않고
// 이 스크립트 자체가 정답을 갖고 있어야 재실행에도 안전하다.
import { admin, SEASON, iso, printState } from './rehearsal-lib.mjs'

const BASE = 'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/'

// 제니3 확정 2026-08-30 -- 순서는 임의, 개수(6)와 내용만 고정.
const FINALS6 = [
  { file: 'content_A01_fashion_wearable_EN_9x16.mp4', title: 'Walk' },
  { file: 'content_A04_morph_EN_9x16.mp4', title: 'Morph' },
  { file: 'content_A01_fashion_EN_9x16.mp4', title: 'Runway' },
  { file: 'content_A01_fashion_fusion_EN_9x16.mp4', title: 'Fusion' },
  { file: 'content_A03_street_EN_9x16.mp4', title: 'Street' },
  { file: 'content_A02_fabric_EN_9x16.mp4', title: 'Weave' },
].map((f) => ({ url: BASE + f.file, title: f.title }))

const db = admin()
const { data: finalists, error } = await db.from('genesis_applications')
  .select('id, creator_name').eq('season_id', SEASON).eq('status', 'selected').order('creator_name')
if (error) { console.error('load finalists failed:', error.message); process.exit(1) }
if (!finalists?.length) { console.error("no status='selected' rows -- run stage 'advance' first (after prelim scoring)"); process.exit(1) }

// Exact 1:1 required -- no modulo/round-robin. A count mismatch means the
// advance step produced a different N than this rehearsal was designed for;
// stop rather than silently wrap around and duplicate or drop an entry.
if (finalists.length !== FINALS6.length) {
  console.error(`finalist count (${finalists.length}) != FINALS6 count (${FINALS6.length}) -- fix FINALS6 before assigning, do not round-robin`)
  process.exit(1)
}

console.log(`assigning ${FINALS6.length} curated finals videos 1:1 to ${finalists.length} finalists`)
for (let i = 0; i < finalists.length; i++) {
  const f = finalists[i]
  const { url, title } = FINALS6[i]
  const { error: e } = await db.from('genesis_applications')
    .update({
      status: 'main_round_submitted',
      main_round_video_url: url,
      video_title: title,
      main_round_submitted_at: iso(0),
    })
    .eq('id', f.id)
  if (e) { console.error(`  ${f.creator_name}: ${e.message}`); process.exit(1) }
  console.log(`  ${f.creator_name} -> "${title}"  ${url}`)
}

await printState(db)
console.log("\nNEXT: rehearsal-stage.mjs main-open  ->  main-close  ->  RUN MAIN WORKER (ROUND=main)")
process.exit(0)
