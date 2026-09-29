import { createClient } from '@supabase/supabase-js'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: season, error: e1 } = await admin
  .from('seasons')
  .select('id, max_applicants, application_video_min_seconds, application_video_max_seconds, main_round_video_min_seconds, main_round_video_max_seconds, ai_score_weight, community_vote_weight')
  .eq('id', 'season_0')
  .single()
if (e1) console.error('seasons error:', e1.message)
else console.log('season_0:', JSON.stringify(season, null, 2))

const { data: cfg, error: e2 } = await admin
  .from('platform_config')
  .select('key, value')
  .eq('key', 'membership_founding_free_count')
if (e2) console.error('platform_config error:', e2.message)
else console.log('membership_founding_free_count:', JSON.stringify(cfg, null, 2))

const { data: ar, error: e3 } = await admin.from('seasons').select('id, aspect_ratio').eq('id', 'season_0').single()
if (e3) console.error('aspect_ratio error:', e3.message)
else console.log('aspect_ratio:', JSON.stringify(ar))
