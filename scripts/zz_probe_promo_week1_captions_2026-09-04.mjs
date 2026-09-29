import { createClient } from '@supabase/supabase-js'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const db = createClient(url, key, { auth: { persistSession: false } })
const labels = ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'C01']
for (const l of labels) {
  const { data, error } = await db.from('promo_videos')
    .select('id, created_at, theme_note, video_url, caption, channels, status')
    .ilike('theme_note', `%${l}%`)
    .order('created_at')
  if (error) { console.error(l, error.message); continue }
  console.log(`\n=== ${l} (${data.length}) ===`)
  for (const r of data) {
    console.log(JSON.stringify({ id: r.id, theme_note: r.theme_note, video_url: r.video_url, caption: r.caption, channels: r.channels, status: r.status }))
  }
}
