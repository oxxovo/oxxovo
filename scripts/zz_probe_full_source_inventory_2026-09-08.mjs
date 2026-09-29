// Read-only: enumerate the FULL candidate source pool (promo A-series, cf-series,
// watch_demo, tk_render) before any more GT21 editing. HQ 2026-09-08 directive:
// screen the whole pool once, not one clip at a time.
import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: promos } = await db.from('promo_videos').select('id, video_url, theme_note, status').order('theme_note')
const aSeries = (promos || []).filter(r => /_EN_9x16/.test(r.video_url || ''))
console.log(`=== promo/content_video A-series (EN only): ${aSeries.length} ===`)
for (const r of aSeries) console.log(r.video_url.split('/').pop())

const { data: demos } = await db.from('genesis_applications')
  .select('free_entry_url')
  .ilike('free_entry_url', '%watch_demo%')
const demoUrls = [...new Set((demos || []).map(r => r.free_entry_url))]
console.log(`\n=== watch_demo: ${demoUrls.length} ===`)
for (const u of demoUrls) console.log(u.split('/').pop())

const { data: renders } = await db.from('genesis_applications')
  .select('free_entry_url')
  .ilike('free_entry_url', '%/renders/%')
const renderUrls = [...new Set((renders || []).map(r => r.free_entry_url))]
console.log(`\n=== renders (tk_render etc): ${renderUrls.length} ===`)
for (const u of renderUrls) console.log(u)

process.exit(0)
