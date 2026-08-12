// motionBlur (rVFC ring buffer) parity -- does the GL preview's approximation
// (average N RAW pre-effect frames, captured via video.requestVideoFrameCallback,
// then run the normal per-segment chain on the average) match the worker's REAL
// tmix=frames=N (which averages already-graded frames mid-chain)?
//   node scripts/gl-motionblur-parity.mjs
//
// ★WHY THIS EXISTS. The 2026-08-10 spike (reports/
// lane_c_item4_g_motionblur_spike_2026-08-10.md) established that rVFC solves the
// STRUCTURAL problem (rAF over-ticking vs source fps, measured 2.47x duplicate
// capture) -- but never measured whether the GL approximation's raw-frame-average
// actually looks like the worker's real mid-chain tmix output. That is what this
// harness measures, using the SAME signal-relative-error instrument and PASS/
// REVIEW/FAIL bands as gl-engine-parity.mjs / gl-combo-parity.mjs.
//
// ★VIDEO, NOT A SINGLE PNG. motionBlur is temporal -- there is no single-frame
// analogue. The source is a lossless yuv444p VP9 WebM (no chroma-subsampling
// round-trip loss, so the browser's decode and ffmpeg's decode of the SAME file
// should read back byte-identical -- verified below as an explicit decode-
// baseline check BEFORE trusting the motionBlur number, not assumed).
//
// ★FRAME-EXACT, NOT -ss. -ss lands between frames and produces a fake mismatch
// (the lesson from reports/lane_c_...parity_harness_frame_exact -- see
// [[feedback-parity-harness-frame-exact]]). The ffmpeg side selects the target
// frame by index (`select=eq(n,N)`); the browser side aligns via rVFC's
// mediaTime (frameIdx = round(mediaTime * FPS)), logged explicitly, not assumed.
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'
import { chromium } from 'playwright-core'
import { FFMPEG, ffmpegBanner } from './ffmpeg-bin.mjs'
import { VERT, FRAG_MOTIONBLUR, motionBlurN } from '../lib/gl-effects.ts'
import { resolveWorkerRepo } from './worker-repo.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORKER_REPO = resolveWorkerRepo(ROOT)
const RENDER_TS = join(WORKER_REPO, 'src', 'render.ts')
if (!existsSync(RENDER_TS)) {
  console.error(`\n★Cannot load the worker's filter builder -- exiting 1 rather than guessing its order.`)
  console.error(`  looked for : ${RENDER_TS}\n`)
  process.exit(1)
}
process.env.LUT_DIR = join(WORKER_REPO, 'assets', 'luts')
register('./test-hooks.mjs', import.meta.url)
let effectVideoFilters
try {
  ;({ effectVideoFilters } = await import(pathToFileURL(RENDER_TS).href))
} catch (e) {
  console.error(`\n★Found ${RENDER_TS} but could not import it. ${e?.message ?? e}\n`)
  process.exit(1)
}
const ff = (e) => effectVideoFilters(e).join(',')

const FPS = 24
const W = 320, H = 240
const DURATION_SEC = 3
const TARGET_FRAME = 48 // 2s in @24fps -- well past any tmix warm-up for N<=6

const TMPDIR = (process.env.TEMP || '/tmp').split(String.fromCharCode(92)).join('/')
const run = (args) => new Promise((res, rej) => {
  const p = spawn(FFMPEG, args)
  const ch = []; let e = ''
  p.stdout.on('data', (d) => ch.push(d))
  p.stderr.on('data', (d) => (e += d))
  p.on('close', (c) => (c === 0 ? res(Buffer.concat(ch)) : rej(new Error('ff ' + c + ' ' + e.slice(-400)))))
  p.on('error', rej)
})
// ★vf MUST run before select. tmix (and any other temporal filter) needs the
// FULL frame stream to average over -- selecting down to one frame FIRST (as
// an earlier version of this harness did) hands tmix a 1-frame stream, which
// is a no-op by construction and silently reads as mag=0.000 "unmeasurable"
// instead of the real effect. select only picks which OUTPUT frame to keep.
const rawFrame = async (src, vf) => {
  const args = ['-y', '-i', src]
  const filters = [...(vf ? [vf] : []), 'select=\'eq(n,' + TARGET_FRAME + ')\'', 'format=rgb24']
  args.push('-vf', filters.join(','), '-vsync', 'vfr', '-frames:v', '1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1')
  return run(args)
}
// Same instrument as gl-engine-parity.mjs / gl-combo-parity.mjs.
const signalErr = (plain, ff_, gl) => {
  const n = Math.min(plain.length, ff_.length, gl.length)
  let num = 0, den = 0
  for (let i = 0; i < n; i++) { num += Math.abs(gl[i] - ff_[i]); den += Math.abs(ff_[i] - plain[i]) }
  return den === 0 ? 0 : num / den
}
const diff = (a, b) => { const n = Math.min(a.length, b.length); let s = 0; for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]); return s / n / 255 * 100 }
const FLOOR_PCT = 100 / 255

console.log('')
console.log(await ffmpegBanner())
console.log(`worker repo: ${WORKER_REPO}`)
console.log(`source: ${W}x${H} @ ${FPS}fps, ${DURATION_SEC}s, target frame n=${TARGET_FRAME} (t=${(TARGET_FRAME / FPS).toFixed(3)}s)`)
console.log('bands: PASS r<0.5 | REVIEW 0.5<=r<1.0 | FAIL r>=1.0 | UNMEASURABLE if effect<=1 LSB')
console.log('')

// ---------------------------------------------------------------------------
// 1. Source clip -- moving content (testsrc2 has a zoneplate + motion + frame
// counter), lossless yuv444p VP9/WebM so the browser's decode and ffmpeg's
// decode of the identical file have no chroma-subsampling round-trip to
// diverge on (checked explicitly below, not assumed).
// ---------------------------------------------------------------------------
const SRC = `${TMPDIR}/mb_src.webm`
await run(['-y', '-f', 'lavfi', '-i', `testsrc2=size=${W}x${H}:rate=${FPS}:duration=${DURATION_SEC}`,
  '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv444p', '-lossless', '1', '-an', SRC])

// ★Order/formula check, read off the built string -- not assumed. Confirms
// tmix appears and lets us read N straight back out of what render.ts emits,
// so this harness can never silently test a stale mapping.
const nFromFilters = (mb) => {
  const s = ff({ motionBlur: mb })
  const m = /tmix=frames=(\d+)/.exec(s)
  return m ? Number(m[1]) : null
}
const CASES = [40, 100] // N=3, N=6 -- two points on the mapping, not just the max
for (const mb of CASES) {
  const nWorker = nFromFilters(mb)
  const nGl = motionBlurN({ motionBlur: mb })
  if (nWorker == null) { console.error(`\n★motionBlur=${mb}: worker emitted no tmix filter -- exiting 1.\n`); process.exit(1) }
  if (nWorker !== nGl) {
    console.error(`\n★motionBlur=${mb}: worker N=${nWorker} but motionBlurN()=${nGl} -- the GL helper has drifted from render.ts. Exiting 1 rather than measuring a known-wrong mapping.\n`)
    process.exit(1)
  }
}
console.log(`N mapping confirmed against render.ts for motionBlur=${CASES.join('/')}: N=${CASES.map(nFromFilters).join('/')}`)
console.log('')

// ---------------------------------------------------------------------------
// 2. ffmpeg ground truth at the target frame: plain (no filter) + real tmix.
// ---------------------------------------------------------------------------
const plainBuf = await rawFrame(SRC, null)

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const srcB64 = (await readFile(SRC)).toString('base64')

// ---------------------------------------------------------------------------
// 3. Browser side: real <video> playback + the REAL FRAG_MOTIONBLUR shader
// (imported, not retyped) fed by an rVFC capture loop -- the same decoupled-
// from-rAF architecture preview-gl.ts ships, reimplemented here the way every
// other harness in this repo re-runs the real shader source headlessly rather
// than instantiating the client-only GLProcessor class (see gl-combo-parity.mjs).
// Captures: (a) glPlain -- the RAW decoded frame at the target index, no blend,
// for the decode-baseline sanity check; (b) glBlendN -- the ring-buffer average
// of the most recent N frames AT the target index, for each N in CASES.
async function captureBrowser(ns) {
  const dataUrls = await page.evaluate(async ({ srcB64, VERT, FRAG_MOTIONBLUR, W, H, FPS, TARGET_FRAME, RING_SIZE, ns }) => {
    const video = document.createElement('video')
    video.muted = true; video.playsInline = true
    video.src = 'data:video/webm;base64,' + srcB64
    await new Promise((res, rej) => {
      video.addEventListener('loadedmetadata', res, { once: true })
      video.addEventListener('error', () => rej(new Error('video load failed')), { once: true })
    })

    const cv = document.createElement('canvas'); cv.width = W; cv.height = H
    const gl = cv.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true })
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o }
    const mkProg = (fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p }
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const progMb = mkProg(FRAG_MOTIONBLUR)
    for (const p of [progMb]) { gl.useProgram(p); const a = gl.getAttribLocation(p, 'a_pos'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0) }
    const mkTex = () => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t)
      for (const [k, v] of [['WRAP_S', 'CLAMP_TO_EDGE'], ['WRAP_T', 'CLAMP_TO_EDGE'], ['MIN_FILTER', 'LINEAR'], ['MAG_FILTER', 'LINEAR']]) gl.texParameteri(gl.TEXTURE_2D, gl['TEXTURE_' + k], gl[v])
      return t
    }
    const ring = Array.from({ length: RING_SIZE }, () => mkTex())
    let ringFilled = 0, ringWrite = 0
    // plain-frame texture, captured once we hit the target frame index (unblended).
    const plainTex = mkTex()
    let plainCaptured = false
    let plainFrameIdx = -1

    const pushRing = (src) => {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, ring[ringWrite])
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
      ringWrite = (ringWrite + 1) % RING_SIZE
      ringFilled = Math.min(ringFilled + 1, RING_SIZE)
    }
    const blendAt = (n) => {
      gl.useProgram(progMb)
      for (let i = 0; i < RING_SIZE; i++) {
        const idx = (ringWrite - 1 - Math.min(i, n - 1) + RING_SIZE * 2) % RING_SIZE
        gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, ring[idx])
        gl.uniform1i(gl.getUniformLocation(progMb, `u_tex${i}`), i)
      }
      gl.uniform1i(gl.getUniformLocation(progMb, 'u_n'), n)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      return cv.toDataURL('image/png')
    }

    const results = {}
    let resolveDone
    const done = new Promise((res) => { resolveDone = res })
    const tick = (_now, metadata) => {
      const frameIdx = Math.round(metadata.mediaTime * FPS)
      pushRing(video)
      if (frameIdx === TARGET_FRAME) {
        if (!plainCaptured) {
          plainCaptured = true; plainFrameIdx = frameIdx
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, plainTex)
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)
        }
        for (const n of ns) if (ringFilled >= n && !(n in results)) results[n] = { dataUrl: blendAt(n), frameIdx, ringFilled }
        if (Object.keys(results).length === ns.length) { resolveDone(); return }
      }
      if (frameIdx > TARGET_FRAME + 2) { resolveDone(); return } // safety: never hang if alignment fails
      video.requestVideoFrameCallback(tick)
    }
    video.requestVideoFrameCallback(tick)
    await video.play()
    await done
    video.pause()

    // plain readback via the copy/passthrough path (n=1 blend == passthrough of tex0)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, plainTex)
    const plainUrl = (() => { gl.useProgram(progMb)
      for (let i = 0; i < RING_SIZE; i++) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, plainTex); gl.uniform1i(gl.getUniformLocation(progMb, `u_tex${i}`), i) }
      gl.uniform1i(gl.getUniformLocation(progMb, 'u_n'), 1)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      return cv.toDataURL('image/png')
    })()

    return { plain: { dataUrl: plainUrl, frameIdx: plainFrameIdx }, blends: results }
  }, { srcB64, VERT, FRAG_MOTIONBLUR, W, H, FPS, TARGET_FRAME, RING_SIZE: 6, ns })
  return dataUrls
}

const captured = await captureBrowser(CASES.map(nFromFilters))
console.log(`browser: plain captured at frameIdx=${captured.plain.frameIdx} (target ${TARGET_FRAME})`)
if (captured.plain.frameIdx !== TARGET_FRAME) {
  console.error(`\n★rVFC alignment MISSED the target frame (got ${captured.plain.frameIdx}, wanted ${TARGET_FRAME}) -- results below are NOT frame-exact. Exiting 1 rather than reporting a number against the wrong frame.\n`)
  process.exit(1)
}

const pngToRaw = async (dataUrl, tag) => {
  const png = `${TMPDIR}/mb_${tag}.png`
  await writeFile(png, Buffer.from(dataUrl.split(',')[1], 'base64'))
  return run(['-y', '-i', png, '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
}

// ---------------------------------------------------------------------------
// 4. Decode-baseline check FIRST -- browser's plain decode vs ffmpeg's plain
// decode of the IDENTICAL file/frame. If this itself doesn't match closely,
// the motionBlur number below is confounded by decoder disagreement, not by
// the shader -- reported as its own line, not folded into the verdict.
// ---------------------------------------------------------------------------
const glPlain = await pngToRaw(captured.plain.dataUrl, 'plain')
const decodeBaselinePct = diff(plainBuf, glPlain)
console.log(`decode baseline (browser plain decode vs ffmpeg plain decode, same file/frame): ${decodeBaselinePct.toFixed(3)}%`)
console.log(decodeBaselinePct <= FLOOR_PCT ? '  -> at/under the 1-LSB floor, decoders agree' : '  -> ABOVE floor -- see note before trusting the motionBlur row below')
console.log('')

// ---------------------------------------------------------------------------
// 5. motionBlur rows.
// ---------------------------------------------------------------------------
console.log('mb   N   mag%(ff tmix vs plain)   r(signal-relative)   verdict')
for (const mb of CASES) {
  const n = nFromFilters(mb)
  const ffTmix = await rawFrame(SRC, `${ff({ motionBlur: mb })},format=rgb24`)
  const glBlend = await pngToRaw(captured.blends[n].dataUrl, `blend_n${n}`)
  const mag = diff(plainBuf, ffTmix)
  const r = signalErr(plainBuf, ffTmix, glBlend)
  const verdict = mag <= FLOOR_PCT ? 'UNMEASURABLE' : r < 0.5 ? 'PASS' : r < 1.0 ? 'REVIEW' : 'FAIL'
  console.log(`${String(mb).padEnd(4)} ${String(n).padEnd(3)} ${mag.toFixed(3).padEnd(24)} ${r.toFixed(3).padEnd(20)} ${verdict}  (ring filled=${captured.blends[n].ringFilled}/${n})`)
}

console.log('')
console.log('PNGs written beside the source for visual review: mb_plain.png, mb_blend_n*.png')
await browser.close()
