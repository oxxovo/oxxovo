// One-time backfill: archive TK's already-submitted-round clips into My Library.
// Run AFTER reports/studio_archived_at_2026-07.sql (needs archived_at column).
//   node --env-file=.env.local _studio_archive_backfill.mjs            (dry-run)
//   node --env-file=.env.local _studio_archive_backfill.mjs --apply    (writes)
// NEVER deletes -- only sets archived_at on READY clips whose round is submitted.
import { createClient } from '@supabase/supabase-js'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const TK = '9b5ceed5-34b3-4a64-af4a-3fe898dd547f'
const SEASON = 'season_test'
const APPLY = process.argv.includes('--apply')

// column guard
const probe = await admin.from('generation_jobs').select('archived_at').limit(0)
if (probe.error) { console.error('archived_at MISSING -- run the migration first:', probe.error.message); process.exit(1) }

const { data: app } = await admin.from('genesis_applications')
  .select('studio_application_submitted_at, main_round_submitted_at, main_round_video_url')
  .eq('season_id', SEASON).eq('user_id', TK).maybeSingle()
const { data: season } = await admin.from('seasons').select('main_round_start_at, studio_round').eq('id', SEASON).single()
const boundary = season.main_round_start_at ? new Date(season.main_round_start_at).getTime() : null

const { data: clips } = await admin.from('generation_jobs')
  .select('id, status, created_at, archived_at').eq('user_id', TK).eq('season_id', SEASON).eq('status', 'ready').is('archived_at', null)

// application round submitted? -> archive its ready clips (created before boundary, or all if no boundary)
const appSubmitted = !!app?.studio_application_submitted_at
const mainSubmitted = !!app?.main_round_submitted_at
const targets = (clips ?? []).filter((c) => {
  const t = new Date(c.created_at).getTime()
  const isApp = boundary == null || t < boundary
  const isMain = boundary != null && t >= boundary
  return (isApp && appSubmitted) || (isMain && mainSubmitted)
})
console.log(`app submitted: ${appSubmitted}, main submitted: ${mainSubmitted}`)
console.log(`ready clips: ${(clips ?? []).length}, to archive: ${targets.length}`)
targets.forEach((c) => console.log('  ', c.id, c.created_at))
if (!APPLY) { console.log('\nDry-run. Re-run with --apply to archive.'); process.exit(0) }
const now = new Date().toISOString()
let ok = 0
for (const c of targets) {
  const { error } = await admin.from('generation_jobs').update({ archived_at: now, updated_at: now }).eq('id', c.id)
  if (error) console.error('  FAIL', c.id, error.message); else ok++
}
console.log(`\narchived ${ok}/${targets.length} (moved to My Library, NOT deleted).`)
