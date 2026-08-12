// TEMP: create season_test2 (clean E2E) by cloning season_test's config, then
// seed 12 demo competitors (reuse season_test demo R2 urls) as fresh pending
// entries. season_test itself is untouched. Run:
//   node --env-file=.env.local _season_test2_setup.mjs
import { createClient } from '@supabase/supabase-js'
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const NEW_ID = 'season_test2'

// 1. Clone season_test row -> season_test2 with E2E dates.
const { data: src, error: se } = await admin.from('seasons').select('*').eq('id', 'season_test').single()
if (se || !src) { console.error('load season_test failed:', se?.message); process.exit(1) }

const row = { ...src }
delete row.created_at
delete row.updated_at
// GENERATED columns (computed from prize_pool etc.) cannot be inserted.
delete row.prize_first
delete row.prize_second
delete row.prize_third
row.id = NEW_ID
row.season_number = 998
row.display_name = 'Season Test 2 (E2E)'
row.status = 'active'
row.application_open_at = '2026-07-01T00:00:00+00:00'   // already open
row.application_close_at = '2026-07-15T06:59:00+00:00'  // 7/14 23:59 PT
row.scoring_complete_at = '2026-07-15T14:00:00+00:00'   // 7/15 (advance gate)
row.main_round_start_at = null
row.main_round_end_at = null
row.awards_announcement_at = null
row.community_vote_start_at = null
row.community_vote_end_at = null
row.top_n_advance = 10

const { error: ie } = await admin.from('seasons').upsert(row, { onConflict: 'id' })
if (ie) { console.error('insert season_test2 failed:', ie.message); process.exit(1) }
console.error(`+ season_test2 created (close 7/14, scoring_complete 7/15, status active)`)

// 2. Seed 12 demo competitors: reuse season_test demo entries' urls/posters as
//    fresh pending entries under season_test2 (fresh scoring).
const { data: demos, error: de } = await admin
  .from('genesis_applications')
  .select('creator_name, country, free_entry_url, creator_statement, video_title, ai_service, video_duration_seconds, thumbnail_url')
  .eq('season_id', 'season_test')
  .like('email', 'watch-%@oxxovo-demo.local')
  .not('free_entry_url', 'is', null)
  .limit(12)
if (de) { console.error('load demos failed:', de.message); process.exit(1) }

let n = 0
for (const d of demos ?? []) {
  const { error } = await admin.from('genesis_applications').insert({
    creator_name: d.creator_name,
    email: `t2-${(d.creator_name || 'demo').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${n}@oxxovo-demo.local`,
    country: d.country,
    free_entry_url: d.free_entry_url,
    creator_statement: d.creator_statement,
    video_title: d.video_title,
    ai_service: d.ai_service,
    video_duration_seconds: d.video_duration_seconds,
    thumbnail_url: d.thumbnail_url,
    season_id: NEW_ID,
    status: 'pending',
    moderation_status: 'approved',
    watch_hidden: false,
    agreed_to_rules: true,
    agreed_to_privacy: true,
    agreed_to_integrity_notice: true,
    user_id: null,
    ai_score: null,
  })
  if (error) { console.error(`insert demo ${n} failed: ${error.message}`); process.exit(1) }
  n++
}
console.error(`+ ${n} demo competitors seeded into season_test2 (pending)`)
console.log('DONE')
process.exit(0)
