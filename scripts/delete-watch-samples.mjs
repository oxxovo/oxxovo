// Delete the 5 old /watch visual-test samples ([TEST] Nova Park etc.) in season_0.
// Keyed strictly on the @watch-test.local domain -- disjoint from the pipeline
// test rows (@pipeline-test.local / season_test), which are KEPT.
import { createClient } from '@supabase/supabase-js'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: before } = await admin.from('genesis_applications')
  .select('id, season_id, email, creator_name').ilike('email', '%@watch-test.local')
console.log('to delete (' + (before?.length ?? 0) + '):')
for (const r of before ?? []) console.log(`  ${r.season_id}  ${r.email}  ${r.creator_name}`)

// Safety assertion: none of these may be season_test / @pipeline-test.local
const unsafe = (before ?? []).filter(r => r.season_id === 'season_test' || r.email?.includes('@pipeline-test.local'))
if (unsafe.length) { console.error('ABORT: match hit pipeline-test rows'); process.exit(1) }

const { error, count } = await admin.from('genesis_applications')
  .delete({ count: 'exact' }).ilike('email', '%@watch-test.local')
if (error) { console.error('DELETE failed:', error.message); process.exit(1) }
console.log('\ndeleted rows:', count)

const { data: after } = await admin.from('genesis_applications')
  .select('id').ilike('email', '%@watch-test.local')
console.log('remaining @watch-test.local rows (expect 0):', after?.length ?? 0)

// Confirm season_test untouched (expect 20)
const { count: st } = await admin.from('genesis_applications')
  .select('id', { count: 'exact', head: true }).eq('season_id', 'season_test')
console.log('season_test rows (expect 20):', st)
process.exit(0)
