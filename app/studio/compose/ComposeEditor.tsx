'use client'

// In-platform compose editor (Session 6). Beginner-first: pick ready clips, order
// them (drag or arrows), trim each, preview the sequence, watch the length meter,
// then render one composed final. Sequence + trim + cut ONLY -- the platform adds
// no transitions/effects (hard cut by design). Tone matches /studio (dark + purple).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ComposeEdl } from '@/lib/cryptobind'

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
  // Asynchronous submission (mirrors the server RenderStatusDTO): acceptedAt is when
  // the submission was RECEIVED -- before the deadline -- and finalized says whether
  // the rendered file has landed on the entry. Between the two the editor shows
  // "accepted, processing" rather than pretending the submission has not happened.
  acceptedAt?: string | null
  finalized?: boolean
}

// Applicant info collected at submission ONLY when the application round has no
// existing application row (the compose IS the application). Mirrors lib/studio
// ApplicantInfo without importing the server-only module into this client file.
export type ComposeApplicant = {
  creatorName: string
  creatorStatement: string
  country?: string
  channelUrl?: string
  agreedRules: boolean
  agreedPrivacy: boolean
  agreedIntegrity: boolean
}

export type ComposeSubmitCtx = {
  round: 'application' | 'main'
  hasApplication: boolean
  alreadySubmitted: boolean
  needsApplicantInfo: boolean
  statementMin: number
  statementMax: number
}

// Server-side acceptance state for an asynchronous submission. Mirrors the server
// ComposeSubmissionStatus without importing the server module into this client file.
// Non-null = this round's submission was already accepted; the editor must show
// "accepted, processing" on re-entry instead of offering the submit form again.
export type ComposeSubmission = {
  acceptedAt: string
  finalized: boolean
  renderId: string | null
  renderStatus: 'queued' | 'rendering' | 'uploading' | 'ready' | 'submitted' | 'failed' | null
  state: 'intent' | 'finalized' | 'render_failed' | 'render_requeued' | 'render_overdue' | 'finalize_rejected' | null
} | null

// The participant's latest resumable render (server-persisted), so re-entry can
// restore the composition instead of starting over. Shape mirrors the server
// ResumeRender without importing the server module into this client file.
export type ComposeResumeRender = {
  id: string
  status: EditorRenderStatus['status']
  videoUrl: string | null
  totalSeconds: number
  edl: { jobId: string; startMs: number; endMs: number }[]
}

export type ComposeEditorProps = {
  lang: 'ko' | 'en'
  // Scopes the localStorage draft (omitted in the demo -> no persistence).
  seasonId?: string
  clips: SourceClip[]
  minSeconds: number
  maxSeconds: number
  maxClips: number
  // ★TK 2026-08-27: null = participant picks freely (today's behavior,
  // unchanged). A value locks the toggle to it -- createRender is the
  // authority regardless, this only drives the UI lock + shown reason.
  // Omitted (demo) behaves like null.
  lockedAspect?: '16:9' | '9:16' | null
  demo?: boolean
  resumeRender?: ComposeResumeRender | null
  // ★A FAILED render offered only for its arrangement. Never resumed (the row is
  // dead); its EDL is the last server-side copy of the timeline, which is all a
  // participant on a second device has after a stalled render was swept away.
  restorableRender?: (Omit<ComposeResumeRender, 'status'> & { status: 'failed' }) | null
  // Account nickname the entry publishes as (option A: no name/country fields;
  // identity is the account, shown as a notice and editable in /profile).
  nickname?: string
  // Music bed assets available to the participant (platform library + their own
  // AI-generated tracks), mood-grouped. Omitted in the demo / when music is off.
  // ★NOT the normal path any more -- see loadMusicAssets. Kept for the demo,
  // which has a fixed handful and no server action to call.
  musicAssets?: { id: string; url: string; title: string; mood: string; source: 'library' | 'ai' }[]
  // ★Fetch the pickable beds ON DEMAND, instead of shipping them with the page.
  //
  // Season 0's library is planned at 300 tracks (대표님, 2026-08-02). Sending all
  // of them inside loadComposeState meant every editor load carried the whole
  // catalogue -- including the majority of loads where the participant never
  // opens the music panel. This is called the first time the picker is needed.
  //
  // ★This is the seam a filtered picker needs anyway: 300 items do not belong in
  // one <select>, and whatever replaces it will filter server-side, through here.
  // The filter arguments are not invented yet because the classification axis is
  // head office's call (see reports/lane_c_library_pipeline_design_2026-08-02.md).
  loadMusicAssets?: () => Promise<{ id: string; url: string; title: string; mood: string; source: 'library' | 'ai' }[]>
  // Allowlist gate: the season's studio_music_enabled. When false the editor hides
  // the music panel entirely (createRender also rejects music with music_disabled).
  musicEnabled?: boolean
  // AI music generation (Stage 6). aiEnabled=false -> the editor shows the library
  // picker only (no generate UI), so a half-wired button never appears while no
  // provider is live. creditCost = whole credits per generation; promptMax =
  // the prompt char cap. onGenerateMusic/pollMusic are omitted in the demo.
  musicAiEnabled?: boolean
  musicCreditCost?: number
  musicPromptMax?: number
  // Per-round AI-music ceiling + spend so far. cap 0 = unlimited -> no counter.
  musicCap?: number
  musicUsed?: number
  onGenerateMusic?: (
    prompt: string,
    durationSeconds: number,
  ) => Promise<{ ok: true; assetId: string; credits: number } | { ok: false; error: string; detail?: string }>
  pollMusic?: (
    assetId: string,
  ) => Promise<{ status: 'queued' | 'generating' | 'ready' | 'failed'; url: string | null; title: string; mood: string; error: string | null } | null>
  onRender: (
    edl: ComposeEdl | { jobId: string; startMs: number; endMs: number }[],
  ) => Promise<{ ok: true; renderId: string } | { ok: false; error: string }>
  pollRender: (renderId: string) => Promise<EditorRenderStatus | null>
  // Submission step (optional -- the editor renders the submit UI only when both
  // are provided). The demo stubs these like onRender/pollRender.
  submitCtx?: ComposeSubmitCtx
  // Server-side acceptance for this round (asynchronous submission). Omitted in the
  // demo. Present + not finalized -> the "accepted, processing" screen.
  submission?: ComposeSubmission
  onSubmit?: (
    renderId: string,
    applicant?: ComposeApplicant,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  // Discard a rendered final (soft-delete). Optional -- the demo omits it. A
  // submitted final is competition record and is never offered for deletion.
  onDelete?: (renderId: string) => Promise<{ ok: true } | { ok: false; error: string }>
}

type Segment = { uid: string; jobId: string; startMs: number; endMs: number }

const DICT = {
  ko: {
    title: '조합 편집기',
    subtitle: '내 클립을 골라 순서·트림·컷으로 완성작을 만드세요. 전환효과는 없습니다 — 자연스러운 연결은 실력입니다.',
    why_title: '왜 편집 기능이 제한되나요?',
    why_intro: 'OXXOVO는 영상 편집이 아니라 순수 AI 창작을 겨루는 대회입니다.',
    why_reason: '특수효과·전환·색보정·자막·외부 오디오 같은 고급 편집 도구를 허용하면, 전문 편집 실력을 가진 사람이 불공정하게 유리해집니다.',
    why_allow: '대회의 초점을 AI 생성에 두기 위해, OXXOVO는 세 가지만 허용합니다:',
    why_seq: ['순서', '클립의 재생 순서 배열'],
    why_trim: ['트림', '클립의 앞 또는 끝을 짧게 자르기'],
    why_cut: ['컷', '전환효과 없이 클립을 하드컷으로 잇기'],
    why_baseline:
      '중요한 건 AI가 생성한 결과물입니다. 생성된 클립 안에 들어 있는 글자·효과·오디오는 모두 허용됩니다 — AI 생성물의 일부니까요. 반면 글자·효과·전환·오디오를 후편집으로 추가하는 것은 허용되지 않습니다. (OXXOVO 편집기엔 그런 도구가 아예 없으니, AI가 생성한 그대로가 경쟁에 오릅니다.)',
    why_close: '관건은 얼마나 편집하느냐가 아니라, 얼마나 효과적으로 AI로 창작하느냐입니다.',
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
    under: (n: number) => `최소 ${n}초가 필요합니다. 클립을 추가하거나 트림을 늘리세요.`,
    over: (n: number) => `${n}초를 초과했습니다. 트림하거나 클립을 줄이세요.`,
    clip_over: (n: number) => `클립 수가 최대 ${n}개를 초과했습니다.`,
    clip_count: (n: number, max: number) => `클립 ${n} / ${max}`,
    clip_max_reached: (max: number) => `최대 ${max}개까지 담을 수 있습니다. 더 넣으려면 기존 클립을 빼세요.`,
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
    submit_title: '완성본 제출',
    submit_round: (r: string) =>
      r === 'main' ? '본선 라운드' : '예선 라운드',
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
    f_name: '창작자 이름',
    f_statement: (n: number, m: number) => `작품 설명 (${n}~${m}자)`,
    f_country: '국가 (선택)',
    f_channel: '채널 URL (선택)',
    agree_rules: '대회 규칙에 동의합니다',
    agree_privacy: '개인정보 처리방침에 동의합니다',
    agree_integrity: '무결성 고지에 동의합니다',
    submit_err: (e: string) => `제출 실패: ${e}`,
    chars: '자',
    sec: '초',
  },
  en: {
    title: 'Compose',
    subtitle: 'Pick your clips and build a final with sequence, trim and cut. No transitions — a smooth join is your skill.',
    why_title: 'Why are editing tools limited?',
    why_intro: 'OXXOVO rewards pure AI creation — not editing.',
    why_reason: 'If advanced editing tools such as visual effects, transitions, color grading, subtitles, or external audio were allowed, participants with professional editing skills would gain an unfair advantage.',
    why_allow: 'To keep the competition focused on AI generation, OXXOVO allows only three actions:',
    why_seq: ['Sequence', 'arrange the order of clips'],
    why_trim: ['Trim', 'shorten the beginning or end of a clip'],
    why_cut: ['Cut', 'join clips with a hard cut (no transition)'],
    why_baseline:
      "What counts is what the AI generated. Any text, visual effect, or audio that appears within a generated clip is allowed — it's part of the AI's output. Adding text, effects, transitions, or audio afterward is not. (OXXOVO's editor has no tools to add them, so what your AI generates is exactly what competes.)",
    why_close: 'The challenge is not how much you can edit, but how effectively you can create with AI.',
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
    under: (n: number) => `At least ${n}s required. Add a clip or extend a trim.`,
    over: (n: number) => `Over ${n}s. Trim or remove a clip.`,
    clip_over: (n: number) => `More than the max of ${n} clips.`,
    clip_count: (n: number, max: number) => `Clips ${n} / ${max}`,
    clip_max_reached: (max: number) => `You can add up to ${max} clips. Remove one to add another.`,
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
    submit_title: 'Submit final',
    submit_round: (r: string) =>
      r === 'main' ? 'Main round' : 'Application round',
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
    f_name: 'Creator name',
    f_statement: (n: number, m: number) => `Creator statement (${n}–${m} chars)`,
    f_country: 'Country (optional)',
    f_channel: 'Channel URL (optional)',
    agree_rules: 'I agree to the tournament rules',
    agree_privacy: 'I agree to the privacy policy',
    agree_integrity: 'I agree to the integrity notice',
    submit_err: (e: string) => `Submission failed: ${e}`,
    chars: 'chars',
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
  const [whyOpen, setWhyOpen] = useState(false)

  const [renderState, setRenderState] = useState<EditorRenderStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [renderId, setRenderId] = useState<string | null>(null)

  // submit step
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr] = useState<string | null>(null)
  const [submitDone, setSubmitDone] = useState(false)
  const [ap, setAp] = useState<ComposeApplicant>({
    creatorName: '',
    creatorStatement: '',
    country: '',
    channelUrl: '',
    agreedRules: false,
    agreedPrivacy: false,
    agreedIntegrity: false,
  })

  // --- draft persistence (item 7) --------------------------------------------
  // The render + its R2 video are server-persisted, but the arrangement +
  // statement live only in React state. Restore them on re-entry so navigating
  // away doesn't lose work.
  const draftKey = props.seasonId ? `oxxovo_compose_draft_${props.seasonId}` : null
  const restored = useRef(false)

  useEffect(() => {
    if (restored.current) return
    restored.current = true
    type Edl = { jobId: string; startMs: number; endMs: number }
    const edlEq = (a: Edl[], b: Edl[]) =>
      a.length === b.length &&
      a.every((s, i) => s.jobId === b[i].jobId && s.startMs === b[i].startMs && s.endMs === b[i].endMs)

    // Read the local draft (same-browser latest edits).
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
      } catch {
        /* malformed draft -- ignore */
      }
    }

    // Arrangement: the local draft wins (it reflects the newest same-browser
    // edits); the server render's EDL is the fallback (cleared storage / other
    // device). Drop segments whose source clip no longer exists.
    const rr = props.resumeRender
    const sourceEdl: Edl[] = draftSegs && draftSegs.length ? draftSegs : rr?.edl ?? []
    const rebuilt = sourceEdl
      .filter((e) => clipById.has(e.jobId))
      .map((e) => ({ uid: nextUid(), jobId: e.jobId, startMs: e.startMs, endMs: e.endMs }))
    if (rebuilt.length) setSegments(rebuilt)

    // Bind a ready server render as directly submittable ONLY when it matches the
    // restored arrangement -- otherwise the user edited after rendering and must
    // re-render so the submitted composition matches what they see.
    if (rr && rr.status === 'ready' && rr.videoUrl) {
      const chosen = rebuilt.map((s) => ({ jobId: s.jobId, startMs: s.startMs, endMs: s.endMs }))
      if (edlEq(chosen, rr.edl)) {
        setRenderId(rr.id)
        setRenderState({ status: 'ready', videoUrl: rr.videoUrl, totalSeconds: rr.totalSeconds })
      }
    }

    // Statement is restored from the local draft (name/country are no longer
    // collected here -- option A resolves identity server-side from the account).
    // Agreements are NOT restored -- re-affirmed every submission.
    if (draftAp?.creatorStatement) {
      setAp((a) => ({ ...a, creatorStatement: draftAp.creatorStatement ?? a.creatorStatement }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist arrangement + statement draft (not agreements) on change. Skip the
  // empty state so the initial mount does not clobber an existing draft before
  // the restore effect above has hydrated it.
  useEffect(() => {
    if (!draftKey || typeof window === 'undefined' || submitDone) return
    const empty =
      segments.length === 0 && !ap.creatorName.trim() && !ap.creatorStatement.trim() && !(ap.country ?? '').trim()
    if (empty) return
    try {
      window.localStorage.setItem(
        draftKey,
        JSON.stringify({
          segments: segments.map((s) => ({ jobId: s.jobId, startMs: s.startMs, endMs: s.endMs })),
          ap: { creatorName: ap.creatorName, creatorStatement: ap.creatorStatement, country: ap.country },
        }),
      )
    } catch {
      /* quota / disabled storage -- non-fatal */
    }
  }, [segments, ap, submitDone, draftKey])

  // A successful submission is permanent -> drop the draft.
  useEffect(() => {
    if (submitDone && draftKey && typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(draftKey)
      } catch {
        /* ignore */
      }
    }
  }, [submitDone, draftKey])

  const totalMs = segments.reduce((a, s) => a + (s.endMs - s.startMs), 0)
  const minMs = props.minSeconds * 1000
  const maxMs = props.maxSeconds * 1000
  const over = totalMs > maxMs
  // under = below the floor, but only once the user has started a sequence (an
  // empty sequence shows no error, just the empty hint).
  const under = props.minSeconds > 0 && segments.length > 0 && totalMs < minMs
  const tooMany = segments.length > props.maxClips
  const canRender = segments.length > 0 && !over && !under && !tooMany && !busy

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
      if (!clip) {
        setPlaying(false)
        return
      }
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
    setSubmitDone(false)
    setSubmitErr(null)
    setRenderId(null)
    setRenderState({ status: 'queued', videoUrl: null, totalSeconds: totalMs / 1000 })
    const edl = segments.map((s) => ({ jobId: s.jobId, startMs: s.startMs, endMs: s.endMs }))
    const res = await props.onRender(edl)
    if (!res.ok) {
      setErr(res.error)
      setRenderState(null)
      setBusy(false)
      return
    }
    setRenderId(res.renderId)
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

  // --- submit ---
  const needInfo = props.submitCtx?.needsApplicantInfo ?? false
  const sMin = props.submitCtx?.statementMin ?? 150
  const sMax = props.submitCtx?.statementMax ?? 250
  const stmtLen = ap.creatorStatement.trim().length
  // Name/country are resolved server-side from the account (option A); the form
  // only requires the statement + the three consents.
  const infoValid =
    !needInfo ||
    (stmtLen >= sMin &&
      stmtLen <= sMax &&
      ap.agreedRules &&
      ap.agreedPrivacy &&
      ap.agreedIntegrity)
  const canSubmit =
    !!props.onSubmit && !!renderId && !submitting && !submitDone && infoValid && !props.submitCtx?.alreadySubmitted

  const doSubmit = async () => {
    if (!props.onSubmit || !renderId) return
    setSubmitErr(null)
    setSubmitting(true)
    // Option A: name/country are omitted -- the server resolves them from the
    // account (profile -> nickname). Only statement + consents come from here.
    const applicant: ComposeApplicant | undefined = needInfo
      ? {
          creatorName: '',
          creatorStatement: ap.creatorStatement.trim(),
          agreedRules: ap.agreedRules,
          agreedPrivacy: ap.agreedPrivacy,
          agreedIntegrity: ap.agreedIntegrity,
        }
      : undefined
    const res = await props.onSubmit(renderId, applicant)
    if (res.ok) setSubmitDone(true)
    else setSubmitErr(res.error)
    setSubmitting(false)
  }

  // Discard the current rendered final (soft-delete) and return to editing. Only
  // reachable before submission -- a submitted final is protected server-side.
  const [deleting, setDeleting] = useState(false)
  const doDeleteRender = async () => {
    if (!props.onDelete || !renderId) return
    if (typeof window !== 'undefined' && !window.confirm(t.delete_final_confirm)) return
    setDeleting(true)
    const res = await props.onDelete(renderId)
    setDeleting(false)
    if (res.ok) {
      setRenderState(null)
      setRenderId(null)
      setSubmitErr(null)
    } else {
      setSubmitErr(res.error)
    }
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

      {/* "Why are editing tools limited?" — collapsed by default; keeps the editor clean */}
      <div className="rounded-xl border border-[#8b22ff]/30 bg-[#8b22ff]/[.06]">
        <button
          type="button"
          onClick={() => setWhyOpen((o) => !o)}
          aria-expanded={whyOpen}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className="text-[12px] font-bold text-[#b66cff]">{t.why_title}</span>
          <span className={`text-[11px] text-[#b66cff] transition-transform ${whyOpen ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {whyOpen && (
          <div className="space-y-3 border-t border-[#8b22ff]/20 px-4 py-3.5 text-[12px] leading-relaxed text-white/70">
            <p>{t.why_intro}</p>
            <p>{t.why_reason}</p>
            <p>{t.why_allow}</p>
            <ul className="space-y-1.5">
              {[t.why_seq, t.why_trim, t.why_cut].map(([term, desc]) => (
                <li key={term}>
                  <span className="font-bold text-[#d9b8ff]">{term}</span> — {desc}
                </li>
              ))}
            </ul>
            <p className="rounded-lg border border-[#8b22ff]/25 bg-[#8b22ff]/[.05] px-3 py-2.5 text-white/75">
              {t.why_baseline}
            </p>
            <p className="text-[#d9b8ff]">{t.why_close}</p>
          </div>
        )}
      </div>
      {/* practical resolution note stays visible (functional UX, not philosophy) */}
      <p className="-mt-3 text-[11px] leading-relaxed text-white/40">{t.res_note}</p>

      {/* My clips */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className={headCls}>{t.my_clips}</h2>
          {/* Live clip count vs the cap, so a disabled Add button is explained. */}
          <span className={`text-[11px] ${segments.length >= props.maxClips ? 'text-amber-300' : 'text-white/40'}`}>
            {t.clip_count(segments.length, props.maxClips)}
          </span>
        </div>
        {segments.length >= props.maxClips && (
          <p className="mb-2 text-[11px] text-amber-300/80">{t.clip_max_reached(props.maxClips)}</p>
        )}
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
          <span className={`text-xs font-bold ${over || under ? 'text-[#ff8888]' : 'text-[#b66cff]'}`}>
            {t.total}: {fmt(totalMs)} / {props.minSeconds}~{props.maxSeconds}{t.sec}
          </span>
        </div>

        {/* length meter -- fill vs the max; a tick marks the min (floor) so the
            valid window [min, max] is visible at a glance. Red below min or over max. */}
        <div className="relative mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full transition-all ${over || under ? 'bg-[#ff4444]' : 'bg-[#8b22ff]'}`}
            style={{ width: `${Math.min(100, (totalMs / maxMs) * 100)}%` }}
          />
          {props.minSeconds > 0 && props.minSeconds < props.maxSeconds && (
            <div
              className="absolute top-0 h-full w-px bg-white/50"
              style={{ left: `${(minMs / maxMs) * 100}%` }}
            />
          )}
        </div>
        {under && <p className="mb-2 text-[11px] text-[#ff8888]">{t.under(props.minSeconds)}</p>}
        {over && <p className="mb-2 text-[11px] text-[#ff8888]">{t.over(props.maxSeconds)}</p>}
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
              <div className="space-y-3">
                <div className="text-xs uppercase tracking-[0.2em] text-[#b66cff] font-bold">{t.final_title} · {renderState.totalSeconds.toFixed(1)}{t.sec}</div>
                <video src={renderState.videoUrl} controls playsInline className="aspect-video w-full rounded-xl border border-white/10 bg-black" />

                {!props.onSubmit ? (
                  <p className="text-[11px] text-white/40">{t.submit_next}</p>
                ) : submitDone ? (
                  <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/[.06] px-4 py-3 text-sm text-emerald-300">
                    {t.submitted_ok}
                  </div>
                ) : props.submitCtx?.alreadySubmitted ? (
                  <p className="text-[12px] text-white/50">{t.already_submitted}</p>
                ) : (
                  <div className="space-y-3 border-t border-white/10 pt-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs uppercase tracking-[0.2em] text-[#b66cff] font-bold">{t.submit_title}</h3>
                      {props.submitCtx && (
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/50">
                          {t.submit_round(props.submitCtx.round)}
                        </span>
                      )}
                    </div>

                    {needInfo && (
                      <div className="space-y-2.5">
                        <p className="text-[11px] text-[#d9b8ff]">{t.need_info}</p>
                        {/* Option A: identity is the account -- no name/country
                            fields here. The entry publishes as the account
                            nickname (resolved server-side), editable in /profile. */}
                        {props.nickname && (
                          <p className="rounded border border-white/10 bg-white/[.03] px-3 py-2 text-[11px] text-white/65">
                            {t.publish_as(props.nickname)}
                          </p>
                        )}
                        <label className="block">
                          <span className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white/70">
                            <span>{t.f_statement(sMin, sMax)}</span>
                            <span className={stmtLen < sMin || stmtLen > sMax ? 'text-[#ff8888]' : 'text-[#b66cff]'}>
                              {stmtLen}{t.chars}
                            </span>
                          </span>
                          <textarea
                            value={ap.creatorStatement}
                            onChange={(e) => setAp((a) => ({ ...a, creatorStatement: e.target.value }))}
                            rows={3}
                            className="mt-1 w-full rounded border border-white/20 bg-[#070610] px-3 py-2 text-sm text-[#ededed] focus:border-[#8b22ff] focus:outline-none"
                          />
                        </label>
                        {([
                          ['agreedRules', t.agree_rules],
                          ['agreedPrivacy', t.agree_privacy],
                          ['agreedIntegrity', t.agree_integrity],
                        ] as const).map(([key, label]) => (
                          <label key={key} className="flex items-center gap-2 text-[12px] text-white/80">
                            <input
                              type="checkbox"
                              checked={ap[key]}
                              onChange={(e) => setAp((a) => ({ ...a, [key]: e.target.checked }))}
                              className="accent-[#8b22ff]"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    )}

                    <p className="text-[11px] text-white/40">{t.submit_warn}</p>
                    {submitErr && <p className="text-[12px] text-[#ff8888]">{t.submit_err(submitErr)}</p>}
                    <button
                      onClick={doSubmit}
                      disabled={!canSubmit}
                      className="w-full rounded-xl border border-emerald-400/50 bg-emerald-400/15 px-5 py-3 text-sm font-black uppercase tracking-wider text-emerald-200 transition hover:bg-emerald-400/25 disabled:opacity-40"
                    >
                      {submitting ? t.submitting : t.submit_btn}
                    </button>
                  </div>
                )}

                {/* Discard this rendered final (soft-delete). Hidden once
                    submitted -- a submitted final is competition record. */}
                {props.onDelete && !submitDone && !props.submitCtx?.alreadySubmitted && (
                  <button
                    type="button"
                    onClick={doDeleteRender}
                    disabled={deleting}
                    className="text-[11px] text-white/40 transition hover:text-[#ff8888] disabled:opacity-40"
                  >
                    {deleting ? t.deleting : t.delete_final}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
