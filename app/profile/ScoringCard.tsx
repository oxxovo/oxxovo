'use client'

import { useEffect, useState } from 'react'
import { useAdminLang } from '@/lib/admin-i18n'
import { loadMyScores, type MyRoundScore } from './actions'

// Owner-only score card. A participant sees their OWN Triple-AI score + critique
// for each round (prelim + main). Prelim scores are never public -- this is the
// only place they appear. Integrity is never shown (anti-gaming).
const COPY = {
  ko: {
    title: '내 점수',
    empty: '채점이 완료되면 여기에서 Triple-AI 점수와 심사평을 확인할 수 있습니다.',
    prelim: '예선',
    main: '본선',
    note: '점수와 심사평은 본인에게만 표시됩니다. (예선 점수는 공개되지 않습니다.)',
    intent: '의도/명확성',
    execution: '완성도',
    originality: '독창성',
  },
  en: {
    title: 'My scores',
    empty: 'Your Triple-AI score and feedback will appear here once judging completes.',
    prelim: 'Preliminary',
    main: 'Main Round',
    note: 'Scores and feedback are visible only to you. (Preliminary scores are never public.)',
    intent: 'Intent / clarity',
    execution: 'Execution',
    originality: 'Originality',
  },
}

export function ScoringCard() {
  const lang = useAdminLang()
  const c = COPY[lang === 'ko' ? 'ko' : 'en']
  const [scores, setScores] = useState<MyRoundScore[] | null>(null)

  useEffect(() => {
    let cancelled = false
    loadMyScores().then((s) => {
      if (!cancelled) setScores(s)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Stable order: prelim then main.
  const ordered = (scores ?? [])
    .slice()
    .sort((a, b) => (a.round === 'application' ? -1 : 1) - (b.round === 'application' ? -1 : 1))

  return (
    <section className="mt-6 border border-white/10 bg-white/[.02] rounded-lg p-6">
      <h2 className="text-xs uppercase tracking-[0.2em] font-bold mb-4 text-[#b66cff]">{c.title}</h2>

      {scores === null ? (
        <p className="text-xs text-white/40">…</p>
      ) : ordered.length === 0 ? (
        <p className="text-xs text-white/40">{c.empty}</p>
      ) : (
        <div className="space-y-6">
          {ordered.map((s) => (
            <RoundScore key={s.round} s={s} c={c} />
          ))}
          <p className="text-[10px] text-white/30">{c.note}</p>
        </div>
      )}
    </section>
  )
}

function RoundScore({ s, c }: { s: MyRoundScore; c: (typeof COPY)['en'] }) {
  return (
    <div className="border-t border-white/5 pt-4 first:border-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-white">{s.round === 'main' ? c.main : c.prelim}</span>
        <div className="flex items-center gap-2">
          {s.grade && (
            <span className="rounded-full border border-[#8b22ff]/40 bg-[#8b22ff]/15 px-2.5 py-0.5 text-[10px] font-bold text-[#b66cff]">
              {s.grade}
            </span>
          )}
          {s.verifiedScore != null && (
            <span className="text-lg font-black text-white">{Number(s.verifiedScore).toFixed(1)}</span>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <Axis label={c.intent} value={s.intent} />
        <Axis label={c.execution} value={s.execution} />
        <Axis label={c.originality} value={s.originality} />
      </div>

      {s.ai.length > 0 && (
        <div className="mt-4 space-y-3">
          {s.ai.map((a) => (
            <div key={a.name}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">{a.name}</p>
              {a.summary && <p className="mt-1 text-sm text-white/75 leading-relaxed">{a.summary}</p>}
              {a.strengths.map((x, i) => (
                <p key={`s${i}`} className="mt-0.5 text-xs text-emerald-300/80">+ {x}</p>
              ))}
              {a.weaknesses.map((x, i) => (
                <p key={`w${i}`} className="mt-0.5 text-xs text-white/45">- {x}</p>
              ))}
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
        <span>{value != null ? Number(value).toFixed(1) : '—'}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[#8b22ff]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
