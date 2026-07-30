// Transition parity harness (D4): GL blend vs ffmpeg xfade at the SAME progress.
// Two static frames A,B; the reference frame is selected by frame index (never by
// a seconds seek -- see scripts/parity-ff.mjs for why that distinction is the whole
// ballgame). Usage: node scripts/transition-parity.mjs <A.png> <B.png> [type] [p]
// Gate <=5%; frame-exact references actually land at <=0.2% (slide: 0.00%).
import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright-core'
import { xfadeRefArgs } from './parity-ff.mjs'

const [aPng, bPng, TYPE = 'fade', P = '0.5'] = process.argv.slice(2)
const progress = Number(P)
// GL body producing gl_FragColor from a(=uv A), b(=uv B), t(=progress). Must
// match ffmpeg xfade's transition of the same name at the mid frame.
const GL_BODY = {
  fade: 'gl_FragColor=vec4(mix(texture2D(a,uv).rgb, texture2D(b,uv).rgb, t),1.0);',
  // wipeleft: B occupies uv.x > (1-t); left stays A.
  wipeleft: 'gl_FragColor=vec4(uv.x > 1.0-t ? texture2D(b,uv).rgb : texture2D(a,uv).rgb, 1.0);',
  wiperight: 'gl_FragColor=vec4(uv.x < t ? texture2D(b,uv).rgb : texture2D(a,uv).rgb, 1.0);',
  // slideleft: A slides out left, B slides in from the right.
  slideleft: 'vec2 ua=uv+vec2(t,0.0); vec2 ub=uv-vec2(1.0-t,0.0); gl_FragColor=vec4(uv.x>1.0-t?texture2D(b,ub).rgb:texture2D(a,ua).rgb,1.0);',
}
const FFMAP = { fade: 'fade', wipeleft: 'wipeleft', wiperight: 'wiperight', slideleft: 'slideleft' }
const run = (args) => new Promise((res, rej) => { const p = spawn('ffmpeg', args); const ch = []; p.stdout.on('data', (d) => ch.push(d)); let e = ''; p.stderr.on('data', (d) => (e += d)); p.on('close', (c) => (c === 0 ? res(Buffer.concat(ch)) : rej(new Error('ff ' + c + ' ' + e.slice(-300))))); p.on('error', rej) })
const raw = (png) => run(['-y', '-i', png, '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])

// ffmpeg reference at EXACTLY `progress` (frame-index selection, 100 fps grid).
const tmp = aPng.replace(/\.png$/, '')
await run(xfadeRefArgs({ aPng, bPng, type: FFMAP[TYPE], p: progress, out: `${tmp}.xf.png` }))
const ffMid = await raw(`${tmp}.xf.png`)

// GL: the same blend evaluated at the same progress.
const aB64 = (await readFile(aPng)).toString('base64')
const bB64 = (await readFile(bPng)).toString('base64')
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const glUrl = await page.evaluate(async ({ aB64, bB64, glBody, progress }) => {
  const load = (b) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + b })
  const A = await load(aB64), B = await load(bB64)
  const W = A.width, H = A.height
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const gl = cv.getContext('webgl', { preserveDrawingBuffer: true })
  const VERT = `attribute vec2 p; varying vec2 uv; void main(){ uv=vec2((p.x+1.0)*0.5,(1.0-p.y)*0.5); gl_Position=vec4(p,0.0,1.0);}`
  const FRAG = `precision highp float; varying vec2 uv; uniform sampler2D a,b; uniform float t;
    void main(){ ${glBody} }`
  const sh = (ty, s) => { const o = gl.createShader(ty); gl.shaderSource(o, s); gl.compileShader(o); return o }
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr); gl.useProgram(pr)
  const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const lp = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0)
  const tex = (img, unit) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img) }
  tex(A, 0); tex(B, 1)
  gl.uniform1i(gl.getUniformLocation(pr, 'a'), 0); gl.uniform1i(gl.getUniformLocation(pr, 'b'), 1); gl.uniform1f(gl.getUniformLocation(pr, 't'), progress)
  gl.viewport(0, 0, W, H); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  return cv.toDataURL('image/png')
}, { aB64, bB64, glBody: GL_BODY[TYPE], progress })
await browser.close()
await writeFile(`${tmp}.gl.png`, Buffer.from(glUrl.split(',')[1], 'base64'))
const glMid = await raw(`${tmp}.gl.png`)

const n = Math.min(ffMid.length, glMid.length); let sum = 0, max = 0
for (let i = 0; i < n; i++) { const d = Math.abs(ffMid[i] - glMid[i]); sum += d; if (d > max) max = d }
const mean = sum / n
console.log(`${TYPE} @ progress ${progress} (frame-exact reference)`)
console.log(`mean abs diff : ${mean.toFixed(2)}/255 (${(mean / 255 * 100).toFixed(2)}%)`)
console.log(`max abs diff  : ${max}/255`)
console.log(`GATE (<=5%)   : ${mean / 255 * 100 <= 5 ? 'PASS' : 'REVIEW'}`)
