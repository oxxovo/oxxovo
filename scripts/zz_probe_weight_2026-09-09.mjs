import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data } = await db.from('seasons').select('id, ai_score_weight, community_vote_weight').in('id', ['season_0'])
console.log(JSON.stringify(data))
