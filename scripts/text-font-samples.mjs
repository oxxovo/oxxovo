// Font sample renderer -- produces the PNGs TK looks at to sign off the three
// allowlisted text fonts (the "폰트 3종 실렌더 확인" item of the text/caption epic).
//
// ★ These are REAL renders, not mockups: the frames come out of the WORKER'S OWN
// src/text-render.ts (dynamically imported from the lane's worker worktree) drawn
// on @napi-rs/canvas with the WORKER'S OWN .ttf files -- the exact code path and
// the exact font binaries that produce a participant's final video. The browser
// preview is proven to match this by scripts/text-parity.mjs; this script is the
// other half: it shows what that agreed-upon output actually LOOKS like.
//
// Run: npm run test:text-samples      (writes PNGs, prints their absolute paths)

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { resolveWorkerRepo } from './worker-repo.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const WORKER_REPO = resolveWorkerRepo(ROOT)
const WORKER_FONTS = join(WORKER_REPO, 'assets', 'fonts')
const OUT_DIR = join(ROOT, 'reports', '_run', 'text-font-samples')

const OT = await import(pathToFileURL(join(WORKER_REPO, 'src', 'text-render.ts')).href)

for (const f of OT.FONT_SPECS) {
  const p = join(WORKER_FONTS, f.file)
  if (!existsSync(p)) throw new Error('worker font missing: ' + p)
  GlobalFonts.registerFromPath(p, f.family)
}

// ★ The REAL output canvas, taken from the worker's canvasForAspect()
// (oxxovo-studio/src/render.ts:169). Rendering the samples at a larger canvas
// would make the fonts look crisper than the video a participant actually gets --
// the 5% floor is 64px here, not 96px. Judge readability at ship resolution.
const ASPECTS = [
  { id: '9x16', W: 720, H: 1280 }, // primary Studio output
  { id: '16x9', W: 1280, H: 720 },
]

// One frame shows the whole usable size band at once, so a single glance answers
// "is this font readable at our floor, and does it look right at title size?".
// sizePct spans the enforced UI band: 5 (MIN_SIZE_PCT floor) .. 12.
//
// ★ Content length is chosen to FIT 9:16 (1080 wide), the tighter aspect. The
// spec does NOT wrap or shrink to fit -- sizePct is a fraction of HEIGHT, so on
// 9:16 a long line at a large size runs off both edges. checkFit() below prints
// the measured width of every row so a sample can never silently ship clipped.
const ROWS = [
  { y: 0.10, sizePct: 12, content: '아름다움', note: '12% · 타이틀' },
  { y: 0.26, sizePct: 12, content: 'GLOW', note: '12% · title' },
  { y: 0.42, sizePct: 7, content: '지금 만나보세요', note: '7% · 본문' },
  { y: 0.55, sizePct: 8, content: 'Radiance', note: '8% · body' },
  { y: 0.68, sizePct: 6, content: 'OXXOVO 옥소보', note: '6% · 혼합' },
  { y: 0.80, sizePct: 6, content: '눈부신 광채', note: '6% · 외곽선', stroke: true },
  { y: 0.91, sizePct: 5, content: 'made with oxxovo', note: '5% · 최소 크기(하한)' },
]

// A mid-gray backdrop with a dark and a light band: white text has to survive
// both, which is what a real video frame does to it.
function paintBackdrop(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#1b1726')
  g.addColorStop(0.5, '#4a4658')
  g.addColorStop(1, '#0b0912')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#cfcada'
  ctx.fillRect(0, Math.round(H * 0.74), W, Math.round(H * 0.12)) // light band under the stroke row
}

// Caption text drawn OUTSIDE the shared spec (plain ctx) so it is visibly a
// harness annotation and can never be mistaken for rendered overlay output.
function annotate(ctx, W, H, text, yPx) {
  const px = Math.round(H * 0.014)
  ctx.font = `${px}px "OxxovoPretendard"`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#ffd24a'
  ctx.fillText(text, Math.round(W * 0.02), yPx)
}

// Measured width of one row's line, as a % of canvas width. The spec draws every
// line with ctx.measureText at the layer's font px, so this is the same number
// the renderer will produce -- not an estimate.
function widthPct(ctx, W, H, layer) {
  ctx.font = `${OT.fontPx(layer, H)}px "${OT.fontSpec(layer.font).family}"`
  return (ctx.measureText(layer.content).width / W) * 100
}

mkdirSync(OUT_DIR, { recursive: true })
const written = []
const overflows = []

for (const font of OT.FONT_SPECS) {
  for (const asp of ASPECTS) {
    const cv = createCanvas(asp.W, asp.H)
    const ctx = cv.getContext('2d')
    paintBackdrop(ctx, asp.W, asp.H)

    for (const r of ROWS) {
      const layer = {
        content: r.content,
        font: font.id,
        sizePct: r.sizePct,
        color: '#ffffff',
        align: 'center',
        xNorm: 0.5,
        yNorm: r.y,
        startMs: 0,
        endMs: 1000,
        ...(r.stroke ? { strokeColor: '#12060f', strokePct: 7 } : {}),
      }
      const wp = widthPct(ctx, asp.W, asp.H, layer)
      if (wp > 100) overflows.push(`${font.id}/${asp.id}/${r.sizePct}% "${r.content}" = ${wp.toFixed(0)}% of width`)
      OT.drawTextLayer(ctx, asp.W, asp.H, layer)
      // label sits just above the row's own text top (yNorm*H), never inside the
      // previous row -- the rows are tall enough at 12% to collide otherwise.
      annotate(ctx, asp.W, asp.H, `${r.note}  ·  폭 ${wp.toFixed(0)}%`, Math.round(r.y * asp.H - asp.H * 0.006))
    }

    annotate(ctx, asp.W, asp.H, `${font.label}  (id: ${font.id} · ${font.file})  ${asp.W}x${asp.H}`, Math.round(asp.H * 0.035))

    const out = join(OUT_DIR, `${font.id}_${asp.id}.png`)
    writeFileSync(out, cv.toBuffer('image/png'))
    written.push(out)
  }
}

console.log(`APP    : ${ROOT}`)
console.log(`WORKER : ${WORKER_REPO}`)
console.log(`FONTS  : ${WORKER_FONTS}`)
console.log(`\n${written.length} sample(s) written:`)
for (const w of written) console.log('  ' + w)
if (overflows.length) {
  console.log(`\n★ ${overflows.length} row(s) exceed the canvas width -- the sample is CLIPPED, fix the content:`)
  for (const o of overflows) console.log('  ' + o)
  process.exit(1)
}
console.log('\nfit: every row is within the canvas width.')
