import { createClient } from '@supabase/supabase-js'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data, error } = await admin
  .from('seasons')
  .select('id, scoring_intent_clarity_weight, scoring_execution_weight, scoring_originality_weight, scoring_integrity_weight')
  .eq('id', 'season_0')
  .single()
if (error) { console.error(error.message); process.exit(1) }
console.log(JSON.stringify(data, null, 2))
