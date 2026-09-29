import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data, error } = await supabase
  .from('genesis_applications')
  .select('email, season_id, creator_name, user_id')
  .eq('season_id', 'season_test')
  .order('created_at', { ascending: false })
  .limit(10)
if (error) { console.error(error); process.exit(1) }
for (const r of data) console.log(JSON.stringify(r))
