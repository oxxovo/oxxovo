// 일회성 진단 — 슬롯 분리 상태기계가 부분성공(2/3 ok) 후 다음 tick에서 재개되는지
// 실측 확인. season_test에 신규 1행만 넣는다(제 시드, 끝나면 cleanup).
//   node --env-file=.env.local scripts/zz_probe_slot_retry_2026-09-07.mjs insert
//   node --env-file=.env.local scripts/zz_probe_slot_retry_2026-09-07.mjs check
//   node --env-file=.env.local scripts/zz_probe_slot_retry_2026-09-07.mjs cleanup
import { admin, SEASON } from './rehearsal-lib.mjs'

const CREATOR = 'ZZPROBE-RETRY-0907'
const cmd = process.argv[2]
const db = admin()

if (cmd === 'insert') {
  const { data: existing } = await db.from('genesis_applications')
    .select('id').eq('season_id', SEASON).eq('creator_name', CREATOR).maybeSingle()
  if (existing) { console.log('already exists:', existing.id); process.exit(0) }
  const { data, error } = await db.from('genesis_applications').insert({
    season_id: SEASON, country: null, channel_url: null, agreed_to_rules: true,
    status: 'pending', ai_score: null, ip_address: null,
    creator_name: CREATOR, email: 'zzprobe-retry-0907@oxxovo-demo.local',
    free_entry_url: 'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/cf/v3/cf_01_lumea_premium.mp4',
    video_title: 'zzprobe retry test',
    creator_statement: 'Diagnostic probe -- slot-separated retry state machine, not a real entry.',
    ai_service: 'OXXOVO Studio', agreed_to_privacy: true, agreed_to_integrity_notice: true,
    moderation_status: 'approved', staff_pick: false, watch_hidden: true, watch_hold: true,
    main_round_disqualified: false, user_id: null, age: null,
  }).select('id').single()
  if (error) { console.error('insert failed:', error.message); process.exit(1) }
  console.log('inserted:', data.id)
} else if (cmd === 'check') {
  const { data: app } = await db.from('genesis_applications').select('id, status').eq('season_id', SEASON).eq('creator_name', CREATOR).maybeSingle()
  console.log('app:', app)
  if (app) {
    const { data: sr } = await db.from('scoring_results').select('*').eq('application_id', app.id).eq('round', 'application').maybeSingle()
    console.log('scoring_results:', JSON.stringify(sr, null, 2))
  }
} else if (cmd === 'cleanup') {
  const { data: app } = await db.from('genesis_applications').select('id').eq('season_id', SEASON).eq('creator_name', CREATOR).maybeSingle()
  if (app) {
    await db.from('scoring_results').delete().eq('application_id', app.id)
    await db.from('genesis_applications').delete().eq('id', app.id)
    console.log('cleaned up', app.id)
  } else {
    console.log('nothing to clean up')
  }
} else {
  console.error('usage: insert|check|cleanup')
  process.exit(1)
}
process.exit(0)
