import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data, error } = await supabase
  .from('profiles')
  .select('id, email, locale, creator_name, country')
  .or('email.ilike.%test%,email.ilike.%demo%,email.ilike.%oxxovo-demo%')
  .limit(20)
if (error) { console.error(error); process.exit(1) }
for (const r of data) console.log(JSON.stringify(r))
console.log('count:', data.length)
