// Client-safe effect param model (shared by the GL preview engine [D] and the
// effect UI [E]). cryptobind.ts defines the SAME shape server-side but imports
// 'server-only', so the client can't reuse it -- this is the client mirror.
//
// ★ Canonical contract: the RENDER (oxxovo-studio ffmpeg, B1) is authoritative;
// the GL preview must MATCH it, never the reverse. Param ranges + the neutral
// default (0) must line up with effectVideoFilters() in the worker's render.ts.
// Adding a param = append to EffectParams + EFFECT_SPECS AND to cryptobind's
// EFFECT_KEYS (in both repos) in the same order.

export type EffectParams = {
  exposure?: number
  contrast?: number
  saturation?: number
  temperature?: number
  tint?: number
  lut?: string
  lutIntensity?: number
  grain?: number
  vignette?: number
  glow?: number
  motionBlur?: number
  sharpen?: number
  chromatic?: number
}

export type EffectSpec = {
  key: keyof EffectParams
  label: string
  min: number
  max: number
  // How well the GL preview can match the ffmpeg render:
  //   exact       -- shader reproduces the filter closely (color math, LUT, vignette)
  //   approximate -- stochastic/temporal; preview is indicative only (grain, motion blur)
  parity: 'exact' | 'approximate'
}

// Slider specs for the UI (E). Order here is display order; the SIGNATURE order
// is EFFECT_KEYS in cryptobind (kept in lockstep).
export const EFFECT_SPECS: readonly EffectSpec[] = [
  { key: 'exposure', label: 'Exposure', min: -100, max: 100, parity: 'exact' },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100, parity: 'exact' },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100, parity: 'exact' },
  { key: 'temperature', label: 'Temperature', min: -100, max: 100, parity: 'exact' },
  { key: 'tint', label: 'Tint', min: -100, max: 100, parity: 'exact' },
  { key: 'lutIntensity', label: 'LUT intensity', min: 0, max: 100, parity: 'exact' },
  { key: 'vignette', label: 'Vignette', min: 0, max: 100, parity: 'exact' },
  { key: 'glow', label: 'Glow', min: 0, max: 100, parity: 'exact' },
  { key: 'sharpen', label: 'Sharpen', min: 0, max: 100, parity: 'exact' },
  { key: 'chromatic', label: 'Chromatic', min: 0, max: 100, parity: 'exact' },
  { key: 'grain', label: 'Grain', min: 0, max: 100, parity: 'approximate' },
  { key: 'motionBlur', label: 'Motion blur', min: 0, max: 100, parity: 'approximate' },
]

// The effects E EXPOSES (parity-passed + engine-previewable). Order = UI order.
// Excludes: motionBlur (see the note on its gap below).
//
// ★sharpen added 2026-08-10. The gate this file's own comment used to point
// at (scripts/gl-engine-parity.mjs's sharpen CASE) said not to read a PASS
// here as licence to expose it, for two reasons that are both closed now:
// the kernel match (finished 08-08, binomial-5 confirmed against a fitted
// candidate set) and the gate SHAPE for low-magnitude effects (제니2,
// 08-08's signal-relative-error bands, replacing the absolute threshold that
// comment was written against). Under that gate sharpen reads PASS on
// mandel/testsrc (r=0.256/0.209, both < the 0.5 band) and UNMEASURABLE on
// smooth/bars (effect magnitude at/under the 1-LSB floor, not a fail) --
// 0 REVIEW, 0 FAIL. Preview-side wiring landed the same day (targetIdx fix +
// option (1) restructure, preview-gl.ts): color+LUT -> sharpen -> chromatic
// -> grain -> vignette -> glow, worker order.
//
// ★chromatic added the same day. Cheaper than sharpen: rgbashift is a plain
// per-channel pixel shift (direction measured with a known red-channel edge,
// not assumed), and it reads PASS at r=0.000 on all four contents (byte-
// identical) -- 0 UNMEASURABLE even, since the shift is visible on every
// content this harness runs.
//
// ★★lutIntensity added 2026-08-10 by TK executive decision, NOT because the
// gate passed -- it has not. scripts/gl-engine-parity.mjs's lutIntensity row
// still reads REVIEW (r=0.44-0.83 on 3/4 contents, PASS only on bars) after a
// real formula bug (ffmpeg's blend=all_mode=normal:all_opacity weights the
// FIRST/bottom input, not the second -- found and fixed the same day) closed
// most, not all, of the gap. TK's reasoning (제니2, relayed): the instrument
// itself cannot resolve this band -- three separate findings the same day
// (no single FLOOR*k cutoff exists near the floor; two magnitude-identical
// exposure samples read r 2x apart; the residual shrinks as the effect grows,
// which is the signature of instrument noise, not a wrong formula) -- and
// where the gate can't give a clean answer, the effect is ALSO too small for
// a participant to see. This is the SAME reasoning sharpen's UNMEASURABLE
// rows already rest on, made explicit and applied on purpose rather than
// arrived at by construction. ★THE GATE ITSELF WAS NOT CHANGED -- FLOOR_PCT
// and the 0.5/1.0 bands are exactly what they were; this is a business call
// to ship inside the gate's own acknowledged blind spot, recorded here so
// nobody reads "exposed" as "passed." See reports/lane_c_floor_derivation_2026-08-10.md.
// ★motionBlur added 2026-08-11. Was blocked on a frame-history buffer this
// engine didn't have (tmix averages several video FRAMES, not one) -- closed
// by a two-step process: the 2026-08-10 spike (reports/
// lane_c_item4_g_motionblur_spike_2026-08-10.md) found video.
// requestVideoFrameCallback() eliminates the rAF-over-tick duplicate-capture
// problem structurally (measured 2.47x on a 24fps clip), then a video-based
// parity harness (scripts/gl-motionblur-parity.mjs, run against the worker's
// REAL tmix output, not a hand-written copy) measured the actual
// approximation this engine makes -- averaging RAW pre-effect frames, vs the
// worker's mid-chain average of already-graded frames -- and it reads PASS:
// r=0.088 (motionBlur=40, N=3) and r=0.051 (motionBlur=100, N=6), both well
// inside the r<0.5 band, on a moving-content clip with the decode pipeline
// itself verified clean first (browser vs ffmpeg decode of the same lossless
// file: 0.118%, at the 1-LSB floor). Declared 'approximate' in EFFECT_SPECS
// above stays -- PASS on one content set is not the same claim as sharpen/
// chromatic's byte-exact match, and the mid-chain-vs-pre-chain averaging
// order is a real, documented difference from the worker, just one this
// measurement found small enough to ship.
export const EXPOSED_SLIDER_KEYS: readonly (keyof EffectParams)[] = [
  'exposure', 'contrast', 'saturation', 'temperature', 'tint', 'vignette', 'glow', 'sharpen', 'chromatic', 'grain', 'lutIntensity', 'motionBlur',
]
export const EXPOSED_SLIDERS: readonly EffectSpec[] = EFFECT_SPECS.filter((s) => EXPOSED_SLIDER_KEYS.includes(s.key))

// The transitions the editor EXPOSES. A transition may only appear here once the
// preview reproduces the render for it -- the gate is scripts/gl-engine-transition
// (4 content pairs x p=0.25/0.5/0.75, worst case, exit 1 on failure), and each id
// must also exist in TRANSITION_TYPE (lib/gl-effects) or the preview cannot draw it.
// Worst-case parity as of 2026-07-30: slide-left 0.00% (byte-identical), everything
// else <= 0.30%.
// NOT exposed, on purpose: dissolve -- ffmpeg's field comes out of float32 sinf()
// whose fract() amplifies the last bits, so the pattern depends on the ffmpeg build's
// libm and cannot be reproduced in a shader (or across GPUs). Opening it requires a
// render-side field we define, same class as grain/tmix.
export const EXPOSED_TRANSITIONS: readonly { id: string; label: string }[] = [
  { id: 'crossfade', label: 'Crossfade' },
  { id: 'wipe-left', label: 'Wipe left' },
  { id: 'wipe-right', label: 'Wipe right' },
  { id: 'wipe-up', label: 'Wipe up' },
  { id: 'wipe-down', label: 'Wipe down' },
  { id: 'slide-left', label: 'Slide left' },
  { id: 'dip-to-black', label: 'Dip to black' },
  { id: 'dip-to-white', label: 'Dip to white' },
  { id: 'circle', label: 'Circle open' },
]

// Available in-platform LUTs (must match oxxovo-studio assets/luts + LUT_FILES).
export const LUT_OPTIONS: readonly { id: string; label: string }[] = [
  { id: '', label: 'None' },
  { id: 'teal-orange', label: 'Teal / Orange' },
  { id: 'warm-film', label: 'Warm Film' },
  { id: 'cool-cinema', label: 'Cool Cinema' },
  { id: 'noir', label: 'Noir' },
  { id: 'vibrant', label: 'Vibrant' },
]

// True if the EDL carries any non-neutral effect (drives the "approximate" note
// when the raw fallback preview is showing a composition that HAS effects).
export function hasAnyEffect(e?: EffectParams): boolean {
  if (!e) return false
  for (const k of Object.keys(e) as (keyof EffectParams)[]) {
    const v = e[k]
    if (typeof v === 'number' ? Math.round(v) !== 0 : !!v) return true
  }
  return false
}
