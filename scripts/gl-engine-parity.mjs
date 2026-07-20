// Engine re-verify (WebGL2): runs the ENGINE's actual shaders (lib/gl-effects.ts,
// the same source preview-gl.ts uses) headlessly and compares with ffmpeg, so a
// port can't drift from the harness parity. Cases: color, LUT, glow (multipass).
//   node scripts/gl-engine-parity.mjs <test.png>
import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
import { VERT, FRAG_COLOR_LUT, FRAG_BLUR, FRAG_SCREEN, colorUniforms, glowStages, parseCube, tileCube } from '../lib/gl-effects.ts'

const [testPng] = process.argv.slice(2)
const run = (args) => new Promise((res, rej) => { const p = spawn('ffmpeg', args); const ch = []; let e = ''; p.stdout.on('data', (d) => ch.push(d)); p.stderr.on('data', (d) => (e += d)); p.on('close', (c) => (c === 0 ? res(Buffer.concat(ch)) : rej(new Error('ff ' + c + ' ' + e.slice(-200))))); p.on('error', rej) })
const raw = (png, vf) => run(['-y', '-i', png, ...(vf ? ['-vf', vf] : []), '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
const diff = (a, b) => { const n = Math.min(a.length, b.length); let s = 0; for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]); return s / n / 255 * 100 }
const testB64 = (await readFile(testPng)).toString('base64')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

// Runs a WebGL2 pipeline in the page. `pipeline` describes passes with the shared
// gl-effects shaders. Returns a PNG data buffer.
async function glRun(spec) {
  const url = await page.evaluate(async ({ testB64, spec, VERT }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + testB64; await img.decode()
    const W = img.width, H = img.height
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H
    const gl = cv.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true })
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o }
    const prog = (fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); return p }
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const progs = {}; for (const k in spec.shaders) { const p = prog(spec.shaders[k]); const a = gl.getAttribLocation(p, 'a_pos'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0); progs[k] = p }
    const mkTex = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); for (const [k, v] of [['WRAP_S', 'CLAMP_TO_EDGE'], ['WRAP_T', 'CLAMP_TO_EDGE'], ['MIN_FILTER', 'LINEAR'], ['MAG_FILTER', 'LINEAR']]) gl.texParameteri(gl.TEXTURE_2D, gl['TEXTURE_' + k], gl[v]); return t }
    const src = mkTex(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    const lutTex = mkTex(); if (spec.lut) { gl.bindTexture(gl.TEXTURE_2D, lutTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, spec.lut.W, spec.lut.H, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(spec.lut.px)) }
    const fbos = []; for (let i = 0; i < 4; i++) { const t = mkTex(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); fbos.push({ fb, tex: t }) }
    const uf = (p, n, v) => gl.uniform1f(gl.getUniformLocation(p, n), v)
    const draw = () => gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    const to = (i) => { gl.bindFramebuffer(gl.FRAMEBUFFER, i === null ? null : fbos[i].fb); gl.viewport(0, 0, W, H) }
    // pass 1: color+LUT
    const cl = progs.cl; gl.useProgram(cl); gl.uniform1i(gl.getUniformLocation(cl, 'u_tex'), 0); gl.uniform1i(gl.getUniformLocation(cl, 'u_lut'), 1)
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, lutTex)
    for (const [k, v] of Object.entries(spec.U)) uf(cl, 'u_' + k, v)
    uf(cl, 'u_hasLut', spec.lut ? 1 : 0); uf(cl, 'u_N', spec.lut ? spec.lut.N : 2)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src)
    if (!spec.stages || !spec.stages.length) { to(null); draw(); return cv.toDataURL('image/png') }
    to(0); draw()
    let base = 0, bA = 1, bB = 2, out = 3
    for (const st of spec.stages) {
      const bl = progs.blur; gl.useProgram(bl); gl.uniform1i(gl.getUniformLocation(bl, 'u'), 0); uf(bl, 'u_sigma', st.sigma); gl.uniform2f(gl.getUniformLocation(bl, 'u_texel'), 1 / W, 1 / H)
      gl.uniform2f(gl.getUniformLocation(bl, 'u_dir'), 1, 0); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbos[base].tex); to(bA); draw()
      gl.uniform2f(gl.getUniformLocation(bl, 'u_dir'), 0, 1); gl.bindTexture(gl.TEXTURE_2D, fbos[bA].tex); to(bB); draw()
      const sc = progs.screen; gl.useProgram(sc); gl.uniform1i(gl.getUniformLocation(sc, 'u_base'), 0); gl.uniform1i(gl.getUniformLocation(sc, 'u_blur'), 1); uf(sc, 'u_op', st.opacity)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbos[base].tex); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fbos[bB].tex); to(out); draw()
      ;[base, out] = [out, base]
    }
    const cp = progs.copy; gl.useProgram(cp); gl.uniform1i(gl.getUniformLocation(cp, 'u'), 0); to(null); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbos[base].tex); draw()
    return cv.toDataURL('image/png')
  }, { testB64, spec, VERT })
  return Buffer.from(url.split(',')[1], 'base64')
}

const shadersCL = { cl: FRAG_COLOR_LUT }
const shadersGlow = { cl: FRAG_COLOR_LUT, blur: FRAG_BLUR, screen: FRAG_SCREEN, copy: '#version 300 es\nprecision highp float; in vec2 v_uv; out vec4 o; uniform sampler2D u; void main(){ o=texture(u,v_uv); }' }

// color
{
  const U = colorUniforms({ exposure: 10, contrast: 30, saturation: -20 })
  const p = testPng.replace(/\.png$/, '.eng.color.png'); await writeFile(p, await glRun({ shaders: shadersCL, U }))
  const d = diff(await raw(testPng, 'eq=brightness=0.0500:contrast=1.3000:saturation=0.8000,format=rgb24'), await raw(p))
  console.log(`ENGINE color : ${d.toFixed(2)}%  (harness 1.51%, gate <=2.5%)  ${d <= 2.5 ? 'PASS' : 'REVIEW'}`)
}
// LUT
{
  const cube = parseCube(await readFile('public/luts/teal_orange.cube', 'utf8')); const t = tileCube(cube)
  const p = testPng.replace(/\.png$/, '.eng.lut.png'); await writeFile(p, await glRun({ shaders: shadersCL, U: colorUniforms(), lut: { px: Array.from(t.px), W: t.W, H: t.H, N: cube.size } }))
  const d = diff(await raw(testPng, `lut3d=file='public/luts/teal_orange.cube',format=rgb24`), await raw(p))
  console.log(`ENGINE LUT   : ${d.toFixed(2)}%  (harness 0.18%, gate <=3%)   ${d <= 3 ? 'PASS' : 'REVIEW'}`)
}
// glow (g=50 -> sigma 6.25, op 0.5)
{
  const stages = glowStages({ glow: 50 })
  const p = testPng.replace(/\.png$/, '.eng.glow.png'); await writeFile(p, await glRun({ shaders: shadersGlow, U: colorUniforms(), stages }))
  const d = diff(await raw(testPng, 'split[a][b];[b]gblur=sigma=6.250[c];[a][c]blend=all_mode=screen:all_opacity=0.500,format=rgb24'), await raw(p))
  console.log(`ENGINE glow  : ${d.toFixed(2)}%  (harness 0.11-0.23%, gate <=5%)  ${d <= 5 ? 'PASS' : 'REVIEW'}`)
}
await browser.close()
