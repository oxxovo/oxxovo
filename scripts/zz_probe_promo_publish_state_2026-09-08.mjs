import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const week1Ids = [
  '250072ab-ee02-4fad-8f62-3e852915d4a5', '35cccd52-7031-4b7a-a503-bc2e9721916b',
  '8163cf0e-42c8-4889-88ef-66ab7f3a0c56', '0fdb8ebb-4cc4-45bf-8757-624ea706e651',
  'abadec96-663c-4147-95eb-bee6e87c6182', '319a5aa4-8b24-45a1-9e12-bfef331c7885',
  '7c0a321c-9a8c-47d7-9d4b-8aa6bf7ce002', 'c03a8fc9-092a-4d10-83c1-c52a4459f435',
  '399c982a-c6d3-4b8e-9a55-4b70f29ad040', '096105ea-81f0-4c38-980b-e23445a51ee3',
  '436d50dd-8f32-47cc-839e-b6344922f1ee', '9a59b0d0-163b-480f-84cc-970d09f2cb5c',
  'b42a8b98-e7b7-47a7-ac97-69560769cf73', '8e3b9240-6f36-427f-bab3-9622f10cef78',
]
const { data, error } = await db.from('promo_videos')
  .select('id, theme_note, approved, approved_at, channels, postiz_post_id, posted_channels, posted_at, status, caption')
  .in('id', week1Ids)
if (error) { console.error(error); process.exit(1) }
for (const r of data) {
  console.log(JSON.stringify({ id: r.id, theme_note: r.theme_note, approved: r.approved, channels: r.channels, postiz_post_id: r.postiz_post_id, posted_channels: r.posted_channels, posted_at: r.posted_at, status: r.status, hasCaption: !!r.caption }))
}

// Overall approved tally (should be 0/86 per 제니3's statement -- confirm).
const { count: approvedCount } = await db.from('promo_videos').select('id', { count: 'exact', head: true }).eq('approved', true).is('deleted_at', null)
const { count: totalCount } = await db.from('promo_videos').select('id', { count: 'exact', head: true }).is('deleted_at', null)
console.log(`\napproved tally: ${approvedCount}/${totalCount}`)

// platform_config cadence / auto-publish gate
const { data: cfg } = await db.from('platform_config').select('key, value').in('key', ['promo_auto_publish_enabled', 'promo_publish_cadence'])
console.log('platform_config:', JSON.stringify(cfg))

// promo_publish_log for these 14 (any attempt at all, success or fail)
const { data: logs } = await db.from('promo_publish_log').select('*').in('promo_video_id', week1Ids)
console.log(`\npromo_publish_log rows for week1: ${logs?.length ?? 0}`)
for (const l of logs ?? []) console.log(JSON.stringify(l))
