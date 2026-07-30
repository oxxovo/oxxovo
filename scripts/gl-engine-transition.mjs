// Transition re-verify: engine's transition shader (lib/gl-effects.ts) vs ffmpeg
// xfade. Reports (1) mid-frame PARITY per type and (2) ★BOUNDARY TIMING -- at
// progress p the engine's transitionSample() must pick the outgoing frame
// endMs_out - t(1-p) and incoming startMs_in + t*p so the preview lines up with
// the render's xfade; measured at p = 0 / 0.5 / 1.
//   node scripts/gl-engine-transition.mjs <src.mp4>
import { writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright-core'
import { VERT, FRAG_TRANSITION, TRANSITION_TYPE, transitionSample } from '../lib/gl-effects.ts'
import { xfadeRefArgs, xfadeClipRefArgs } from './parity-ff.mjs'

const [src] = process.argv.slice(2) // optional: only part (2) needs a clip
const TMP = process.env.TEMP + '/xfeng'
const sh = (args) => new Promise((res, rej) => { const p = spawn('ffmpeg', args); const ch = []; let e = ''; p.stdout.on('data', (d) => ch.push(d)); p.stderr.on('data', (d) => (e += d)); p.on('close', (c) => (c === 0 ? res(Buffer.concat(ch)) : rej(new Error('ff ' + c + ' ' + e.slice(-200))))); p.on('error', rej) })
const rawOf = (png) => sh(['-y', '-i', png, '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
const diff = (a, b) => { const n = Math.min(a.length, b.length); let s = 0; for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]); return s / n / 255 * 100 }
// accurate output-seek frame at time t (seconds), scaled 256, to png path
const frameAt = (t, out) => sh(['-y', '-i', src, '-ss', String(t), '-frames:v', '1', '-vf', 'scale=256:256', out])
const b64 = async (png) => (await sh(['-y', '-i', png, '-c:v', 'png', '-f', 'image2pipe', 'pipe:1'])).toString('base64')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
async function glBlend(aB64, bB64, p, type) {
  const url = await page.evaluate(async ({ aB64, bB64, p, type, VERT, FRAG }) => {
    const load = (b) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + b })
    const A = await load(aB64), B = await load(bB64); const W = A.width, H = A.height
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H
    const gl = cv.getContext('webgl2', { preserveDrawingBuffer: true })
    const c = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o }
    const pr = gl.createProgram(); gl.attachShader(pr, c(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, c(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr); gl.useProgram(pr)
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const a = gl.getAttribLocation(pr, 'a_pos'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)
    const tex = (img, u) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, t); for (const [k, v] of [['WRAP_S', 'CLAMP_TO_EDGE'], ['WRAP_T', 'CLAMP_TO_EDGE'], ['MIN_FILTER', 'LINEAR'], ['MAG_FILTER', 'LINEAR']]) gl.texParameteri(gl.TEXTURE_2D, gl['TEXTURE_' + k], gl[v]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img) }
    tex(A, 0); tex(B, 1)
    gl.uniform1i(gl.getUniformLocation(pr, 'u_a'), 0); gl.uniform1i(gl.getUniformLocation(pr, 'u_b'), 1)
    gl.uniform1f(gl.getUniformLocation(pr, 'u_p'), p); gl.uniform1i(gl.getUniformLocation(pr, 'u_type'), type)
    gl.uniform2f(gl.getUniformLocation(pr, 'u_res'), W, H)
    gl.viewport(0, 0, W, H); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    return cv.toDataURL('image/png')
  }, { aB64, bB64, p, type, VERT, FRAG: FRAG_TRANSITION })
  return Buffer.from(url.split(',')[1], 'base64')
}

// ---- (1) PARITY: every exposed transition x a fixed CONTENT SET x 3 progresses --
// One image is not evidence (see gl-engine-parity for the same lesson), and a
// transition can be right at p=0.5 and wrong elsewhere, so the gate needs both axes.
// ffmpeg names must match the worker's XFADE_MAP.
const FF_NAME = {
  crossfade: 'fade', 'wipe-left': 'wipeleft', 'wipe-right': 'wiperight',
  'wipe-up': 'wipeup', 'wipe-down': 'wipedown', 'dip-to-black': 'fadeblack',
  'dip-to-white': 'fadewhite', circle: 'circleopen', 'slide-left': 'slideleft',
}
const CONTENT = {
  smooth: ['-f', 'lavfi', '-i', 'color=c=gray:s=256x256', '-vf', "geq=r='128+60*sin(X/40)':g='120+50*sin(Y/35)':b='110+40*sin((X+Y)/50)',format=rgb24"],
  mandel: ['-f', 'lavfi', '-i', 'mandelbrot=s=256x256'],
  bars: ['-f', 'lavfi', '-i', 'smptebars=s=256x256'],
  testsrc: ['-f', 'lavfi', '-i', 'testsrc2=s=256x256'],
}
const names = Object.keys(CONTENT)
for (const [n, args] of Object.entries(CONTENT)) await sh(['-y', ...args, '-frames:v', '1', `${TMP}/c_${n}.png`])
// pair each content with the next one, cyclically -> 4 A/B pairs
const PAIRS = names.map((n, i) => ({ label: `${n}->${names[(i + 1) % names.length]}`.padEnd(16), a: `${TMP}/c_${n}.png`, b: `${TMP}/c_${names[(i + 1) % names.length]}.png` }))
const PROGRESS = [0.25, 0.5, 0.75]
const GATE = 5
// Lowest fps that still puts every PROGRESS value exactly on a frame (0.05 grid).
// The reference is frame-exact either way; this only avoids encoding frames we
// then throw away -- 100 fps x hundreds of measurements is minutes of ffmpeg.
const REF_FPS = 20

console.log('--- (1) transition parity: worst over 4 content pairs x p=0.25/0.5/0.75 ---')
console.log(`${'transition'.padEnd(13)}${'worst'.padEnd(9)}gate<=${GATE}%   worst case`)
let fails = 0
for (const id of Object.keys(TRANSITION_TYPE)) {
  const ff = FF_NAME[id]
  if (!ff) { console.log(`  ${id.padEnd(11)}: no ffmpeg name mapped -- REVIEW`); fails++; continue }
  let worst = -1, where = ''
  for (const pair of PAIRS) {
    const aB64 = await b64(pair.a), bB64 = await b64(pair.b)
    for (const p of PROGRESS) {
      await sh(xfadeRefArgs({ aPng: pair.a, bPng: pair.b, type: ff, p, fps: REF_FPS, out: `${TMP}/ff_${id}.png` }))
      await writeFile(`${TMP}/gl_${id}.png`, await glBlend(aB64, bB64, p, TRANSITION_TYPE[id]))
      const d = diff(await rawOf(`${TMP}/ff_${id}.png`), await rawOf(`${TMP}/gl_${id}.png`))
      if (d > worst) { worst = d; where = `${pair.label.trim()} @ p=${p}` }
    }
  }
  const ok = worst <= GATE
  if (!ok) fails++
  console.log(`  ${id.padEnd(11)}: ${worst.toFixed(2)}%`.padEnd(26) + (ok ? 'PASS' : 'REVIEW') + `   (${where})`)
}

// ---- (2) BOUNDARY TIMING: crossfade, outgoing trim [0,6], incoming [8,14], t=1 ----
// render truth = xfade of the two trimmed clips; extract at output 5+p.
console.log('--- (2) boundary timing (outEnd=6s inStart=8s t=1s) ---')
const outEnd = 6, inStart = 8, t = 1
for (const p of [0, 0.5, 1]) {
  const { aTime, bTime } = transitionSample(p, t, outEnd, inStart)
  await frameAt(aTime, `${TMP}/ta.png`); await frameAt(bTime, `${TMP}/tb.png`)
  const gl = await glBlend(await b64(`${TMP}/ta.png`), await b64(`${TMP}/tb.png`), p, TRANSITION_TYPE.crossfade); await writeFile(`${TMP}/tgl.png`, gl)
  // ground truth: xfade the trimmed clips, take the output frame at progress p by
  // FRAME INDEX (offset = outEnd - t = 5). Both inputs are normalised to the
  // harness fps inside the graph so the index is well defined -- see parity-ff.mjs.
  await sh(xfadeClipRefArgs({
    aArgs: ['-ss', '0', '-t', '6', '-i', src],
    bArgs: ['-ss', '8', '-t', '6', '-i', src],
    type: 'fade', p, pre: 'scale=256:256', offset: 5, duration: 1,
    out: `${TMP}/truth.png`,
  }))
  const d = diff(await rawOf(`${TMP}/truth.png`), await rawOf(`${TMP}/tgl.png`))
  console.log(`  p=${p}: aTime=${aTime.toFixed(2)}s bTime=${bTime.toFixed(2)}s  diff=${d.toFixed(2)}%  ${d <= 8 ? 'ALIGNED' : 'DRIFT'}`)
}
await browser.close()
if (fails) { console.log(`REVIEW: ${fails} transition(s) over gate`); process.exitCode = 1 }
else console.log('ALL TRANSITIONS PASS')
