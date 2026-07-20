// GL effect shaders + LUT helpers -- the SINGLE SOURCE the WebGL preview engine
// (preview-gl.ts) AND the re-verify parity harness (scripts/gl-engine-parity.mjs)
// both use, so a ported shader can't drift from what's parity-tested. Client-safe
// + node-importable (no browser APIs, no @/ alias). ★ The render (oxxovo-studio
// render.ts) is authoritative; these mirror its B1 math in the SAME order:
// eq(exposure/contrast/saturation) -> temperature -> tint -> LUT -> vignette.
import type { EffectParams } from './effects'

// WebGL2 / GLSL ES 3.00 (glow needs FBO multipass + a dynamic-loop gaussian, so
// the whole engine is WebGL2). All programs share this vertex shader.
export const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() { v_uv = vec2((a_pos.x + 1.0) * 0.5, (1.0 - a_pos.y) * 0.5); gl_Position = vec4(a_pos, 0.0, 1.0); }`

// Color grade + optional LUT + vignette (render order). LUT is a 2D-tiled cube
// (size N tiles laid horizontally), trilinear-sampled on blue.
export const FRAG_COLOR_LUT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform sampler2D u_tex, u_lut;
uniform float u_exposure, u_contrast, u_saturation, u_tempK, u_tint, u_vignette, u_hasLut, u_N;
const vec3 LUMA = vec3(0.299, 0.587, 0.114);
vec3 lutSample(vec3 c) {
  float N = u_N; c = clamp(c, 0.0, 1.0);
  float bF = c.b * (N - 1.0); float b0 = floor(bF); float b1 = min(b0 + 1.0, N - 1.0); float f = bF - b0;
  float rx = c.r * (N - 1.0) + 0.5; float gy = c.g * (N - 1.0) + 0.5;
  vec2 t0 = vec2((b0 * N + rx) / (N * N), gy / N);
  vec2 t1 = vec2((b1 * N + rx) / (N * N), gy / N);
  return mix(texture(u_lut, t0).rgb, texture(u_lut, t1).rgb, f);
}
void main() {
  vec3 c = texture(u_tex, v_uv).rgb;
  c = (c - 0.5) * u_contrast + 0.5 + u_exposure;
  float y = dot(c, LUMA); c = mix(vec3(y), c, u_saturation);
  float k = u_tempK / 3000.0; c.r -= k * 0.05; c.b += k * 0.05;
  c.g += u_tint * (1.0 - abs(2.0 * dot(c, LUMA) - 1.0));
  if (u_hasLut > 0.5) c = lutSample(clamp(c, 0.0, 1.0));
  if (u_vignette > 0.0) { float d = distance(v_uv, vec2(0.5)); c *= 1.0 - u_vignette * smoothstep(0.35, 0.75, d); }
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`

// Glow: separable gaussian (matches ffmpeg gblur=sigma=glow/8) then screen-blend
// at opacity glow/100 (B2c). Direction u_dir = (1,0) then (0,1).
export const FRAG_BLUR = `#version 300 es
precision highp float; in vec2 v_uv; out vec4 o; uniform sampler2D u; uniform vec2 u_dir, u_texel; uniform float u_sigma;
void main() { float s = max(u_sigma, 0.001); int r = int(min(ceil(3.0 * s), 60.0)); float wsum = 0.0; vec3 acc = vec3(0.0);
  for (int i = -60; i <= 60; i++) { if (i < -r || i > r) continue; float w = exp(-float(i * i) / (2.0 * s * s)); acc += texture(u, v_uv + u_dir * u_texel * float(i)).rgb * w; wsum += w; }
  o = vec4(acc / wsum, 1.0); }`

export const FRAG_SCREEN = `#version 300 es
precision highp float; in vec2 v_uv; out vec4 o; uniform sampler2D u_base, u_blur; uniform float u_op;
void main() { vec3 b = texture(u_base, v_uv).rgb; vec3 g = texture(u_blur, v_uv).rgb; vec3 sc = 1.0 - (1.0 - b) * (1.0 - g); o = vec4(mix(b, sc, u_op), 1.0); }`

// Passthrough (FBO -> canvas final copy).
export const FRAG_COPY = `#version 300 es
precision highp float; in vec2 v_uv; out vec4 o; uniform sampler2D u; void main() { o = texture(u, v_uv); }`

// Transition blend (crossfade + wipes) at progress p in [0,1]. Matches ffmpeg
// xfade fade/wipeleft/wiperight/wipeup/wipedown (validated by transition-parity).
export const FRAG_TRANSITION = `#version 300 es
precision highp float; in vec2 v_uv; out vec4 o; uniform sampler2D u_a, u_b; uniform float u_p; uniform int u_type;
void main() {
  vec3 a = texture(u_a, v_uv).rgb, b = texture(u_b, v_uv).rgb; vec3 c;
  if (u_type == 0) c = mix(a, b, u_p);
  else if (u_type == 1) c = v_uv.x > 1.0 - u_p ? b : a;      // wipe-left
  else if (u_type == 2) c = v_uv.x < u_p ? b : a;            // wipe-right
  else if (u_type == 3) c = v_uv.y > 1.0 - u_p ? b : a;      // wipe-up
  else c = v_uv.y < u_p ? b : a;                             // wipe-down
  o = vec4(c, 1.0);
}`

// transition id -> shader type int (E exposes only the parity-passed set).
export const TRANSITION_TYPE: Record<string, number> = {
  crossfade: 0, 'wipe-left': 1, 'wipe-right': 2, 'wipe-up': 3, 'wipe-down': 4,
}

// ★ Boundary timing: at progress p the OUTGOING clip must show endMs_out - t(1-p)
// and the INCOMING clip startMs_in + t*p, so the preview's sampled frames line up
// with the render's xfade (offset = out_duration - t). Times in SECONDS.
export function transitionSample(p: number, tSec: number, outEndSec: number, inStartSec: number): { aTime: number; bTime: number } {
  const cp = p < 0 ? 0 : p > 1 ? 1 : p
  return { aTime: outEndSec - tSec * (1 - cp), bTime: inStartSec + tSec * cp }
}

// glow -> { sigma, opacity }. 0 = no glow. Per-seg then global are applied as two
// screen-blend stages (matches render.ts B2c).
export function glowStages(seg?: EffectParams, global?: EffectParams): { sigma: number; opacity: number }[] {
  const out: { sigma: number; opacity: number }[] = []
  for (const e of [seg, global]) {
    const g = iv(e?.glow)
    if (g > 0) out.push({ sigma: g / 8, opacity: g / 100 })
  }
  return out
}

const iv = (v: number | undefined) => (typeof v === 'number' ? Math.round(v) : 0)

export type ColorUniforms = { exposure: number; contrast: number; saturation: number; tempK: number; tint: number; vignette: number }

// Fold per-segment + global into color uniforms, matching render.ts numeric maps
// (exposure/200, 1+contrast/100, ...). Global applied after per-seg (both stages).
export function colorUniforms(seg?: EffectParams, global?: EffectParams): ColorUniforms {
  const acc: ColorUniforms = { exposure: 0, contrast: 1, saturation: 1, tempK: 0, tint: 0, vignette: 0 }
  const apply = (e?: EffectParams) => {
    if (!e) return
    acc.exposure += iv(e.exposure) / 200
    acc.contrast *= 1 + iv(e.contrast) / 100
    acc.saturation *= 1 + iv(e.saturation) / 100
    acc.tempK += iv(e.temperature) * 30
    acc.tint += iv(e.tint) / 200
    acc.vignette = Math.max(acc.vignette, iv(e.vignette) / 100)
  }
  apply(seg)
  apply(global)
  return acc
}

// Active LUT id (per-seg wins; else global). '' = none.
export function activeLut(seg?: EffectParams, global?: EffectParams): string {
  const s = typeof seg?.lut === 'string' ? seg.lut : ''
  return s || (typeof global?.lut === 'string' ? global.lut : '')
}

// LUT id -> served .cube path (public/luts). Matches oxxovo-studio LUT_FILES.
export const LUT_FILE: Record<string, string> = {
  'teal-orange': 'teal_orange.cube',
  'warm-film': 'warm_film.cube',
  'cool-cinema': 'cool_cinema.cube',
  noir: 'noir.cube',
  vibrant: 'vibrant.cube',
}

export type ParsedCube = { size: number; rgb: Float32Array }
export function parseCube(text: string): ParsedCube {
  let size = 0
  const data: number[] = []
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#') || t.startsWith('TITLE') || t.startsWith('DOMAIN')) continue
    if (t.startsWith('LUT_3D_SIZE')) { size = parseInt(t.split(/\s+/)[1], 10); continue }
    const p = t.split(/\s+/).map(Number)
    if (p.length === 3 && p.every((n) => Number.isFinite(n))) data.push(p[0], p[1], p[2])
  }
  return { size, rgb: Float32Array.from(data) }
}

// Tile the size^3 cube into a 2D strip: width = size*size, height = size.
// Pixel (b*size + r, g) = LUT[r,g,b]. RGBA8.
export function tileCube(lut: ParsedCube): { W: number; H: number; px: Uint8Array } {
  const N = lut.size, W = N * N, H = N
  const px = new Uint8Array(W * H * 4)
  const cl = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
  for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) {
    const src = (b * N * N + g * N + r) * 3
    const dst = ((g * W) + (b * N + r)) * 4
    px[dst] = cl(lut.rgb[src]) * 255; px[dst + 1] = cl(lut.rgb[src + 1]) * 255; px[dst + 2] = cl(lut.rgb[src + 2]) * 255; px[dst + 3] = 255
  }
  return { W, H, px }
}
