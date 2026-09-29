// One-off: resolve real URLs for GT21 source clips (ffmpeg 18편 제작 전 확인용).
// Read-only probe, no writes.
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Missing SUPABASE env'); process.exit(1) }
const db = createClient(url, key, { auth: { persistSession: false } })

const NEEDLES = [
  'A02_fabric', 'A03_street', 'A07', 'A08', 'A11_night', 'A13_group',
  'A14_solo', 'A16_crowd', 'A17_vista', 'A18_cities', 'A19_sunrise', 'A20_culture',
  'demo_artisan', 'demo_anne', 'demo_duel',
]

const { data, error } = await db.from('promo_videos').select('id, video_url, theme_note, status').limit(2000)
if (error) { console.error('promo_videos error:', error.message) } else {
  console.log(`\npromo_videos rows: ${data.length}`)
  for (const n of NEEDLES) {
    const hits = data.filter(r => (r.theme_note || '').includes(n) || (r.video_url || '').includes(n))
    for (const h of hits) console.log(`  [${n}] ${h.id} :: ${h.video_url}`)
  }
}
process.exit(0)
