import type { PublicScore } from '@/lib/watch'

// Public Triple-AI score for a finalist (main-round) video. Total + grade + the
// three public axes + each AI's critique. Integrity is never shown here.
export function ScorePanel({ score }: { score: PublicScore }) {
  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-white/[.02] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-wider text-[#b66cff]">Triple-AI score</h2>
        {score.grade && (
          <span className="rounded-full border border-[#8b22ff]/40 bg-[#8b22ff]/15 px-3 py-1 text-xs font-bold text-[#b66cff]">
            {score.grade}
          </span>
        )}
      </div>

      {score.verifiedScore != null && (
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-4xl font-black text-white">{Number(score.verifiedScore).toFixed(2)}</span>
          <span className="text-sm text-white/40">/ 100</span>
        </div>
      )}

      <div className="mt-4 space-y-2">
        <Axis label="Intent / clarity" value={score.intent} />
        <Axis label="Execution" value={score.execution} />
        <Axis label="Originality" value={score.originality} />
      </div>

      {/* ★2026-08-11: badge only, no number, PASS-only (no "not verified" state
          -- see PublicScore.integrityVerified). Kept even though it adds no
          numeric info: omitting integrity from this panel entirely would
          erase the 4th scoring dimension's existence, which TK's ruling did
          not ask for -- "verification happened" is shown, the number isn't. */}
      {score.integrityVerified && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
          <span aria-hidden>✓</span> Integrity Verified
        </div>
      )}

      {score.ai.length > 0 && (
        <div className="mt-5 space-y-4 border-t border-white/10 pt-4">
          {score.ai.map((a) => (
            <div key={a.name}>
              <p className="text-xs font-bold uppercase tracking-wider text-white/60">{a.name}</p>
              {a.summary && <p className="mt-1 text-sm text-white/75 leading-relaxed">{a.summary}</p>}
              {a.strengths.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {a.strengths.map((s, i) => (
                    <li key={i} className="text-xs text-emerald-300/80">+ {s}</li>
                  ))}
                </ul>
              )}
              {a.weaknesses.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {a.weaknesses.map((w, i) => (
                    <li key={i} className="text-xs text-white/45">- {w}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Axis({ label, value }: { label: string; value: number | null }) {
  const pct = value != null ? Math.max(0, Math.min(100, Number(value))) : 0
  return (
    <div>
      <div className="flex justify-between text-[11px] text-white/50">
        <span>{label}</span>
        <span>{value != null ? Number(value).toFixed(2) : '—'}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[#8b22ff]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
