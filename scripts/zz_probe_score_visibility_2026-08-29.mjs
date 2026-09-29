import { createClient } from '@supabase/supabase-js'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data, error } = await admin.from('seasons').select('id, watch_scores_public').in('id', ['season_0','season_test'])
if (error) { console.error(error.message); process.exit(1) }
console.log(JSON.stringify(data, null, 2))
