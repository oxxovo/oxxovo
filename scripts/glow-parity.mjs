// Glow parity harness (D3): GL separable gaussian + screen-blend vs ffmpeg
// split->gblur->screen (B2c). Usage: node scripts/glow-parity.mjs <test.png> [glow]
// Spatial blur kernels differ between engines (ffmpeg gblur is an approximation),
// so the glow gate is looser (<=5%). Reports mean abs diff.
import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { FFMPEG } from './ffmpeg-bin.mjs'
import { chromium } from 'playwright-core'

const [testPng, glowSl = '50'] = process.argv.slice(2)
const g = Math.round(Number(glowSl))
const sigma = g / 8
const opacity = g / 100

function ffRaw(png, vf) {
  return new Promise((res, rej) => {
    const args = ['-y', '-i', png]; if (vf) args.push('-vf', vf)
    args.push('-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1')
    const p = spawn(FFMPEG, args); const ch = []
    p.stdout.on('data', (d) => ch.push(d)); p.on('close', (c) => (c === 0 ? res(Buffer.concat(ch)) : rej(new Error('ff ' + c)))); p.on('error', rej)
  })
}

const testB64 = (await readFile(testPng)).toString('base64')
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] })
const page = await browser.newPage()
const glDataUrl = await page.evaluate(async ({ testB64, sigma, opacity }) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + testB64; await img.decode()
  const W = img.width, H = img.height
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const gl = cv.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true })
  const VERT = `#version 300 es
  in vec2 a_pos; out vec2 v_uv;
  void main(){ v_uv=vec2((a_pos.x+1.0)*0.5,(a_pos.y+1.0)*0.5); gl_Position=vec4(a_pos,0.0,1.0);}`
  const BLUR = `#version 300 es
  precision highp float; in vec2 v_uv; out vec4 o; uniform sampler2D u; uniform vec2 u_dir; uniform float u_sigma; uniform vec2 u_texel;
  void main(){ float s=max(u_sigma,0.001); int r=int(min(ceil(3.0*s),60.0)); float wsum=0.0; vec3 acc=vec3(0.0);
    for(int i=-60;i<=60;i++){ if(i< -r||i>r) continue; float w=exp(-float(i*i)/(2.0*s*s)); acc+=texture(u, v_uv+u_dir*u_texel*float(i)).rgb*w; wsum+=w; }
    o=vec4(acc/wsum,1.0); }`
  const BLEND = `#version 300 es
  precision highp float; in vec2 v_uv; out vec4 o; uniform sampler2D u_base,u_blur; uniform float u_op;
  void main(){ vec3 b=texture(u_base,v_uv).rgb; vec3 g=texture(u_blur,v_uv).rgb;
    vec3 sc=1.0-(1.0-b)*(1.0-g); o=vec4(mix(b,sc,u_op),1.0); }`
  const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o}
  const prog=(vs,fs)=>{const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,vs));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p}
  const quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW)
  const bindQuad=(p)=>{const a=gl.getAttribLocation(p,'a_pos');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0)}
  const mkTex=(src)=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);if(src)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src);else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,null);return t}
  const mkFbo=(t)=>{const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);return f}
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); const base=mkTex(img); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
  const tA=mkTex(null), tB=mkTex(null); const fA=mkFbo(tA), fB=mkFbo(tB)
  const blurP=prog(VERT,BLUR), blendP=prog(VERT,BLEND)
  // H blur base->A
  gl.useProgram(blurP);bindQuad(blurP);gl.viewport(0,0,W,H)
  gl.bindFramebuffer(gl.FRAMEBUFFER,fA);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,base)
  gl.uniform1i(gl.getUniformLocation(blurP,'u'),0);gl.uniform2f(gl.getUniformLocation(blurP,'u_dir'),1,0);gl.uniform1f(gl.getUniformLocation(blurP,'u_sigma'),sigma);gl.uniform2f(gl.getUniformLocation(blurP,'u_texel'),1/W,1/H)
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4)
  // V blur A->B
  gl.bindFramebuffer(gl.FRAMEBUFFER,fB);gl.bindTexture(gl.TEXTURE_2D,tA);gl.uniform2f(gl.getUniformLocation(blurP,'u_dir'),0,1)
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4)
  // screen blend base + B -> canvas
  gl.useProgram(blendP);bindQuad(blendP);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,W,H)
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,base);gl.uniform1i(gl.getUniformLocation(blendP,'u_base'),0)
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,tB);gl.uniform1i(gl.getUniformLocation(blendP,'u_blur'),1)
  gl.uniform1f(gl.getUniformLocation(blendP,'u_op'),opacity)
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4)
  return cv.toDataURL('image/png')
}, { testB64, sigma, opacity })
await browser.close()

const glPng = testPng.replace(/\.png$/, '.glow.gl.png')
await writeFile(glPng, Buffer.from(glDataUrl.split(',')[1], 'base64'))
const ffVf = `split[a][b];[b]gblur=sigma=${sigma.toFixed(3)}[c];[a][c]blend=all_mode=screen:all_opacity=${opacity.toFixed(3)},format=rgb24`
const [ff, glp] = await Promise.all([ffRaw(testPng, ffVf), ffRaw(glPng)])
const n = Math.min(ff.length, glp.length); let sum = 0, max = 0
for (let i = 0; i < n; i++) { const d = Math.abs(ff[i] - glp[i]); sum += d; if (d > max) max = d }
const mean = sum / n
console.log(`glow g=${g} sigma=${sigma} opacity=${opacity}`)
console.log(`mean abs diff : ${mean.toFixed(2)}/255 (${(mean / 255 * 100).toFixed(2)}%)`)
console.log(`max abs diff  : ${max}/255`)
console.log(`GATE (<=5%)   : ${mean / 255 * 100 <= 5 ? 'PASS' : 'REVIEW'}`)
