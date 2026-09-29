import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data, error } = await db.from('model_catalog').select('*').limit(500)
if (error) { console.error(error.message); process.exit(1) }
console.log('columns:', Object.keys(data[0] ?? {}))
for (const r of data) {
  console.log(JSON.stringify(r))
}
