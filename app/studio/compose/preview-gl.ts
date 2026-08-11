'use client'

// D -- WebGL WYSIWYG preview engine. Plugs into the PreviewEngine seam (preview.ts).
// ★ The RENDER (oxxovo-studio render.ts, B1) is authoritative; the shaders MATCH
// it (shared source: lib/gl-effects.ts). Parity is re-verified from the ENGINE's
// shaders by scripts/gl-engine-parity.mjs before effect controls (E) are exposed.
// Ported so far: color grade + LUT + sharpen + chromatic + grain + vignette +
// glow (this file, worker order: color/LUT -> sharpen -> chromatic -> grain ->
// vignette -> glow). ★sharpen/chromatic are WIRED AND EXPOSED
// (EXPOSED_SLIDER_KEYS, 2026-08-10). motionBlur is NOT wired -- it is
// TEMPORAL (worker's tmix averages several video FRAMES), which this
// single-frame-in/single-frame-out pass chain cannot do without a frame-
// history buffer this engine does not keep. lutIntensity is NOT wired either,
// on purpose: render.ts's effectVideoFilters() never reads it (lut3d always
// applies at full strength), so there is nothing on the worker side for a
// preview slider to match yet -- exposing it here would show a control that
// lies about what the render does.

import type { PreviewEngine, PreviewClip, PreviewSegment, PreviewTransition } from './preview'
import { locateComposition, fitObjectFit } from './preview'
import type { EffectParams } from '@/lib/effects'
import { VERT, FRAG_COLOR_LUT, FRAG_UNSHARP, FRAG_CHROMATIC, FRAG_GRAIN, FRAG_VIGNETTE, FRAG_BLUR, FRAG_SCREEN, FRAG_COPY, FRAG_TRANSITION, TRANSITION_TYPE, transitionSample, colorUniforms, activeLut, glowStages, grainAmount, unsharpAmount, chromaticShift, LUT_FILE, parseCube, tileCube } from '@/lib/gl-effects'
import { valueAt, type KeyframeTrack } from '@/lib/edl-keyframes'

// ★D keyframes (2026-08-10). Only exposure/contrast/saturation/vignette are
// keyframe-able at all -- same limitation as the worker (render.ts), for the
// same reason (checked there against ffmpeg directly): this list exists so
// the two sides can't silently drift on WHICH params animate.
const KEYFRAMEABLE_PARAMS: readonly (keyof EffectParams)[] = ['exposure', 'contrast', 'saturation', 'vignette']

// seg with any keyframed param replaced by its value AT segRelMs -- a plain
// EffectParams a caller can hand to colorUniforms()/etc exactly like a
// static one, so nothing downstream needs to know keyframes exist at all.
function effectiveSegParams(
  seg: EffectParams | undefined,
  keyframes: Partial<Record<keyof EffectParams, KeyframeTrack>> | undefined,
  segRelMs: number,
): EffectParams | undefined {
  if (!keyframes) return seg
  let out: EffectParams | undefined
  for (const k of KEYFRAMEABLE_PARAMS) {
    const track = keyframes[k]
    if (!track || !track.points.length) continue
    if (!out) out = { ...seg }
    // KEYFRAMEABLE_PARAMS is all-numeric EffectParams keys; TS can't narrow a
    // generic `keyof` write across a mixed number|string object, so this cast
    // just states what's already true by construction above.
    ;(out as Record<string, number>)[k] = valueAt(track, segRelMs)
  }
  return out ?? seg
}

type TiledLut = { W: number; H: number; px: Uint8Array; N: number }

// WebGL2 multipass: color+LUT -> FBO[6]; then sharpen/grain/vignette each as
// their own pass (ping-pong FBO[6]/[7], skipped when their amount is 0); then,
// per glow stage, separable gaussian + screen-blend (ping-pong FBO[0-3]);
// finally copy to the target. Nothing active at all (no glow, sharpen=0,
// grain=0, vignette=0) = color+LUT drawn straight to the target (fast path,
// unchanged from before this pass chain existed).
export class GLProcessor {
  private gl: WebGL2RenderingContext
  private progCL: WebGLProgram
  private progUnsharp: WebGLProgram
  private progChromatic: WebGLProgram
  private progGrain: WebGLProgram
  private progVignette: WebGLProgram
  private progBlur: WebGLProgram
  private progScreen: WebGLProgram
  private progCopy: WebGLProgram
  private progTrans: WebGLProgram
  private tex: WebGLTexture
  private lutTex: WebGLTexture
  private lutN = 0
  private vignetteLutTex: WebGLTexture
  private vignetteLutReady = false
  private seed = 0
  private fbos: { fb: WebGLFramebuffer; tex: WebGLTexture }[] = []
  private fw = 0
  private fh = 0
  constructor(public canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: false })
    if (!gl) throw new Error('webgl2 unavailable')
    this.gl = gl
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s))
      return s
    }
    const prog = (fs: string) => {
      const p = gl.createProgram()!; gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p)
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p))
      return p
    }
    this.progCL = prog(FRAG_COLOR_LUT); this.progUnsharp = prog(FRAG_UNSHARP); this.progChromatic = prog(FRAG_CHROMATIC)
    this.progGrain = prog(FRAG_GRAIN); this.progVignette = prog(FRAG_VIGNETTE)
    this.progBlur = prog(FRAG_BLUR); this.progScreen = prog(FRAG_SCREEN); this.progCopy = prog(FRAG_COPY); this.progTrans = prog(FRAG_TRANSITION)
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    for (const p of [this.progCL, this.progUnsharp, this.progChromatic, this.progGrain, this.progVignette, this.progBlur, this.progScreen, this.progCopy, this.progTrans]) {
      gl.useProgram(p); const a = gl.getAttribLocation(p, 'a_pos'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)
    }
    const mkTex = () => {
      const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      return t
    }
    this.tex = mkTex(); this.lutTex = mkTex(); this.vignetteLutTex = mkTex()
    // ★STATIC asset (one table, not per-composition like colour LUTs), so this
    // fires once here rather than through the per-id makeLutLoader() below.
    // Fire-and-forget: render() checks vignetteLutReady and treats vignette as
    // 0 until it resolves (a same-origin ~4KB fetch, effectively one frame).
    fetch('/vignette/vignette-lut.png')
      .then((r) => r.blob())
      .then((b) => createImageBitmap(b))
      .then((bmp) => {
        gl.bindTexture(gl.TEXTURE_2D, this.vignetteLutTex)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bmp)
        this.vignetteLutReady = true
      })
      .catch(() => { /* stays not-ready; vignette silently no-ops rather than throwing mid-render */ })
  }
  private ensureFbos(w: number, h: number): void {
    if (this.fw === w && this.fh === h && this.fbos.length) return
    const gl = this.gl
    for (const f of this.fbos) { gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.tex) }
    this.fbos = []
    for (let i = 0; i < 8; i++) { // 0-3 glow multipass, 4/5 = transition A/B, 6/7 = pre-glow chain (sharpen/grain/vignette)
      const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      const fb = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0)
      this.fbos.push({ fb, tex: t })
    }
    this.fw = w; this.fh = h
  }
  setLut(l: TiledLut | null): void {
    const gl = this.gl
    if (!l) { this.lutN = 0; return }
    this.lutN = l.N
    gl.bindTexture(gl.TEXTURE_2D, this.lutTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, l.W, l.H, 0, gl.RGBA, gl.UNSIGNED_BYTE, l.px)
  }
  private uf(p: WebGLProgram, name: string, v: number) { this.gl.uniform1f(this.gl.getUniformLocation(p, name), v) }
  // Bind the final draw target: -1 = canvas, else fbos[idx].
  private bindTarget(idx: number, w: number, h: number) {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, idx < 0 ? null : this.fbos[idx].fb)
    gl.viewport(0, 0, w, h)
  }
  // Blend two already-effected frames (fbos[aIdx], fbos[bIdx]) with a transition
  // at progress p, straight to the canvas. Uses the parity-verified FRAG_TRANSITION.
  transitionBlend(aIdx: number, bIdx: number, w: number, h: number, p: number, type: number): void {
    const gl = this.gl
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h }
    gl.useProgram(this.progTrans)
    gl.uniform1i(gl.getUniformLocation(this.progTrans, 'u_a'), 0); gl.uniform1i(gl.getUniformLocation(this.progTrans, 'u_b'), 1)
    this.uf(this.progTrans, 'u_p', p); gl.uniform1i(gl.getUniformLocation(this.progTrans, 'u_type'), type)
    // circle needs the canvas aspect (see FRAG_TRANSITION); harmless for the rest.
    gl.uniform2f(gl.getUniformLocation(this.progTrans, 'u_res'), w, h)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.fbos[aIdx].tex)
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.fbos[bIdx].tex)
    this.bindTarget(-1, w, h); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
  render(
    source: TexImageSource, w: number, h: number, seg?: EffectParams, global?: EffectParams, lutLoaded = false, targetIdx = -1,
    // ★D keyframes (2026-08-10). segRelMs = playhead position relative to
    // THIS segment's own start (0 at the segment's first frame) -- the same
    // convention the worker's `t` uses inside its per-segment ffmpeg process
    // (measured, not assumed: -ss before -i rebases pts_time to 0).
    keyframes?: Partial<Record<keyof EffectParams, KeyframeTrack>>, segRelMs = 0,
  ): void {
    const gl = this.gl
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h }
    if (targetIdx >= 0) this.ensureFbos(w, h)
    // upload source
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    // Keyframed params replaced by their value AT segRelMs; everything past
    // this point reads `seg` (now the effective one) exactly like before --
    // colorUniforms/unsharpAmount/etc never need to know keyframes exist.
    seg = effectiveSegParams(seg, keyframes, segRelMs)
    const stages = glowStages(seg, global)
    const useLut = lutLoaded && this.lutN > 0 && !!activeLut(seg, global)
    const u = colorUniforms(seg, global)
    const sharpenAmt = unsharpAmount(seg, global)
    const chromatic = chromaticShift(seg, global)
    const grainAmt = grainAmount(seg, global)
    // pass 1: color + LUT (no vignette/grain here any more -- ★2026-08-10, see
    // the note above FRAG_COLOR_LUT in lib/gl-effects.ts: the worker fires
    // sharpen right after this, and grain/vignette LAST, so baking them into
    // this pass made the correct order unreachable.)
    gl.useProgram(this.progCL)
    gl.uniform1i(gl.getUniformLocation(this.progCL, 'u_tex'), 0); gl.uniform1i(gl.getUniformLocation(this.progCL, 'u_lut'), 1)
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.lutTex)
    this.uf(this.progCL, 'u_exposure', u.exposure); this.uf(this.progCL, 'u_contrast', u.contrast); this.uf(this.progCL, 'u_saturation', u.saturation)
    this.uf(this.progCL, 'u_tempK', u.tempK); this.uf(this.progCL, 'u_tint', u.tint)
    this.uf(this.progCL, 'u_hasLut', useLut ? 1 : 0); this.uf(this.progCL, 'u_N', this.lutN || 2)
    // ★vignette no-ops until its LUT texture has loaded (a same-origin fetch
    // kicked off in the constructor, effectively one frame) -- see the note
    // there. Never throws, never shows a mangled frame; just skips the effect
    // for the handful of frames before it resolves.
    const vignetteActive = u.vignette > 0 && this.vignetteLutReady
    const needsChain = stages.length > 0 || sharpenAmt > 0 || chromatic.rh !== 0 || chromatic.bh !== 0 || grainAmt > 0 || vignetteActive
    if (!needsChain) {
      this.bindTarget(targetIdx, w, h)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      return
    }
    this.ensureFbos(w, h)
    const drawTo = (fbIdx: number) => { gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[fbIdx].fb); gl.viewport(0, 0, w, h); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4) }

    // ---- pre-glow chain: color+LUT -> sharpen -> grain -> vignette --------
    // ★WORKER ORDER (effectVideoFilters, read not recalled): unsharp fires
    // right after the LUT; grain and vignette fire last, grain before
    // vignette. Ping-pongs fbos[6]/[7] -- dedicated scratch slots so this
    // chain can never collide with glow's 0-3 or a transition's 4/5.
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex)
    drawTo(6)
    let cur = 6, other = 7
    if (sharpenAmt > 0) {
      gl.useProgram(this.progUnsharp); gl.uniform1i(gl.getUniformLocation(this.progUnsharp, 'u_tex'), 0)
      gl.uniform2f(gl.getUniformLocation(this.progUnsharp, 'u_texel'), 1 / w, 1 / h)
      this.uf(this.progUnsharp, 'u_amount', sharpenAmt)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.fbos[cur].tex); drawTo(other)
      ;[cur, other] = [other, cur]
    }
    if (chromatic.rh !== 0 || chromatic.bh !== 0) {
      gl.useProgram(this.progChromatic); gl.uniform1i(gl.getUniformLocation(this.progChromatic, 'u_tex'), 0)
      gl.uniform2f(gl.getUniformLocation(this.progChromatic, 'u_texel'), 1 / w, 1 / h)
      this.uf(this.progChromatic, 'u_rh', chromatic.rh); this.uf(this.progChromatic, 'u_bh', chromatic.bh)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.fbos[cur].tex); drawTo(other)
      ;[cur, other] = [other, cur]
    }
    if (grainAmt > 0) {
      gl.useProgram(this.progGrain); gl.uniform1i(gl.getUniformLocation(this.progGrain, 'u_tex'), 0)
      this.uf(this.progGrain, 'u_grain', grainAmt); this.uf(this.progGrain, 'u_seed', (this.seed = (this.seed + 1) % 997))
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.fbos[cur].tex); drawTo(other)
      ;[cur, other] = [other, cur]
    }
    if (vignetteActive) {
      gl.useProgram(this.progVignette)
      gl.uniform1i(gl.getUniformLocation(this.progVignette, 'u_tex'), 0); gl.uniform1i(gl.getUniformLocation(this.progVignette, 'u_vignetteLut'), 1)
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.vignetteLutTex)
      this.uf(this.progVignette, 'u_vignette', u.vignette); gl.uniform2f(gl.getUniformLocation(this.progVignette, 'u_res'), w, h)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.fbos[cur].tex); drawTo(other)
      ;[cur, other] = [other, cur]
    }

    if (!stages.length) {
      // no glow: cur already holds the fully pre-glow-processed frame.
      gl.useProgram(this.progCopy); gl.uniform1i(gl.getUniformLocation(this.progCopy, 'u'), 0)
      this.bindTarget(targetIdx, w, h)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.fbos[cur].tex)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      return
    }
    // hand off to the glow loop, which owns fbos[0-3] and expects its input
    // pre-loaded at base=0 -- one copy pass, not a rewrite of the loop below.
    gl.useProgram(this.progCopy); gl.uniform1i(gl.getUniformLocation(this.progCopy, 'u'), 0)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.fbos[cur].tex); drawTo(0)

    let base = 0, blurA = 1, blurB = 2, out = 3
    // glow stages (per-seg then global): separable blur -> screen blend
    for (const st of stages) {
      // H blur base -> blurA
      gl.useProgram(this.progBlur); gl.uniform1i(gl.getUniformLocation(this.progBlur, 'u'), 0)
      this.uf(this.progBlur, 'u_sigma', st.sigma); gl.uniform2f(gl.getUniformLocation(this.progBlur, 'u_texel'), 1 / w, 1 / h)
      gl.uniform2f(gl.getUniformLocation(this.progBlur, 'u_dir'), 1, 0)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.fbos[base].tex); drawTo(blurA)
      // V blur blurA -> blurB
      gl.uniform2f(gl.getUniformLocation(this.progBlur, 'u_dir'), 0, 1)
      gl.bindTexture(gl.TEXTURE_2D, this.fbos[blurA].tex); drawTo(blurB)
      // screen(base, blurB, op) -> out
      gl.useProgram(this.progScreen)
      gl.uniform1i(gl.getUniformLocation(this.progScreen, 'u_base'), 0); gl.uniform1i(gl.getUniformLocation(this.progScreen, 'u_blur'), 1)
      this.uf(this.progScreen, 'u_op', st.opacity)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.fbos[base].tex)
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.fbos[blurB].tex)
      drawTo(out)
      ;[base, out] = [out, base] // ping-pong: result becomes the new base
    }
    // final copy base -> target (canvas by default, or an fbo slot mid-transition --
    // ★3-(A): this used to hard-bind the canvas here, ignoring targetIdx. The fast
    // path above (no glow stages) already respected it; a segment with BOTH glow and
    // an active transition took this branch instead and drew its glow result straight
    // to the canvas, so transitionBlend(4, 5, ...) read fbos[4]/[5] with whatever was
    // left in them from a PRIOR frame -- a stale-texture bug that only showed up on
    // the glow+transition combination, never on either alone.
    gl.useProgram(this.progCopy); gl.uniform1i(gl.getUniformLocation(this.progCopy, 'u'), 0)
    this.bindTarget(targetIdx, w, h)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.fbos[base].tex)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
}

// Fetch + parse + tile a LUT .cube from /luts, cached. Returns null until ready.
function makeLutLoader() {
  const cache = new Map<string, TiledLut>()
  const inflight = new Set<string>()
  return {
    get(id: string): TiledLut | null { return cache.get(id) ?? null },
    ensure(id: string, onReady: () => void): void {
      if (!id || cache.has(id) || inflight.has(id)) return
      const file = LUT_FILE[id]
      if (!file) return
      inflight.add(id)
      fetch(`/luts/${file}`)
        .then((r) => r.text())
        .then((txt) => {
          const parsed = parseCube(txt)
          const t = tileCube(parsed)
          cache.set(id, { ...t, N: parsed.size })
          inflight.delete(id)
          onReady()
        })
        .catch(() => inflight.delete(id))
    },
  }
}

// The GL preview uploads each frame to a WebGL texture, which requires the clip
// to be fetched in CORS mode (crossOrigin) with the bucket returning ACAO.
//
// R2 CORS is now applied on the bucket (GET/HEAD, ACAO echoed per Origin), so the
// clip is loaded at its BARE URL -- no ?gl=1 cache key any more. The invariant that
// replaces it: every surface that loads a clip URL in the compose editor opts into
// CORS mode too (the media-pool thumbnails carry crossOrigin), so one URL means one
// cache entry and one download. Mixing modes on the same URL is what tainted the
// texture before: an opaque (no-cors) cached response cannot serve a cors request.
//   * GL + pool thumbnails : bare URL, CORS mode          <- shared cache entry
//   * raw fallback engine   : ?raw=1, no-cors (preview.ts) <- deliberately independent
// The raw engine keeps its own key so the black-screen fallback still works when
// CORS itself is what failed. See preview.ts for that side of the contract.

export function createGLPreview(opts: { onPlayingChange?: (playing: boolean) => void; onDegrade?: (reason: string) => void; onProgress?: (compMs: number) => void } = {}): PreviewEngine {
  let video: HTMLVideoElement | null = null
  let videoB: HTMLVideoElement | null = null // incoming clip, only during a transition
  let canvas: HTMLCanvasElement | null = null
  let proc: GLProcessor | null = null
  let savedVideoStyle = ''
  let raf = 0
  // ★ BLACK-SCREEN GUARD. The clips are cross-origin (R2). Uploading a
  // cross-origin <video> to a texture throws SecurityError unless the bucket
  // sends Access-Control-Allow-Origin AND the element carries crossOrigin --
  // and the throw used to escape drawFrame, killing the rAF loop and leaving an
  // undrawn (transparent -> black) canvas over bg-black with no recovery.
  // Now ANY GL failure sets `dead` and reports up: the editor drops back to the
  // raw engine, the <video> is unhidden, and the user sees the ORIGINAL footage
  // with an honest "preview approximate" note. A black preview is never shown.
  let dead = false
  const degrade = (reason: string) => {
    if (dead) return
    dead = true
    cancelAnimationFrame(raf)
    canvas?.remove()
    canvas = null
    if (video) video.setAttribute('style', savedVideoStyle) // unhide immediately
    opts.onDegrade?.(reason)
  }
  let segs: PreviewSegment[] = []
  let clipMap: Map<string, PreviewClip> = new Map()
  let glob: EffectParams | undefined
  let trans: Map<number, PreviewTransition> = new Map()
  let idx = 0
  let playing = false
  const luts = makeLutLoader()
  let lastReport = 0
  const setPlaying = (p: boolean) => { playing = p; opts.onPlayingChange?.(p) }
  const showCanvas = () => { if (canvas) canvas.style.display = '' }
  const compStart = (i: number) => { let a = 0; for (let k = 0; k < i; k++) a += Math.max(0, segs[k].endMs - segs[k].startMs); return a }
  const report = () => {
    if (!video || !opts.onProgress) return
    const seg = segs[idx]; if (!seg) return
    const now = performance.now()
    if (now - lastReport < 50) return // ~20fps; avoids a setState storm per rAF
    lastReport = now
    opts.onProgress(compStart(idx) + Math.max(0, video.currentTime * 1000 - seg.startMs))
  }
  // Persistent seek handler: when paused, repaint once the seek settles (scrub).
  // A persistent listener avoids per-seek once-listeners piling up during a drag.
  const onSeeked = () => { if (!playing) drawFrame() }

  // Ensure the LUT for these effects is loaded + bound on the processor. Returns
  // whether a LUT is in play (drives u_hasLut). Applied before EACH render so A/B
  // in a transition can use different LUTs on the single LUT texture.
  const applyLut = (effects?: EffectParams): boolean => {
    if (!proc) return false
    const id = activeLut(effects, glob)
    if (id) luts.ensure(id, () => {})
    const t = id ? luts.get(id) : null
    proc.setLut(t)
    return !!t
  }
  // Release the second video (transition ended / left the window) -- no leak.
  const releaseVideoB = () => {
    if (videoB) { videoB.pause(); videoB.removeAttribute('src'); videoB.load(); videoB.volume = 0 }
    if (video) video.volume = 1
  }

  const drawFrameGL = () => {
    if (!video || !proc || video.readyState < 2 || !video.videoWidth) return
    const w = video.videoWidth, h = video.videoHeight
    const seg = segs[idx]
    if (canvas) canvas.style.objectFit = fitObjectFit(seg) // letterbox/crop per clip

    const tr = trans.get(idx)
    // --- transition window: blend outgoing (video) + incoming (videoB) ---
    if (tr && idx + 1 < segs.length) {
      const t = tr.durationMs / 1000, endA = seg.endMs / 1000, tStart = endA - t
      if (video.currentTime >= tStart - 1e-3) {
        const p = Math.max(0, Math.min(1, (video.currentTime - tStart) / t))
        const segB = segs[idx + 1], clipB = clipMap.get(segB.jobId)
        if (clipB) {
          if (!videoB) { videoB = document.createElement('video'); videoB.playsInline = true; videoB.crossOrigin = 'anonymous' }
          const bUrl = clipB.url
          if (videoB.src !== bUrl) { videoB.src = bUrl }
          const bTime = transitionSample(p, t, endA, segB.startMs / 1000).bTime
          if (Math.abs(videoB.currentTime - bTime) > 0.08) { try { videoB.currentTime = bTime } catch { /* not ready */ } }
          if (videoB.paused) videoB.play().catch(() => {})
          // audio crossfade (mirrors the render's acrossfade)
          video.volume = 1 - p; videoB.volume = p
          if (videoB.readyState >= 2) {
            const segRelMsA = video.currentTime * 1000 - seg.startMs
            const segRelMsB = videoB.currentTime * 1000 - segB.startMs
            const lutA = applyLut(seg.effects); proc.render(video, w, h, seg.effects, glob, lutA, 4, seg.keyframes, segRelMsA)
            const lutB = applyLut(segB.effects); proc.render(videoB, w, h, segB.effects, glob, lutB, 5, segB.keyframes, segRelMsB)
            proc.transitionBlend(4, 5, w, h, p, TRANSITION_TYPE[tr.type] ?? 0)
            return
          }
        }
      } else {
        releaseVideoB()
      }
    } else {
      releaseVideoB()
    }
    // --- normal single-video path (unchanged) ---
    const lut = applyLut(seg?.effects)
    const segRelMs = seg ? video.currentTime * 1000 - seg.startMs : 0
    proc.render(video, w, h, seg?.effects, glob, lut, -1, seg?.keyframes, segRelMs)
  }
  // Every GL call the preview makes goes through here. A throw (SecurityError on
  // a tainted cross-origin video, shader/link failure, context loss) degrades to
  // raw instead of escaping and freezing the loop on a black canvas.
  const drawFrame = () => {
    if (dead) return
    try { drawFrameGL() } catch (e) { degrade(e instanceof Error ? `${e.name}: ${e.message}` : String(e)) }
  }
  const loop = () => { drawFrame(); report(); if (playing && !dead) raf = requestAnimationFrame(loop) }
  const playAt = async (i: number, startOffsetMs = 0) => {
    if (!video || i >= segs.length) { setPlaying(false); return }
    releaseVideoB()
    idx = i
    const clip = clipMap.get(segs[i].jobId)
    if (!clip) { setPlaying(false); return }
    const url = clip.url
    if (video.src !== url) video.src = url
    video.volume = 1
    try { video.currentTime = segs[i].startMs / 1000 + startOffsetMs / 1000; await video.play() } catch { setPlaying(false) }
  }
  // The media itself failed to load (most likely: this origin is not in the R2
  // CORS policy, so the CORS-mode request is rejected). Raw playback does not
  // need CORS, so degrading restores a working preview.
  const onMediaError = () => degrade('media load failed (origin not allowed by bucket CORS?)')
  const onTimeUpdate = () => {
    if (!video || !playing) return
    const seg = segs[idx]
    // When a transition just completed, the main video takes over the incoming
    // clip from +t (the transition already showed its first t seconds via videoB).
    if (seg && video.currentTime >= seg.endMs / 1000) {
      const tr = trans.get(idx)
      void playAt(idx + 1, tr ? tr.durationMs : 0)
    }
  }

  return {
    kind: 'gl',
    approximate: () => false,
    mount(v) {
      video = v
      savedVideoStyle = v.getAttribute('style') ?? ''
      // texImage2D refuses a cross-origin video element that did not opt into
      // CORS. The R2 bucket now returns Access-Control-Allow-Origin for this
      // app's origins (www.oxxovo.ai / *.vercel.app / localhost, verified), so
      // the preview opts in with crossOrigin on the bare URL (R2 CORS applied). The
      // safety net stays -- if ANY origin/browser still fails the CORS upload or
      // media load, drawFrame catches it -> degrade() -> raw (original footage +
      // honest note), never a black canvas.
      v.crossOrigin = 'anonymous'
      v.addEventListener('error', onMediaError)
      v.addEventListener('seeked', onSeeked)
      try {
        canvas = document.createElement('canvas')
        // Fill the aspect box; object-fit (set per current segment in drawFrameGL)
        // letterboxes/crops the native-aspect bitmap exactly like the worker.
        canvas.className = 'oxxovo-gl-preview absolute inset-0 h-full w-full rounded-xl'
        v.parentElement?.insertBefore(canvas, v)
        proc = new GLProcessor(canvas) // shader compile / link throws land here
      } catch (e) {
        degrade(e instanceof Error ? `${e.name}: ${e.message}` : String(e))
        return
      }
      v.style.position = 'absolute'; v.style.width = '1px'; v.style.height = '1px'; v.style.opacity = '0'; v.style.pointerEvents = 'none'
      v.addEventListener('timeupdate', onTimeUpdate)
      v.addEventListener('ended', () => setPlaying(false))
    },
    play(segments, clips, global, transitions, startCompMs = 0) {
      segs = segments; clipMap = clips; glob = global
      trans = new Map((transitions ?? []).map((tr) => [tr.afterIndex, tr]))
      if (!segments.length) return
      showCanvas()
      setPlaying(true)
      const { idx: si, videoTimeMs } = locateComposition(segs, startCompMs)
      void playAt(si, videoTimeMs - segs[si].startMs)
      cancelAnimationFrame(raf); raf = requestAnimationFrame(loop)
    },
    update(segments, clips, global, transitions) {
      segs = segments; clipMap = clips; glob = global
      trans = new Map((transitions ?? []).map((tr) => [tr.afterIndex, tr]))
    },
    // Move the playhead to a composition-global time. During a transition window
    // the normal drawFrame path re-derives the A/B blend from video.currentTime
    // (transitionSample), so positioning the outgoing clip is enough.
    seek(compMs, segments, clips, global, transitions) {
      segs = segments; clipMap = clips; glob = global
      trans = new Map((transitions ?? []).map((tr) => [tr.afterIndex, tr]))
      if (!segs.length || !video || dead) return
      showCanvas()
      releaseVideoB() // drawFrame re-acquires videoB if the target lands in a transition
      const { idx: ni, videoTimeMs } = locateComposition(segs, compMs)
      idx = ni
      const clip = clipMap.get(segs[ni].jobId)
      if (!clip) return
      const url = clip.url
      const srcChanged = video.src !== url
      if (srcChanged) video.src = url
      video.volume = 1
      const target = videoTimeMs / 1000
      const apply = () => {
        if (!video || dead) return
        try { video.currentTime = target } catch { /* not ready */ }
        if (playing) { video.play().catch(() => {}); return }
        // paused scrub: onSeeked repaints when the seek settles; this rAF retry
        // covers the "already at target" no-op (no seeked fires) and not-yet-ready.
        let tries = 0
        const retry = () => { if (dead || !video) return; if (video.readyState >= 2) drawFrame(); else if (tries++ < 60) requestAnimationFrame(retry) }
        requestAnimationFrame(retry)
      }
      if (srcChanged && video.readyState < 1) video.addEventListener('loadedmetadata', apply, { once: true })
      else apply()
    },
    clear() {
      setPlaying(false)
      cancelAnimationFrame(raf)
      video?.pause()
      releaseVideoB()
      if (canvas) canvas.style.display = 'none'
    },
    pause() { setPlaying(false); video?.pause(); cancelAnimationFrame(raf) },
    showFrame(seg, clips, global) {
      segs = [seg]; clipMap = clips; glob = global; idx = 0
      const clip = clips.get(seg.jobId)
      if (!video || !clip || dead) return
      const url = clip.url
      if (video.src !== url) video.src = url
      // Setting currentTime drops readyState below HAVE_CURRENT_DATA until the
      // new frame decodes, and drawFrame no-ops under that -- firing two rAFs
      // blind used to leave the canvas undrawn (i.e. black) with no retry. Draw
      // on 'seeked' (the frame IS decoded) and keep a short rAF retry for the
      // no-op case where currentTime was already at the target.
      const paint = () => { drawFrame(); requestAnimationFrame(drawFrame) }
      const seek = () => {
        if (!video || dead) return
        video.addEventListener('seeked', paint, { once: true })
        try { video.currentTime = seg.startMs / 1000 } catch { /* not ready */ }
        let tries = 0
        const retry = () => {
          if (dead || !video) return
          if (video.readyState >= 2) { drawFrame(); return }
          if (tries++ < 60) requestAnimationFrame(retry)
        }
        requestAnimationFrame(retry)
      }
      if (video.readyState >= 1) seek()
      else video.addEventListener('loadedmetadata', seek, { once: true })
    },
    destroy() {
      cancelAnimationFrame(raf)
      video?.removeEventListener('timeupdate', onTimeUpdate)
      video?.removeEventListener('error', onMediaError)
      video?.removeEventListener('seeked', onSeeked)
      video?.pause()
      releaseVideoB(); videoB = null
      if (video) video.setAttribute('style', savedVideoStyle)
      canvas?.remove()
      video = null; canvas = null; proc = null
    },
  }
}
