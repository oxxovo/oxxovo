import { createClient } from '@supabase/supabase-js'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const db = createClient(url, key, { auth: { persistSession: false } })
const { data, error } = await db.from('genesis_applications').select('*').eq('season_id','season_test').ilike('creator_name','TEST-%').order('creator_name').limit(3)
if (error) { console.error(error); process.exit(1) }
console.log(JSON.stringify(data, null, 2))
