// 9/9 홍보 중지 (TK 판정, 2026-09-08): AI 심사 미확정 -> 1주차 14편 발행 보류.
// ① 승인 해제(발행 후보에서 완전히 제외 -- setPromoApprovedAction과 동일한 필드 리셋)
// ② caption 제거(날짜 "10월 14일 접수 시작"이 캡션에 박혀 있어 일정 밀리면 거짓이 됨).
//    버리는 게 아님 -- 원문은 scripts/promo-set-captions-week1-2026-09-04.mjs에 그대로 있음.
//   node --env-file=.env.local scripts/promo-week1-hold-2026-09-08.mjs
import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const week1Ids = [
  '250072ab-ee02-4fad-8f62-3e852915d4a5', '35cccd52-7031-4b7a-a503-bc2e9721916b', // D01
  '8163cf0e-42c8-4889-88ef-66ab7f3a0c56', '0fdb8ebb-4cc4-45bf-8757-624ea706e651', // D02
  'abadec96-663c-4147-95eb-bee6e87c6182', '319a5aa4-8b24-45a1-9e12-bfef331c7885', // D03
  '7c0a321c-9a8c-47d7-9d4b-8aa6bf7ce002', 'c03a8fc9-092a-4d10-83c1-c52a4459f435', // D04
  '399c982a-c6d3-4b8e-9a55-4b70f29ad040', '096105ea-81f0-4c38-980b-e23445a51ee3', // D06
  '436d50dd-8f32-47cc-839e-b6344922f1ee', '9a59b0d0-163b-480f-84cc-970d09f2cb5c', // C01
  'b42a8b98-e7b7-47a7-ac97-69560769cf73', '8e3b9240-6f36-427f-bab3-9622f10cef78', // D07
]

const { data, error } = await db.from('promo_videos')
  .update({ approved: false, approved_by: null, approved_at: null, caption: null })
  .in('id', week1Ids)
  .select('id, theme_note, approved, caption')
if (error) { console.error('FAILED:', error.message); process.exit(1) }
console.log(`${data.length}건 처리 (승인 해제 + 캡션 제거):`)
for (const r of data) console.log(`  ${r.theme_note}  approved=${r.approved}  caption=${r.caption === null ? 'null' : 'STILL SET!'}`)
process.exit(0)
