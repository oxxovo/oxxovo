// TEMP: (1) fill thumbnail_url on the 6 demo apps, (2) hide the 21 non-demo
// public cards (watch_hidden = true; NOT deleted, reversible) so the demo shows
// 6 clean cards and the LIVE bar completes 6/6.
//   node --env-file=.env.local _watch_demo_finalize.mjs
import { createClient } from '@supabase/supabase-js'
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const BASE = 'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/posters/season_test/watch_demo'
const DEMO = [
  { id: '72f5386a-cbb9-47b8-a705-e0ff85523e53', name: 'demo_artisan' },
  { id: '6e4addfa-d4af-49c8-a7e3-bc5a88cd2971', name: 'demo_sf' },
  { id: 'ee72af6f-3f96-4aea-841f-d0fbe8d01e80', name: 'demo_duel' },
  { id: 'ff640185-4605-4017-af69-ed7bdf72c128', name: 'demo_astronaut' },
  { id: '19a304e0-e59b-4a76-b427-380b198de011', name: 'demo_ichar' },
  { id: 'bb5d2ab6-1cb3-48c5-a8b9-60905fc19faf', name: 'demo_anne' },
]
const demoIds = new Set(DEMO.map((d) => d.id))

// (1) thumbnails
for (const d of DEMO) {
  const { error } = await admin
    .from('genesis_applications')
    .update({ thumbnail_url: `${BASE}/${d.name}.jpg` })
    .eq('id', d.id)
  if (error) { console.error(`thumb ${d.name}: ${error.message}`); process.exit(1) }
  console.error(`thumb set: ${d.name}`)
}

// (2) hide non-demo public cards
const HIDDEN = new Set(['rejected', 'flagged'])
const { data: apps } = await admin
  .from('genesis_applications')
  .select('id, creator_name, status, watch_hidden, moderation_status, free_entry_url')
  .eq('season_id', 'season_test')
const toHide = (apps ?? []).filter(
  (r) =>
    !demoIds.has(r.id) &&
    !HIDDEN.has(r.status) &&
    !r.watch_hidden &&
    r.moderation_status === 'approved' &&
    r.free_entry_url?.trim(),
)
console.error(`\nhiding ${toHide.length} non-demo cards...`)
for (const r of toHide) {
  const { error } = await admin
    .from('genesis_applications')
    .update({
      watch_hidden: true,
      watch_hidden_at: new Date().toISOString(),
      watch_hidden_reason: 'demo view — pipeline-test/studio-test artifacts hidden (reversible)',
    })
    .eq('id', r.id)
  if (error) { console.error(`hide ${r.creator_name}: ${error.message}`); process.exit(1) }
}
console.error(`hidden: ${toHide.map((r) => r.creator_name).join(', ')}`)
console.log('DONE')
process.exit(0)
