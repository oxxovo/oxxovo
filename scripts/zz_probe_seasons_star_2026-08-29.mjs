import { createClient } from '@supabase/supabase-js'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data, error } = await admin.from('seasons').select('*').eq('id','season_0').maybeSingle()
if (error) { console.error(error.message); process.exit(1) }
const weightKeys = Object.keys(data).filter(k => k.includes('weight') || k.includes('score'))
for (const k of weightKeys) console.log(k, '=', data[k])
