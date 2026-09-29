// 1주차 캡션 14편(7라벨 x KR/EN) DB 입력. 2026-09-04 제니3 지시.
// D05_worldchamp는 1주차 대상 아님(2구간으로 밀림) -- 여기 포함 안 함.
//   node --env-file=.env.local scripts/promo-set-captions-week1-2026-09-04.mjs
import { createClient } from '@supabase/supabase-js'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const db = createClient(url, key, { auth: { persistSession: false } })

const CAPTIONS = {
  '250072ab-ee02-4fad-8f62-3e852915d4a5': // D01_slogan EN
    "Three words. That's the whole thing.\nEveryone has AI. Not everyone can win.\nEntries open October 14 · oxxovo.ai\n#OXXOVO #TheLastHope #AIfilm #AIvideo",
  '35cccd52-7031-4b7a-a503-bc2e9721916b': // D01_slogan KR
    "세 단어면 충분합니다.\n누구나 AI를 사용할 수 있습니다.\n하지만 모두가 이길 수는 없습니다.\n10월 14일 접수 시작 · oxxovo.ai\n#OXXOVO #더라스트호프 #AI영상 #AI영상대회",

  '8163cf0e-42c8-4889-88ef-66ab7f3a0c56': // D02_aieasy EN
    "Better tools make good work easier for everyone.\nEveryone has AI. Not everyone can win.\nEntries open October 14 · oxxovo.ai\n#OXXOVO #TheLastHope #AIvideo #AIcreator",
  '0fdb8ebb-4cc4-45bf-8757-624ea706e651': // D02_aieasy KR
    "도구가 좋아질수록 잘 만드는 일은 쉬워집니다.\n누구나 AI를 사용할 수 있습니다.\n하지만 모두가 이길 수는 없습니다.\n10월 14일 접수 시작 · oxxovo.ai\n#OXXOVO #더라스트호프 #AI영상 #AI크리에이터",

  'abadec96-663c-4147-95eb-bee6e87c6182': // D03_arena EN
    "There was no place to compete. So we built one.\nEveryone has AI. Not everyone can win.\nEntries open October 14 · oxxovo.ai\n#OXXOVO #TheLastHope #AIcontest #AIvideo",
  '319a5aa4-8b24-45a1-9e12-bfef331c7885': // D03_arena KR
    "실력을 겨룰 자리가 없었습니다. 그래서 만들었습니다.\n누구나 AI를 사용할 수 있습니다.\n하지만 모두가 이길 수는 없습니다.\n10월 14일 접수 시작 · oxxovo.ai\n#OXXOVO #더라스트호프 #AI영상대회",

  '7c0a321c-9a8c-47d7-9d4b-8aa6bf7ce002': // D04_fair EN
    "Skill is the only thing we look at.\nEveryone has AI. Not everyone can win.\nEntries open October 14 · oxxovo.ai\n#OXXOVO #TheLastHope #AIcontest #AIvideo",
  'c03a8fc9-092a-4d10-83c1-c52a4459f435': // D04_fair KR
    "실력 말고는 아무것도 보지 않습니다.\n누구나 AI를 사용할 수 있습니다.\n하지만 모두가 이길 수는 없습니다.\n10월 14일 접수 시작 · oxxovo.ai\n#OXXOVO #더라스트호프 #AI영상대회",

  '399c982a-c6d3-4b8e-9a55-4b70f29ad040': // D06_creators EN
    "Built by people who make things, for people who make things.\nEveryone has AI. Not everyone can win.\nEntries open October 14 · oxxovo.ai\n#OXXOVO #TheLastHope #AIcreator #AIfilm",
  '096105ea-81f0-4c38-980b-e23445a51ee3': // D06_creators KR
    "만드는 사람이 만들면 다릅니다.\n누구나 AI를 사용할 수 있습니다.\n하지만 모두가 이길 수는 없습니다.\n10월 14일 접수 시작 · oxxovo.ai\n#OXXOVO #더라스트호프 #AI영상 #AI크리에이터",

  '436d50dd-8f32-47cc-839e-b6344922f1ee': // C01_d30 EN
    "One month until entries open.\nEveryone has AI. Not everyone can win.\nEntries open October 14 · oxxovo.ai\n#OXXOVO #TheLastHope #AIcontest #AIvideo",
  '9a59b0d0-163b-480f-84cc-970d09f2cb5c': // C01_d30 KR
    "접수 시작까지 한 달.\n누구나 AI를 사용할 수 있습니다.\n하지만 모두가 이길 수는 없습니다.\n10월 14일 접수 시작 · oxxovo.ai\n#OXXOVO #더라스트호프 #AI영상 #AI영상대회",

  'b42a8b98-e7b7-47a7-ac97-69560769cf73': // D07_newstandard EN
    "Nobody tells you if your work is actually good.\nEveryone has AI. Not everyone can win.\nEntries open October 14 · oxxovo.ai\n#OXXOVO #TheLastHope #AIcreator #AIvideo",
  '8e3b9240-6f36-427f-bab3-9622f10cef78': // D07_newstandard KR
    "잘 만들었다는 말을 아무도 해주지 않습니다.\n누구나 AI를 사용할 수 있습니다.\n하지만 모두가 이길 수는 없습니다.\n10월 14일 접수 시작 · oxxovo.ai\n#OXXOVO #더라스트호프 #AI영상 #AI크리에이터",
}

let ok = 0, fail = 0
for (const [id, caption] of Object.entries(CAPTIONS)) {
  const { error } = await db.from('promo_videos').update({ caption }).eq('id', id)
  if (error) { console.error(`[실패] ${id}:`, error.message); fail++; continue }
  ok++
}
console.log(`완료: ${ok} 성공 / ${fail} 실패 (총 ${Object.keys(CAPTIONS).length})`)
process.exit(fail ? 1 : 0)
