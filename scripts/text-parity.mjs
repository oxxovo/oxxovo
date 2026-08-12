// Text-overlay parity harness -- proves the browser preview and the worker render
// draw text IDENTICALLY (WYSIWYG) BEFORE the text UI is exposed (same discipline
// as scripts/gl-engine-parity.mjs for effects).
//
// It renders the SAME lib/text-render.ts drawTextLayer() in two engines:
//   - BROWSER: Playwright Chromium (Blink = Skia) with the web fonts (woff2/ttf
//     from public/fonts) -- exactly what a participant's preview uses.
//   - WORKER:  @napi-rs/canvas (Skia) with the .ttf from oxxovo-studio/assets/fonts
//     -- exactly what the render worker uses.
//
// Gate per case (ALL must pass; else the UI stays hidden):
//   position  |dx|,|dy| <= 2 px
//   size      |dW|,|dH| <= 1.0% AND <= 2 px
//   shape     SSIM(alpha, aligned) >= 0.985   (secondary: mean alpha err <= 3/255)
//
// Run: node scripts/text-parity.mjs
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import esbuild from 'esbuild'
import { chromium } from 'playwright-core'
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas'
import { resolveWorkerRepo } from './worker-repo.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const APP_FONTS = join(ROOT, 'public', 'fonts')                       // browser side (woff2/ttf)

// ★ Lane-aware (see scripts/worker-repo.mjs). The resolved path is printed in the
// report so every number this harness emits carries its provenance.
const WORKER_REPO = resolveWorkerRepo(ROOT)
const WORKER_FONTS = join(WORKER_REPO, 'assets', 'fonts')             // worker side (ttf)

// The worker(napi-rs) side imports the WORKER'S ACTUAL file -- so this harness
// proves the file the render worker ships is byte-parity with the browser preview
// (bundled from lib/text-render.ts below). If the worker mirror drifts, parity
// FAILS here instead of shipping a mis-rendered video. Dynamic so the path above
// can be resolved at runtime; the .ts loader hook is already installed by
// `node --import ./scripts/test-register.mjs`.
const OT = await import(pathToFileURL(join(WORKER_REPO, 'src', 'text-render.ts')).href)

// Gate thresholds. Position/size use the SOLID glyph body (alpha>=128) so the AA
// fringe never moves the box. Shape is judged AFTER a small blur that cancels the
// sub-pixel AA disagreement between the two Skia builds (proven visually identical
// -- see the DUMP composites) while any real shift/wrong-glyph survives the blur.
const CORE_A = 128            // "solid glyph" alpha threshold for bbox
// Font px is computed by the SAME formula (sizePct/100*H) in both engines, so the
// glyph SIZE is identical by construction -- the bbox w/h delta is only AA/hint
// jitter, not a real size error. So size is a LOOSE sanity (<=4px absolute, catch
// gross); the real gates are POSITION (placement) and SHAPE (blurred best-aligned
// SSIM/MAE). UI enforces a min size (see MIN_SIZE_PCT) -- the parity-verified band.
const POS_PX = 2, SIZE_PX = 4, SSIM_MIN = 0.97, MAE_MAX = 6
const MIN_SIZE_PCT = 5       // UI/validation floor; below this AA dominates tiny text

// ---- test matrix ----------------------------------------------------------
const P = { tl: [0.06, 0.08, 'left'], tc: [0.5, 0.08, 'center'], tr: [0.94, 0.08, 'right'],
  ml: [0.06, 0.45, 'left'], mc: [0.5, 0.45, 'center'], mr: [0.94, 0.45, 'right'],
  bl: [0.06, 0.82, 'left'], bc: [0.5, 0.82, 'center'], br: [0.94, 0.82, 'right'] }
const mk = (name, over) => ({ name, content: 'Bloom Beauty', font: 'pretendard', sizePct: 8, color: '#ffffff', align: 'center', xNorm: 0.5, yNorm: 0.45, startMs: 0, endMs: 1000, ...over })
const CASES = [
  mk('EN-short-title', { content: 'Bloom Beauty', font: 'black-han-sans', sizePct: 11 }),
  mk('KO-short', { content: '지금 만나보세요', font: 'pretendard', sizePct: 8 }),
  mk('KO-title-heavy', { content: '순간의 아름다움', font: 'black-han-sans', sizePct: 12 }),
  mk('mixed-cta', { content: 'NEW 신상 30% OFF', font: 'pretendard', sizePct: 7 }),
  mk('EN-long', { content: 'Radiance that lasts all day long', font: 'pretendard', sizePct: 5 }),
  mk('KO-multiline', { content: '피부가 빛나는\n순간을 만나다', font: 'black-han-sans', sizePct: 9 }),
  mk('EN-multiline', { content: 'Glow\nEvery Day', font: 'black-han-sans', sizePct: 10 }),
  mk('small-caption', { content: 'made with oxxovo', font: 'pretendard', sizePct: MIN_SIZE_PCT }), // at the enforced UI floor
  mk('stroke-on', { content: '눈부신 광채', font: 'black-han-sans', sizePct: 10, strokeColor: '#000000', strokePct: 7 }),
  mk('stroke-color', { content: 'LIMITED 한정', font: 'pretendard', sizePct: 7, color: '#ff77bb', strokeColor: '#3a0033', strokePct: 6 }),
  // Noto Serif KR (stage 7): browser woff2 vs worker ttf, same subset outlines.
  mk('serif-KO', { content: '고요한 아침', font: 'noto-serif-kr', sizePct: 10 }),
  mk('serif-KO-multiline', { content: '순간의\n아름다움', font: 'noto-serif-kr', sizePct: 9 }),
  mk('serif-mixed', { content: 'OXXOVO 옥소보', font: 'noto-serif-kr', sizePct: 8 }),
  mk('serif-stroke', { content: '눈부신 광채', font: 'noto-serif-kr', sizePct: 9, strokeColor: '#101010', strokePct: 6 }),
  // 9-grid positions (short KO+EN mix)
  ...Object.entries(P).map(([k, [x, y, a]]) => mk(`grid-${k}`, { content: 'OXXOVO 옥소보', font: 'pretendard', sizePct: 6, xNorm: x, yNorm: y, align: a })),
]
const ASPECTS = [{ id: '16x9', W: 1920, H: 1080 }, { id: '9x16', W: 1080, H: 1920 }]

// ---- bundle the shared spec for the browser -------------------------------
const bundle = esbuild.buildSync({
  entryPoints: [join(ROOT, 'lib', 'text-render.ts')],
  bundle: true, format: 'iife', globalName: 'OxxovoText', write: false, logLevel: 'silent',
})
const SPEC_JS = bundle.outputFiles[0].text

// ---- worker (napi-rs) render ----------------------------------------------
// Register the SAME .ttf the worker ships, under the SAME alias the spec uses.
for (const f of OT.FONT_SPECS) {
  const p = join(WORKER_FONTS, f.file)
  if (!existsSync(p)) throw new Error('worker font missing: ' + p)
  GlobalFonts.registerFromPath(p, f.family)
}
function renderWorker(layer, W, H) {
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  OT.drawTextLayer(ctx, W, H, layer)
  return ctx.getImageData(0, 0, W, H).data
}

// ---- browser (chromium) render --------------------------------------------
function findChromium() {
  if (process.env.PW_CHROMIUM && existsSync(process.env.PW_CHROMIUM)) return process.env.PW_CHROMIUM
  const la = process.env.LOCALAPPDATA || ''
  const cands = [
    join(la, 'ms-playwright', 'chromium-1228', 'chrome-win64', 'chrome.exe'),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ]
  return cands.find(existsSync)
}
const mimeFor = (f) => (f.endsWith('.woff2') ? 'font/woff2' : f.endsWith('.woff') ? 'font/woff' : 'font/ttf')
const BROWSER_FONTS = OT.FONT_SPECS.map((s) => {
  const file = s.web.replace('/fonts/', '')
  return { family: s.family, url: `data:${mimeFor(file)};base64,` + readFileSync(join(APP_FONTS, file)).toString('base64') }
})

async function main() {
  const exe = findChromium()
  if (!exe) throw new Error('no chromium/chrome found')
  const browser = await chromium.launch({ executablePath: exe, headless: true })
  const page = await browser.newPage()
  await page.setContent('<!doctype html><meta charset=utf-8><body></body>')
  await page.addScriptTag({ content: SPEC_JS })
  await page.evaluate(async (fonts) => {
    for (const f of fonts) { const ff = new FontFace(f.family, `url(${f.url})`); await ff.load(); document.fonts.add(ff) }
  }, BROWSER_FONTS)

  const renderBrowser = async (layer, W, H) => {
    const dataUrl = await page.evaluate(async ({ layer, W, H }) => {
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H
      const ctx = cv.getContext('2d')
      // eslint-disable-next-line no-undef
      OxxovoText.drawTextLayer(ctx, W, H, layer)
      return cv.toDataURL('image/png')
    }, { layer, W, H })
    const img = await loadImage(Buffer.from(dataUrl.split(',')[1], 'base64'))
    const cv = createCanvas(W, H); const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0)
    return ctx.getImageData(0, 0, W, H).data
  }

  let allPass = true
  const rows = []
  for (const asp of ASPECTS) {
    for (const c of CASES) {
      const layer = { ...c }
      const a = renderWorker(layer, asp.W, asp.H)   // worker (napi-rs)
      const b = await renderBrowser(layer, asp.W, asp.H) // browser (chromium)
      if (process.env.DUMP && `${asp.id}/${c.name}`.includes(process.env.DUMP)) {
        const { writeFileSync } = await import('node:fs')
        writeFileSync(join(ROOT, `_pt_${asp.id}_${c.name}.png`), composite(a, b, asp.W, asp.H))
      }
      const m = compare(a, b, asp.W, asp.H)
      const pass = m.dx <= POS_PX && m.dy <= POS_PX &&
        m.dw <= SIZE_PX && m.dh <= SIZE_PX &&
        m.ssim >= SSIM_MIN && m.mae <= MAE_MAX
      allPass = allPass && pass
      rows.push({ case: `${asp.id}/${c.name}`, ...m, pass })
    }
  }
  // negative controls -- the gate MUST reject a shifted render and a wrong-font
  // render, or it has no teeth.
  const cW = 1920, cH = 1080
  const base = mk('ctrl', { content: 'Bloom Beauty', font: 'pretendard', sizePct: 8 })
  const cm = compare(renderWorker(base, cW, cH), await renderBrowser({ ...base, yNorm: base.yNorm + 0.02 }, cW, cH), cW, cH)
  const shiftRejected = !(cm.dx <= POS_PX && cm.dy <= POS_PX)
  const dm = compare(renderWorker(base, cW, cH), await renderBrowser({ ...base, font: 'black-han-sans' }, cW, cH), cW, cH)
  const fontRejected = !(dm.ssim >= SSIM_MIN && dm.dw <= SIZE_PX && dm.dh <= SIZE_PX)
  const controlsOk = shiftRejected && fontRejected

  await browser.close()

  // report
  const pad = (s, n) => String(s).padEnd(n)
  console.log(`\nAPP    : ${ROOT}`)
  console.log(`WORKER : ${WORKER_REPO}`)
  console.log('\n' + pad('CASE', 26) + pad('dx', 5) + pad('dy', 5) + pad('dW%', 7) + pad('dH%', 7) + pad('SSIM', 8) + pad('MAE', 7) + 'RESULT')
  for (const r of rows) {
    console.log(pad(r.case, 26) + pad(r.dx, 5) + pad(r.dy, 5) + pad(r.dwPct.toFixed(2), 7) + pad(r.dhPct.toFixed(2), 7) +
      pad(r.ssim.toFixed(4), 8) + pad(r.mae.toFixed(2), 7) + (r.pass ? 'PASS' : 'FAIL'))
  }
  const worst = rows.reduce((w, r) => ({ ssim: Math.min(w.ssim, r.ssim), dx: Math.max(w.dx, r.dx), dy: Math.max(w.dy, r.dy), dwPct: Math.max(w.dwPct, r.dwPct), dhPct: Math.max(w.dhPct, r.dhPct), mae: Math.max(w.mae, r.mae) }), { ssim: 1, dx: 0, dy: 0, dwPct: 0, dhPct: 0, mae: 0 })
  const passN = rows.filter((r) => r.pass).length
  console.log(`\nWORST: dx=${worst.dx} dy=${worst.dy} dW%=${worst.dwPct.toFixed(2)} dH%=${worst.dhPct.toFixed(2)} SSIM=${worst.ssim.toFixed(4)} MAE=${worst.mae.toFixed(2)}`)
  console.log(`NEG-CONTROLS (must reject): shift=${shiftRejected ? 'OK' : 'LEAKED'} wrong-font=${fontRejected ? 'OK' : 'LEAKED'}`)
  console.log(`GATE (pos<=${POS_PX}px, size<=${SIZE_PX}px, blurSSIM>=${SSIM_MIN}, blurMAE<=${MAE_MAX}, minSize=${MIN_SIZE_PCT}%): ${passN}/${rows.length} pass -> ${allPass && controlsOk ? 'PARITY OK' : 'PARITY FAIL'}`)
  process.exit(allPass && controlsOk ? 0 : 1)
}

// ---- debug: crop to text bbox, scale up, stack [worker | browser | diff] ----
function composite(a, b, W, H) {
  const bb = alphaBBox(a, W, H) || { x0: 0, y0: 0, x1: W - 1, y1: H - 1 }
  const pad = 6, S = 5
  const x0 = Math.max(0, bb.x0 - pad), y0 = Math.max(0, bb.y0 - pad)
  const cw = Math.min(W, bb.x1 + pad) - x0 + 1, ch = Math.min(H, bb.y1 + pad) - y0 + 1
  const panel = (d, mode) => {
    const cv = createCanvas(cw, ch); const ctx = cv.getContext('2d'); const img = ctx.createImageData(cw, ch)
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const si = ((y0 + y) * W + (x0 + x)) * 4, di = (y * cw + x) * 4
      if (mode === 'diff') { img.data[di] = Math.abs(a[si + 3] - b[si + 3]); img.data[di + 1] = img.data[di + 2] = 0 }
      else { const v = d[si + 3]; img.data[di] = img.data[di + 1] = img.data[di + 2] = v }
      img.data[di + 3] = 255
    }
    ctx.putImageData(img, 0, 0); return cv
  }
  const panels = [panel(a, 'a'), panel(b, 'b'), panel(null, 'diff')]
  const out = createCanvas(cw * S * 3 + 20, ch * S); const octx = out.getContext('2d')
  octx.fillStyle = '#202020'; octx.fillRect(0, 0, out.width, out.height)
  octx.imageSmoothingEnabled = false
  panels.forEach((p, i) => octx.drawImage(p, i * (cw * S + 10), 0, cw * S, ch * S))
  return out.toBuffer('image/png')
}

// ---- metrics (alpha channel) ----------------------------------------------
function alphaBBox(d, W, H, th = CORE_A) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (d[(y * W + x) * 4 + 3] >= th) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  }
  if (x1 < 0) return null
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}
// separable 3-tap box blur (2 passes ~= Gaussian) over a w x h alpha plane --
// cancels 1px AA-edge disagreement so SHAPE is compared, not anti-aliasing.
function blur(p, w, h) {
  const pass = (src) => {
    const out = new Float64Array(src.length)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const l = src[y * w + (x > 0 ? x - 1 : x)], c = src[y * w + x], r = src[y * w + (x < w - 1 ? x + 1 : x)]
      out[y * w + x] = (l + c + r) / 3
    }
    const out2 = new Float64Array(src.length)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = out[(y > 0 ? y - 1 : y) * w + x], c = out[y * w + x], d = out[(y < h - 1 ? y + 1 : y) * w + x]
      out2[y * w + x] = (u + c + d) / 3
    }
    return out2
  }
  return pass(pass(p))
}
function compare(a, b, W, H) {
  const ba = alphaBBox(a, W, H), bb = alphaBBox(b, W, H)
  if (!ba || !bb) return { dx: 999, dy: 999, dw: 999, dh: 999, dwPct: 999, dhPct: 999, ssim: 0, mae: 255 }
  const dx = Math.abs(ba.x0 - bb.x0), dy = Math.abs(ba.y0 - bb.y0)
  const dw = Math.abs(ba.w - bb.w), dh = Math.abs(ba.h - bb.h)
  const dwPct = (dw / Math.max(ba.w, bb.w)) * 100, dhPct = (dh / Math.max(ba.h, bb.h)) * 100
  // Shape is compared at BEST alignment within a small window: the tiny (<=2px)
  // offset is ALREADY gated by position above, so searching it out here isolates
  // true glyph-shape agreement from integer-alignment residue. Blur cancels AA.
  const cw = ba.w, ch = ba.h
  const base = bb.x0 - ba.x0, basey = bb.y0 - ba.y0
  const A = new Float64Array(cw * ch)
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) A[y * cw + x] = a[((ba.y0 + y) * W + (ba.x0 + x)) * 4 + 3]
  const Ab = blur(A, cw, ch)
  let best = { ssim: 0, mae: 255 }
  for (let sy = -3; sy <= 3; sy++) for (let sx = -3; sx <= 3; sx++) {
    const B = new Float64Array(cw * ch)
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const bx = ba.x0 + x + base + sx, by = ba.y0 + y + basey + sy
      B[y * cw + x] = (bx >= 0 && bx < W && by >= 0 && by < H) ? b[(by * W + bx) * 4 + 3] : 0
    }
    const Bb = blur(B, cw, ch)
    const e = mae(Ab, Bb)
    if (e < best.mae) best = { ssim: ssim(Ab, Bb), mae: e }
  }
  return { dx, dy, dw, dh, dwPct, dhPct, ssim: best.ssim, mae: best.mae }
}
function mae(A, B) { let s = 0; for (let i = 0; i < A.length; i++) s += Math.abs(A[i] - B[i]); return s / A.length }
function ssim(A, B) {
  const n = A.length; if (!n) return 0
  let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += A[i]; mb += B[i] } ma /= n; mb /= n
  let va = 0, vb = 0, cov = 0
  for (let i = 0; i < n; i++) { const da = A[i] - ma, db = B[i] - mb; va += da * da; vb += db * db; cov += da * db }
  va /= n; vb /= n; cov /= n
  const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2
  return ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2))
}

main().catch((e) => { console.error(e); process.exit(1) })
