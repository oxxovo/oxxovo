import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data, error } = await supabase.from('seasons').select('*').in('id', ['season_0', 'season_test'])
if (error) { console.error(error); process.exit(1) }
const s0 = data.find(r => r.id === 'season_0')
const st = data.find(r => r.id === 'season_test')
const keys = Array.from(new Set([...Object.keys(s0), ...Object.keys(st)])).sort()
const diffs = []
for (const k of keys) {
  const a = JSON.stringify(s0[k])
  const b = JSON.stringify(st[k])
  if (a !== b) diffs.push({ column: k, season_0: s0[k], season_test: st[k] })
}
console.log('TOTAL_COLUMNS', keys.length)
console.log('DIFF_COUNT', diffs.length)
for (const d of diffs) console.log(JSON.stringify(d))
