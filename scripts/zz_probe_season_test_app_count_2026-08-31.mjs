import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data, count, error } = await supabase
  .from('genesis_applications')
  .select('id, email, status', { count: 'exact' })
  .eq('season_id', 'season_test')
  .order('email')
if (error) { console.error(error); process.exit(1) }
console.log('COUNT', count)
for (const r of data) console.log(r.email, r.status)
