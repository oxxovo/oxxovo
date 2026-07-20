// Transition parity harness (D4): GL crossfade vs ffmpeg xfade at a mid-transition
// frame. Two static frames A,B are cross-faded; at progress 0.5 both should be
// mix(A,B,0.5). Usage: node scripts/transition-parity.mjs <A.png> <B.png>
// Gate <=5% (a mid-transition frame; timing/interp make it looser than color).
import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const [aPng, bPng] = process.argv.slice(2)
const run = (args) => new Promise((res, rej) => { const p = spawn('ffmpeg', args); const ch = []; p.stdout.on('data', (d) => ch.push(d)); let e = ''; p.stderr.on('data', (d) => (e += d)); p.on('close', (c) => (c === 0 ? res(Buffer.concat(ch)) : rej(new Error('ff ' + c + ' ' + e.slice(-300))))); p.on('error', rej) })
const raw = (png) => run(['-y', '-i', png, '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])

// ffmpeg: hold A 2s + B 2s, xfade fade dur=1 offset=1 -> at t=1.5 progress=0.5.
const tmp = aPng.replace(/\.png$/, '')
await run(['-y', '-loop', '1', '-t', '2', '-i', aPng, '-loop', '1', '-t', '2', '-i', bPng,
  '-filter_complex', '[0:v][1:v]xfade=transition=fade:duration=1:offset=1,format=rgb24[v]',
  '-map', '[v]', '-ss', '1.5', '-frames:v', '1', `${tmp}.xf.png`])
const ffMid = await raw(`${tmp}.xf.png`)

// GL: mix(A,B,0.5)
const aB64 = (await readFile(aPng)).toString('base64')
const bB64 = (await readFile(bPng)).toString('base64')
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const glUrl = await page.evaluate(async ({ aB64, bB64 }) => {
  const load = (b) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + b })
  const A = await load(aB64), B = await load(bB64)
  const W = A.width, H = A.height
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const gl = cv.getContext('webgl', { preserveDrawingBuffer: true })
  const VERT = `attribute vec2 p; varying vec2 uv; void main(){ uv=vec2((p.x+1.0)*0.5,(1.0-p.y)*0.5); gl_Position=vec4(p,0.0,1.0);}`
  const FRAG = `precision highp float; varying vec2 uv; uniform sampler2D a,b; uniform float t;
    void main(){ gl_FragColor=vec4(mix(texture2D(a,uv).rgb, texture2D(b,uv).rgb, t),1.0); }`
  const sh = (ty, s) => { const o = gl.createShader(ty); gl.shaderSource(o, s); gl.compileShader(o); return o }
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr); gl.useProgram(pr)
  const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const lp = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0)
  const tex = (img, unit) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img) }
  tex(A, 0); tex(B, 1)
  gl.uniform1i(gl.getUniformLocation(pr, 'a'), 0); gl.uniform1i(gl.getUniformLocation(pr, 'b'), 1); gl.uniform1f(gl.getUniformLocation(pr, 't'), 0.5)
  gl.viewport(0, 0, W, H); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  return cv.toDataURL('image/png')
}, { aB64, bB64 })
await browser.close()
await writeFile(`${tmp}.gl.png`, Buffer.from(glUrl.split(',')[1], 'base64'))
const glMid = await raw(`${tmp}.gl.png`)

const n = Math.min(ffMid.length, glMid.length); let sum = 0, max = 0
for (let i = 0; i < n; i++) { const d = Math.abs(ffMid[i] - glMid[i]); sum += d; if (d > max) max = d }
const mean = sum / n
console.log(`crossfade mid-frame (progress 0.5)`)
console.log(`mean abs diff : ${mean.toFixed(2)}/255 (${(mean / 255 * 100).toFixed(2)}%)`)
console.log(`max abs diff  : ${max}/255`)
console.log(`GATE (<=5%)   : ${mean / 255 * 100 <= 5 ? 'PASS' : 'REVIEW'}`)
