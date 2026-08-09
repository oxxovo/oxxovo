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
uniform float u_exposure, u_contrast, u_saturation, u_tempK, u_tint, u_vignette, u_hasLut, u_N, u_grain, u_seed;
const vec3 LUMA = vec3(0.299, 0.587, 0.114);
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

// ★ffmpeg eq is a YUV filter, not an RGB one. Measured 2026-07-30 (24-patch chart
// + 256-step sweeps, planes read directly as yuv444p):
//   * the graph negotiates yuv444p (no chroma subsampling) and the conversion is
//     BT.601 LIMITED range -- modelling it that way reproduced ffmpeg's identity
//     round trip BYTE-EXACT (mean 0/max 0 over the chart);
//   * brightness/contrast touch ONLY Y, saturation touches ONLY U/V (verified both
//     ways: Y unchanged by saturation, U unchanged by contrast);
//   * per-plane transfer: Y' = ((Y/255 - 0.5)*contrast + 0.5 + brightness)*255
//     (brightness form matched EXACTLY, 0/0 over 256 steps), U' = (U-128)*sat + 128.
// Doing this in RGB (the previous shader) is a different operator: on pure red at
// saturation 0.8 ffmpeg gives (216,17,11) while an RGB-luma mix gives (219,15,15) --
// note G and B diverge, which an RGB-luma model cannot produce. That mismatch was
// worth 2.5% (smooth gradients) to 7.5% (saturated) mean error, i.e. the colour
// grade never actually passed its 2.5% gate on any content.
// Residual after this port: <= 1 LSB (~0.3%), which is the pipeline's own floor --
// ffmpeg's identity RGB->YUV->RGB round trip is itself lossy by up to 1 LSB.
const float KR = 0.299, KG = 0.587, KB = 0.114;
vec3 rgbToYuv601Limited(vec3 c) {
  float y = dot(c, vec3(KR, KG, KB));
  return vec3(16.0 + 219.0 * y,
              128.0 + 224.0 * (c.b - y) / 1.772,
              128.0 + 224.0 * (c.r - y) / 1.402);
}
vec3 yuv601LimitedToRgb(vec3 t) {
  float y = (t.x - 16.0) / 219.0;
  float u = (t.y - 128.0) / 224.0;
  float v = (t.z - 128.0) / 224.0;
  float r = y + 1.402 * v;
  float b = y + 1.772 * u;
  float g = (y - KR * r - KB * b) / KG;
  return clamp(vec3(r, g, b), 0.0, 1.0);
}
// brightness = u_exposure, contrast = u_contrast, saturation = u_saturation --
// colorUniforms() already produces the same numbers the render passes to eq.
vec3 eqGrade(vec3 c, float brightness, float contrast, float saturation) {
  vec3 t = rgbToYuv601Limited(c);
  t.x = clamp(((t.x / 255.0 - 0.5) * contrast + 0.5 + brightness) * 255.0, 0.0, 255.0);
  t.y = clamp((t.y - 128.0) * saturation + 128.0, 0.0, 255.0);
  t.z = clamp((t.z - 128.0) * saturation + 128.0, 0.0, 255.0);
  return yuv601LimitedToRgb(t);
}
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
  // eq (YUV) first, exactly like the render's filter order; everything after this
  // mirrors an RGB filter (colortemperature / colorbalance / lut3d / vignette).
  c = eqGrade(c, u_exposure, u_contrast, u_saturation);
  float k = u_tempK / 3000.0; c.r -= k * 0.05; c.b += k * 0.05;
  c.g += u_tint * (1.0 - abs(2.0 * dot(c, LUMA) - 1.0));
  if (u_hasLut > 0.5) c = lutSample(clamp(c, 0.0, 1.0));
  if (u_vignette > 0.0) { float d = distance(v_uv, vec2(0.5)); c *= 1.0 - u_vignette * smoothstep(0.35, 0.75, d); }
  // Grain: APPROXIMATE preview only (a different random field than the ffmpeg
  // render; amplitude tracks the slider so the amount matches). UI shows a badge.
  if (u_grain > 0.0) { float n = hash(v_uv * 1024.0 + u_seed) - 0.5; c += n * u_grain * 0.006; }
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

// Transition blend at progress p in [0,1]. Every branch mirrors the ffmpeg xfade
// transition of the same name, and every formula below was DERIVED BY MEASUREMENT
// against this ffmpeg build, not recalled: the reference frame is selected by frame
// index (scripts/parity-ff.mjs) and the A/B coefficients are separated by rendering
// white-over-black and black-over-white, which makes each term readable on its own.
//
// slide-left (2026-07-30): A shifts left by p, B enters from the right, boundary at
//   x = 1-p. Byte-identical to ffmpeg (0.00%, max 0) once the reference frame is
//   frame-exact -- the previously recorded 8.81% was a harness artefact.
// dip-to-black / dip-to-white (2026-07-30): NOT a symmetric fade through the
//   midpoint. The darkest point is p ~= 0.2, and the two clip weights use different
//   smoothstep widths:
//       alpha = (1 - smoothstep(0, 0.2, p)) * (1 - p)      <- outgoing
//       beta  = smoothstep(0, 0.8, p) * p                  <- incoming
//       out   = alpha*A + beta*B + (1 - alpha - beta)*BG
//   Verified on 14 progress points with ZERO error on both coefficients; the same
//   alpha/beta with BG=white reproduce fadewhite (<=1 LSB). A naive "fade to black
//   at p=0.5" would have been visibly wrong.
// circle (circleopen, 2026-07-30): a wide radial smoothstep sweeping outward, not a
//   hard disc with a soft rim:
//       d = hypot(x - w/2, y - h/2) / hypot(w/2, h/2)
//       out = mix(B, A, smoothstep(0, 1, d - (p - 0.5) * 3))
//   Verified across 5 progress values x the full radius range.
// u_res is the output canvas size -- only `circle` needs it (for the aspect ratio;
// d is scale-invariant otherwise).
export const FRAG_TRANSITION = `#version 300 es
precision highp float; in vec2 v_uv; out vec4 o; uniform sampler2D u_a, u_b; uniform float u_p; uniform int u_type; uniform vec2 u_res;
void main() {
  vec3 a = texture(u_a, v_uv).rgb, b = texture(u_b, v_uv).rgb; vec3 c;
  if (u_type == 0) c = mix(a, b, u_p);
  else if (u_type == 1) c = v_uv.x > 1.0 - u_p ? b : a;      // wipe-left
  else if (u_type == 2) c = v_uv.x < u_p ? b : a;            // wipe-right
  else if (u_type == 3) c = v_uv.y > 1.0 - u_p ? b : a;      // wipe-up
  else if (u_type == 4) c = v_uv.y < u_p ? b : a;            // wipe-down
  else if (u_type == 5 || u_type == 6) {                     // dip to black / white
    float alpha = (1.0 - smoothstep(0.0, 0.2, u_p)) * (1.0 - u_p);
    float beta = smoothstep(0.0, 0.8, u_p) * u_p;
    vec3 bg = u_type == 5 ? vec3(0.0) : vec3(1.0);
    c = a * alpha + b * beta + bg * max(0.0, 1.0 - alpha - beta);
  }
  else if (u_type == 7) {                                    // circle (circleopen)
    vec2 half_ = u_res * 0.5;
    float d = length((v_uv - 0.5) * u_res) / length(half_);
    c = mix(b, a, smoothstep(0.0, 1.0, d - (u_p - 0.5) * 3.0));
  }
  else {                                                     // slide-left
    vec2 ua = v_uv + vec2(u_p, 0.0);
    vec2 ub = v_uv - vec2(1.0 - u_p, 0.0);
    c = v_uv.x > 1.0 - u_p ? texture(u_b, ub).rgb : texture(u_a, ua).rgb;
  }
  o = vec4(c, 1.0);
}`

// transition id -> shader type int. ONLY parity-passed transitions are listed: an id
// missing here cannot be exposed in the editor, which is what keeps "the preview
// matches the render" true by construction rather than by intention.
// dissolve is deliberately absent -- ffmpeg's dissolve field comes out of sinf() in
// float32 and its fract() amplifies the last bits, so the pattern depends on the
// ffmpeg build's libm and is not reproducible in a shader. Closing that one needs a
// render-side change (a field we define), same class as grain/tmix.
export const TRANSITION_TYPE: Record<string, number> = {
  crossfade: 0, 'wipe-left': 1, 'wipe-right': 2, 'wipe-up': 3, 'wipe-down': 4,
  'dip-to-black': 5, 'dip-to-white': 6, circle: 7, 'slide-left': 8,
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

// Grain amount for the shader (single u_grain). per-seg wins, else global.
export function grainAmount(seg?: EffectParams, global?: EffectParams): number {
  return iv(seg?.grain) || iv(global?.grain)
}

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

// ---------------------------------------------------------------------------
// ④-G  sharpen -- mirrors the render's `unsharp=5:5:amount:5:5:0`.
//
// ★WHAT ffmpeg's unsharp ACTUALLY DOES, because guessing it would have produced a
// plausible shader that fails the gate. vf_unsharp builds its blur from CASCADED
// 2-tap running sums, not a single box: with msize 5 the cascade runs 2*steps = 4
// times per axis, which is a 2-tap box convolved with itself 4 times = the width-5
// BINOMIAL kernel (1,4,6,4,1)/16. Both axes give 16 x 16 = 256, and that is exactly
// the filter's own `scalebits = (steps_x + steps_y) * 2 = 8` (divide by 1<<8) --
// the two numbers agreeing is the check that this reading is right. A uniform 5x5 box
// would be a different operator, softer in the middle and wrong at the edges of detail.
//
// ★LUMA ONLY. The render passes chroma_amount=0, so U and V are copied through
// untouched. And unsharp is a YUV filter, so the sharpen has to happen on Y in
// BT.601 LIMITED range -- the same model the colour grade needed
// (see FRAG_COLOR_LUT: doing it in RGB is a different operator entirely).
//
// ★Edges are CLAMP-to-edge in vf_unsharp (`x <= 0 ? src[0] : x >= width ? src[width-1]`),
// which is what the sampler is already configured for, so no border special-case.
//
// amount comes from unsharpAmount() below, which mirrors render.ts's `sh / 50`.
export const FRAG_UNSHARP = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform sampler2D u_tex;
uniform vec2 u_texel;
uniform float u_amount;
const float KR = 0.299, KG = 0.587, KB = 0.114;
vec3 rgbToYuv601Limited(vec3 c) {
  float y = dot(c, vec3(KR, KG, KB));
  return vec3(16.0 + 219.0 * y,
              128.0 + 224.0 * (c.b - y) / 1.772,
              128.0 + 224.0 * (c.r - y) / 1.402);
}
vec3 yuv601LimitedToRgb(vec3 t) {
  float y = (t.x - 16.0) / 219.0;
  float u = (t.y - 128.0) / 224.0;
  float v = (t.z - 128.0) / 224.0;
  float r = y + 1.402 * v;
  float b = y + 1.772 * u;
  float g = (y - KR * r - KB * b) / KG;
  return clamp(vec3(r, g, b), 0.0, 1.0);
}
float lumaAt(vec2 uv) { return rgbToYuv601Limited(texture(u_tex, uv).rgb).x; }
void main() {
  vec3 yuv = rgbToYuv601Limited(texture(u_tex, v_uv).rgb);
  // separable binomial (1,4,6,4,1); 16 x 16 = 256 == 1 << scalebits
  float w[5] = float[5](1.0, 4.0, 6.0, 4.0, 1.0);
  float sum = 0.0;
  for (int j = 0; j < 5; j++) {
    for (int i = 0; i < 5; i++) {
      vec2 off = vec2(float(i - 2) * u_texel.x, float(j - 2) * u_texel.y);
      sum += w[i] * w[j] * lumaAt(v_uv + off);
    }
  }
  float blurY = sum / 256.0;
  yuv.x = clamp(yuv.x + (yuv.x - blurY) * u_amount, 0.0, 255.0);
  o = vec4(yuv601LimitedToRgb(yuv), 1.0);
}`

/**
 * Slider -> unsharp `luma_amount`. ★Mirrors render.ts (`unsharp=5:5:${sh/50}:5:5:0`)
 * and nothing else: if that mapping changes, the parity row moves rather than quietly
 * still passing. 0 means the render emits no unsharp at all.
 */
export function unsharpAmount(seg?: EffectParams, global?: EffectParams): number {
  const v = seg?.sharpen ?? global?.sharpen ?? 0
  const n = Math.round(Number(v))
  if (!Number.isFinite(n) || n === 0) return 0
  return n / 50
}
