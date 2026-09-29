import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data, error } = await supabase.from('profiles').select('locale').limit(1)
if (error) {
  console.log('COLUMN_MISSING', error.code, error.message)
} else {
  console.log('COLUMN_EXISTS', JSON.stringify(data))
}
