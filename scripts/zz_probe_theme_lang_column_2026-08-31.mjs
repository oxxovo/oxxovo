import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const r = await supabase.from('seasons').select('*').eq('id', 'season_0').maybeSingle()
const keys = Object.keys(r.data).sort()
console.log(keys.filter(k => /theme|twist|brief|lang|locale/i.test(k)).join('\n'))
