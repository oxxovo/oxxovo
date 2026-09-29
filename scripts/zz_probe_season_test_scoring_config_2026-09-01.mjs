import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data, error } = await supabase
  .from('seasons')
  .select('id, scoring_intent_clarity_weight, scoring_execution_weight, scoring_originality_weight, scoring_integrity_weight, flag_integrity_high_threshold, flag_integrity_medium_threshold, flag_integrity_low_threshold')
  .eq('id', 'season_test')
  .single()
if (error) { console.error(error); process.exit(1) }
console.log(JSON.stringify(data, null, 2))
