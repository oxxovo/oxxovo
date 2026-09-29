import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: s } = await db.from('seasons').select('id, main_round_disqualification_enabled, flag_integrity_threshold').eq('id', 'season_0')
console.log('season_0 disqualify config:', JSON.stringify(s))
const { data: cols } = await db.rpc('pg_catalog_noop').catch(()=>({data:null}))
