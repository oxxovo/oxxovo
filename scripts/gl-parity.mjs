// GL preview <-> ffmpeg render color-grade PARITY harness (D gate).
// Renders a test image through (a) the WebGL color shader (headless chromium) and
// (b) the ffmpeg eq filter, then reports the mean abs pixel diff. The render is
// authoritative; the shader must match it within tolerance before effect controls
// (E) are exposed. Usage:
//   node scripts/gl-parity.mjs <test.png> <ff.png> [exposure] [contrast] [saturation]
// (exposure/contrast/saturation are SLIDER values; the ffmpeg ref must be graded
// with the matching eq params by the caller.)
//
// Shader below MUST stay identical to app/studio/compose/preview-gl.ts.
import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { FFMPEG } from './ffmpeg-bin.mjs'
import { chromium } from 'playwright-core'

const [testPng, ffPng, exSl = '10', coSl = '30', saSl = '-20'] = process.argv.slice(2)
const iv = (v) => Math.round(Number(v))
const U = { exposure: iv(exSl) / 200, contrast: 1 + iv(coSl) / 100, saturation: 1 + iv(saSl) / 100, tempK: 0, tint: 0, vignette: 0 }

const FRAG = `
precision highp float; varying vec2 v_uv; uniform sampler2D u_tex;
uniform float u_exposure,u_contrast,u_saturation,u_tempK,u_tint,u_vignette;
const vec3 LUMA=vec3(0.299,0.587,0.114);
void main(){ vec3 c=texture2D(u_tex,v_uv).rgb;
 c=(c-0.5)*u_contrast+0.5+u_exposure; float y=dot(c,LUMA); c=mix(vec3(y),c,u_saturation);
 float k=u_tempK/3000.0; c.r-=k*0.05; c.b+=k*0.05;
 c.g+=u_tint*(1.0-abs(2.0*dot(c,LUMA)-1.0));
 if(u_vignette>0.0){float d=distance(v_uv,vec2(0.5)); c*=1.0-u_vignette*smoothstep(0.35,0.75,d);}
 gl_FragColor=vec4(clamp(c,0.0,1.0),1.0);}`
const VERT = `attribute vec2 a_pos; varying vec2 v_uv;
void main(){ v_uv=vec2((a_pos.x+1.0)*0.5,(1.0-a_pos.y)*0.5); gl_Position=vec4(a_pos,0.0,1.0);}`

function ffToRaw(png) {
  return new Promise((res, rej) => {
    const p = spawn(FFMPEG, ['-y', '-i', png, '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
    const chunks = []; p.stdout.on('data', (d) => chunks.push(d))
    p.on('close', (c) => (c === 0 ? res(Buffer.concat(chunks)) : rej(new Error('ffmpeg raw ' + c))))
    p.on('error', rej)
  })
}

const testB64 = (await readFile(testPng)).toString('base64')
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const glDataUrl = await page.evaluate(async ({ testB64, VERT, FRAG, U }) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + testB64
  await img.decode()
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height
  const gl = cv.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true })
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o }
  const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(p); gl.useProgram(p)
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const a = gl.getAttribLocation(p, 'a_pos'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)
  const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
  for (const [k, v] of Object.entries(U)) gl.uniform1f(gl.getUniformLocation(p, 'u_' + k), v)
  gl.viewport(0, 0, cv.width, cv.height); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  return cv.toDataURL('image/png')
}, { testB64, VERT, FRAG, U })
await browser.close()

const glPng = testPng.replace(/\.png$/, '.gl.png')
await writeFile(glPng, Buffer.from(glDataUrl.split(',')[1], 'base64'))

const [ffRaw, glRaw] = await Promise.all([ffToRaw(ffPng), ffToRaw(glPng)])
const n = Math.min(ffRaw.length, glRaw.length)
let sum = 0, max = 0
for (let i = 0; i < n; i++) { const d = Math.abs(ffRaw[i] - glRaw[i]); sum += d; if (d > max) max = d }
const meanAbs = sum / n
console.log(`compared ${n} channel-bytes`)
console.log(`mean abs diff : ${meanAbs.toFixed(2)} / 255  (${(meanAbs / 255 * 100).toFixed(2)}%)`)
console.log(`max abs diff  : ${max} / 255`)
console.log(`VERDICT       : ${meanAbs < 6 ? 'PARITY OK (<6/255 avg)' : meanAbs < 12 ? 'CLOSE (tune)' : 'OFF (refine shader)'}`)
