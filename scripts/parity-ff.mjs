// Shared ffmpeg-reference helpers for the parity harnesses.
//
// ★WHY THIS FILE EXISTS. A parity harness compares one GL frame at progress p
// against ffmpeg's xfade output at the same p. Picking that reference frame with a
// SECONDS SEEK is wrong: with the default 25 fps and duration=1/offset=1 there is
// no output frame at t=1.5, so `-ss 1.5` lands on t=1.52 -- progress 0.52, not
// 0.50. The GL side is then evaluated at a different progress than the reference,
// and the harness reports a mismatch the engine does not have.
//
// The size of that lie depends on the transition: a global-shift transition
// (slide*) moves the whole frame by (p_err * W) pixels, so 0.02 of progress reads
// as ~7-9% mean error, while fade/wipe hide the same error at 0.4-1%. That is how
// "slide is structurally broken" was concluded from a harness bug. Measured
// 2026-07-29 on identical shaders + identical ffmpeg build:
//   slideleft  7.29% (-ss 1.5)  ->  0.00%, max 0 (frame-exact)  <- byte identical
//   fade       1.04%            ->  0.16%
//   wipeleft   0.93%            ->  0.08%
//
// So: ALWAYS select the reference by FRAME INDEX. Calibrated at 25/50/100 fps for
// p = 0/.25/.5/.75/1 (boundary of xfade=wipeleft read back from the pixels):
//   progress(n) == (n - fps*offset) / (fps*duration)
// Residuals were <= 1 pixel of boundary-measurement granularity, i.e. exact.

// 0.01 progress granularity for a 1s transition -- every p we test lands on a
// frame, so no harness ever needs to round.
export const XFADE_FPS = 100

// Frame index of progress p in an xfade output. Throws instead of rounding: a
// non-integer index means the chosen fps cannot express this p, which is exactly
// the bug this module exists to prevent.
export function xfadeFrameIndex(p, { fps = XFADE_FPS, offset = 1, duration = 1 } = {}) {
  const n = fps * (offset + p * duration)
  if (Math.abs(n - Math.round(n)) > 1e-9) {
    throw new Error(
      `xfadeFrameIndex: progress ${p} is not on a frame at ${fps}fps ` +
        `(offset=${offset}, duration=${duration}) -> n=${n}. Raise fps.`,
    )
  }
  return Math.round(n)
}

// ffmpeg args that write the xfade output frame at EXACTLY progress p to `out`.
// Two still PNGs in, one PNG out. `type` is an ffmpeg xfade transition name.
export function xfadeRefArgs({ aPng, bPng, type, p, out, fps = XFADE_FPS, offset = 1, duration = 1 }) {
  const n = xfadeFrameIndex(p, { fps, offset, duration })
  // Just past the transition: at 100 fps a 1s overhang is 100 wasted encoded
  // frames per measurement, and the harnesses take hundreds of measurements.
  const hold = offset + duration + 0.1
  return [
    '-y',
    '-loop', '1', '-t', String(hold), '-r', String(fps), '-i', aPng,
    '-loop', '1', '-t', String(hold), '-r', String(fps), '-i', bPng,
    '-filter_complex',
    `[0:v][1:v]xfade=transition=${type}:duration=${duration}:offset=${offset},` +
      `format=rgb24,select='eq(n\\,${n})'[v]`,
    '-map', '[v]',
    '-vsync', '0', '-frames:v', '1',
    out,
  ]
}

// Same idea for a reference built from two real CLIPS (not stills): normalise both
// to `fps` inside the graph so the frame index is meaningful, then select by index.
// `pre` is per-input filter chain (e.g. 'scale=256:256'), applied before fps.
export function xfadeClipRefArgs({ aArgs, bArgs, type, p, out, pre = '', fps = XFADE_FPS, offset = 1, duration = 1 }) {
  const n = xfadeFrameIndex(p, { fps, offset, duration })
  const chain = (label) => `${pre ? pre + ',' : ''}fps=${fps}[${label}]`
  return [
    '-y',
    ...aArgs,
    ...bArgs,
    '-filter_complex',
    `[0:v]${chain('pa')};[1:v]${chain('pb')};` +
      `[pa][pb]xfade=transition=${type}:duration=${duration}:offset=${offset},` +
      `format=rgb24,select='eq(n\\,${n})'[v]`,
    '-map', '[v]',
    '-vsync', '0', '-frames:v', '1',
    out,
  ]
}
