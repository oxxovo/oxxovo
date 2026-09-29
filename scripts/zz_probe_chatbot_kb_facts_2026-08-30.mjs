import { createClient } from '@supabase/supabase-js'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data, error } = await admin
  .from('seasons')
  .select(
    'id, application_open_at, application_close_at, main_round_start_at, main_round_end_at, community_vote_start_at, community_vote_end_at, awards_announcement_at, total_prize_pool, prize_first, prize_second, prize_third, community_vote_weight',
  )
  .in('id', ['season_0'])
if (error) { console.error(error.message); process.exit(1) }
console.log(JSON.stringify(data, null, 2))
