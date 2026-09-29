import { createClient } from '@supabase/supabase-js'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data, error } = await admin.from('information_schema.columns').select('column_name, data_type').eq('table_schema','public').eq('table_name','seasons').ilike('column_name', '%weight%')
if (error) { console.error(error.message); process.exit(1) }
console.log(JSON.stringify(data, null, 2))
