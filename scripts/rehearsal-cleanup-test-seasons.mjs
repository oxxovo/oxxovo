// Task 3 -- neutralize the leftover test seasons (season_1000..1006) so they stop
// hijacking getCurrentSeason(). getCurrentSeason picks the newest season whose
// application_open_at <= now; these test seasons (opened Jun-Jul) outrank the real
// ones. seasons_public exposes ALL rows (no draft filter -- verified), so draft is
// NOT the lever -- application_open_at IS. We NULL both open+close so they also
// drop out of the season-tick deferral/transition churn. Reversible, non-destructive
// (no rows deleted). season_0 and season_test are NEVER touched here.
import { createClient } from '@supabase/supabase-js'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const TARGETS = ['season_1000','season_1001','season_1002','season_1003','season_1004','season_1005','season_1006']

const { data: before } = await admin.from('seasons')
  .select('id, season_number, status, application_open_at, application_close_at').in('id', TARGETS).order('season_number')
console.log('BEFORE:')
for (const s of before ?? []) console.log(`  ${s.id} #${s.season_number} status=${s.status} open=${s.application_open_at ?? '-'} close=${s.application_close_at ?? '-'}`)

const { error } = await admin.from('seasons')
  .update({ application_open_at: null, application_close_at: null, updated_at: new Date().toISOString() })
  .in('id', TARGETS)
if (error) { console.error('FAILED:', error.message); process.exit(1) }

const { data: after } = await admin.from('seasons')
  .select('id, application_open_at, application_close_at').in('id', TARGETS)
console.log('\nAFTER (expect all null):')
for (const s of after ?? []) console.log(`  ${s.id} open=${s.application_open_at ?? 'null'} close=${s.application_close_at ?? 'null'}`)

// Sanity: what does getCurrentSeason resolve to now? (newest open<=now, base table)
const now = new Date().toISOString()
const { data: cur } = await admin.from('seasons')
  .select('id, season_number, status, application_open_at').lte('application_open_at', now)
  .order('application_open_at', { ascending: false }).limit(1).maybeSingle()
console.log('\ngetCurrentSeason() would now pick:', cur ? `${cur.id} (#${cur.season_number}, open=${cur.application_open_at})` : '(none opened yet -> falls to soonest upcoming)')
console.log('  -> expect season_test once its window is set open by the rehearsal, else season_0 stays future.')
process.exit(0)
