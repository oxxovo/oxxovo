import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const r = await supabase.from('seasons').select('id, main_round_theme, main_round_theme_label, main_round_twist').eq('id', 'season_test').maybeSingle()
console.log(JSON.stringify(r.data, null, 2))
