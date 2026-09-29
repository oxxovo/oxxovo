import { createClient } from '@supabase/supabase-js'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const db = createClient(url, key, { auth: { persistSession: false } })

const NEEDLES = ['demo_artisan', 'demo_anne', 'demo_duel']
const { data, error } = await db.from('genesis_applications')
  .select('id, creator_name, video_title, free_entry_url, season_id')
  .or(NEEDLES.map(n => `free_entry_url.ilike.%${n}%`).join(','))
  .limit(50)
if (error) console.error('error:', error.message)
else for (const r of data) console.log(`${r.season_id} :: ${r.creator_name} :: ${r.video_title} :: ${r.free_entry_url}`)
process.exit(0)
