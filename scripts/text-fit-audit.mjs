#!/usr/bin/env node
// Back-compat audit for the proposed TEXT WIDTH validation (finding A).
//
// The text spec does not wrap or shrink to fit, so a layer can render off the
// edges of the canvas. Before a width check becomes a hard gate we have to know
// whether it would RETROACTIVELY reject rows that already exist -- ①async
// submission re-verifies the source at BOTH intent and finalize, so a new hard
// gate could fail a submission that was already accepted. That would eliminate a
// participant for something that is not their fault.
//
// This script only SELECTs. It measures every text layer in every render_jobs
// EDL with the WORKER'S OWN fonts + the WORKER'S OWN canvas size, and reports
// how many rows would be rejected, grouped by status.
//
// Run: node --env-file=.env.local scripts/text-fit-audit.mjs

import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { createClient } from '@supabase/supabase-js'
import { resolveWorkerRepo } from './worker-repo.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORKER_REPO = resolveWorkerRepo(ROOT)
const OT = await import(pathToFileURL(join(WORKER_REPO, 'src', 'text-render.ts')).href)
for (const f of OT.FONT_SPECS) GlobalFonts.registerFromPath(join(WORKER_REPO, 'assets', 'fonts', f.file), f.family)

// ★ The REAL output canvas, from the worker's canvasForAspect() (src/render.ts:169).
// Width-as-%-of-canvas is aspect-ratio invariant, but use the true numbers so the
// audit cannot drift from what actually ships.
const CANVAS = { '9:16': [720, 1280], '16:9': [1280, 720] }
const DEFAULT_ASPECT = '9:16'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

// Widest line of a layer, as a % of canvas width. Same measureText the renderer
// uses, at the same font px -- not an estimate.
function widestPct(ctx, W, H, layer) {
  ctx.font = `${OT.fontPx(layer, H)}px "${OT.fontSpec(layer.font).family}"`
  let max = 0
  for (const line of String(layer.content ?? '').split('\n')) {
    max = Math.max(max, ctx.measureText(line).width)
  }
  return (max / W) * 100
}

const { data, error } = await admin
  .from('render_jobs')
  .select('id, status, season_id, edl, submitted_at, submit_intent_at, finalized_at, created_at')
  .order('created_at', { ascending: true })
if (error) { console.error('query failed:', error.message); process.exit(1) }

const byStatus = new Map()
const withText = []
const offenders = []
let layerTotal = 0

for (const row of data ?? []) {
  byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1)
  const edl = row.edl
  const texts = Array.isArray(edl) ? [] : (edl?.texts ?? [])
  if (!texts.length) continue
  withText.push(row)

  const aspect = (Array.isArray(edl) ? undefined : edl?.aspect) ?? DEFAULT_ASPECT
  const [W, H] = CANVAS[aspect] ?? CANVAS[DEFAULT_ASPECT]
  const ctx = createCanvas(W, H).getContext('2d')

  const bad = []
  for (let i = 0; i < texts.length; i++) {
    layerTotal++
    const pct = widestPct(ctx, W, H, texts[i])
    if (pct > 100) bad.push({ i, pct, content: texts[i].content, font: texts[i].font, sizePct: texts[i].sizePct })
  }
  if (bad.length) offenders.push({ row, aspect, W, H, bad })
}

console.log(`APP    : ${ROOT}`)
console.log(`WORKER : ${WORKER_REPO}`)
console.log(`DB     : ${SUPABASE_URL}`)
console.log(`\nrender_jobs total: ${data?.length ?? 0}`)
console.log('by status: ' + [...byStatus.entries()].map(([k, v]) => `${k}=${v}`).join(' '))
console.log(`rows with text layers: ${withText.length}   text layers total: ${layerTotal}`)
console.log(`\n★ rows a >100%-of-width HARD GATE would reject: ${offenders.length}`)

if (offenders.length) {
  const perStatus = new Map()
  for (const o of offenders) perStatus.set(o.row.status, (perStatus.get(o.row.status) ?? 0) + 1)
  console.log('   by status: ' + [...perStatus.entries()].map(([k, v]) => `${k}=${v}`).join(' '))
  for (const o of offenders) {
    console.log(`\n  ${o.row.id}  status=${o.row.status}  aspect=${o.aspect} (${o.W}x${o.H})  season=${o.row.season_id}`)
    console.log(`    submitted_at=${o.row.submitted_at ?? '-'}  intent=${o.row.submit_intent_at ?? '-'}  finalized=${o.row.finalized_at ?? '-'}`)
    for (const b of o.bad) {
      console.log(`    layer[${b.i}] ${b.sizePct}% ${b.font} = ${b.pct.toFixed(0)}% of width  "${String(b.content).replace(/\n/g, '\\n')}"`)
    }
  }
}

// Distribution helps pick the gate: how close is the existing corpus to the edge?
const buckets = { '<=60%': 0, '60-80%': 0, '80-95%': 0, '95-100%': 0, '>100%': 0 }
for (const row of withText) {
  const edl = row.edl
  const aspect = (Array.isArray(edl) ? undefined : edl?.aspect) ?? DEFAULT_ASPECT
  const [W, H] = CANVAS[aspect] ?? CANVAS[DEFAULT_ASPECT]
  const ctx = createCanvas(W, H).getContext('2d')
  for (const layer of edl.texts) {
    const p = widestPct(ctx, W, H, layer)
    if (p > 100) buckets['>100%']++
    else if (p > 95) buckets['95-100%']++
    else if (p > 80) buckets['80-95%']++
    else if (p > 60) buckets['60-80%']++
    else buckets['<=60%']++
  }
}
console.log('\nlayer width distribution: ' + Object.entries(buckets).map(([k, v]) => `${k}=${v}`).join('  '))
