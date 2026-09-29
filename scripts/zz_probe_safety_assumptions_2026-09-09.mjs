import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

console.log('=== nickname banned word lists (platform_config) ===')
const { data: cfg } = await db.from('platform_config').select('key, value').in('key', ['nickname_banned_words_general', 'nickname_banned_words_impersonation'])
console.log(JSON.stringify(cfg))

console.log('\n=== season_0 allowed_video_platforms ===')
const { data: s0 } = await db.from('seasons').select('id, allowed_video_platforms').in('id', ['season_0'])
console.log(JSON.stringify(s0))

console.log('\n=== fixture seasons (is season_test / demo flagged?) ===')
const { data: allSeasons } = await db.from('seasons').select('id, status')
console.log(JSON.stringify(allSeasons))
