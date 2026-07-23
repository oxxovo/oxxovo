// Shared text-overlay layout + rasterization spec.
//
// ★ BYTE-MIRROR with oxxovo-studio/src/text-render.ts. Both the browser preview
// (Chrome canvas 2D = Skia) and the worker render (@napi-rs/canvas = Skia) call
// THIS exact sequence of canvas-2D ops with the SAME font files, so the text a
// participant sees in the preview is the text that ships in the final render
// (WYSIWYG). Parity is proven by scripts/text-parity.mjs before the UI is exposed.
//
// This module is client-safe (no 'server-only'): the preview imports it. The
// signed TextLayer shape lives in lib/cryptobind.ts (server-only) and is
// structurally identical to the one re-declared here.

// Structural copy of cryptobind's TextLayer (client-safe). Keep in sync.
export type TextLayer = {
  content: string
  font: string
  sizePct: number
  color: string
  strokeColor?: string
  strokePct?: number
  align: string
  xNorm: number
  yNorm: number
  startMs: number
  endMs: number
  fadeInMs?: number
  fadeOutMs?: number
}

// Font allowlist. `family` is a UNIQUE alias registered identically on both sides
// (browser @font-face + worker GlobalFonts.registerFromPath) so ctx.font selects
// the exact same face with no weight-matching ambiguity across Skia builds.
// `web` = self-hosted file for the browser FontFace; `file` = the .ttf bundled in
// the worker image (assets/fonts). Both are the SAME TrueType outlines.
export type FontSpec = { id: string; label: string; family: string; web: string; file: string }
export const FONT_SPECS: readonly FontSpec[] = [
  { id: 'pretendard', label: 'Pretendard', family: 'OxxovoPretendard', web: '/fonts/Pretendard-Regular.woff2', file: 'Pretendard-Regular.ttf' },
  { id: 'black-han-sans', label: 'Black Han Sans', family: 'OxxovoBlackHanSans', web: '/fonts/BlackHanSans-Regular.ttf', file: 'BlackHanSans-Regular.ttf' },
]
export function fontSpec(id: string): FontSpec {
  return FONT_SPECS.find((f) => f.id === id) ?? FONT_SPECS[0]
}

// Layout constants -- part of the parity contract (identical in both repos).
export const LINE_HEIGHT = 1.25 // multiple of font px
const STROKE_MITER = 2

// A minimal canvas-2D surface -- satisfied by both the DOM context and
// @napi-rs/canvas's context (only the members we use are declared).
export type TextMetricsLike = { width: number; fontBoundingBoxAscent?: number; actualBoundingBoxAscent?: number }
export type Ctx2D = {
  font: string
  textAlign: string
  textBaseline: string
  fillStyle: string
  strokeStyle: string
  lineWidth: number
  lineJoin: string
  miterLimit: number
  fillText(text: string, x: number, y: number): void
  strokeText(text: string, x: number, y: number): void
  measureText(text: string): TextMetricsLike
}

// Font pixel size for a layer on a canvas of height H.
export function fontPx(layer: TextLayer, H: number): number {
  return (layer.sizePct / 100) * H
}

// The em-box ascent for the current ctx font, from font metadata (content-
// independent). `textBaseline='top'` is defined DIFFERENTLY across Skia builds
// (Chromium vs @napi-rs) -- it drifts vertically with font size and breaks
// parity. So we use the 'alphabetic' baseline and place it ourselves from the
// measured font ascent, which BOTH engines read from the same font file.
function fontAscent(ctx: Ctx2D, px: number): number {
  const m = ctx.measureText('Ag가힣')
  return m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent ?? px * 0.8
}

// Draw a text layer at FULL opacity onto ctx (canvas W x H). Fade is applied by
// the compositor (worker ffmpeg fade / preview globalAlpha), not baked here, so
// the raster is deterministic. Anchor: yNorm*H = TOP of the text block; align
// controls the horizontal meaning of xNorm*W (left edge / center / right edge).
//
// Parity contract: baseline is 'alphabetic' + measured ascent (see fontAscent);
// each line's draw origin is SNAPPED to an integer px so the two engines never
// diverge on sub-pixel positioning (which otherwise smears anti-aliased edges).
export function drawTextLayer(ctx: Ctx2D, W: number, H: number, layer: TextLayer): void {
  const px = fontPx(layer, H)
  const spec = fontSpec(layer.font)
  ctx.font = `${px}px "${spec.family}"`
  ctx.textAlign = 'left' // we compute the x origin ourselves + snap to integer
  ctx.textBaseline = 'alphabetic'
  ctx.lineJoin = 'round'
  ctx.miterLimit = STROKE_MITER

  const lines = layer.content.split('\n')
  const lineH = px * LINE_HEIGHT
  const anchorX = layer.xNorm * W
  const yTop = layer.yNorm * H
  const asc = fontAscent(ctx, px)

  const hasStroke = !!layer.strokeColor && (layer.strokePct ?? 0) > 0
  const strokeW = hasStroke ? ((layer.strokePct ?? 0) / 100) * px : 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const w = ctx.measureText(line).width
    let lx = anchorX
    if (layer.align === 'center') lx = anchorX - w / 2
    else if (layer.align === 'right') lx = anchorX - w
    lx = Math.round(lx)
    const ly = Math.round(yTop + asc + i * lineH)
    if (hasStroke) {
      ctx.strokeStyle = layer.strokeColor as string
      ctx.lineWidth = strokeW
      ctx.strokeText(line, lx, ly) // outline first, fill on top
    }
    ctx.fillStyle = layer.color
    ctx.fillText(line, lx, ly)
  }
}

// Opacity for a layer at composition time `tMs`, given its window + fades.
// Shared by preview (globalAlpha) and any timing checks; the worker mirrors the
// same ramp with ffmpeg's fade filter.
export function textAlphaAt(layer: TextLayer, tMs: number): number {
  if (tMs < layer.startMs || tMs > layer.endMs) return 0
  const fin = layer.fadeInMs ?? 0
  const fout = layer.fadeOutMs ?? 0
  if (fin > 0 && tMs < layer.startMs + fin) return (tMs - layer.startMs) / fin
  if (fout > 0 && tMs > layer.endMs - fout) return Math.max(0, (layer.endMs - tMs) / fout)
  return 1
}
