// Transition re-verify: engine's transition shader (lib/gl-effects.ts) vs ffmpeg
// xfade. Reports (1) mid-frame PARITY per type and (2) ★BOUNDARY TIMING -- at
// progress p the engine's transitionSample() must pick the outgoing frame
// endMs_out - t(1-p) and incoming startMs_in + t*p so the preview lines up with
// the render's xfade; measured at p = 0 / 0.5 / 1.
//   node scripts/gl-engine-transition.mjs <src.mp4>
import { writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
import { VERT, FRAG_TRANSITION, TRANSITION_TYPE, transitionSample } from '../lib/gl-effects.ts'

const [src] = process.argv.slice(2)
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
    gl.viewport(0, 0, W, H); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    return cv.toDataURL('image/png')
  }, { aB64, bB64, p, type, VERT, FRAG: FRAG_TRANSITION })
  return Buffer.from(url.split(',')[1], 'base64')
}

// ---- (1) PARITY: static A,B mid-frame per transition type ----
await frameAt(1, `${TMP}/A.png`); await frameAt(10, `${TMP}/B.png`)
const A64 = await b64(`${TMP}/A.png`), B64 = await b64(`${TMP}/B.png`)
console.log('--- (1) mid-frame parity (progress 0.5) ---')
for (const [id, ff] of [['crossfade', 'fade'], ['wipe-left', 'wipeleft'], ['wipe-right', 'wiperight'], ['wipe-up', 'wipeup'], ['wipe-down', 'wipedown']]) {
  await sh(['-y', '-loop', '1', '-t', '2', '-i', `${TMP}/A.png`, '-loop', '1', '-t', '2', '-i', `${TMP}/B.png`, '-filter_complex', `[0:v][1:v]xfade=transition=${ff}:duration=1:offset=1,format=rgb24[v]`, '-map', '[v]', '-ss', '1.5', '-frames:v', '1', `${TMP}/ff_${id}.png`])
  const gl = await glBlend(A64, B64, 0.5, TRANSITION_TYPE[id]); await writeFile(`${TMP}/gl_${id}.png`, gl)
  const d = diff(await rawOf(`${TMP}/ff_${id}.png`), await rawOf(`${TMP}/gl_${id}.png`))
  console.log(`  ${id.padEnd(11)}: ${d.toFixed(2)}%  ${d <= 5 ? 'PASS' : 'REVIEW'}`)
}

// ---- (2) BOUNDARY TIMING: crossfade, outgoing trim [0,6], incoming [8,14], t=1 ----
// render truth = xfade of the two trimmed clips; extract at output 5+p.
console.log('--- (2) boundary timing (outEnd=6s inStart=8s t=1s) ---')
const outEnd = 6, inStart = 8, t = 1
for (const p of [0, 0.5, 1]) {
  const { aTime, bTime } = transitionSample(p, t, outEnd, inStart)
  await frameAt(aTime, `${TMP}/ta.png`); await frameAt(bTime, `${TMP}/tb.png`)
  const gl = await glBlend(await b64(`${TMP}/ta.png`), await b64(`${TMP}/tb.png`), p, TRANSITION_TYPE.crossfade); await writeFile(`${TMP}/tgl.png`, gl)
  // ground truth: xfade the trimmed clips, extract output frame at 5+p (offset=outEnd-t=5)
  await sh(['-y', '-ss', '0', '-t', '6', '-i', src, '-ss', '8', '-t', '6', '-i', src, '-filter_complex', '[0:v]scale=256:256[a];[1:v]scale=256:256[b];[a][b]xfade=transition=fade:duration=1:offset=5,format=rgb24[v]', '-map', '[v]', '-ss', String(5 + p), '-frames:v', '1', `${TMP}/truth.png`])
  const d = diff(await rawOf(`${TMP}/truth.png`), await rawOf(`${TMP}/tgl.png`))
  console.log(`  p=${p}: aTime=${aTime.toFixed(2)}s bTime=${bTime.toFixed(2)}s  diff=${d.toFixed(2)}%  ${d <= 8 ? 'ALIGNED' : 'DRIFT'}`)
}
await browser.close()
