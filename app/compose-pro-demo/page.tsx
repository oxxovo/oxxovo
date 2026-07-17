'use client'

// PRO compose editor -- A-stage SHELL (jisu2, 2026-07-17). UNGATED demo, outside
// /studio, no DB/auth. Proves the DaVinci-style 3-pane layout (media pool | preview
// | single-track timeline) + the mobile vertical fallback, at 50-100 clip density.
// PURE FRONT-END LAYOUT ONLY -- no editor logic yet (sequence/trim/cut ops, render,
// crypto, worker, Watch are all untouched). Later phases move the real ComposeEditor
// sections into these panes. Genesis Rule preserved: ONE video lane, no track layers.
// Tone matches /studio + ComposeEditor (dark #030305 + purple #8b22ff).

import { useMemo, useState } from 'react'
import { useAdminLang, setAdminLang } from '@/lib/admin-i18n'

const T = {
  ko: {
    shell: 'PRO 편집기 · A단계 셸',
    shell_note: '레이아웃 프로토타입 — 실제 편집 배선은 다음 단계. 클립·미리보기·타임라인은 자리표시입니다.',
    pool: '미디어 풀',
    pool_sub: '내 클립',
    search: '클립 검색…',
    all: '전체', practice: '연습장', comp: '경기',
    preview: '미리보기',
    play: '▶ 재생', stop: '■ 정지',
    total: '총 길이',
    timeline: '타임라인',
    single_track: '단일 트랙 · 순서 · 트림 · 컷만 (합성/오버레이 없음)',
    tl_hint: '풀에서 클립을 끌어와 가로로 이어붙입니다. 층 겹치기는 없습니다 — Genesis Rule.',
    clip: '클립', sec: '초',
    drag_here: '여기로 클립을 끌어오세요',
  },
  en: {
    shell: 'PRO editor · A-stage shell',
    shell_note: 'Layout prototype — real editing wiring comes next. Clips, preview and timeline are placeholders.',
    pool: 'Media pool',
    pool_sub: 'My clips',
    search: 'Search clips…',
    all: 'All', practice: 'Sandbox', comp: 'Competition',
    preview: 'Preview',
    play: '▶ Play', stop: '■ Stop',
    total: 'Total',
    timeline: 'Timeline',
    single_track: 'Single track · sequence · trim · cut only (no compositing/overlay)',
    tl_hint: 'Drag clips from the pool and join them horizontally. No stacked layers — Genesis Rule.',
    clip: 'Clip', sec: 's',
    drag_here: 'Drag clips here',
  },
} as const

// Placeholder pool clips (density demo -- proves scroll/search at 50-100 scale).
const POOL = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  dur: 5 + (i % 4) * 2, // 5..11s
  draft: i % 5 === 0, // every 5th is a Sandbox/draft clip
}))
// Placeholder timeline segments (proportional widths).
const TL = [
  { id: 1, dur: 5 }, { id: 2, dur: 4 }, { id: 3, dur: 6 },
  { id: 4, dur: 5 }, { id: 5, dur: 3 }, { id: 6, dur: 7 },
]

export default function ComposeProDemo() {
  const lang = useAdminLang()
  const t = T[lang]
  const [tier, setTier] = useState<'all' | 'practice' | 'comp'>('all')
  const [q, setQ] = useState('')

  const pool = useMemo(
    () => POOL.filter((c) => (tier === 'all' ? true : tier === 'practice' ? c.draft : !c.draft)),
    [tier],
  )
  const tlTotal = TL.reduce((a, s) => a + s.dur, 0)

  const chip = (v: typeof tier, label: string) => (
    <button
      key={v}
      onClick={() => setTier(v)}
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
        tier === v ? 'bg-[#8b22ff]/20 text-[#d9b8ff] border border-[#8b22ff]/50' : 'border border-white/10 text-white/45 hover:text-white/70'
      }`}
    >
      {label}
    </button>
  )
  const paneHead = 'text-[11px] uppercase tracking-[0.2em] text-[#b66cff] font-bold'

  return (
    <main className="min-h-screen bg-[#030305] text-white">
      <header className="flex items-center justify-between border-b border-white/5 px-6 py-3.5">
        <div className="flex items-center gap-3">
          <span className="text-[20px] font-black tracking-wide text-[#8b22ff]">OXXOVO</span>
          <span className="rounded-full border border-[#8b22ff]/40 bg-[#8b22ff]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#b66cff]">
            {t.shell}
          </span>
        </div>
        <div className="flex gap-1">
          {(['ko', 'en'] as const).map((l) => (
            <button key={l} onClick={() => setAdminLang(l)} className={`px-2 py-1 text-[11px] transition ${lang === l ? 'text-[#b66cff] font-bold' : 'text-white/40 hover:text-white/70'}`}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <p className="border-b border-white/5 bg-[#8b22ff]/[.04] px-6 py-2 text-[11px] text-white/45">{t.shell_note}</p>

      {/* 3-PANE: mobile = vertical stack; lg = pool | preview (top row), timeline full-width bottom. */}
      <div className="flex flex-col gap-3 p-4 lg:grid lg:h-[calc(100vh-104px)] lg:grid-cols-[340px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_268px] lg:gap-3 lg:overflow-hidden">

        {/* PANE 1 — MEDIA POOL (left, full top-row height on desktop) */}
        <section className="flex flex-col rounded-xl border border-white/10 bg-[#08060f] lg:col-start-1 lg:row-start-1 lg:overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-white/8 px-3.5 py-2.5">
            <h2 className={paneHead}>{t.pool}</h2>
            <span className="text-[10px] text-white/35">{pool.length} {t.clip}</span>
          </div>
          <div className="flex flex-col gap-2 border-b border-white/8 px-3 py-2.5">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.search}
              className="w-full rounded-lg border border-white/10 bg-[#070610] px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:border-[#8b22ff] focus:outline-none"
            />
            <div className="flex gap-1.5">{[chip('all', t.all), chip('practice', t.practice), chip('comp', t.comp)]}</div>
          </div>
          {/* thumbnail grid — scrolls independently; density proves the 50-100 target */}
          <div className="grid grid-cols-3 gap-2 overflow-y-auto p-3 lg:min-h-0 lg:flex-1">
            {pool.map((c) => (
              <div
                key={c.id}
                draggable
                className="group cursor-grab overflow-hidden rounded-lg border border-white/10 bg-[#0c0a14] transition hover:border-[#8b22ff]/60"
              >
                <div className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-[#141020] to-[#0a0812] text-[9px] text-white/20">
                  {t.clip} {c.id + 1}
                  {c.draft && (
                    <span className="absolute left-1 top-1 rounded bg-amber-400/20 px-1 py-0.5 text-[7px] font-bold text-amber-300">DRAFT</span>
                  )}
                </div>
                <div className="flex items-center justify-between px-1.5 py-1 text-[9px] text-white/35">
                  <span>{c.dur}{t.sec}</span>
                  <span className="text-[#b66cff] opacity-0 transition group-hover:opacity-100">+ </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* PANE 2 — PREVIEW (top-right) */}
        <section className="flex flex-col rounded-xl border border-white/10 bg-[#08060f] lg:col-start-2 lg:row-start-1 lg:overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-white/8 px-3.5 py-2.5">
            <h2 className={paneHead}>{t.preview}</h2>
            <span className="text-[11px] font-bold text-[#b66cff]">{t.total}: {tlTotal.toFixed(1)}{t.sec}</span>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            <div className="flex aspect-video w-full max-w-2xl items-center justify-center rounded-xl border border-white/10 bg-black text-white/20">
              <span className="text-xs">16:9</span>
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-white/8 px-4 py-2.5">
            <button className="rounded-lg border border-[#8b22ff]/50 px-3 py-1 text-xs font-bold text-[#b66cff] transition hover:bg-[#8b22ff]/10">{t.play}</button>
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-2/3 bg-[#8b22ff]" />
            </div>
          </div>
        </section>

        {/* PANE 3 — TIMELINE (full width bottom on desktop). Single track only. */}
        <section className="flex flex-col rounded-xl border border-white/10 bg-[#08060f] lg:col-span-2 lg:col-start-1 lg:row-start-2 lg:overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-3.5 py-2.5">
            <div className="flex items-center gap-3">
              <h2 className={paneHead}>{t.timeline}</h2>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/40">{t.single_track}</span>
            </div>
            <span className="text-[10px] text-white/30">{TL.length} {t.clip} · {tlTotal}{t.sec}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-x-auto p-4">
            {/* the single horizontal lane -- proportional segment widths (order/trim/cut) */}
            <div className="flex h-24 min-w-full items-stretch gap-1">
              {TL.map((s) => (
                <div
                  key={s.id}
                  style={{ flexGrow: s.dur, flexBasis: 0 }}
                  className="group relative flex min-w-[70px] items-center justify-center rounded-lg border border-[#8b22ff]/30 bg-gradient-to-b from-[#1a1330] to-[#0e0a1c] text-[10px] text-white/50 transition hover:border-[#8b22ff]"
                >
                  {/* trim handles (visual only in the shell) */}
                  <span className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize rounded-l-lg bg-[#8b22ff]/40 opacity-0 transition group-hover:opacity-100" />
                  <span>{t.clip} {s.id} · {s.dur}{t.sec}</span>
                  <span className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize rounded-r-lg bg-[#8b22ff]/40 opacity-0 transition group-hover:opacity-100" />
                </div>
              ))}
              <div className="flex min-w-[120px] flex-1 items-center justify-center rounded-lg border border-dashed border-white/12 text-[10px] text-white/25">
                {t.drag_here}
              </div>
            </div>
            <p className="mt-3 text-[10px] text-white/30">{t.tl_hint}</p>
          </div>
        </section>
      </div>
    </main>
  )
}
