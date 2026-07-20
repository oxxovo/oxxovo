'use client'

// D -- WebGL WYSIWYG preview engine. Plugs into the PreviewEngine seam (preview.ts)
// with ZERO editor changes. ★ The RENDER (oxxovo-studio render.ts, B1) is the
// authoritative contract; these shaders MATCH it (never the reverse). Parity is
// measured by a harness (GL frame vs the ffmpeg frame for the same params) before
// the editor is switched from the raw engine to this one and effect controls (E)
// are exposed. D1 = color grade (exposure/contrast/saturation/temperature/tint/
// vignette). LUT / glow / grain / transitions land in later D steps.
//
// Not yet wired into the editor DOM -- built + parity-tested standalone first.

import type { EffectParams } from '@/lib/effects'
import type { PreviewEngine, PreviewClip, PreviewSegment } from './preview'

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = vec2((a_pos.x + 1.0) * 0.5, (1.0 - a_pos.y) * 0.5); // flip Y (video top-left)
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`

// Fragment shader mirrors render.ts effectVideoFilters() color math (B1):
//   eq: contrast around 0.5, +brightness(=exposure/200), saturation around luma
//   colortemperature: warm/cool shift; colorbalance gm: green<->magenta; vignette.
const FRAG = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_exposure;    // -0.5..0.5   (exposure/200)
uniform float u_contrast;    //  0..2       (1 + contrast/100)
uniform float u_saturation;  //  0..2       (1 + saturation/100)
uniform float u_tempK;       //  Kelvin offset from 6500 (temperature*30)
uniform float u_tint;        // -0.5..0.5   (tint/200), green<->magenta
uniform float u_vignette;    //  0..1       (vignette/100)
const vec3 LUMA = vec3(0.299, 0.587, 0.114);
void main() {
  vec3 c = texture2D(u_tex, v_uv).rgb;
  // eq: contrast then brightness (ffmpeg eq order), then saturation.
  c = (c - 0.5) * u_contrast + 0.5 + u_exposure;
  float y = dot(c, LUMA);
  c = mix(vec3(y), c, u_saturation);
  // colortemperature approx: +K (cooler) -> more blue, less red.
  float k = u_tempK / 3000.0;
  c.r -= k * 0.05; c.b += k * 0.05;
  // colorbalance gm approx: +tint -> greener midtones.
  c.g += u_tint * (1.0 - abs(2.0 * dot(c, LUMA) - 1.0));
  // vignette: radial darken toward the corners.
  if (u_vignette > 0.0) {
    float d = distance(v_uv, vec2(0.5));
    c *= 1.0 - u_vignette * smoothstep(0.35, 0.75, d);
  }
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s))
  return s
}

const iv = (v: number | undefined) => (typeof v === 'number' ? Math.round(v) : 0)

// Combine per-segment + global into the shader uniforms, using the SAME numeric
// mapping as render.ts (exposure/200, 1+contrast/100, ...). Global applied after
// per-seg (both stages), matching the render's per-seg-then-global fold.
function uniformsFor(seg?: EffectParams, global?: EffectParams) {
  const acc = { exposure: 0, contrast: 1, saturation: 1, tempK: 0, tint: 0, vignette: 0 }
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

class GLProcessor {
  private gl: WebGLRenderingContext
  private prog: WebGLProgram
  private tex: WebGLTexture
  private loc: Record<string, WebGLUniformLocation | null> = {}
  constructor(public canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { premultipliedAlpha: false })
    if (!gl) throw new Error('webgl unavailable')
    this.gl = gl
    const p = gl.createProgram()!
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT))
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p))
    this.prog = p
    gl.useProgram(p)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const a = gl.getAttribLocation(p, 'a_pos')
    gl.enableVertexAttribArray(a)
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)
    this.tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, this.tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    for (const u of ['u_exposure', 'u_contrast', 'u_saturation', 'u_tempK', 'u_tint', 'u_vignette']) {
      this.loc[u] = gl.getUniformLocation(p, u)
    }
  }
  // Draw a source (video/image/canvas) with the given effects into the canvas.
  render(source: TexImageSource, w: number, h: number, seg?: EffectParams, global?: EffectParams): void {
    const gl = this.gl
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h }
    gl.viewport(0, 0, w, h)
    gl.bindTexture(gl.TEXTURE_2D, this.tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    const u = uniformsFor(seg, global)
    gl.uniform1f(this.loc.u_exposure, u.exposure)
    gl.uniform1f(this.loc.u_contrast, u.contrast)
    gl.uniform1f(this.loc.u_saturation, u.saturation)
    gl.uniform1f(this.loc.u_tempK, u.tempK)
    gl.uniform1f(this.loc.u_tint, u.tint)
    gl.uniform1f(this.loc.u_vignette, u.vignette)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
}

// Exposed for the parity harness: process one image element with given effects.
export { GLProcessor }

export function createGLPreview(opts: { onPlayingChange?: (playing: boolean) => void } = {}): PreviewEngine {
  let video: HTMLVideoElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let proc: GLProcessor | null = null
  let savedVideoStyle = ''
  let raf = 0
  let segs: PreviewSegment[] = []
  let clipMap: Map<string, PreviewClip> = new Map()
  let glob: EffectParams | undefined
  let idx = 0
  let playing = false
  const setPlaying = (p: boolean) => { playing = p; opts.onPlayingChange?.(p) }

  const draw = () => {
    if (!video || !proc) return
    if (video.readyState >= 2 && video.videoWidth) {
      proc.render(video, video.videoWidth, video.videoHeight, segs[idx]?.effects, glob)
    }
    if (playing) raf = requestAnimationFrame(draw)
  }
  const playAt = async (i: number) => {
    if (!video || i >= segs.length) { setPlaying(false); return }
    idx = i
    const seg = segs[i]
    const clip = clipMap.get(seg.jobId)
    if (!clip) { setPlaying(false); return }
    if (video.src !== clip.url) video.src = clip.url
    try { video.currentTime = seg.startMs / 1000; await video.play() } catch { setPlaying(false) }
  }
  const onTimeUpdate = () => {
    if (!video || !playing) return
    const seg = segs[idx]
    if (seg && video.currentTime >= seg.endMs / 1000) void playAt(idx + 1)
  }

  return {
    kind: 'gl',
    approximate: () => false, // aims to reproduce the render (verified by harness)
    mount(v) {
      video = v
      // Canvas shows the processed frames; the <video> stays as the texture +
      // audio source but is hidden off-screen (NOT display:none, so it keeps
      // decoding frames for texImage2D). Restored on destroy.
      canvas = document.createElement('canvas')
      canvas.className = 'oxxovo-gl-preview max-h-full w-full max-w-2xl rounded-xl'
      v.parentElement?.insertBefore(canvas, v)
      savedVideoStyle = v.getAttribute('style') ?? ''
      v.style.position = 'absolute'
      v.style.width = '1px'
      v.style.height = '1px'
      v.style.opacity = '0'
      v.style.pointerEvents = 'none'
      proc = new GLProcessor(canvas)
      v.addEventListener('timeupdate', onTimeUpdate)
      v.addEventListener('ended', () => setPlaying(false))
    },
    play(segments, clips, global) {
      segs = segments; clipMap = clips; glob = global
      if (!segments.length) return
      setPlaying(true)
      void playAt(0)
      cancelAnimationFrame(raf); raf = requestAnimationFrame(draw)
    },
    pause() { setPlaying(false); video?.pause(); cancelAnimationFrame(raf) },
    showFrame(seg, clips, global) {
      segs = [seg]; clipMap = clips; glob = global; idx = 0
      const clip = clips.get(seg.jobId)
      if (!video || !clip) return
      if (video.src !== clip.url) video.src = clip.url
      const seek = () => { try { video!.currentTime = seg.startMs / 1000 } catch { /* not ready */ }; requestAnimationFrame(draw) }
      if (video.readyState >= 1) seek()
      else video.addEventListener('loadedmetadata', seek, { once: true })
    },
    destroy() {
      cancelAnimationFrame(raf)
      video?.removeEventListener('timeupdate', onTimeUpdate)
      video?.pause()
      if (video) video.setAttribute('style', savedVideoStyle) // restore visibility
      canvas?.remove()
      video = null; canvas = null; proc = null
    },
  }
}
