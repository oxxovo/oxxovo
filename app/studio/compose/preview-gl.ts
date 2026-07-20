'use client'

// D -- WebGL WYSIWYG preview engine. Plugs into the PreviewEngine seam (preview.ts).
// ★ The RENDER (oxxovo-studio render.ts, B1) is authoritative; the shaders MATCH
// it (shared source: lib/gl-effects.ts). Parity is re-verified from the ENGINE's
// shaders by scripts/gl-engine-parity.mjs before effect controls (E) are exposed.
// Ported so far: color grade + LUT (this file). Glow / transitions land next.

import type { PreviewEngine, PreviewClip, PreviewSegment, PreviewTransition } from './preview'
import type { EffectParams } from '@/lib/effects'
import { VERT, FRAG_COLOR_LUT, FRAG_BLUR, FRAG_SCREEN, FRAG_COPY, FRAG_TRANSITION, TRANSITION_TYPE, transitionSample, colorUniforms, activeLut, glowStages, grainAmount, LUT_FILE, parseCube, tileCube } from '@/lib/gl-effects'

type TiledLut = { W: number; H: number; px: Uint8Array; N: number }

// WebGL2 multipass: color+LUT -> FBO base; then, per glow stage, separable
// gaussian + screen-blend (ping-pong FBOs); finally copy to the canvas. No glow
// = color+LUT drawn straight to the canvas (fast path).
export class GLProcessor {
  private gl: WebGL2RenderingContext
  private progCL: WebGLProgram
  private progBlur: WebGLProgram
  private progScreen: WebGLProgram
  private progCopy: WebGLProgram
  private progTrans: WebGLProgram
  private tex: WebGLTexture
  private lutTex: WebGLTexture
  private lutN = 0
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
    this.progCL = prog(FRAG_COLOR_LUT); this.progBlur = prog(FRAG_BLUR); this.progScreen = prog(FRAG_SCREEN); this.progCopy = prog(FRAG_COPY); this.progTrans = prog(FRAG_TRANSITION)
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    for (const p of [this.progCL, this.progBlur, this.progScreen, this.progCopy, this.progTrans]) {
      gl.useProgram(p); const a = gl.getAttribLocation(p, 'a_pos'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)
    }
    const mkTex = () => {
      const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      return t
    }
    this.tex = mkTex(); this.lutTex = mkTex()
  }
  private ensureFbos(w: number, h: number): void {
    if (this.fw === w && this.fh === h && this.fbos.length) return
    const gl = this.gl
    for (const f of this.fbos) { gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.tex) }
    this.fbos = []
    for (let i = 0; i < 6; i++) { // 0-3 glow multipass, 4/5 = transition A/B
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
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.fbos[aIdx].tex)
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.fbos[bIdx].tex)
    this.bindTarget(-1, w, h); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
  render(source: TexImageSource, w: number, h: number, seg?: EffectParams, global?: EffectParams, lutLoaded = false, targetIdx = -1): void {
    const gl = this.gl
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h }
    if (targetIdx >= 0) this.ensureFbos(w, h)
    // upload source
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    const stages = glowStages(seg, global)
    const useLut = lutLoaded && this.lutN > 0 && !!activeLut(seg, global)
    const u = colorUniforms(seg, global)
    // pass 1: color + LUT
    gl.useProgram(this.progCL)
    gl.uniform1i(gl.getUniformLocation(this.progCL, 'u_tex'), 0); gl.uniform1i(gl.getUniformLocation(this.progCL, 'u_lut'), 1)
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.lutTex)
    this.uf(this.progCL, 'u_exposure', u.exposure); this.uf(this.progCL, 'u_contrast', u.contrast); this.uf(this.progCL, 'u_saturation', u.saturation)
    this.uf(this.progCL, 'u_tempK', u.tempK); this.uf(this.progCL, 'u_tint', u.tint); this.uf(this.progCL, 'u_vignette', u.vignette)
    this.uf(this.progCL, 'u_hasLut', useLut ? 1 : 0); this.uf(this.progCL, 'u_N', this.lutN || 2)
    this.uf(this.progCL, 'u_grain', grainAmount(seg, global)); this.uf(this.progCL, 'u_seed', (this.seed = (this.seed + 1) % 997))
    if (!stages.length) {
      this.bindTarget(targetIdx, w, h)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      return
    }
    this.ensureFbos(w, h)
    let base = 0, blurA = 1, blurB = 2, out = 3
    const drawTo = (fbIdx: number) => { gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[fbIdx].fb); gl.viewport(0, 0, w, h); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4) }
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex)
    drawTo(base)
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
    // final copy base -> canvas
    gl.useProgram(this.progCopy); gl.uniform1i(gl.getUniformLocation(this.progCopy, 'u'), 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h)
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

export function createGLPreview(opts: { onPlayingChange?: (playing: boolean) => void } = {}): PreviewEngine {
  let video: HTMLVideoElement | null = null
  let videoB: HTMLVideoElement | null = null // incoming clip, only during a transition
  let canvas: HTMLCanvasElement | null = null
  let proc: GLProcessor | null = null
  let savedVideoStyle = ''
  let raf = 0
  let segs: PreviewSegment[] = []
  let clipMap: Map<string, PreviewClip> = new Map()
  let glob: EffectParams | undefined
  let trans: Map<number, PreviewTransition> = new Map()
  let idx = 0
  let playing = false
  const luts = makeLutLoader()
  const setPlaying = (p: boolean) => { playing = p; opts.onPlayingChange?.(p) }

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

  const drawFrame = () => {
    if (!video || !proc || video.readyState < 2 || !video.videoWidth) return
    const w = video.videoWidth, h = video.videoHeight
    const seg = segs[idx]
    const tr = trans.get(idx)
    // --- transition window: blend outgoing (video) + incoming (videoB) ---
    if (tr && idx + 1 < segs.length) {
      const t = tr.durationMs / 1000, endA = seg.endMs / 1000, tStart = endA - t
      if (video.currentTime >= tStart - 1e-3) {
        const p = Math.max(0, Math.min(1, (video.currentTime - tStart) / t))
        const segB = segs[idx + 1], clipB = clipMap.get(segB.jobId)
        if (clipB) {
          if (!videoB) { videoB = document.createElement('video'); videoB.playsInline = true; videoB.crossOrigin = 'anonymous' }
          if (videoB.src !== clipB.url) { videoB.src = clipB.url }
          const bTime = transitionSample(p, t, endA, segB.startMs / 1000).bTime
          if (Math.abs(videoB.currentTime - bTime) > 0.08) { try { videoB.currentTime = bTime } catch { /* not ready */ } }
          if (videoB.paused) videoB.play().catch(() => {})
          // audio crossfade (mirrors the render's acrossfade)
          video.volume = 1 - p; videoB.volume = p
          if (videoB.readyState >= 2) {
            const lutA = applyLut(seg.effects); proc.render(video, w, h, seg.effects, glob, lutA, 4)
            const lutB = applyLut(segB.effects); proc.render(videoB, w, h, segB.effects, glob, lutB, 5)
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
    proc.render(video, w, h, seg?.effects, glob, lut)
  }
  const loop = () => { drawFrame(); if (playing) raf = requestAnimationFrame(loop) }
  const playAt = async (i: number, startOffsetMs = 0) => {
    if (!video || i >= segs.length) { setPlaying(false); return }
    releaseVideoB()
    idx = i
    const clip = clipMap.get(segs[i].jobId)
    if (!clip) { setPlaying(false); return }
    if (video.src !== clip.url) video.src = clip.url
    video.volume = 1
    try { video.currentTime = segs[i].startMs / 1000 + startOffsetMs / 1000; await video.play() } catch { setPlaying(false) }
  }
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
      canvas = document.createElement('canvas')
      canvas.className = 'oxxovo-gl-preview max-h-full w-full max-w-2xl rounded-xl'
      v.parentElement?.insertBefore(canvas, v)
      savedVideoStyle = v.getAttribute('style') ?? ''
      v.style.position = 'absolute'; v.style.width = '1px'; v.style.height = '1px'; v.style.opacity = '0'; v.style.pointerEvents = 'none'
      proc = new GLProcessor(canvas)
      v.addEventListener('timeupdate', onTimeUpdate)
      v.addEventListener('ended', () => setPlaying(false))
    },
    play(segments, clips, global, transitions) {
      segs = segments; clipMap = clips; glob = global
      trans = new Map((transitions ?? []).map((tr) => [tr.afterIndex, tr]))
      if (!segments.length) return
      setPlaying(true); void playAt(0)
      cancelAnimationFrame(raf); raf = requestAnimationFrame(loop)
    },
    update(segments, clips, global, transitions) {
      segs = segments; clipMap = clips; glob = global
      trans = new Map((transitions ?? []).map((tr) => [tr.afterIndex, tr]))
    },
    pause() { setPlaying(false); video?.pause(); cancelAnimationFrame(raf) },
    showFrame(seg, clips, global) {
      segs = [seg]; clipMap = clips; glob = global; idx = 0
      const clip = clips.get(seg.jobId)
      if (!video || !clip) return
      if (video.src !== clip.url) video.src = clip.url
      const seek = () => { try { video!.currentTime = seg.startMs / 1000 } catch { /* not ready */ }; requestAnimationFrame(() => { drawFrame(); requestAnimationFrame(drawFrame) }) }
      if (video.readyState >= 1) seek()
      else video.addEventListener('loadedmetadata', seek, { once: true })
    },
    destroy() {
      cancelAnimationFrame(raf)
      video?.removeEventListener('timeupdate', onTimeUpdate)
      video?.pause()
      releaseVideoB(); videoB = null
      if (video) video.setAttribute('style', savedVideoStyle)
      canvas?.remove()
      video = null; canvas = null; proc = null
    },
  }
}
