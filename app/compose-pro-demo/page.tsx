'use client'

// PRO compose editor -- A+B stage (jisu2, 2026-07-17). UNGATED demo, outside
// /studio, no DB/auth. Proves the DaVinci-style 3-pane layout (media pool | preview
// | single-track timeline) + mobile vertical fallback + an INTERACTIVE single-track
// timeline (add from pool, drag-reorder, edge-trim, proportional widths, live total).
// A-stage = layout shell; B-stage = the horizontal timeline is now really wired
// (local state only). Still PURE FRONT-END: no server/crypto/worker/Watch touched;
// the live ComposeEditor is untouched -- these interactions are prototyped here and
// migrate into the real editor in a later phase. Genesis Rule preserved: ONE video
// lane, order/trim/cut only, no track layers, no compositing.
// Tone matches /studio + ComposeEditor (dark #030305 + purple #8b22ff).

import { useCallback, useMemo, useRef, useState } from 'react'
import { useAdminLang, setAdminLang } from '@/lib/admin-i18n'

const T = {
  ko: {
    shell: 'PRO 편집기 · A+B단계',
    shell_note: '레이아웃 + 인터랙티브 타임라인 프로토타입. 클립은 자리표시(로컬 상태) — 서버·크립토 배선은 Stage 3 이후.',
    pool: '미디어 풀', search: '클립 검색…',
    all: '전체', practice: '연습장', comp: '경기',
    add: '추가',
    preview: '미리보기', total: '총 길이', empty_prev: '타임라인에 클립을 추가하세요',
    timeline: '타임라인',
    single_track: '단일 트랙 · 순서 · 트림 · 컷만 (합성/오버레이 없음)',
    tl_hint: '풀에서 클립을 추가하고, 드래그로 순서를 바꾸고, 양끝을 끌어 트림하세요. 층 겹치기는 없습니다 — Genesis Rule.',
    clip: '클립', sec: '초', seg: '구간', remove: '제거', drag_here: '풀에서 클립을 추가하세요',
    reset: '초기화',
  },
  en: {
    shell: 'PRO editor · A+B stage',
    shell_note: 'Layout + interactive timeline prototype. Clips are placeholders (local state) — server/crypto wiring comes after Stage 3.',
    pool: 'Media pool', search: 'Search clips…',
    all: 'All', practice: 'Sandbox', comp: 'Competition',
    add: 'Add',
    preview: 'Preview', total: 'Total', empty_prev: 'Add clips to the timeline',
    timeline: 'Timeline',
    single_track: 'Single track · sequence · trim · cut only (no compositing/overlay)',
    tl_hint: 'Add clips from the pool, drag to reorder, and drag the ends to trim. No stacked layers — Genesis Rule.',
    clip: 'Clip', sec: 's', seg: 'Segment', remove: 'Remove', drag_here: 'Add clips from the pool',
    reset: 'Reset',
  },
} as const

// Placeholder pool clips (density demo -- proves scroll/search at 50-100 scale).
const POOL = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  dur: 5 + (i % 4) * 2, // 5..11s
  draft: i % 5 === 0, // every 5th is a Sandbox/draft clip
  hue: (i * 47) % 360, // distinct placeholder swatch so reordering is visible
}))

type Seg = { uid: string; clipId: number; dur: number; start: number; end: number; hue: number }
let uidN = 0

export default function ComposeProDemo() {
  const lang = useAdminLang()
  const t = T[lang]
  const [tier, setTier] = useState<'all' | 'practice' | 'comp'>('all')
  const [q, setQ] = useState('')
  const [segs, setSegs] = useState<Seg[]>([])
  const [dragUid, setDragUid] = useState<string | null>(null)
  const [sel, setSel] = useState<string | null>(null)

  const pool = useMemo(
    () => POOL.filter((c) => (tier === 'all' ? true : tier === 'practice' ? c.draft : !c.draft)),
    [tier],
  )
  const total = segs.reduce((a, s) => a + (s.end - s.start), 0)

  // --- timeline ops (mirror ComposeEditor semantics: order / trim / cut) ---
  const addClip = (c: (typeof POOL)[number]) =>
    setSegs((s) => [...s, { uid: `seg_${++uidN}`, clipId: c.id, dur: c.dur, start: 0, end: c.dur, hue: c.hue }])
  const removeSeg = (uid: string) => setSegs((s) => s.filter((x) => x.uid !== uid))
  const reorderTo = (from: string, to: string) =>
    setSegs((s) => {
      if (from === to) return s
      const fi = s.findIndex((x) => x.uid === from)
      const ti = s.findIndex((x) => x.uid === to)
      if (fi < 0 || ti < 0) return s
      const copy = [...s]
      const [m] = copy.splice(fi, 1)
      copy.splice(ti, 0, m)
      return copy
    })

  // Edge trim via pointer drag. Convert px delta -> seconds using the segment's
  // own px/second (its rendered width represents end-start seconds).
  const trim = useRef<{ uid: string; edge: 'start' | 'end'; x0: number; pxPerSec: number; orig: number } | null>(null)
  const onTrimDown = (e: React.PointerEvent, s: Seg, edge: 'start' | 'end') => {
    e.preventDefault()
    e.stopPropagation()
    const segEl = (e.currentTarget as HTMLElement).closest('[data-seg]') as HTMLElement | null
    const wPx = segEl?.getBoundingClientRect().width ?? 1
    const span = Math.max(0.001, s.end - s.start)
    trim.current = { uid: s.uid, edge, x0: e.clientX, pxPerSec: wPx / span, orig: edge === 'start' ? s.start : s.end }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onTrimMove = useCallback((e: React.PointerEvent) => {
    const tr = trim.current
    if (!tr) return
    const dSec = (e.clientX - tr.x0) / tr.pxPerSec
    setSegs((list) =>
      list.map((x) => {
        if (x.uid !== tr.uid) return x
        if (tr.edge === 'start') return { ...x, start: Math.max(0, Math.min(tr.orig + dSec, x.end - 0.2)) }
        return { ...x, end: Math.min(x.dur, Math.max(tr.orig + dSec, x.start + 0.2)) }
      }),
    )
  }, [])
  const onTrimUp = () => { trim.current = null }

  const selSeg = segs.find((s) => s.uid === sel) ?? null
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
  const swatch = (hue: number) => `linear-gradient(135deg, hsl(${hue} 45% 26%), hsl(${hue} 40% 14%))`

  return (
    <main className="min-h-screen bg-[#030305] text-white">
      <header className="flex items-center justify-between border-b border-white/5 px-6 py-3.5">
        <div className="flex items-center gap-3">
          <span className="text-[20px] font-black tracking-wide text-[#8b22ff]">OXXOVO</span>
          <span className="rounded-full border border-[#8b22ff]/40 bg-[#8b22ff]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#b66cff]">{t.shell}</span>
        </div>
        <div className="flex gap-1">
          {(['ko', 'en'] as const).map((l) => (
            <button key={l} onClick={() => setAdminLang(l)} className={`px-2 py-1 text-[11px] transition ${lang === l ? 'text-[#b66cff] font-bold' : 'text-white/40 hover:text-white/70'}`}>{l.toUpperCase()}</button>
          ))}
        </div>
      </header>

      <p className="border-b border-white/5 bg-[#8b22ff]/[.04] px-6 py-2 text-[11px] text-white/45">{t.shell_note}</p>

      {/* 3-PANE: mobile = vertical stack; lg = pool | preview (top row), timeline full-width bottom. */}
      <div className="flex flex-col gap-3 p-4 lg:grid lg:h-[calc(100vh-104px)] lg:grid-cols-[340px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_268px] lg:gap-3 lg:overflow-hidden">

        {/* PANE 1 — MEDIA POOL */}
        <section className="flex flex-col rounded-xl border border-white/10 bg-[#08060f] lg:col-start-1 lg:row-start-1 lg:overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-white/8 px-3.5 py-2.5">
            <h2 className={paneHead}>{t.pool}</h2>
            <span className="text-[10px] text-white/35">{pool.length} {t.clip}</span>
          </div>
          <div className="flex flex-col gap-2 border-b border-white/8 px-3 py-2.5">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search}
              className="w-full rounded-lg border border-white/10 bg-[#070610] px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:border-[#8b22ff] focus:outline-none" />
            <div className="flex gap-1.5">{[chip('all', t.all), chip('practice', t.practice), chip('comp', t.comp)]}</div>
          </div>
          <div className="grid grid-cols-3 gap-2 overflow-y-auto p-3 lg:min-h-0 lg:flex-1">
            {pool.map((c) => (
              <button
                key={c.id}
                draggable
                onDragStart={() => setDragUid(`pool_${c.id}`)}
                onClick={() => addClip(c)}
                title={t.add}
                className="group cursor-grab overflow-hidden rounded-lg border border-white/10 bg-[#0c0a14] text-left transition hover:border-[#8b22ff]/60"
              >
                <div className="relative flex aspect-video items-center justify-center text-[9px] text-white/25" style={{ background: swatch(c.hue) }}>
                  {t.clip} {c.id + 1}
                  {c.draft && <span className="absolute left-1 top-1 rounded bg-amber-400/20 px-1 py-0.5 text-[7px] font-bold text-amber-300">DRAFT</span>}
                  <span className="absolute inset-0 flex items-center justify-center bg-[#8b22ff]/0 text-[16px] font-black text-white opacity-0 transition group-hover:bg-[#8b22ff]/25 group-hover:opacity-100">＋</span>
                </div>
                <div className="flex items-center justify-between px-1.5 py-1 text-[9px] text-white/35">
                  <span>{c.dur}{t.sec}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* PANE 2 — PREVIEW */}
        <section className="flex flex-col rounded-xl border border-white/10 bg-[#08060f] lg:col-start-2 lg:row-start-1 lg:overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-white/8 px-3.5 py-2.5">
            <h2 className={paneHead}>{t.preview}</h2>
            <span className="text-[11px] font-bold text-[#b66cff]">{t.total}: {total.toFixed(1)}{t.sec} · {segs.length} {t.clip}</span>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            <div className="flex aspect-video w-full max-w-2xl items-center justify-center rounded-xl border border-white/10 text-white/30"
              style={{ background: selSeg ? swatch(selSeg.hue) : '#000' }}>
              <span className="text-xs">{selSeg ? `${t.clip} ${selSeg.clipId + 1} · ${(selSeg.end - selSeg.start).toFixed(1)}${t.sec}` : segs.length ? '16:9' : t.empty_prev}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-white/8 px-4 py-2.5">
            <button className="rounded-lg border border-[#8b22ff]/50 px-3 py-1 text-xs font-bold text-[#b66cff] transition hover:bg-[#8b22ff]/10 disabled:opacity-40" disabled={!segs.length}>▶</button>
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-[#8b22ff] transition-all" style={{ width: `${Math.min(100, (total / 40) * 100)}%` }} />
            </div>
            {segs.length > 0 && (
              <button onClick={() => { setSegs([]); setSel(null) }} className="text-[10px] text-white/35 transition hover:text-[#ff8888]">{t.reset}</button>
            )}
          </div>
        </section>

        {/* PANE 3 — TIMELINE (single track, interactive) */}
        <section className="flex flex-col rounded-xl border border-white/10 bg-[#08060f] lg:col-span-2 lg:col-start-1 lg:row-start-2 lg:overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-3.5 py-2.5">
            <div className="flex items-center gap-3">
              <h2 className={paneHead}>{t.timeline}</h2>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/40">{t.single_track}</span>
            </div>
            <span className="text-[10px] text-white/30">{segs.length} {t.clip} · {total.toFixed(1)}{t.sec}</span>
          </div>
          <div
            className="min-h-0 flex-1 overflow-x-auto p-4"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragUid?.startsWith('pool_')) { const id = Number(dragUid.slice(5)); const c = POOL[id]; if (c) addClip(c) }
              setDragUid(null)
            }}
          >
            <div className="flex h-24 min-w-full items-stretch gap-1">
              {segs.map((s, i) => (
                <div
                  key={s.uid}
                  data-seg
                  draggable
                  onDragStart={(e) => { if (trim.current) { e.preventDefault(); return } setDragUid(s.uid) }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.stopPropagation(); if (dragUid && !dragUid.startsWith('pool_')) reorderTo(dragUid, s.uid); setDragUid(null) }}
                  onClick={() => setSel(s.uid)}
                  style={{ flexGrow: s.end - s.start, flexBasis: 0, background: swatch(s.hue) }}
                  className={`group relative flex min-w-[64px] cursor-grab items-center justify-center rounded-lg border text-[10px] transition ${
                    sel === s.uid ? 'border-[#b66cff] ring-1 ring-[#8b22ff]' : dragUid === s.uid ? 'border-[#8b22ff]' : 'border-[#8b22ff]/25 hover:border-[#8b22ff]/70'
                  }`}
                >
                  <span
                    onPointerDown={(e) => onTrimDown(e, s, 'start')} onPointerMove={onTrimMove} onPointerUp={onTrimUp}
                    className="absolute left-0 top-0 z-10 h-full w-2 cursor-ew-resize rounded-l-lg bg-[#8b22ff]/50 opacity-0 transition group-hover:opacity-100"
                    title={t.seg}
                  />
                  <span className="pointer-events-none flex flex-col items-center text-white/70">
                    <span className="font-bold">{i + 1}</span>
                    <span className="text-[9px] text-white/45">{(s.end - s.start).toFixed(1)}{t.sec}</span>
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeSeg(s.uid); if (sel === s.uid) setSel(null) }}
                    className="absolute right-1 top-1 z-10 rounded bg-black/40 px-1 text-[10px] text-white/50 opacity-0 transition hover:text-[#ff8888] group-hover:opacity-100"
                    title={t.remove}
                  >×</button>
                  <span
                    onPointerDown={(e) => onTrimDown(e, s, 'end')} onPointerMove={onTrimMove} onPointerUp={onTrimUp}
                    className="absolute right-0 top-0 z-10 h-full w-2 cursor-ew-resize rounded-r-lg bg-[#8b22ff]/50 opacity-0 transition group-hover:opacity-100"
                    title={t.seg}
                  />
                </div>
              ))}
              {segs.length === 0 && (
                <div className="flex min-w-full flex-1 items-center justify-center rounded-lg border border-dashed border-white/12 text-[11px] text-white/25">{t.drag_here}</div>
              )}
            </div>
            <p className="mt-3 text-[10px] text-white/30">{t.tl_hint}</p>
          </div>
        </section>
      </div>
    </main>
  )
}
