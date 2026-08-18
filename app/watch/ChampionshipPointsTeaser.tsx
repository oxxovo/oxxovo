// Championship Points ranking teaser -- PREVIEW ONLY, not approved for
// production (HQ 2026-08-18 design review, row count + copy still open).
// Sits directly below the Hero, full width, above the entry grid. Numbered
// rows with a deliberately BLANK name slot -- not a loading skeleton, not
// "Coming Soon". No real ranking data exists (calculation/snapshot/tie-break/
// eligibility are explicitly out of scope until March 2027) -- this renders
// nothing but the row count.
//
// rowCount is a plain prop here (a query param upstream, for THIS preview
// only, so the two candidate counts -- 5 and 10 -- can both be viewed). The
// approved version reads it from a config value; this file does not decide
// what that config key is.
//
// pulseText is HQ's given placeholder ("지금, 당신의 순위는?") -- not final
// copy. 제니3 owns the real wording.

const PULSE_TEXT_PLACEHOLDER = '지금, 당신의 순위는?'

export function ChampionshipPointsTeaser({ rowCount }: { rowCount: number }) {
  const rows = Array.from({ length: rowCount }, (_, i) => i + 1)
  return (
    <section className="mb-10">
      <div className="rounded-2xl border border-[#8b22ff]/28 bg-[#110d1c] px-8 py-8 shadow-[0_0_60px_rgba(139,34,255,.10)] sm:px-9">
        <p className="championship-points-pulse mb-7 text-center text-[13px] font-bold uppercase tracking-[0.14em] text-[#c9a9ff]">
          {PULSE_TEXT_PLACEHOLDER}
        </p>
        <div>
          {rows.map((n) => (
            <div key={n}>
              <div className="flex items-center gap-5 py-3.5">
                <span
                  className="w-9 shrink-0 text-right text-xl font-black"
                  style={{ color: rankNumberColor(n, rowCount) }}
                >
                  {n}
                </span>
                <div className="h-px flex-1 bg-[#8b22ff]/16" />
              </div>
              {n < rowCount && <div className="mx-1 h-px bg-[#211735]" />}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Fades from near-white at #1 toward the accent's darker end, so the ranking
// still reads top-to-bottom even with every name slot blank.
function rankNumberColor(n: number, total: number): string {
  const t = total > 1 ? (n - 1) / (total - 1) : 0
  const from = [244, 240, 255] // #f4f0ff
  const to = [81, 56, 167] // #5138a7
  const mix = from.map((c, i) => Math.round(c + (to[i] - c) * t))
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`
}
