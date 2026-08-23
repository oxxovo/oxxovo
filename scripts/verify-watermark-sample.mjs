// HQ 2026-08-22: verify (not just assert) the 18pct sample's actual margin
// and actual opacity, by measuring real pixels -- not by re-reading the
// generator script's intent.
import { createCanvas, loadImage } from '@napi-rs/canvas'

const OUT_PATH = process.argv[2] || 'outputs/_watermark_test_18pct.png'
const LOGO_PATH = 'outputs/logo-wm-white.png'

function px(data, w, x, y) {
  const i = (y * w + x) * 4
  return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] }
}

async function main() {
  const out = await loadImage(OUT_PATH)
  const logo = await loadImage(LOGO_PATH)
  const w = out.width
  const h = out.height

  const c = createCanvas(w, h)
  const ctx = c.getContext('2d')
  ctx.drawImage(out, 0, 0)
  const data = ctx.getImageData(0, 0, w, h).data

  // Find the actual non-transparent/non-background bounding box of the logo
  // as PLACED in the output -- scan the bottom-right quadrant for pixels
  // that are visibly lighter than the surrounding background (the sample's
  // background there is warm/orange skin tone, so anything notably
  // desaturated+bright is the logo mark). This measures the REAL visual
  // edge, not the nominal draw-box the generator script intended.
  let minX = w, maxX = 0, minY = h, maxY = 0
  const scanX0 = Math.floor(w * 0.6)
  const scanY0 = Math.floor(h * 0.6)
  for (let y = scanY0; y < h; y++) {
    for (let x = scanX0; x < w; x++) {
      const p = px(data, w, x, y)
      // "logo-ish" = fairly bright AND fairly desaturated (white/gray mark),
      // distinct from the warm orange background at this corner.
      const maxc = Math.max(p.r, p.g, p.b)
      const minc = Math.min(p.r, p.g, p.b)
      const sat = maxc === 0 ? 0 : (maxc - minc) / maxc
      if (maxc > 120 && sat < 0.25) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  const marginRight = w - 1 - maxX
  const marginBottom = h - 1 - maxY
  console.log('=== measured logo bounding box in output ===')
  console.log({ minX, maxX, minY, maxY, logoWmeasured: maxX - minX, logoHmeasured: maxY - minY })
  console.log('=== measured margin to canvas edge ===')
  console.log({
    marginRight_px: marginRight,
    marginRight_pct_of_width: (marginRight / w * 100).toFixed(2) + '%',
    marginRight_pct_of_height: (marginRight / h * 100).toFixed(2) + '%',
    marginBottom_px: marginBottom,
    marginBottom_pct_of_height: (marginBottom / h * 100).toFixed(2) + '%',
    marginBottom_pct_of_width: (marginBottom / w * 100).toFixed(2) + '%',
  })

  // Opacity check: compare the brightest logo pixel in the output against
  // the same relative pixel in the SOURCE logo asset (which is drawn at
  // ~100% white). If globalAlpha=0.7 truly applied over this background,
  // the composited pixel should sit between the background color and pure
  // white -- NOT at 255,255,255.
  // Sample the brightest point found in the bounding box above.
  let brightest = { r: 0, g: 0, b: 0 }
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const p = px(data, w, x, y)
      if (p.r + p.g + p.b > brightest.r + brightest.g + brightest.b) brightest = p
    }
  }
  console.log('=== brightest sampled pixel inside the logo mark (output) ===')
  console.log(brightest, '(255,255,255 would mean fully opaque white, no blending)')

  // Also report what the SOURCE logo's own brightest pixel is, for reference.
  const cl = createCanvas(logo.width, logo.height)
  const lctx = cl.getContext('2d')
  lctx.drawImage(logo, 0, 0)
  const ldata = lctx.getImageData(0, 0, logo.width, logo.height).data
  let srcBrightest = { r: 0, g: 0, b: 0, a: 0 }
  for (let i = 0; i < ldata.length; i += 4) {
    const r = ldata[i], g = ldata[i + 1], b = ldata[i + 2]
    if (r + g + b > srcBrightest.r + srcBrightest.g + srcBrightest.b) {
      srcBrightest = { r, g, b, a: ldata[i + 3] }
    }
  }
  console.log('=== source logo asset brightest pixel ===')
  console.log(srcBrightest)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
