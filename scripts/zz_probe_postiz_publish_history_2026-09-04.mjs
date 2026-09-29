import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: logs, error } = await db.from('promo_publish_log').select('*').order('attempted_at', { ascending: false }).limit(20)
if (error) { console.error(error); process.exit(1) }
console.log(`총 ${logs.length}건 (최신순)`)
for (const l of logs) {
  console.log(JSON.stringify({ id: l.id, at: l.attempted_at, by: l.triggered_by, channels: l.channels, status: l.status, err: l.error_message, capLen: l.caption?.length }))
}
const { data: posted } = await db.from('promo_videos').select('id, theme_note, posted_channels, posted_at, postiz_post_id').not('posted_at', 'is', null)
console.log(`\n실제 posted_at 있는 행: ${posted?.length ?? 0}`)
for (const p of posted ?? []) console.log(JSON.stringify(p))
