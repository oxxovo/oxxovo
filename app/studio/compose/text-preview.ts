'use client'

// Preview-side text compositor. Draws the SAME shared spec (drawTextLayer) the
// worker render uses, so the preview is WYSIWYG with the final video. The ONLY
// preview-specific piece lives here (not in lib/text-render.ts, which stays a
// byte-mirror of the worker): fade is applied as canvas globalAlpha from
// textAlphaAt -- the worker mirrors the exact same ramp with its ffmpeg fade.
//
// Kept as a PURE function (ctx + box + texts + time) so it can be verified
// headlessly (scripts/text-preview-check.mjs) without mounting the whole editor.

import { drawTextLayer, textAlphaAt, FONT_SPECS, type TextLayer } from '@/lib/text-render'

// Load the allowlisted fonts as FontFaces under the SAME family aliases the spec
// selects with (ctx.font = `..px "OxxovoPretendard"`). Idempotent + memoized: the
// preview must draw with the real faces (not a fallback) or it isn't WYSIWYG.
let fontsPromise: Promise<void> | null = null
export function ensureTextFontsLoaded(): Promise<void> {
  if (fontsPromise) return fontsPromise
  fontsPromise = (async () => {
    if (typeof document === 'undefined' || !('fonts' in document)) return
    await Promise.all(
      FONT_SPECS.map(async (s) => {
        try {
          const ff = new FontFace(s.family, `url(${s.web})`)
          await ff.load()
          ;(document as unknown as { fonts: FontFaceSet }).fonts.add(ff)
        } catch {
          // A missing face falls back to the browser default here; the render is
          // still authoritative. UI gates fonts to the allowlist so this is rare.
        }
      }),
    )
  })()
  return fontsPromise
}

// Paint all visible text layers for composition time `tMs` into ctx, sized to a
// W x H box (the video's DISPLAYED box). Normalized coords make this resolution-
// independent -> the same proportional layout as the full-res render (parity is
// in the normalized math, proven by scripts/text-parity.mjs). Caller clears +
// sets the transform (dpr) first; this leaves globalAlpha reset to 1.
// `editingIndex` (optional): that layer is drawn (near-)opaque REGARDLESS of the
// playhead window, so a selected layer stays visible while it's being positioned
// or styled even when the playhead sits outside its show window. It does not
// affect the render -- purely an editor affordance.
export function paintTextOverlay(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  texts: TextLayer[],
  tMs: number,
  editingIndex?: number | null,
): void {
  for (let i = 0; i < texts.length; i++) {
    const layer = texts[i]
    const a = i === editingIndex ? Math.max(textAlphaAt(layer, tMs), 0.9) : textAlphaAt(layer, tMs)
    if (a <= 0) continue
    ctx.globalAlpha = a
    drawTextLayer(ctx as unknown as Parameters<typeof drawTextLayer>[0], W, H, layer)
  }
  ctx.globalAlpha = 1
}
