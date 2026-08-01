#!/usr/bin/env node
// Back-compat audit for the text geometry guard.
//
// The render spec neither wraps nor shrinks to fit, so a layer can run off the
// frame horizontally or vertically. Before those checks became a hard gate we had
// to know whether they would RETROACTIVELY reject rows that already exist --
// ①async submission re-verifies the source at BOTH intent and finalize, so a new
// hard gate could fail a submission that was already accepted, eliminating a
// participant for something that is not their fault.
//
// ★ It measures with lib/text-metrics -- the SAME function the gate uses. Measuring
// with a real canvas here would audit a different rule than the one that ships.
//
// This script only SELECTs.
// Run: node --env-file=.env.local --import ./scripts/test-register.mjs scripts/text-fit-audit.mjs

import { createClient } from '@supabase/supabase-js'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { textBlockMetrics, undrawableChars } from '../lib/text-metrics.ts'
import { TEXT_CANVAS, TIGHTEST_ASPECT } from '../lib/text-limits.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const { data, error } = await admin
  .from('render_jobs')
  .select('id, status, season_id, edl, submitted_at, submit_intent_at, finalized_at, created_at')
  .order('created_at', { ascending: true })
if (error) { console.error('query failed:', error.message); process.exit(1) }

const byStatus = new Map()
const offenders = []
let rowsWithText = 0
let layerTotal = 0
const buckets = { '<=60%': 0, '60-80%': 0, '80-95%': 0, '95-100%': 0, '>100%': 0 }

for (const row of data ?? []) {
  byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1)
  const edl = row.edl
  const texts = Array.isArray(edl) ? [] : (edl?.texts ?? [])
  if (!texts.length) continue
  rowsWithText++

  const aspect = (Array.isArray(edl) ? undefined : edl?.aspect) ?? TIGHTEST_ASPECT
  const [W, H] = TEXT_CANVAS[aspect] ?? TEXT_CANVAS[TIGHTEST_ASPECT]

  const bad = []
  for (let i = 0; i < texts.length; i++) {
    layerTotal++
    const m = textBlockMetrics(texts[i], W, H)
    const missing = undrawableChars(texts[i].font, texts[i].content)
    const p = m.widthFrac * 100
    if (p > 100) buckets['>100%']++
    else if (p > 95) buckets['95-100%']++
    else if (p > 80) buckets['80-95%']++
    else if (p > 60) buckets['60-80%']++
    else buckets['<=60%']++

    const why = []
    if (m.widthFrac > 1) why.push(`too_wide ${p.toFixed(0)}%`)
    if (m.bottomFrac > 1) why.push(`too_tall ${(m.bottomFrac * 100).toFixed(0)}%`)
    if (missing.length) why.push(`no_glyph ${missing.join('')}`)
    if (why.length) bad.push({ i, why, content: texts[i].content, font: texts[i].font, sizePct: texts[i].sizePct })
  }
  if (bad.length) offenders.push({ row, aspect, W, H, bad })
}

console.log(`APP : ${ROOT}`)
console.log(`DB  : ${SUPABASE_URL}`)
console.log(`\nrender_jobs total: ${data?.length ?? 0}`)
console.log('by status: ' + [...byStatus.entries()].map(([k, v]) => `${k}=${v}`).join(' '))
console.log(`rows with text layers: ${rowsWithText}   text layers total: ${layerTotal}`)
console.log(`\n★ rows the geometry + glyph HARD GATE would reject: ${offenders.length}`)

if (offenders.length) {
  const perStatus = new Map()
  for (const o of offenders) perStatus.set(o.row.status, (perStatus.get(o.row.status) ?? 0) + 1)
  console.log('   by status: ' + [...perStatus.entries()].map(([k, v]) => `${k}=${v}`).join(' '))
  for (const o of offenders) {
    console.log(`\n  ${o.row.id}  status=${o.row.status}  aspect=${o.aspect} (${o.W}x${o.H})  season=${o.row.season_id}`)
    console.log(`    submitted_at=${o.row.submitted_at ?? '-'}  intent=${o.row.submit_intent_at ?? '-'}  finalized=${o.row.finalized_at ?? '-'}`)
    for (const b of o.bad) {
      console.log(`    layer[${b.i}] ${b.sizePct}% ${b.font} -> ${b.why.join(', ')}  "${String(b.content).replace(/\n/g, '\\n')}"`)
    }
  }
}

console.log('\nlayer width distribution: ' + Object.entries(buckets).map(([k, v]) => `${k}=${v}`).join('  '))
