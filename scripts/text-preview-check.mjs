// Stage-5 preview-compositor check: proves paintTextOverlay() renders the fade
// (textAlphaAt -> canvas globalAlpha) correctly in a REAL browser canvas, with
// the allowlisted fonts. drawTextLayer positioning is already proven by
// scripts/text-parity.mjs + the worker real-render; this isolates the NEW
// preview-only piece (alpha compositing over the video box).
//
// Run: node scripts/text-preview-check.mjs   (writes _preview_*.png; disposable)
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import esbuild from 'esbuild'
import { chromium } from 'playwright-core'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const APP_FONTS = join(ROOT, 'public', 'fonts')

// bundle the preview compositor (resolves the '@/' alias to repo root).
const bundle = esbuild.buildSync({
  entryPoints: [join(ROOT, 'app', 'studio', 'compose', 'text-preview.ts')],
  bundle: true, format: 'iife', globalName: 'TP', write: false, logLevel: 'silent',
  alias: { '@': ROOT },
})
const SPEC_JS = bundle.outputFiles[0].text

function findChromium() {
  if (process.env.PW_CHROMIUM && existsSync(process.env.PW_CHROMIUM)) return process.env.PW_CHROMIUM
  const la = process.env.LOCALAPPDATA || ''
  return [
    join(la, 'ms-playwright', 'chromium-1228', 'chrome-win64', 'chrome.exe'),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find(existsSync)
}
const mimeFor = (f) => (f.endsWith('.woff2') ? 'font/woff2' : f.endsWith('.woff') ? 'font/woff' : 'font/ttf')

// One layer with a 500ms fade-in [0..500], full [500..2500], 500ms fade-out
// [2500..3000]. Sample at 250 (mid fade-in ~0.5), 1500 (full), 2750 (mid fade-out ~0.5).
const LAYER = {
  content: '순간의 아름다움', font: 'black-han-sans', sizePct: 11, color: '#ffffff',
  strokeColor: '#101010', strokePct: 6, align: 'center',
  xNorm: 0.5, yNorm: 0.42, startMs: 0, endMs: 3000, fadeInMs: 500, fadeOutMs: 500,
}
const SAMPLES = [[250, 'fadein-half'], [1500, 'full'], [2750, 'fadeout-half']]

async function main() {
  const exe = findChromium()
  if (!exe) throw new Error('no chromium/chrome found')
  const fonts = [
    { family: 'OxxovoPretendard', file: 'Pretendard-Regular.woff2' },
    { family: 'OxxovoBlackHanSans', file: 'BlackHanSans-Regular.ttf' },
  ].map((f) => ({ family: f.family, url: `data:${mimeFor(f.file)};base64,` + readFileSync(join(APP_FONTS, f.file)).toString('base64') }))

  const browser = await chromium.launch({ executablePath: exe, headless: true })
  const page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 })
  await page.setContent('<!doctype html><meta charset=utf-8><body style="margin:0"><canvas id=c width=640 height=360></canvas></body>')
  await page.addScriptTag({ content: SPEC_JS })
  await page.evaluate(async (ff) => {
    for (const f of ff) { const face = new FontFace(f.family, `url(${f.url})`); await face.load(); document.fonts.add(face) }
  }, fonts)

  const alphas = []
  for (const [t, label] of SAMPLES) {
    const measured = await page.evaluate(({ t, layer }) => {
      const cv = document.getElementById('c')
      const ctx = cv.getContext('2d')
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      // dark gray bg so white text alpha is directly readable from pixel value.
      ctx.globalAlpha = 1; ctx.fillStyle = '#202020'; ctx.fillRect(0, 0, cv.width, cv.height)
      // eslint-disable-next-line no-undef
      TP.paintTextOverlay(ctx, cv.width, cv.height, [layer], t)
      // brightest pixel in the text band = bg(32) + alpha*(255-32); invert for alpha.
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data
      let max = 0
      for (let i = 0; i < d.length; i += 4) if (d[i] > max) max = d[i]
      return { max, alpha: (max - 32) / (255 - 32) }
    }, { t, layer: LAYER })
    const png = await page.screenshot()
    writeFileSync(join(ROOT, `_preview_${t}_${label}.png`), png)
    alphas.push({ t, label, ...measured })
  }
  await browser.close()

  console.log('\nsample   t(ms)  peakLuma  ~alpha  expect')
  const expect = { 250: 0.5, 1500: 1.0, 2750: 0.5 }
  let ok = true
  for (const a of alphas) {
    const want = expect[a.t]
    const pass = Math.abs(a.alpha - want) <= 0.15
    ok = ok && pass
    console.log(`${a.label.padEnd(14)} ${String(a.t).padEnd(6)} ${String(a.max).padEnd(9)} ${a.alpha.toFixed(2).padEnd(7)} ${want}  ${pass ? 'PASS' : 'FAIL'}`)
  }
  // monotonic: fade-in < full and fade-out < full
  const byT = Object.fromEntries(alphas.map((a) => [a.t, a.alpha]))
  const ramp = byT[250] < byT[1500] - 0.15 && byT[2750] < byT[1500] - 0.15
  console.log(`\nfade ramp (edges dimmer than full): ${ramp ? 'OK' : 'FAIL'}`)
  console.log(`RESULT: ${ok && ramp ? 'PREVIEW FADE OK' : 'PREVIEW FADE FAIL'}`)
  process.exit(ok && ramp ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
