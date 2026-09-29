import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data, error } = await supabase
  .from('seasons')
  .select('id, name, season_number, is_fixture, status, allowed_video_platforms, watch_fixture_visible, application_open_at, application_close_at, main_round_start_at')
  .order('season_number', { ascending: true })
if (error) { console.error(error); process.exit(1) }
for (const s of data) {
  console.log(JSON.stringify(s))
}
