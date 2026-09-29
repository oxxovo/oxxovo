import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const r = await supabase
  .from('seasons')
  .select('id, total_prize_pool, prize_first_pct, prize_second_pct, prize_third_pct, prize_first, prize_second, prize_third')
  .in('id', ['season_0', 'season_test'])
console.log(JSON.stringify(r.data, null, 2))
console.log(r.error)
