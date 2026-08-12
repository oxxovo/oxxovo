'use client'

// Live fit readout for the selected text layer: how much of the frame the text
// actually occupies, and -- when it does not fit -- what the participant can do
// about it.
//
// ★ SAME MEASUREMENT AS THE SERVER. Everything here comes from lib/text-metrics,
// which is also what createRender's hard gate calls. A percentage shown here is
// the percentage that is enforced, so a layer can never read 98% and then be
// rejected at submit.
//
// ★ IT NEVER MOVES ANYTHING. The suggestions are text. Silently re-positioning or
// re-sizing what a participant deliberately placed is its own class of bug, and
// the one place the component does constrain a value -- the size slider's upper
// bound -- constrains only the control being dragged.
//
// Own component so the editor's contact surface stays small; the Pro Editor epic
// reworks this panel later.

import type { TextLayer } from '@/lib/text-render'
import { textBlockMetrics, undrawableChars, fontsThatWouldFit } from '@/lib/text-metrics'

export type TextFitLabels = {
  width: string
  height: string
  ok: string
  tooWide: string
  tooTall: string
  fixSplit: string
  fixSmaller: string
  fixShorter: string
  fixFont: (names: string) => string
  fixUp: string
  fixFewerLines: string
  noSizeFits: string
  missingGlyph: (chars: string) => string
}

export function TextFitReadout({
  layer,
  canvas,
  fonts,
  atSizeFloor,
  labels,
}: {
  layer: TextLayer
  canvas: readonly [number, number]
  /** id -> display label, for naming a font that would fit */
  fonts: ReadonlyArray<{ id: string; label: string }>
  /** the size slider is already at MIN_SIZE_PCT -- "make it smaller" is not advice */
  atSizeFloor: boolean
  labels: TextFitLabels
}) {
  const [W, H] = canvas
  const m = textBlockMetrics(layer, W, H)
  const missing = undrawableChars(layer.font, layer.content)
  const wide = m.widthFrac > 1
  const tall = m.bottomFrac > 1

  const wPct = Math.round(m.widthFrac * 100)
  const hPct = Math.round(m.bottomFrac * 100)
  const tone = (over: boolean) => (over ? 'text-[#ff8888]' : 'text-white/35')

  const tips: string[] = []
  if (wide) {
    // Order is deliberate. Splitting a line keeps every word the participant
    // wrote; shortening does not. Shrinking sits between the two, and is dropped
    // entirely once the slider is already at the floor -- offering a control that
    // cannot move is worse than offering nothing.
    if (m.lines < 4) tips.push(labels.fixSplit)
    if (!atSizeFloor) tips.push(labels.fixSmaller)
    tips.push(labels.fixShorter)
    // ★ Measured, not assumed. Which font is narrowest flips between Korean and
    // Latin (Black Han Sans is the narrowest of the three for Hangul and the
    // widest for lowercase Latin), so the only honest suggestion is the one that
    // comes from measuring THIS text.
    const fit = fontsThatWouldFit(layer, W, H, fonts.map((f) => f.id))
    if (fit.length) tips.push(labels.fixFont(fit.map((id) => fonts.find((f) => f.id === id)?.label ?? id).join(', ')))
  }
  if (tall) {
    if (layer.yNorm > 0.02) tips.push(labels.fixUp)
    if (!atSizeFloor) tips.push(labels.fixSmaller)
    if (m.lines > 1) tips.push(labels.fixFewerLines)
  }

  return (
    <div className="space-y-1">
      <p className="flex items-center gap-2 text-[9px] leading-tight">
        <span className={tone(wide)}>{labels.width} <span className="tabular-nums">{wPct}%</span></span>
        <span className={tone(tall)}>{labels.height} <span className="tabular-nums">{hPct}%</span></span>
        {!wide && !tall && !missing.length && <span className="text-emerald-300/70">{labels.ok}</span>}
      </p>

      {missing.length > 0 && (
        <p className="rounded border border-amber-400/30 bg-amber-400/5 px-2 py-1 text-[9px] leading-relaxed text-amber-300/90">
          {labels.missingGlyph(missing.join(' '))}
        </p>
      )}

      {(wide || tall) && (
        <div className="rounded border border-[#ff8888]/30 bg-[#ff8888]/5 px-2 py-1">
          <p className="text-[9px] font-bold text-[#ff9999]">{wide ? labels.tooWide : labels.tooTall}</p>
          <ul className="mt-0.5 space-y-0.5">
            {tips.map((tip, i) => (
              <li key={i} className="text-[9px] leading-relaxed text-white/55">· {tip}</li>
            ))}
            {!tips.length && <li className="text-[9px] leading-relaxed text-white/55">· {labels.noSizeFits}</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
