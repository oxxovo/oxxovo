import { createClient } from '@supabase/supabase-js'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

console.log('== season_test dates + stage fields ==')
const { data: s } = await admin.from('seasons').select('id,status,application_open_at,application_close_at,scoring_start_at,scoring_complete_at,main_round_start_at,main_round_end_at,awards_announcement_at,community_vote_start_at,community_vote_end_at,advance_pct,advance_min,advance_max').eq('id','season_test').maybeSingle()
console.log(JSON.stringify(s, null, 2))

console.log('\n== season_test applications: status / round urls / award_rank ==')
const { data: apps } = await admin.from('genesis_applications')
  .select('id, creator_name, status, award_rank, free_entry_url, main_round_video_url, moderation_status, watch_hidden')
  .eq('season_id','season_test').order('award_rank', { nullsFirst: false })
for (const a of apps ?? []) console.log(`  ${String(a.creator_name).padEnd(18)} status=${String(a.status).padEnd(22)} rank=${a.award_rank ?? '-'} prelim=${a.free_entry_url?'Y':'-'} main=${a.main_round_video_url?'Y':'-'} mod=${a.moderation_status}`)

console.log('\n== scoring_results for season_test ==')
const { data: sr, error } = await admin.from('scoring_results')
  .select('application_id, round, judged_status, verified_score, grade').eq('season_id','season_test')
if (error) console.log('  ! ' + error.message)
else {
  const byRound = {}
  for (const r of sr ?? []) (byRound[r.round] ??= []).push(r)
  for (const [rd, rows] of Object.entries(byRound)) {
    const done = rows.filter(r => r.judged_status === 'completed').length
    console.log(`  round=${rd}: ${rows.length} rows, ${done} completed; sample scores: ${rows.filter(r=>r.verified_score!=null).slice(0,5).map(r=>Math.round(r.verified_score)+(r.grade?'/'+r.grade:'')).join(', ')}`)
  }
}
process.exit(0)
