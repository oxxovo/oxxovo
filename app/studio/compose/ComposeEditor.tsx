'use client'

// In-platform compose editor (Session 6). Beginner-first: pick ready clips, order
// them (drag or arrows), trim each, preview the sequence, watch the length meter,
// then render one composed final. Sequence + trim + cut ONLY -- the platform adds
// no transitions/effects (hard cut by design). Tone matches /studio (dark + purple).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type SourceClip = {
  id: string
  url: string
  durationSeconds: number
  prompt: string
  createdAt: string
}

export type EditorRenderStatus = {
  status: 'queued' | 'rendering' | 'uploading' | 'ready' | 'failed'
  videoUrl: string | null
  totalSeconds: number
  error?: string | null
}

export type ComposeEditorProps = {
  lang: 'ko' | 'en'
  clips: SourceClip[]
  maxSeconds: number
  maxClips: number
  demo?: boolean
  onRender: (
    edl: { jobId: string; startMs: number; endMs: number }[],
  ) => Promise<{ ok: true; renderId: string } | { ok: false; error: string }>
  pollRender: (renderId: string) => Promise<EditorRenderStatus | null>
}

type Segment = { uid: string; jobId: string; startMs: number; endMs: number }

const DICT = {
  ko: {
    title: '조합 편집기',
    subtitle: '내 클립을 골라 순서·트림·컷으로 완성작을 만드세요. 전환효과는 없습니다 — 자연스러운 연결은 실력입니다.',
    rule_title: 'GENESIS RULE',
    rule_body:
      '완성작은 OXXOVO 안에서 생성한 클립들로만, 순서·트림·컷으로만 조합합니다. 외부 편집·VFX·색보정·모션그래픽·외부 에셋·업스케일·오디오 믹싱 금지. 각 클립은 자체 AI 오디오만 유지합니다.',
    res_note: '해상도가 다른 클립을 섞으면 완성본이 가장 낮은 해상도로 수렴합니다 — 일관된 고화질 클립을 권장합니다.',
    my_clips: '내 클립',
    no_clips: '이번 라운드에 생성한 ready 클립이 없습니다. 먼저 Studio에서 클립을 생성하세요.',
    add: '+ 추가',
    seq_title: '내 시퀀스',
    seq_empty: '위에서 클립을 추가해 시퀀스를 만드세요.',
    trim_start: '시작',
    trim_end: '끝',
    seg_len: '구간',
    remove: '제거',
    up: '↑',
    down: '↓',
    total: '총 길이',
    over: '30초를 초과했습니다. 트림하거나 클립을 줄이세요.',
    clip_over: (n: number) => `클립 수가 최대 ${n}개를 초과했습니다.`,
    preview: '시퀀스 미리보기',
    stop: '정지',
    render: '완성본 만들기',
    rendering: '완성본 생성 중…',
    render_status: (s: string) => `상태: ${s}`,
    final_title: '완성본',
    final_ready: '완성본이 준비되었습니다.',
    render_failed: '완성본 생성 실패',
    demo_badge: '데모 — 실제 생성/제출 없음',
    submit_next: '제출은 다음 단계에서 연결됩니다.',
    sec: '초',
  },
  en: {
    title: 'Compose',
    subtitle: 'Pick your clips and build a final with sequence, trim and cut. No transitions — a smooth join is your skill.',
    rule_title: 'GENESIS RULE',
    rule_body:
      'A final is composed only from clips generated inside OXXOVO, using sequence, trim and cut only. No external editing, VFX, color grading, motion graphics, external assets, upscaling, or audio mixing. Each clip keeps its own AI audio only.',
    res_note: 'Mixing clips of different resolutions converges the final to the lowest one — use consistent high-quality clips.',
    my_clips: 'My clips',
    no_clips: 'No ready clips for this round yet. Generate clips in Studio first.',
    add: '+ Add',
    seq_title: 'My sequence',
    seq_empty: 'Add clips above to build your sequence.',
    trim_start: 'Start',
    trim_end: 'End',
    seg_len: 'Segment',
    remove: 'Remove',
    up: '↑',
    down: '↓',
    total: 'Total',
    over: 'Over 30s. Trim or remove a clip.',
    clip_over: (n: number) => `More than the max of ${n} clips.`,
    preview: 'Preview sequence',
    stop: 'Stop',
    render: 'Make final',
    rendering: 'Rendering final…',
    render_status: (s: string) => `Status: ${s}`,
    final_title: 'Final',
    final_ready: 'Your final is ready.',
    render_failed: 'Render failed',
    demo_badge: 'Demo — no real generation/submission',
    submit_next: 'Submission is wired in the next step.',
    sec: 's',
  },
} as const

let uidSeq = 0
const nextUid = () => `seg_${++uidSeq}`
const fmt = (ms: number) => (ms / 1000).toFixed(1)

export default function ComposeEditor(props: ComposeEditorProps) {
  const t = DICT[props.lang]
  const clipById = useMemo(() => new Map(props.clips.map((c) => [c.id, c])), [props.clips])
  const [segments, setSegments] = useState<Segment[]>([])
  const [dragUid, setDragUid] = useState<string | null>(null)

  const [renderState, setRenderState] = useState<EditorRenderStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const totalMs = segments.reduce((a, s) => a + (s.endMs - s.startMs), 0)
  const maxMs = props.maxSeconds * 1000
  const over = totalMs > maxMs
  const tooMany = segments.length > props.maxClips
  const canRender = segments.length > 0 && !over && !tooMany && !busy

  // --- sequence ops ---
  const addClip = (clip: SourceClip) => {
    if (segments.length >= props.maxClips) return
    setSegments((s) => [...s, { uid: nextUid(), jobId: clip.id, startMs: 0, endMs: Math.round(clip.durationSeconds * 1000) }])
  }
  const removeSeg = (uid: string) => setSegments((s) => s.filter((x) => x.uid !== uid))
  const moveSeg = (uid: string, dir: -1 | 1) =>
    setSegments((s) => {
      const i = s.findIndex((x) => x.uid === uid)
      const j = i + dir
      if (i < 0 || j < 0 || j >= s.length) return s
      const copy = [...s]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })
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
  const setTrim = (uid: string, field: 'startMs' | 'endMs', sec: number) =>
    setSegments((s) =>
      s.map((x) => {
        if (x.uid !== uid) return x
        const clip = clipById.get(x.jobId)
        const durMs = clip ? Math.round(clip.durationSeconds * 1000) : x.endMs
        let ms = Math.round(sec * 1000)
        ms = Math.max(0, Math.min(ms, durMs))
        if (field === 'startMs') return { ...x, startMs: Math.min(ms, x.endMs - 200) }
        return { ...x, endMs: Math.max(ms, x.startMs + 200) }
      }),
    )

  // --- sequence preview (sequential playback with trims) ---
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const playIdx = useRef(0)
  const playSeq = useCallback(
    async (idx: number) => {
      const v = videoRef.current
      if (!v || idx >= segments.length) {
        setPlaying(false)
        return
      }
      playIdx.current = idx
      const seg = segments[idx]
      const clip = clipById.get(seg.jobId)
      if (!clip) return
      v.src = clip.url
      v.currentTime = seg.startMs / 1000
      try {
        await v.play()
      } catch {
        setPlaying(false)
      }
    },
    [segments, clipById],
  )
  const onTimeUpdate = () => {
    const v = videoRef.current
    if (!v) return
    const seg = segments[playIdx.current]
    if (seg && v.currentTime >= seg.endMs / 1000) {
      void playSeq(playIdx.current + 1)
    }
  }
  const startPreview = () => {
    if (!segments.length) return
    setPlaying(true)
    void playSeq(0)
  }
  const stopPreview = () => {
    setPlaying(false)
    videoRef.current?.pause()
  }
  useEffect(() => () => videoRef.current?.pause(), [])

  // --- render + poll ---
  const doRender = async () => {
    setErr(null)
    setBusy(true)
    setRenderState({ status: 'queued', videoUrl: null, totalSeconds: totalMs / 1000 })
    const edl = segments.map((s) => ({ jobId: s.jobId, startMs: s.startMs, endMs: s.endMs }))
    const res = await props.onRender(edl)
    if (!res.ok) {
      setErr(res.error)
      setRenderState(null)
      setBusy(false)
      return
    }
    // poll
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, props.demo ? 600 : 2500))
      const st = await props.pollRender(res.renderId)
      if (!st) continue
      setRenderState(st)
      if (st.status === 'ready' || st.status === 'failed') break
    }
    setBusy(false)
  }

  // ---------- render ----------
  const headCls = 'text-xs uppercase tracking-[0.2em] text-[#b66cff] font-bold'
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black tracking-wide">{t.title}</h1>
          {props.demo && (
            <span className="rounded-full border border-[#8b22ff]/40 bg-[#8b22ff]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#b66cff]">
              {t.demo_badge}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-white/55">{t.subtitle}</p>
      </div>

      {/* Genesis Rule + resolution note */}
      <div className="rounded-xl border border-[#8b22ff]/30 bg-[#8b22ff]/[.06] p-4">
        <div className="text-[10px] uppercase tracking-[0.25em] text-[#b66cff] font-bold">{t.rule_title}</div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-white/70">{t.rule_body}</p>
        <p className="mt-2 text-[11px] leading-relaxed text-[#d9b8ff]">{t.res_note}</p>
      </div>

      {/* My clips */}
      <section>
        <h2 className={`${headCls} mb-3`}>{t.my_clips}</h2>
        {props.clips.length === 0 ? (
          <p className="text-sm text-white/45">{t.no_clips}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {props.clips.map((c) => (
              <div key={c.id} className="rounded-lg border border-white/10 bg-[#0c0a14] p-2">
                <video
                  src={c.url}
                  className="aspect-video w-full rounded bg-black object-cover"
                  muted
                  playsInline
                  preload="metadata"
                  onMouseOver={(e) => void (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
                  onMouseOut={(e) => (e.currentTarget as HTMLVideoElement).pause()}
                />
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="truncate text-[10px] text-white/40">{c.durationSeconds.toFixed(0)}{t.sec}</span>
                  <button
                    onClick={() => addClip(c)}
                    disabled={segments.length >= props.maxClips}
                    className="rounded border border-[#8b22ff]/40 px-2 py-0.5 text-[10px] font-bold text-[#b66cff] transition hover:bg-[#8b22ff]/10 disabled:opacity-40"
                  >
                    {t.add}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sequence */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className={headCls}>{t.seq_title}</h2>
          <span className={`text-xs font-bold ${over ? 'text-[#ff8888]' : 'text-[#b66cff]'}`}>
            {t.total}: {fmt(totalMs)} / {props.maxSeconds}{t.sec}
          </span>
        </div>

        {/* length meter */}
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full transition-all ${over ? 'bg-[#ff4444]' : 'bg-[#8b22ff]'}`}
            style={{ width: `${Math.min(100, (totalMs / maxMs) * 100)}%` }}
          />
        </div>
        {over && <p className="mb-2 text-[11px] text-[#ff8888]">{t.over}</p>}
        {tooMany && <p className="mb-2 text-[11px] text-[#ff8888]">{t.clip_over(props.maxClips)}</p>}

        {segments.length === 0 ? (
          <p className="text-sm text-white/45">{t.seq_empty}</p>
        ) : (
          <ol className="space-y-2">
            {segments.map((s, i) => {
              const clip = clipById.get(s.jobId)
              const durMs = clip ? Math.round(clip.durationSeconds * 1000) : s.endMs
              return (
                <li
                  key={s.uid}
                  draggable
                  onDragStart={() => setDragUid(s.uid)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragUid) reorderTo(dragUid, s.uid)
                    setDragUid(null)
                  }}
                  className={`flex flex-wrap items-center gap-3 rounded-lg border bg-[#0c0a14] p-2.5 ${
                    dragUid === s.uid ? 'border-[#8b22ff]' : 'border-white/10'
                  }`}
                >
                  <span className="cursor-grab select-none text-white/30" title="drag">⠿</span>
                  <span className="text-xs font-bold text-[#b66cff]">{i + 1}</span>
                  {clip && (
                    <video src={clip.url} className="h-12 w-20 rounded bg-black object-cover" muted preload="metadata" />
                  )}
                  <div className="flex items-end gap-2">
                    <label className="block">
                      <span className="text-[9px] uppercase tracking-wider text-white/40">{t.trim_start}</span>
                      <input
                        type="number" min={0} max={durMs / 1000} step={0.1} value={(s.startMs / 1000).toFixed(1)}
                        onChange={(e) => setTrim(s.uid, 'startMs', Number(e.target.value))}
                        className="w-16 rounded border border-white/10 bg-[#070610] px-2 py-1 text-xs text-white focus:border-[#8b22ff] focus:outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[9px] uppercase tracking-wider text-white/40">{t.trim_end}</span>
                      <input
                        type="number" min={0} max={durMs / 1000} step={0.1} value={(s.endMs / 1000).toFixed(1)}
                        onChange={(e) => setTrim(s.uid, 'endMs', Number(e.target.value))}
                        className="w-16 rounded border border-white/10 bg-[#070610] px-2 py-1 text-xs text-white focus:border-[#8b22ff] focus:outline-none"
                      />
                    </label>
                    <span className="pb-1 text-[10px] text-white/40">{t.seg_len} {fmt(s.endMs - s.startMs)}{t.sec}</span>
                  </div>
                  <div className="ml-auto flex items-center gap-1">
                    <button onClick={() => moveSeg(s.uid, -1)} disabled={i === 0} className="rounded border border-white/10 px-2 py-1 text-xs text-white/60 hover:bg-white/5 disabled:opacity-30">{t.up}</button>
                    <button onClick={() => moveSeg(s.uid, 1)} disabled={i === segments.length - 1} className="rounded border border-white/10 px-2 py-1 text-xs text-white/60 hover:bg-white/5 disabled:opacity-30">{t.down}</button>
                    <button onClick={() => removeSeg(s.uid)} className="rounded border border-[#ff4444]/30 px-2 py-1 text-xs text-[#ff8888] hover:bg-[#ff4444]/10">×</button>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      {/* Preview */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className={headCls}>{playing ? t.stop : t.preview}</h2>
          <button
            onClick={playing ? stopPreview : startPreview}
            disabled={segments.length === 0}
            className="rounded-lg border border-[#8b22ff]/50 px-3 py-1 text-xs font-bold text-[#b66cff] transition hover:bg-[#8b22ff]/10 disabled:opacity-40"
          >
            {playing ? `■ ${t.stop}` : `▶ ${t.preview}`}
          </button>
        </div>
        <video
          ref={videoRef}
          onTimeUpdate={onTimeUpdate}
          onEnded={() => void playSeq(playIdx.current + 1)}
          controls
          playsInline
          className="aspect-video w-full rounded-xl border border-white/10 bg-black"
        />
      </section>

      {/* Render */}
      <section className="space-y-3">
        <button
          onClick={doRender}
          disabled={!canRender}
          className="w-full rounded-xl border border-[#8b22ff] bg-[#8b22ff]/15 px-5 py-3 text-sm font-black uppercase tracking-wider text-[#d9b8ff] transition hover:bg-[#8b22ff]/25 disabled:opacity-40"
        >
          {busy ? t.rendering : t.render}
        </button>
        {err && <p className="text-[12px] text-[#ff8888]">{err}</p>}

        {renderState && (
          <div className="rounded-xl border border-[#8b22ff]/30 bg-[#8b22ff]/[.05] p-4">
            {renderState.status !== 'ready' && renderState.status !== 'failed' && (
              <p className="text-sm text-[#b66cff]">{t.render_status(renderState.status)}</p>
            )}
            {renderState.status === 'failed' && (
              <p className="text-sm text-[#ff8888]">{t.render_failed}{renderState.error ? `: ${renderState.error}` : ''}</p>
            )}
            {renderState.status === 'ready' && renderState.videoUrl && (
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.2em] text-[#b66cff] font-bold">{t.final_title} · {renderState.totalSeconds.toFixed(1)}{t.sec}</div>
                <video src={renderState.videoUrl} controls playsInline className="aspect-video w-full rounded-xl border border-white/10 bg-black" />
                <p className="text-[11px] text-white/40">{t.submit_next}</p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
