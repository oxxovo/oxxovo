// Read-only: find real clips where any judge flagged a genuine "background"
// finding (background INSTABILITY per HQ 2026-09-08 correction, not a scene
// swap) inside judgingSteps.step3_defects. Scans ALL scoring_results.
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const db = createClient(url, key, { auth: { persistSession: false } })

const { data: rows, error } = await db.from('scoring_results')
  .select('id, application_id, judged_status, rubric_version, ai_outputs')
  .not('ai_outputs', 'is', null)
  .limit(2000)
if (error) { console.error('scoring_results error:', error.message); process.exit(1) }

const appIds = [...new Set(rows.map(r => r.application_id).filter(Boolean))]
const { data: apps } = await db.from('genesis_applications')
  .select('id, creator_name, video_title, free_entry_url, season_id')
  .in('id', appIds)
const appMap = new Map((apps || []).map(a => [a.id, a]))

console.log(`scanned ${rows.length} scoring_results rows\n`)

let hits = 0
for (const r of rows) {
  const app = appMap.get(r.application_id)
  const outputs = r.ai_outputs || {}
  for (const judge of Object.keys(outputs)) {
    const out = outputs[judge]
    const defects = out?.judgingSteps?.step3_defects ?? out?.step3_defects
    if (!defects) continue
    let bgFinding = null
    if (!Array.isArray(defects) && defects.background && defects.background !== 'NONE OBSERVED') {
      bgFinding = defects.background
    } else if (Array.isArray(defects)) {
      const hit = defects.find(d => /background/i.test(d.issue || '') || /background/i.test(d.evidence || ''))
      if (hit) bgFinding = `${hit.issue}: ${hit.evidence}`
    }
    if (bgFinding) {
      hits++
      console.log(`[${judge}] rubric=${r.rubric_version} season=${app?.season_id} ${app?.creator_name} (${app?.video_title})`)
      console.log(`    ${bgFinding}`)
      console.log(`    url: ${app?.free_entry_url}`)
    }
  }
}
console.log(`\ntotal background findings: ${hits}`)
process.exit(0)
