// HQ 2026-08-22: worst-case opacity sample -- same settings as the 18pct
// sample (18% size, 4% margin, 70% opacity), but against a bright/pale real
// entry frame (product-photography beauty CF, near-white background) so a
// white logo at 70% is actually distinguishable from 100% by eye. Real
// frame, not synthetic -- extracted (ffmpeg, every 15th frame) from
// cf_08_soira_premium.mp4 (season_test), picked by measuring average
// brightness in the bottom-right quadrant across ~54 candidate frames and
// taking the brightest (avg ~218/255 there).
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { writeFile } from 'node:fs/promises'

const BG_PATH = 'outputs/_ref_frame_bright_worstcase.png'
const LOGO_PATH = 'outputs/logo-wm-white.png'
const OUT_PATH = 'outputs/_watermark_test_18pct_bright.png'

const SIZE_PCT = 0.18
const MARGIN_PCT = 0.04
const OPACITY = 0.7

function isBlackPixel(data, w, x, y) {
  const idx = (y * w + x) * 4
  return data[idx] < 12 && data[idx + 1] < 12 && data[idx + 2] < 12
}

async function main() {
  const bg = await loadImage(BG_PATH)
  const logo = await loadImage(LOGO_PATH)
  const w = bg.width
  const h = bg.height

  const canvas = createCanvas(w, h)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bg, 0, 0)
  const data = ctx.getImageData(0, 0, w, h).data

  const sampleX = Math.floor(w * 0.15)
  let contentTop = 0
  while (contentTop < h && isBlackPixel(data, w, sampleX, contentTop)) contentTop++
  let bottomBar = 0
  while (bottomBar < h && isBlackPixel(data, w, sampleX, h - 1 - bottomBar)) bottomBar++
  const contentBottom = h - bottomBar
  const contentRight = w
  const contentW = contentRight
  const contentH = contentBottom - contentTop

  const logoW = contentW * SIZE_PCT
  const logoH = logoW * (logo.height / logo.width)
  const margin = contentW * MARGIN_PCT

  const x = contentRight - margin - logoW
  const y = contentBottom - margin - logoH

  ctx.globalAlpha = OPACITY
  ctx.drawImage(logo, x, y, logoW, logoH)
  ctx.globalAlpha = 1

  await writeFile(OUT_PATH, canvas.toBuffer('image/png'))
  console.log(JSON.stringify({
    canvas: { w, h },
    contentBox: { top: contentTop, bottom: contentBottom, w: contentW, h: contentH },
    logo: { x: Math.round(x), y: Math.round(y), w: Math.round(logoW), h: Math.round(logoH) },
    margin: Math.round(margin),
    out: OUT_PATH,
  }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
