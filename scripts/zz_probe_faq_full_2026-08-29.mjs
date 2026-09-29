#!/usr/bin/env node
// zz_ probe: READ-ONLY full dump of faq_items, grouped by surface, HQ urgent
// request 2026-08-29 (Watch shows 9, Jenny3 wrote 27 -- mismatch check).
// Run: node --env-file=.env.local scripts/zz_probe_faq_full_2026-08-29.mjs
import { createClient } from '@supabase/supabase-js'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: all, error } = await admin
  .from('faq_items')
  .select('id, surface, question_en, question_ko, answer_en, answer_ko, sort_order, is_active, created_at, updated_at')
  .order('surface')
  .order('sort_order')
if (error) { console.error('faq_items read failed:', error.message); process.exit(1) }
console.log('TOTAL ROWS:', all.length)
const bySurface = {}
for (const r of all) { (bySurface[r.surface] ??= []).push(r) }
for (const [surface, rows] of Object.entries(bySurface)) {
  console.log(`\n=== surface=${surface} (${rows.length} rows, ${rows.filter((r) => r.is_active).length} active) ===`)
  for (const r of rows) {
    console.log(`  [${r.is_active ? 'ACTIVE' : 'inactive'}] sort=${r.sort_order} id=${r.id}`)
    console.log(`    Q(ko): ${r.question_ko}`)
    console.log(`    A(ko): ${r.answer_ko}`)
    console.log(`    updated_at: ${r.updated_at}`)
  }
}
