// LUT parity harness (D2): GL 2D-tiled trilinear .cube sampling vs ffmpeg lut3d.
// Usage: node scripts/lut-parity.mjs <test.png> <cube> [ffmpeg_lut_path]
// The GL LUT shader here MUST match the one added to preview-gl.ts.
import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright-core'

const [testPng, cubePath] = process.argv.slice(2)

// --- parse .cube -> { size, rgb Float32Array [r fastest, then g, then b] } ---
function parseCube(text) {
  let size = 0
  const data = []
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#') || t.startsWith('TITLE') || t.startsWith('DOMAIN')) continue
    if (t.startsWith('LUT_3D_SIZE')) { size = parseInt(t.split(/\s+/)[1], 10); continue }
    const p = t.split(/\s+/).map(Number)
    if (p.length === 3 && p.every((n) => Number.isFinite(n))) data.push(p[0], p[1], p[2])
  }
  return { size, rgb: Float32Array.from(data) }
}

// Lay the size^3 LUT into a 2D strip: width = size*size (size blue-slices side by
// side), height = size. Pixel (b*size + r, g) = LUT[r,g,b]. RGBA8.
function tile(lut) {
  const N = lut.size
  const W = N * N, H = N
  const px = new Uint8ClampedArray(W * H * 4)
  for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) {
    const src = (b * N * N + g * N + r) * 3
    const x = b * N + r, y = g
    const dst = (y * W + x) * 4
    px[dst] = lut.rgb[src] * 255; px[dst + 1] = lut.rgb[src + 1] * 255; px[dst + 2] = lut.rgb[src + 2] * 255; px[dst + 3] = 255
  }
  return { W, H, px: Array.from(px) }
}

const FRAG = `
precision highp float; varying vec2 v_uv;
uniform sampler2D u_tex, u_lut; uniform float u_N;
vec3 lutSample(vec3 c){
  float N=u_N; c=clamp(c,0.0,1.0);
  float bF=c.b*(N-1.0); float b0=floor(bF); float b1=min(b0+1.0,N-1.0); float f=bF-b0;
  float rx=c.r*(N-1.0)+0.5; float gy=c.g*(N-1.0)+0.5;   // +0.5 texel center within tile
  vec2 t0=vec2((b0*N+rx)/(N*N),gy/N);
  vec2 t1=vec2((b1*N+rx)/(N*N),gy/N);
  return mix(texture2D(u_lut,t0).rgb, texture2D(u_lut,t1).rgb, f);
}
void main(){ vec3 c=texture2D(u_tex,v_uv).rgb; gl_FragColor=vec4(lutSample(c),1.0); }`
const VERT = `attribute vec2 a_pos; varying vec2 v_uv;
void main(){ v_uv=vec2((a_pos.x+1.0)*0.5,(1.0-a_pos.y)*0.5); gl_Position=vec4(a_pos,0.0,1.0);}`

function ffRaw(png, vf) {
  return new Promise((res, rej) => {
    const args = ['-y', '-i', png]; if (vf) args.push('-vf', vf)
    args.push('-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1')
    const p = spawn('ffmpeg', args); const ch = []
    p.stdout.on('data', (d) => ch.push(d)); p.on('close', (c) => (c === 0 ? res(Buffer.concat(ch)) : rej(new Error('ff ' + c)))); p.on('error', rej)
  })
}

const lut = parseCube(await readFile(cubePath, 'utf8'))
const tiled = tile(lut)
const testB64 = (await readFile(testPng)).toString('base64')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const glDataUrl = await page.evaluate(async ({ testB64, VERT, FRAG, tiled, N }) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + testB64; await img.decode()
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height
  const gl = cv.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true })
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o }
  const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(p); gl.useProgram(p)
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const a = gl.getAttribLocation(p, 'a_pos'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)
  const mkTex = (unit) => { const tx = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tx); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); return tx }
  mkTex(0); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
  mkTex(1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tiled.W, tiled.H, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(tiled.px))
  gl.uniform1i(gl.getUniformLocation(p, 'u_tex'), 0); gl.uniform1i(gl.getUniformLocation(p, 'u_lut'), 1); gl.uniform1f(gl.getUniformLocation(p, 'u_N'), N)
  gl.viewport(0, 0, cv.width, cv.height); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  return cv.toDataURL('image/png')
}, { testB64, VERT, FRAG, tiled, N: lut.size })
await browser.close()

const glPng = testPng.replace(/\.png$/, '.lut.gl.png')
await writeFile(glPng, Buffer.from(glDataUrl.split(',')[1], 'base64'))

const [ff, glp] = await Promise.all([ffRaw(testPng, `lut3d=file='${cubePath.replace(/\\/g, '/').replace(/:/g, '\\:')}',format=rgb24`), ffRaw(glPng)])
const n = Math.min(ff.length, glp.length); let sum = 0, max = 0
for (let i = 0; i < n; i++) { const d = Math.abs(ff[i] - glp[i]); sum += d; if (d > max) max = d }
const mean = sum / n
console.log(`LUT ${cubePath.split(/[\\/]/).pop()} size=${lut.size}`)
console.log(`mean abs diff : ${mean.toFixed(2)}/255 (${(mean / 255 * 100).toFixed(2)}%)`)
console.log(`max abs diff  : ${max}/255`)
console.log(`GATE (<=3%)   : ${mean / 255 * 100 <= 3 ? 'PASS' : 'REVIEW'}`)
