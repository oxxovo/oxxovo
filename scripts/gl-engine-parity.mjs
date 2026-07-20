// Engine re-verify: runs the ENGINE's actual shaders (imported from
// lib/gl-effects.ts, the same source preview-gl.ts uses) headlessly and compares
// with ffmpeg -- proving the port didn't drift from the harness parity.
//   node scripts/gl-engine-parity.mjs <test.png>
import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
import { VERT, FRAG_COLOR_LUT, colorUniforms, parseCube, tileCube } from '../lib/gl-effects.ts'

const [testPng] = process.argv.slice(2)
const run = (args) => new Promise((res, rej) => { const p = spawn('ffmpeg', args); const ch = []; let e = ''; p.stdout.on('data', (d) => ch.push(d)); p.stderr.on('data', (d) => (e += d)); p.on('close', (c) => (c === 0 ? res(Buffer.concat(ch)) : rej(new Error('ff ' + c + ' ' + e.slice(-200))))); p.on('error', rej) })
const raw = (png, vf) => run(['-y', '-i', png, ...(vf ? ['-vf', vf] : []), '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
const diff = (a, b) => { const n = Math.min(a.length, b.length); let s = 0, m = 0; for (let i = 0; i < n; i++) { const d = Math.abs(a[i] - b[i]); s += d; if (d > m) m = d } return { mean: s / n, max: m } }

const testB64 = (await readFile(testPng)).toString('base64')

async function glRender(uniforms, lut /* {px,W,H,N} | null */) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const url = await page.evaluate(async ({ testB64, VERT, FRAG, U, lut }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + testB64; await img.decode()
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height
    const gl = cv.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true })
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o }
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(p); gl.useProgram(p)
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const a = gl.getAttribLocation(p, 'a_pos'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)
    const mk = (u) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, t); for (const [k, v] of [['WRAP_S', 'CLAMP_TO_EDGE'], ['WRAP_T', 'CLAMP_TO_EDGE'], ['MIN_FILTER', 'LINEAR'], ['MAG_FILTER', 'LINEAR']]) gl.texParameteri(gl.TEXTURE_2D, gl['TEXTURE_' + k], gl[v]); return t }
    mk(0); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    mk(1); if (lut) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, lut.W, lut.H, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(lut.px))
    gl.uniform1i(gl.getUniformLocation(p, 'u_tex'), 0); gl.uniform1i(gl.getUniformLocation(p, 'u_lut'), 1)
    for (const [k, v] of Object.entries(U)) gl.uniform1f(gl.getUniformLocation(p, 'u_' + k), v)
    gl.uniform1f(gl.getUniformLocation(p, 'u_hasLut'), lut ? 1 : 0); gl.uniform1f(gl.getUniformLocation(p, 'u_N'), lut ? lut.N : 2)
    gl.viewport(0, 0, cv.width, cv.height); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    return cv.toDataURL('image/png')
  }, { testB64, VERT, FRAG: FRAG_COLOR_LUT, U: uniforms, lut })
  await browser.close()
  return Buffer.from(url.split(',')[1], 'base64')
}

// --- COLOR-only (exposure 10 / contrast 30 / saturation -20) ---
{
  const U = colorUniforms({ exposure: 10, contrast: 30, saturation: -20 })
  const glPng = testPng.replace(/\.png$/, '.eng.color.png'); await writeFile(glPng, await glRender(U, null))
  const d = diff(await raw(testPng, 'eq=brightness=0.0500:contrast=1.3000:saturation=0.8000,format=rgb24'), await raw(glPng))
  console.log(`ENGINE color : ${(d.mean / 255 * 100).toFixed(2)}%  (harness 1.51%, gate <=2.5%)  ${d.mean / 255 * 100 <= 2.5 ? 'PASS' : 'REVIEW'}`)
}
// --- LUT-only (teal-orange, color neutral) ---
{
  const cube = parseCube(await readFile('public/luts/teal_orange.cube', 'utf8'))
  const t = tileCube(cube); const lut = { px: Array.from(t.px), W: t.W, H: t.H, N: cube.size }
  const U = colorUniforms(undefined, undefined) // neutral
  const glPng = testPng.replace(/\.png$/, '.eng.lut.png'); await writeFile(glPng, await glRender(U, lut))
  const cubePath = 'public/luts/teal_orange.cube'
  const d = diff(await raw(testPng, `lut3d=file='${cubePath}',format=rgb24`), await raw(glPng))
  console.log(`ENGINE LUT   : ${(d.mean / 255 * 100).toFixed(2)}%  (harness 0.18%, gate <=3%)   ${d.mean / 255 * 100 <= 3 ? 'PASS' : 'REVIEW'}`)
}
