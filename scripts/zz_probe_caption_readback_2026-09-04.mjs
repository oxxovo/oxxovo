import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data } = await db.from('promo_videos').select('theme_note, caption').eq('id', '250072ab-ee02-4fad-8f62-3e852915d4a5').single()
console.log('theme_note:', data.theme_note)
console.log('--- caption raw (JSON, \n visible) ---')
console.log(JSON.stringify(data.caption))
console.log('--- caption rendered ---')
console.log(data.caption)
