#!/usr/bin/env node
// Verify lib/text-advances.ts against the REAL font engine.
//
// lib/text-metrics.test.ts runs in CI and proves the table is self-consistent and
// that the geometry math matches the renderer's model. It cannot prove the NUMBERS
// are right, because CI checks out only this repo -- no worker worktree, no .ttf.
// That is this script's job, and it must be run after any font or table change.
//
// It asserts the property the whole guard rests on:
//   ★ lineWidthEm(font, line) * px  >=  measureText(line)   for every sample.
// The table sums per-glyph advances and so ignores kerning; if that ever went the
// other way the guard would admit text that then clips off the frame.
//
// Run: npm run test:text-advances

import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { resolveWorkerRepo } from './worker-repo.mjs'
import { lineWidthEm, undrawableChars } from '../lib/text-metrics.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORKER_REPO = resolveWorkerRepo(ROOT)
const OT = await import(pathToFileURL(join(WORKER_REPO, 'src', 'text-render.ts')).href)
for (const f of OT.FONT_SPECS) GlobalFonts.registerFromPath(join(WORKER_REPO, 'assets', 'fonts', f.file), f.family)

const EM = 1000
const ctx = createCanvas(10, 10).getContext('2d')
const inkCtx = createCanvas(160, 160).getContext('2d')

const SAMPLES = [
  'Bloom Beauty', '지금 만나보세요', 'OXXOVO 옥소보 2026', 'made with oxxovo',
  'Radiance all day long', '순간의 아름다움', '눈부신 광채 GLOW', 'NEW 신상 30% OFF',
  'Glow Every Day', 'LIMITED 한정', 'AV Wa To LY', 'WAVE TYPE 123', '피부가 빛나는',
  '대한민국 서울', 'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  '0123456789 !?.,-', '옥소보 스튜디오 시즌 0',
]

let fail = 0
console.log(`WORKER : ${WORKER_REPO}\n`)
console.log('UPPER-BOUND CHECK   table_em*1000 vs measureText@1000px   (over% must be >= 0)')

for (const f of OT.FONT_SPECS) {
  ctx.font = `${EM}px "${f.family}"`
  let worstOver = -Infinity
  let worstStr = ''
  let maxOver = 0
  for (const s of SAMPLES) {
    // Skip samples the font cannot draw -- the table deliberately reports those
    // as undrawable and validation rejects them before any width is used.
    if (undrawableChars(f.id, s).length) continue
    const real = ctx.measureText(s).width
    const table = lineWidthEm(f.id, s) * EM
    const overPct = ((table - real) / real) * 100
    if (overPct < worstOver || worstOver === -Infinity) { worstOver = overPct; worstStr = s }
    maxOver = Math.max(maxOver, overPct)
    if (table < real - 1e-6) {
      console.log(`  ✖ UNDER-ESTIMATE  ${f.id}  "${s}"  table=${table.toFixed(2)} real=${real.toFixed(2)}`)
      fail++
    }
  }
  console.log(`  ${f.id.padEnd(16)} tightest=${worstOver.toFixed(2)}% ("${worstStr}")   worst over-estimate=${maxOver.toFixed(2)}%`)
}

// Coverage: the table's "draws no ink" flag must match an actual rasterisation.
console.log('\nCOVERAGE CHECK   table flag vs rasterised ink')
const PROBE = ['가', '나', '뷰', '옥', '쀓', '핧', '삻', '똠', '쫀', '휭']
for (const f of OT.FONT_SPECS) {
  let bad = 0
  for (const ch of PROBE) {
    inkCtx.clearRect(0, 0, 160, 160)
    inkCtx.font = `100px "${f.family}"`
    inkCtx.textBaseline = 'alphabetic'
    inkCtx.fillStyle = '#ffffff'
    inkCtx.fillText(ch, 15, 120)
    const d = inkCtx.getImageData(0, 0, 160, 160).data
    let ink = false
    for (let i = 3; i < d.length; i += 4) if (d[i] > 16) { ink = true; break }
    const tableSaysDrawn = undrawableChars(f.id, ch).length === 0
    if (ink !== tableSaysDrawn) {
      console.log(`  ✖ MISMATCH ${f.id} "${ch}" rasterised=${ink} table=${tableSaysDrawn}`)
      bad++; fail++
    }
  }
  console.log(`  ${f.id.padEnd(16)} ${PROBE.length - bad}/${PROBE.length} agree`)
}

console.log(fail === 0 ? '\nTABLE OK' : `\n★ ${fail} FAILURE(S)`)
process.exit(fail === 0 ? 0 : 1)
