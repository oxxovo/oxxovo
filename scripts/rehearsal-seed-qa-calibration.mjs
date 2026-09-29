// season_test 예선 채점기 편차검증용 3편 추가 시드 (2026-09-04, 제니3 지시).
// TEST-01~16과 동일한 필드 관례를 따른다(스키마 실측: zz_probe_test_rows_2026-09-04.mjs).
// admin_notes는 내부 전용(채점기가 읽지 않는 관리자 메모) -- QA 표시는 여기에만 남긴다.
// video_title/creator_statement는 다른 TEST 행과 동일한 형식(평범한 참가작처럼 보이게).
//   node --env-file=.env.local scripts/rehearsal-seed-qa-calibration.mjs
import { admin, SEASON } from './rehearsal-lib.mjs'

const ROWS = [
  {
    creator_name: 'TEST-17',
    email: 'test-17@oxxovo-demo.local',
    free_entry_url: 'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_Z01_table_EN_9x16.mp4',
    video_title: 'Table',
    video_duration_seconds: 19,
    admin_notes: 'QA · low-intent (EN)',
  },
  {
    creator_name: 'TEST-18',
    email: 'test-18@oxxovo-demo.local',
    free_entry_url: 'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_Z02_dusk_EN_9x16.mp4',
    video_title: 'Dusk',
    video_duration_seconds: 19,
    admin_notes: 'QA · low-execution (EN)',
  },
  {
    creator_name: 'TEST-19',
    email: 'test-19@oxxovo-demo.local',
    free_entry_url: 'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_Z03_studio_EN_9x16.mp4',
    video_title: 'Studio',
    video_duration_seconds: 19,
    admin_notes: 'QA · low-consistency (EN)',
  },
]

const COMMON = {
  season_id: SEASON,
  country: null,
  channel_url: null,
  agreed_to_rules: true,
  status: 'pending',
  ai_score: null,
  ip_address: null,
  creator_statement: 'Rehearsal fixture -- pipeline verification only.',
  ai_service: 'OXXOVO Studio',
  agreed_to_privacy: true,
  agreed_to_integrity_notice: true,
  moderation_status: 'approved',
  staff_pick: false,
  watch_hidden: false,
  watch_hold: false,
  main_round_disqualified: false,
  user_id: null,
  age: null,
}

const db = admin()
for (const r of ROWS) {
  const { data: existing } = await db.from('genesis_applications')
    .select('id').eq('season_id', SEASON).eq('creator_name', r.creator_name).maybeSingle()
  if (existing) {
    console.log(`[스킵] ${r.creator_name} 이미 존재 (id=${existing.id})`)
    continue
  }
  const { data, error } = await db.from('genesis_applications').insert({ ...COMMON, ...r }).select('id, creator_name, video_title, free_entry_url').single()
  if (error) { console.error(`[실패] ${r.creator_name}:`, error.message); process.exit(1) }
  console.log(`[등록] ${JSON.stringify(data)}`)
}
process.exit(0)
