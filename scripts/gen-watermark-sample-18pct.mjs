// One-off watermark sample generator (HQ 2026-08-22) -- NOT part of the
// shipped watermark pipeline (that's oxxovo-studio's applyDownloadWatermark/
// applyPromoWatermark, ffmpeg-based). This is a visual-review sample only.
//
// Fix vs the previous 8/10/12% samples (outputs/_watermark_test_*pct.png):
// size/position were computed off the full 1080x1920 CANVAS, so on a
// letterboxed reference frame (black bars top/bottom) the logo landed partly
// in the black bar and read as smaller than intended relative to the actual
// picture. This version measures the real CONTENT box (scans for the
// black-bar boundary) and places the logo relative to THAT box -- bottom-
// right, 4% margin, 70% opacity, 18% of content width.
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { writeFile } from 'node:fs/promises'

// HQ 2026-08-22: the previous samples' background was actually a MARKETING
// PROMO frame (Eiffel Tower / "The world in 30 seconds"), not a real
// competition entry -- that promo asset's own authoring choices are why IT
// had black bars, unrelated to the Studio pipeline. This background is a
// genuine frame extracted (ffmpeg) from a real season_test main-round
// competition video (cf_07_eclare_premium.mp4, R2) -- full-bleed 1080x1920,
// no letterbox on this particular clip (see the reply to HQ's letterbox
// question: the Studio compose pipeline's default IS letterbox/'contain'
// per clip unless a creator sets 'cover' -- lib/studio.ts is the source of
// truth, THIS clip just happens not to need it). The content-box detection
// below still runs (harmless no-op here) so the same script is correct if
// pointed at a genuinely letterboxed frame later.
const BG_PATH = 'outputs/_ref_frame_real_entry.png'
const LOGO_PATH = 'outputs/logo-wm-white.png'
const OUT_PATH = 'outputs/_watermark_test_18pct.png'

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

  // Measure the letterbox content box: scan a vertical strip well away from
  // the corner where the watermark itself sits, so a previous sample's logo
  // pixels never bias the measurement.
  const sampleX = Math.floor(w * 0.15)
  let contentTop = 0
  while (contentTop < h && isBlackPixel(data, w, sampleX, contentTop)) contentTop++
  let bottomBar = 0
  while (bottomBar < h && isBlackPixel(data, w, sampleX, h - 1 - bottomBar)) bottomBar++
  const contentBottom = h - bottomBar
  const contentLeft = 0
  const contentRight = w
  const contentW = contentRight - contentLeft
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
    contentBox: { top: contentTop, bottom: contentBottom, left: contentLeft, right: contentRight, w: contentW, h: contentH },
    logo: { x: Math.round(x), y: Math.round(y), w: Math.round(logoW), h: Math.round(logoH) },
    margin: Math.round(margin),
    out: OUT_PATH,
  }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
