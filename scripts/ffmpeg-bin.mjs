// Which ffmpeg the parity harnesses call, and how to say so in their output.
//
// ★Why this is not just `'ffmpeg'` inline (measured 2026-08-01): every parity constant
// in this repo -- the eq model, the dip alpha/beta pair, the nine transition curves,
// the LUT and glow gates -- was derived on ONE developer's ffmpeg. The deployed worker
// boots on a different one (Railway: 5.1.9-0+deb12u1; this machine: N-124279). A/B'd
// both across the effect filters: bit-identical on eq, lut3d, gblur+blend, noise
// (grain), tmix (motionBlur), vignette, unsharp, rgbashift, colortemperature,
// colorbalance and format=yuv420p -- and NOT identical on xfade, where 5.1 completes
// the transition one frame earlier, and `dissolve` differs on 6 of 25 frames because
// its random mask is version-dependent.
//
// So a harness result is only meaningful next to the binary that produced it. Set
// FFMPEG_BIN to re-measure any table under the version that actually ships:
//
//   FFMPEG_BIN=/path/to/ffmpeg-5.1.9 npm run test:parity:transition
//
// Full write-up: reports/ffmpeg_version_parity_2026-08-01.md
import { spawn } from 'node:child_process'

export const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg'

// Short version string of whichever binary FFMPEG points at, for the report header.
// Never throws: a missing binary reports MISSING and lets the caller fail on its own
// terms rather than dying inside a version banner.
export function ffmpegVersion() {
  return new Promise((res) => {
    const p = spawn(FFMPEG, ['-version'])
    let o = ''
    p.stdout.on('data', (d) => (o += d))
    p.on('close', () => res(o.split('\n')[0].replace(/^ffmpeg version /, '').split(' ')[0] || 'unknown'))
    p.on('error', () => res('MISSING'))
  })
}

// One line every harness prints, so no table is ever recorded without its source.
export async function ffmpegBanner() {
  const v = await ffmpegVersion()
  const how = process.env.FFMPEG_BIN ? `FFMPEG_BIN=${process.env.FFMPEG_BIN}` : 'from PATH'
  return `ffmpeg     : ${v}   (${how} -- the deployed worker prints its own at boot)`
}
