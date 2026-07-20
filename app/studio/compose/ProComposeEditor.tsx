'use client'

// PRO compose editor -- the real, launch participant editor (replaces the old
// ComposeEditor UI). DaVinci-style 3-pane (media pool | preview | single-track
// timeline) + Descript-style beginner card ordering, wired to the REAL backend:
// loadComposeState clips -> EDL {jobId,startMs,endMs} -> createRender -> submit
// (moderation + CryptoBind). Backend is reused unchanged; this file is the UX.
//
// Genesis Rule: ONE video lane, order / trim / cut ONLY. No transitions, effects,
// overlays, or track layers -- a hard cut by design. Tone matches /studio.
//
// Build phases (this file grows through them):
//   P1 core wiring (real pool + timeline + EDL + render)      -- THIS commit
//   P2 frame-accurate scrub + seamless chaining preview       -- next
//   P3 submit flow (moderation + crypto + applicant + resume) -- included (reused)
//   P4 Descript card mode + waveform + shortcuts + snap        -- next
//   P5 draft tier filter + replace old editor + regression     -- next
//   P6 real thumbnails (thumbnail_url) instead of <video> frame -- next

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  SourceClip,
  ComposeApplicant,
  ComposeSubmitCtx,
  ComposeResumeRender,
  EditorRenderStatus,
  ComposeEditorProps,
} from './ComposeEditor'
import { createRawPreview, type PreviewEngine } from './preview'

type Segment = { uid: string; jobId: string; startMs: number; endMs: number }

let uidSeq = 0
const nextUid = () => `pseg_${++uidSeq}`
const fmt = (ms: number) => (ms / 1000).toFixed(1)

const DICT = {
  ko: {
    shell: 'PRO 편집기',
    back: '← Studio',
    pool: '미디어 풀',
    search: '클립 검색…',
    add: '추가',
    no_clips: '이번 라운드에 생성한 ready 클립이 없습니다. 먼저 Studio에서 클립을 생성하세요.',
    preview: '미리보기',
    total: '총 길이',
    empty_prev: '타임라인에 클립을 추가하세요',
    play: '재생',
    stop: '정지',
    timeline: '타임라인',
    single_track: '단일 트랙 · 순서 · 트림 · 컷만 (합성·오버레이 없음)',
    tl_hint: '풀에서 클립을 추가하고, 드래그로 순서를 바꾸고, 양끝을 끌어 트림하세요 — Genesis Rule.',
    drag_here: '풀에서 클립을 추가하세요',
    clip: '클립',
    sec: '초',
    remove: '제거',
    reset: '초기화',
    zoom_in: '확대',
    zoom_out: '축소',
    fit: '맞춤',
    zoom_hint: 'Ctrl+휠로 줌',
    why_title: '왜 편집 기능이 제한되나요?',
    why_intro: 'OXXOVO는 영상 편집이 아니라 순수 AI 창작을 겨루는 대회입니다.',
    why_allow: '대회의 초점을 AI 생성에 두기 위해, OXXOVO는 세 가지만 허용합니다:',
    why_seq: ['순서', '클립의 재생 순서 배열'],
    why_trim: ['트림', '클립의 앞 또는 끝을 짧게 자르기'],
    why_cut: ['컷', '전환효과 없이 클립을 하드컷으로 잇기'],
    why_close: '관건은 얼마나 편집하느냐가 아니라, 얼마나 효과적으로 AI로 창작하느냐입니다.',
    under: (n: number) => `최소 ${n}초가 필요합니다. 클립을 추가하거나 트림을 늘리세요.`,
    over: (n: number) => `${n}초를 초과했습니다. 트림하거나 클립을 줄이세요.`,
    clip_over: (n: number) => `클립 수가 최대 ${n}개를 초과했습니다.`,
    clip_count: (n: number, max: number) => `클립 ${n} / ${max}`,
    render: '완성본 만들기',
    rendering: '완성본 생성 중…',
    render_status: (s: string) => `상태: ${s}`,
    final_ready: '완성본이 준비되었습니다.',
    render_failed: '완성본 생성 실패',
    submit_title: '완성본 제출',
    submit_round: (r: string) => (r === 'main' ? '본선 라운드' : '예선 라운드'),
    submit_btn: '제출하기',
    submitting: '제출 중…',
    delete_final: '이 완성작 삭제',
    deleting: '삭제 중…',
    delete_final_confirm: '이 완성작을 삭제할까요? 편집 화면으로 돌아갑니다. (제출 전에만 가능)',
    submitted_ok: '제출 완료 — 채점 대기 중입니다. 제출 후에는 수정할 수 없습니다.',
    already_submitted: '이번 라운드에 이미 제출했습니다.',
    submit_warn: '제출하면 이 완성본이 채점에 들어가며 되돌릴 수 없습니다.',
    need_info: '예선은 이 제출이 곧 참가 신청입니다 — 작품 설명과 동의만 입력하세요.',
    publish_as: (n: string) => `이 작품은 '${n}'(으)로 공개됩니다 — 이름은 프로필에서 변경할 수 있어요.`,
    f_statement: (n: number, m: number) => `작품 설명 (${n}~${m}자)`,
    agree_rules: '대회 규칙에 동의합니다',
    agree_privacy: '개인정보 처리방침에 동의합니다',
    agree_integrity: '무결성 고지에 동의합니다',
    submit_err: (e: string) => `제출 실패: ${e}`,
    chars: '자',
  },
  en: {
    shell: 'PRO editor',
    back: '← Studio',
    pool: 'Media pool',
    search: 'Search clips…',
    add: 'Add',
    no_clips: 'No ready clips for this round yet. Generate clips in Studio first.',
    preview: 'Preview',
    total: 'Total',
    empty_prev: 'Add clips to the timeline',
    play: 'Play',
    stop: 'Stop',
    timeline: 'Timeline',
    single_track: 'Single track · sequence · trim · cut only (no compositing/overlay)',
    tl_hint: 'Add clips from the pool, drag to reorder, drag the ends to trim — Genesis Rule.',
    drag_here: 'Add clips from the pool',
    clip: 'Clip',
    sec: 's',
    remove: 'Remove',
    reset: 'Reset',
    zoom_in: 'Zoom in',
    zoom_out: 'Zoom out',
    fit: 'Fit',
    zoom_hint: 'Ctrl+wheel to zoom',
    why_title: 'Why are editing tools limited?',
    why_intro: 'OXXOVO rewards pure AI creation — not editing.',
    why_allow: 'To keep the competition focused on AI generation, OXXOVO allows only three actions:',
    why_seq: ['Sequence', 'arrange the order of clips'],
    why_trim: ['Trim', 'shorten the beginning or end of a clip'],
    why_cut: ['Cut', 'join clips with a hard cut (no transition)'],
    why_close: 'The challenge is not how much you can edit, but how effectively you can create with AI.',
    under: (n: number) => `At least ${n}s required. Add a clip or extend a trim.`,
    over: (n: number) => `Over ${n}s. Trim or remove a clip.`,
    clip_over: (n: number) => `More than the max of ${n} clips.`,
    clip_count: (n: number, max: number) => `Clips ${n} / ${max}`,
    render: 'Make final',
    rendering: 'Rendering final…',
    render_status: (s: string) => `Status: ${s}`,
    final_ready: 'Your final is ready.',
    render_failed: 'Render failed',
    submit_title: 'Submit final',
    submit_round: (r: string) => (r === 'main' ? 'Main round' : 'Application round'),
    submit_btn: 'Submit',
    submitting: 'Submitting…',
    delete_final: 'Delete this final',
    deleting: 'Deleting…',
    delete_final_confirm: 'Delete this final? You return to editing. (Only before submission.)',
    submitted_ok: 'Submitted — awaiting scoring. Submissions cannot be edited.',
    already_submitted: 'Already submitted for this round.',
    submit_warn: 'Submitting enters this final into scoring and cannot be undone.',
    need_info: 'In the application round this submission is your entry — just add your statement and agree below.',
    publish_as: (n: string) => `This entry will be published as '${n}' — you can change your name in your profile.`,
    f_statement: (n: number, m: number) => `Creator statement (${n}–${m} chars)`,
    agree_rules: 'I agree to the tournament rules',
    agree_privacy: 'I agree to the privacy policy',
    agree_integrity: 'I agree to the integrity notice',
    submit_err: (e: string) => `Submission failed: ${e}`,
    chars: 'chars',
  },
} as const

// Media-pool virtualization geometry (real <video> thumbs -- heavier than the
// demo swatches, so windowing matters). 3-col grid, fixed row height.
const POOL_COLS = 3
const POOL_ROW_H = 104
const POOL_OVERSCAN = 2
const ZOOM_MIN = 6
const ZOOM_MAX = 120

export default function ProComposeEditor(props: ComposeEditorProps) {
  const t = DICT[props.lang]
  const clipById = useMemo(() => new Map(props.clips.map((c) => [c.id, c])), [props.clips])

  const [segments, setSegments] = useState<Segment[]>([])
  const [dragUid, setDragUid] = useState<string | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [q, setQ] = useState('')

  // render + submit state (reused from the live editor's proven flow)
  const [renderState, setRenderState] = useState<EditorRenderStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [renderId, setRenderId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr] = useState<string | null>(null)
  const [submitDone, setSubmitDone] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [ap, setAp] = useState<ComposeApplicant>({
    creatorName: '', creatorStatement: '', country: '', channelUrl: '',
    agreedRules: false, agreedPrivacy: false, agreedIntegrity: false,
  })

  // Timeline zoom (px/second) -- presentation only, never touches the EDL.
  const [pxPerSec, setPxPerSec] = useState(24)
  const tlRef = useRef<HTMLDivElement>(null)

  // ---- draft persistence + resume (reused semantics) ------------------------
  const draftKey = props.seasonId ? `oxxovo_compose_draft_${props.seasonId}` : null
  const restored = useRef(false)
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    type Edl = { jobId: string; startMs: number; endMs: number }
    const edlEq = (a: Edl[], b: Edl[]) =>
      a.length === b.length && a.every((s, i) => s.jobId === b[i].jobId && s.startMs === b[i].startMs && s.endMs === b[i].endMs)
    let draftSegs: Edl[] | null = null
    let draftAp: Partial<ComposeApplicant> | null = null
    if (draftKey && typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(draftKey)
        if (raw) {
          const d = JSON.parse(raw) as { segments?: Edl[]; ap?: Partial<ComposeApplicant> }
          draftSegs = Array.isArray(d.segments) ? d.segments : null
          draftAp = d.ap ?? null
        }
      } catch { /* malformed -- ignore */ }
    }
    const rr = props.resumeRender
    const sourceEdl: Edl[] = draftSegs && draftSegs.length ? draftSegs : rr?.edl ?? []
    const rebuilt = sourceEdl
      .filter((e) => clipById.has(e.jobId))
      .map((e) => ({ uid: nextUid(), jobId: e.jobId, startMs: e.startMs, endMs: e.endMs }))
    if (rebuilt.length) setSegments(rebuilt)
    if (rr && rr.status === 'ready' && rr.videoUrl) {
      const chosen = rebuilt.map((s) => ({ jobId: s.jobId, startMs: s.startMs, endMs: s.endMs }))
      if (edlEq(chosen, rr.edl)) {
        setRenderId(rr.id)
        setRenderState({ status: 'ready', videoUrl: rr.videoUrl, totalSeconds: rr.totalSeconds })
      }
    }
    if (draftAp?.creatorStatement) setAp((a) => ({ ...a, creatorStatement: draftAp.creatorStatement ?? a.creatorStatement }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!draftKey || typeof window === 'undefined' || submitDone) return
    const empty = segments.length === 0 && !ap.creatorStatement.trim()
    if (empty) return
    try {
      window.localStorage.setItem(draftKey, JSON.stringify({
        segments: segments.map((s) => ({ jobId: s.jobId, startMs: s.startMs, endMs: s.endMs })),
        ap: { creatorStatement: ap.creatorStatement },
      }))
    } catch { /* quota -- non-fatal */ }
  }, [segments, ap, submitDone, draftKey])

  useEffect(() => {
    if (submitDone && draftKey && typeof window !== 'undefined') {
      try { window.localStorage.removeItem(draftKey) } catch { /* ignore */ }
    }
  }, [submitDone, draftKey])

  // ---- length / caps --------------------------------------------------------
  const totalMs = segments.reduce((a, s) => a + (s.endMs - s.startMs), 0)
  const minMs = props.minSeconds * 1000
  const maxMs = props.maxSeconds * 1000
  const over = totalMs > maxMs
  const under = props.minSeconds > 0 && segments.length > 0 && totalMs < minMs
  const tooMany = segments.length > props.maxClips
  const canRender = segments.length > 0 && !over && !under && !tooMany && !busy

  // ---- sequence ops (order / trim / cut) ------------------------------------
  const addClip = (clip: SourceClip) => {
    if (segments.length >= props.maxClips) return
    setSegments((s) => [...s, { uid: nextUid(), jobId: clip.id, startMs: 0, endMs: Math.round(clip.durationSeconds * 1000) }])
  }
  const removeSeg = (uid: string) => { setSegments((s) => s.filter((x) => x.uid !== uid)); if (sel === uid) setSel(null) }
  const reorderTo = (fromUid: string, toUid: string) =>
    setSegments((s) => {
      if (fromUid === toUid) return s
      const from = s.findIndex((x) => x.uid === fromUid)
      const to = s.findIndex((x) => x.uid === toUid)
      if (from < 0 || to < 0) return s
      const copy = [...s]
      const [moved] = copy.splice(from, 1)
      copy.splice(to, 0, moved)
      return copy
    })

  // Edge trim via pointer drag; px delta -> ms using the live zoom (exact at any zoom).
  const trim = useRef<{ uid: string; edge: 'start' | 'end'; x0: number; orig: number } | null>(null)
  const onTrimDown = (e: React.PointerEvent, s: Segment, edge: 'start' | 'end') => {
    e.preventDefault(); e.stopPropagation()
    trim.current = { uid: s.uid, edge, x0: e.clientX, orig: edge === 'start' ? s.startMs : s.endMs }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onTrimMove = useCallback((e: React.PointerEvent) => {
    const tr = trim.current
    if (!tr) return
    const dMs = ((e.clientX - tr.x0) / pxPerSec) * 1000
    setSegments((list) =>
      list.map((x) => {
        if (x.uid !== tr.uid) return x
        const clip = clipById.get(x.jobId)
        const durMs = clip ? Math.round(clip.durationSeconds * 1000) : x.endMs
        if (tr.edge === 'start') return { ...x, startMs: Math.max(0, Math.min(Math.round(tr.orig + dMs), x.endMs - 200)) }
        return { ...x, endMs: Math.min(durMs, Math.max(Math.round(tr.orig + dMs), x.startMs + 200)) }
      }),
    )
  }, [pxPerSec, clipById])
  const onTrimUp = () => { trim.current = null }

  // ---- zoom -----------------------------------------------------------------
  const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z))
  const zoomBy = (f: number) => setPxPerSec((z) => Math.round(clampZoom(z * f)))
  const fitZoom = () => {
    const el = tlRef.current
    if (el && totalMs > 0) setPxPerSec(clampZoom((el.clientWidth - 32) / (totalMs / 1000)))
  }
  const tickSec = pxPerSec < 12 ? 10 : pxPerSec < 30 ? 5 : 2
  const totalSec = totalMs / 1000
  const trackW = totalSec * pxPerSec

  // ---- media-pool virtualization + search -----------------------------------
  const pool = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? props.clips.filter((c) => c.prompt.toLowerCase().includes(needle)) : props.clips
  }, [props.clips, q])
  const poolRef = useRef<HTMLDivElement>(null)
  const [poolScroll, setPoolScroll] = useState(0)
  const [poolH, setPoolH] = useState(420)
  useEffect(() => {
    const el = poolRef.current
    if (!el) return
    const update = () => setPoolH(el.clientHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const poolRows = Math.ceil(pool.length / POOL_COLS)
  const startRow = Math.max(0, Math.floor(poolScroll / POOL_ROW_H) - POOL_OVERSCAN)
  const endRow = Math.min(poolRows, Math.ceil((poolScroll + poolH) / POOL_ROW_H) + POOL_OVERSCAN)
  const visiblePool = pool.slice(startRow * POOL_COLS, endRow * POOL_COLS)

  // ---- preview (PLUGGABLE engine) -------------------------------------------
  // C ships the raw engine (sequential playback, no effects). D swaps in the GL
  // WYSIWYG engine here with zero editor changes -- the editor only speaks the
  // PreviewEngine interface. Effects are not user-settable in C, so raw is
  // accurate; once effects exist the engine's `approximate` flag drives an honest
  // "final is produced on render" note rather than faking the graded result.
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const engineRef = useRef<PreviewEngine | null>(null)
  const previewClips = useMemo(
    () => new Map(props.clips.map((c) => [c.id, { id: c.id, url: c.url }])),
    [props.clips],
  )
  useEffect(() => {
    const engine = createRawPreview({ onPlayingChange: setPlaying })
    engineRef.current = engine
    if (videoRef.current) engine.mount(videoRef.current)
    return () => engine.destroy()
  }, [])
  const startPreview = () => { if (!segments.length) return; setSel(null); engineRef.current?.play(segments, previewClips) }
  const stopPreview = () => engineRef.current?.pause()
  const selSeg = segments.find((s) => s.uid === sel) ?? null
  useEffect(() => {
    if (!playing && selSeg) engineRef.current?.showFrame(selSeg, previewClips)
  }, [sel, playing, selSeg, previewClips])

  // ---- render + poll (reused) -----------------------------------------------
  const doRender = async () => {
    setErr(null); setBusy(true); setSubmitDone(false); setSubmitErr(null); setRenderId(null)
    setRenderState({ status: 'queued', videoUrl: null, totalSeconds: totalSec })
    const edl = segments.map((s) => ({ jobId: s.jobId, startMs: s.startMs, endMs: s.endMs }))
    const res = await props.onRender(edl)
    if (!res.ok) { setErr(res.error); setRenderState(null); setBusy(false); return }
    setRenderId(res.renderId)
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, props.demo ? 600 : 2500))
      const st = await props.pollRender(res.renderId)
      if (!st) continue
      setRenderState(st)
      if (st.status === 'ready' || st.status === 'failed') break
    }
    setBusy(false)
  }

  // ---- submit (reused: moderation + crypto happen server-side) --------------
  const ctx: ComposeSubmitCtx | undefined = props.submitCtx
  const needInfo = ctx?.needsApplicantInfo ?? false
  const sMin = ctx?.statementMin ?? 150
  const sMax = ctx?.statementMax ?? 250
  const stmtLen = ap.creatorStatement.trim().length
  const infoValid = !needInfo || (stmtLen >= sMin && stmtLen <= sMax && ap.agreedRules && ap.agreedPrivacy && ap.agreedIntegrity)
  const canSubmit = !!props.onSubmit && !!renderId && !submitting && !submitDone && infoValid && !ctx?.alreadySubmitted
  const doSubmit = async () => {
    if (!props.onSubmit || !renderId) return
    setSubmitErr(null); setSubmitting(true)
    const applicant: ComposeApplicant | undefined = needInfo
      ? { creatorName: '', creatorStatement: ap.creatorStatement.trim(), agreedRules: ap.agreedRules, agreedPrivacy: ap.agreedPrivacy, agreedIntegrity: ap.agreedIntegrity }
      : undefined
    const res = await props.onSubmit(renderId, applicant)
    if (res.ok) setSubmitDone(true)
    else setSubmitErr(res.error)
    setSubmitting(false)
  }
  const doDeleteRender = async () => {
    if (!props.onDelete || !renderId) return
    if (typeof window !== 'undefined' && !window.confirm(t.delete_final_confirm)) return
    setDeleting(true)
    const res = await props.onDelete(renderId)
    setDeleting(false)
    if (res.ok) { setRenderState(null); setRenderId(null); setSubmitErr(null) }
    else setSubmitErr(res.error)
  }

  // ---- UI helpers -----------------------------------------------------------
  const paneHead = 'text-[11px] uppercase tracking-[0.2em] text-[#b66cff] font-bold'
  const renderReady = renderState?.status === 'ready' && !!renderState.videoUrl
  const isRendering = busy && !!renderState && renderState.status !== 'ready' && renderState.status !== 'failed'

  return (
    <div className="flex flex-col gap-3">
      {/* 3-PANE: mobile vertical; lg = pool | preview (top), timeline full-width bottom */}
      <div className="flex flex-col gap-3 lg:grid lg:h-[calc(100vh-220px)] lg:min-h-[560px] lg:grid-cols-[340px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_280px] lg:gap-3 lg:overflow-hidden">

        {/* PANE 1 — MEDIA POOL */}
        <section className="flex flex-col rounded-xl border border-white/10 bg-[#08060f] lg:col-start-1 lg:row-start-1 lg:overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-white/8 px-3.5 py-2.5">
            <h2 className={paneHead}>{t.pool}</h2>
            <span className="text-[10px] text-white/35">{pool.length} {t.clip}</span>
          </div>
          <div className="border-b border-white/8 px-3 py-2.5">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search}
              className="w-full rounded-lg border border-white/10 bg-[#070610] px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:border-[#8b22ff] focus:outline-none" />
          </div>
          <div ref={poolRef} onScroll={(e) => setPoolScroll(e.currentTarget.scrollTop)}
            className="min-h-[320px] overflow-y-auto p-3 lg:min-h-0 lg:flex-1">
            {pool.length === 0 ? (
              <p className="px-2 py-10 text-center text-[11px] text-white/35">{t.no_clips}</p>
            ) : (
              <div className="relative" style={{ height: poolRows * POOL_ROW_H }}>
                {visiblePool.map((c, i) => {
                  const idx = startRow * POOL_COLS + i
                  const row = Math.floor(idx / POOL_COLS)
                  const col = idx % POOL_COLS
                  return (
                    <div key={c.id} className="absolute p-1"
                      style={{ top: row * POOL_ROW_H, left: `${(col * 100) / POOL_COLS}%`, width: `${100 / POOL_COLS}%`, height: POOL_ROW_H }}>
                      <button draggable onDragStart={() => setDragUid(`pool_${c.id}`)} onClick={() => addClip(c)}
                        disabled={segments.length >= props.maxClips} title={c.prompt}
                        className="group flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black text-left transition hover:border-[#8b22ff]/60 disabled:opacity-40">
                        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
                          {/* real clip first frame (P6 swaps to thumbnail_url) */}
                          <video src={c.url} preload="metadata" muted playsInline className="h-full w-full object-cover" />
                          <span className="absolute inset-0 flex items-center justify-center bg-[#8b22ff]/0 text-[16px] font-black text-white opacity-0 transition group-hover:bg-[#8b22ff]/25 group-hover:opacity-100">＋</span>
                        </div>
                        <div className="flex items-center justify-between px-1.5 py-1 text-[9px] text-white/45">
                          <span className="truncate">{c.prompt.slice(0, 14) || t.clip}</span>
                          <span className="shrink-0 tabular-nums">{c.durationSeconds.toFixed(0)}{t.sec}</span>
                        </div>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* PANE 2 — PREVIEW */}
        <section className="flex flex-col rounded-xl border border-white/10 bg-[#08060f] lg:col-start-2 lg:row-start-1 lg:overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-white/8 px-3.5 py-2.5">
            <h2 className={paneHead}>{t.preview}</h2>
            <span className="text-[11px] font-bold text-[#b66cff]">{t.total}: {totalSec.toFixed(1)}{t.sec} · {segments.length} {t.clip}</span>
          </div>
          <div className="flex min-h-[220px] flex-1 items-center justify-center bg-black p-3">
            <video ref={videoRef} playsInline
              className={`max-h-full w-full max-w-2xl rounded-xl ${segments.length ? '' : 'hidden'}`} />
            {segments.length === 0 && <span className="text-xs text-white/30">{t.empty_prev}</span>}
          </div>
          <div className="flex items-center gap-2 border-t border-white/8 px-4 py-2.5">
            <button onClick={playing ? stopPreview : startPreview} disabled={!segments.length}
              className="rounded-lg border border-[#8b22ff]/50 px-3 py-1 text-xs font-bold text-[#b66cff] transition hover:bg-[#8b22ff]/10 disabled:opacity-40">
              {playing ? `■ ${t.stop}` : `▶ ${t.play}`}
            </button>
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className={`h-full transition-all ${over ? 'bg-[#ff6b6b]' : 'bg-[#8b22ff]'}`}
                style={{ width: `${Math.min(100, (totalSec / (props.maxSeconds || 40)) * 100)}%` }} />
            </div>
            {segments.length > 0 && (
              <button onClick={() => { setSegments([]); setSel(null); stopPreview() }} className="text-[10px] text-white/35 transition hover:text-[#ff8888]">{t.reset}</button>
            )}
          </div>
        </section>

        {/* PANE 3 — TIMELINE */}
        <section className="flex flex-col rounded-xl border border-white/10 bg-[#08060f] lg:col-span-2 lg:col-start-1 lg:row-start-2 lg:overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-3.5 py-2.5">
            <div className="flex items-center gap-3">
              <h2 className={paneHead}>{t.timeline}</h2>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/40">{t.single_track}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 rounded-lg border border-white/10 p-0.5" title={t.zoom_hint}>
                <button onClick={() => zoomBy(1 / 1.4)} disabled={pxPerSec <= ZOOM_MIN} title={t.zoom_out}
                  className="flex h-6 w-6 items-center justify-center rounded text-[15px] text-white/55 transition hover:bg-white/10 hover:text-white disabled:opacity-30">−</button>
                <span className="w-[52px] text-center text-[10px] tabular-nums text-white/45">{Math.round(pxPerSec)}px/s</span>
                <button onClick={() => zoomBy(1.4)} disabled={pxPerSec >= ZOOM_MAX} title={t.zoom_in}
                  className="flex h-6 w-6 items-center justify-center rounded text-[15px] text-white/55 transition hover:bg-white/10 hover:text-white disabled:opacity-30">+</button>
                <button onClick={fitZoom} disabled={!segments.length} title={t.fit}
                  className="ml-0.5 flex h-6 items-center rounded px-1.5 text-[10px] font-bold text-white/55 transition hover:bg-white/10 hover:text-white disabled:opacity-30">{t.fit}</button>
              </div>
              <span className="text-[10px] text-white/30">{t.clip_count(segments.length, props.maxClips)}</span>
            </div>
          </div>
          <div ref={tlRef} className="min-h-[150px] flex-1 overflow-x-auto p-4"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragUid?.startsWith('pool_')) { const id = dragUid.slice(5); const c = clipById.get(id); if (c) addClip(c) } setDragUid(null) }}
            onWheel={(e) => { if (e.ctrlKey) { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15) } }}>
            <div style={{ width: segments.length ? trackW : undefined, minWidth: '100%' }}>
              {segments.length > 0 && (
                <div className="relative mb-1 h-4 select-none">
                  {Array.from({ length: Math.floor(totalSec / tickSec) + 1 }, (_, k) => k * tickSec).map((tick) => (
                    <span key={tick} className="absolute top-0 h-4 border-l border-white/10 pl-1 text-[8px] tabular-nums text-white/30" style={{ left: tick * pxPerSec }}>
                      {tick}{t.sec}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex h-24 items-stretch gap-1">
                {segments.map((s, i) => {
                  const segMs = s.endMs - s.startMs
                  return (
                    <div key={s.uid} data-seg draggable
                      onDragStart={(e) => { if (trim.current) { e.preventDefault(); return } setDragUid(s.uid) }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.stopPropagation(); if (dragUid && !dragUid.startsWith('pool_')) reorderTo(dragUid, s.uid); setDragUid(null) }}
                      onClick={() => setSel(s.uid)}
                      style={{ width: Math.max(20, (segMs / 1000) * pxPerSec) }}
                      className={`group relative flex shrink-0 cursor-grab items-center justify-center overflow-hidden rounded-lg border bg-[#141021] text-[10px] transition ${
                        sel === s.uid ? 'border-[#b66cff] ring-1 ring-[#8b22ff]' : dragUid === s.uid ? 'border-[#8b22ff]' : 'border-[#8b22ff]/25 hover:border-[#8b22ff]/70'
                      }`}>
                      <span onPointerDown={(e) => onTrimDown(e, s, 'start')} onPointerMove={onTrimMove} onPointerUp={onTrimUp}
                        className="absolute left-0 top-0 z-10 h-full w-2 cursor-ew-resize rounded-l-lg bg-[#8b22ff]/50 opacity-0 transition group-hover:opacity-100" />
                      <span className="pointer-events-none flex flex-col items-center text-white/70">
                        <span className="font-bold">{i + 1}</span>
                        <span className="text-[9px] text-white/45 tabular-nums">{fmt(segMs)}{t.sec}</span>
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); removeSeg(s.uid) }} title={t.remove}
                        className="absolute right-1 top-1 z-10 rounded bg-black/40 px-1 text-[10px] text-white/50 opacity-0 transition hover:text-[#ff8888] group-hover:opacity-100">×</button>
                      <span onPointerDown={(e) => onTrimDown(e, s, 'end')} onPointerMove={onTrimMove} onPointerUp={onTrimUp}
                        className="absolute right-0 top-0 z-10 h-full w-2 cursor-ew-resize rounded-r-lg bg-[#8b22ff]/50 opacity-0 transition group-hover:opacity-100" />
                    </div>
                  )
                })}
                {segments.length === 0 && (
                  <div className="flex min-w-full flex-1 items-center justify-center rounded-lg border border-dashed border-white/12 text-[11px] text-white/25">{t.drag_here}</div>
                )}
              </div>
            </div>
            <p className="mt-3 text-[10px] text-white/30">{t.tl_hint}</p>
          </div>
        </section>
      </div>

      {/* length warnings */}
      {(under || over || tooMany) && (
        <p className="text-[12px] text-[#ff8888]">
          {tooMany ? t.clip_over(props.maxClips) : over ? t.over(props.maxSeconds) : t.under(props.minSeconds)}
        </p>
      )}

      {/* RENDER + SUBMIT (reused backend flow) */}
      <div className="rounded-xl border border-white/10 bg-[#08060f] p-4">
        {!renderReady ? (
          <button onClick={doRender} disabled={!canRender}
            className="rounded-lg bg-gradient-to-br from-[#7d23ff] to-[#6220dc] px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-40">
            {isRendering ? t.rendering : t.render}
          </button>
        ) : null}
        {renderState && (
          <p className="mt-2 text-[12px] text-white/55">
            {renderState.status === 'failed' ? `${t.render_failed}${renderState.error ? ` — ${renderState.error}` : ''}` : t.render_status(renderState.status)}
          </p>
        )}
        {err && <p className="mt-2 text-[12px] text-[#ff8888]">{err}</p>}

        {renderReady && (
          <div className="mt-3 space-y-3">
            <video src={renderState!.videoUrl!} controls className="w-full max-w-2xl rounded-lg border border-white/10 bg-black" />
            <p className="text-[12px] font-bold text-emerald-300">✓ {t.final_ready}</p>

            {submitDone ? (
              <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{t.submitted_ok}</p>
            ) : ctx?.alreadySubmitted ? (
              <p className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">{t.already_submitted}</p>
            ) : (
              <div className="space-y-3 rounded-xl border border-[#8b22ff]/25 bg-[#8b22ff]/[.05] p-4">
                <p className="text-sm font-bold text-white">{t.submit_title} · <span className="text-[#b66cff]">{t.submit_round(ctx?.round ?? 'application')}</span></p>
                {props.nickname && <p className="text-[11px] text-white/45">{t.publish_as(props.nickname)}</p>}
                {needInfo && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-white/55">{t.need_info}</p>
                    <label className="block text-[11px] text-white/60">{t.f_statement(sMin, sMax)} <span className="text-white/35">({stmtLen}{t.chars})</span></label>
                    <textarea value={ap.creatorStatement} onChange={(e) => setAp((a) => ({ ...a, creatorStatement: e.target.value }))} rows={3}
                      className="w-full rounded-lg border border-white/10 bg-[#070610] px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-[#8b22ff] focus:outline-none" />
                    {([['agreedRules', t.agree_rules], ['agreedPrivacy', t.agree_privacy], ['agreedIntegrity', t.agree_integrity]] as const).map(([k, label]) => (
                      <label key={k} className="flex items-center gap-2 text-[12px] text-white/70">
                        <input type="checkbox" checked={ap[k]} onChange={(e) => setAp((a) => ({ ...a, [k]: e.target.checked }))} />
                        {label}
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-amber-300/80">{t.submit_warn}</p>
                {submitErr && <p className="text-[12px] text-[#ff8888]">{t.submit_err(submitErr)}</p>}
                <div className="flex items-center gap-3">
                  <button onClick={doSubmit} disabled={!canSubmit}
                    className="rounded-lg bg-gradient-to-br from-[#7d23ff] to-[#6220dc] px-5 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-40">
                    {submitting ? t.submitting : t.submit_btn}
                  </button>
                  {props.onDelete && (
                    <button onClick={doDeleteRender} disabled={deleting} className="text-[11px] text-white/40 transition hover:text-[#ff8888] disabled:opacity-40">
                      {deleting ? t.deleting : t.delete_final}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
