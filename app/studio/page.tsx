'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAdminLang, setAdminLang, type Lang } from '@/lib/admin-i18n'
import { useLocalToken, clearLocalUser } from '@/lib/use-local-user'
import {
  loadStudioState,
  createGenerationAction,
  pollJobsAction,
  submitGenerationAction,
  deleteClipAction,
  getPurchaseOptions,
  type StudioState,
  type PurchaseOptions,
} from './actions'
import { type StudioJob, type ApplicantInfo, type StudioModel } from '@/lib/studio'
// Client-safe pure helpers (lib/studio itself is server-only).
import { assemblePresetPrompt, type StudioPreset, type StudioPresetGroup } from '@/lib/studio-shared'
// Stage 3 AI-actor mode (t2i character sheet + library + i2v). Additive: the
// clip generator / compose / Watch paths are untouched.
import ActorMode from './ActorMode'

type ApplicantDraft = {
  name: string
  statement: string
  country: string
  channelUrl: string
  rules: boolean
  privacy: boolean
  integrity: boolean
}

// Draft promotion (Sandbox -> Competition): what "이 프롬프트로 최종 렌더"
// prefills into the generator form. The participant reviews the estimated
// credits and confirms with Generate -- nothing is charged on click.
type Prefill = {
  modelId: string
  prompt: string
  presetId: string | null
  negPrompt: string
  cfgScale: number | null
}

const DICT = {
  ko: {
    brand: 'OXXOVO',
    log_out: '로그아웃',
    auth_required: 'Studio를 사용하려면 로그인이 필요합니다.',
    go_login: '로그인하기',
    loading: '불러오는 중…',
    load_failed: '데이터를 불러오지 못했습니다.',
    no_season: '현재 진행 중인 시즌이 없습니다.',
    title: 'Studio',
    subtitle: '외부 도구 없이 OXXOVO 안에서 영상을 생성하고 제출하세요.',
    mode_clip: '클립 생성',
    mode_actor: 'AI 배우',
    round_main: '본선',
    round_application: '예선',
    round_label: (r: string) => `이번 제출: ${r}`,
    theme_label: '주제',
    twist_label: '트위스트',
    twist_hidden: '트위스트는 공개 시점에 표시됩니다.',
    no_theme: '주제 미정',
    balance: '크레딧 잔액',
    used_label: (u: number, m: number) => `생성 ${u}/${m}회 사용`,
    need_apply: '생성은 가능하지만, 제출하려면 먼저 신청이 필요합니다.',
    apply_cta: '신청하기',
    already_submitted: '이미 제출을 완료했습니다. 제출은 영구적이며 수정할 수 없습니다.',
    gen_title: '새 영상 생성',
    model_label: '모델 (티어)',
    competition_group: '경기장 (Competition)',
    sandbox_group: '연습장 (Sandbox) · 제출 불가',
    draft_used_label: (u: number, m: number) => `연습 ${u}/${m}회`,
    draft_badge: 'DRAFT · 연습장',
    draft_note:
      '🎨 연습장(Sandbox) 모델입니다 — 저가·저해상도로 마음껏 시행착오하세요. 영상에 DRAFT 워터마크가 박히고 제출/조합에는 쓸 수 없습니다. 연습 캡(별도)만 차감됩니다.',
    draft_cap_reached: '이번 라운드 연습(드래프트) 횟수를 모두 사용했습니다.',
    draft_no_submit: '연습 클립 — 제출 불가',
    promote: '이 프롬프트로 최종 렌더 →',
    promote_notice:
      '드래프트는 느낌 미리보기입니다 — 같은 프롬프트라도 최종 결과는 달라질 수 있습니다. 모델·프롬프트를 확인하고 생성을 눌러 확정하세요.',
    err_draft_not_submittable: '드래프트(연습) 클립은 제출할 수 없습니다.',
    silent_marker: '무음',
    silent_note: '🔇 무음 모델입니다 — 최종 영상에서 이 클립 구간엔 소리가 없습니다. 필요하면 오디오가 있는 모델을 함께 쓰세요.',
    duration_label: '길이(초)',
    preset_title: '카메라 디렉팅',
    preset_selected: '선택된 프리셋',
    preset_clear: '해제',
    preset_group_action: '액션',
    preset_group_drama: '드라마',
    // ★A MOOD, NOT A PRODUCT CATEGORY. This pill used to read '뷰티/제품' --
    // an industry/product-category word on the participant's screen, which is
    // exactly what the main-round theme must not be leaked by. Its two siblings
    // are moods ('액션'/'드라마'), so the odd one out was also the leaky one.
    // The DB key stays `group_id='beauty'` (internal, never rendered); only the
    // label moved. Keep this a mood or a camera behaviour -- never a product
    // type, an industry, or "광고"/"CF".
    preset_group_beauty: '엘레강스',
    preset_labels: {
      A1: 'FPV 체이스', A2: '휩팬 리빌', A3: '아크 오빗',
      D1: '슬로우 푸시인', D2: '핸드헬드 긴장',
      B1: '엘레강트 오빗', B2: '마크로 푸시인', B3: '틸트업 리빌',
    } as Record<string, string>,
    preset_example_badge: '예시',
    preset_example_note:
      '프리셋의 카메라 느낌을 보여주는 예시 영상입니다 — 정답작이 아닙니다. 결과물은 내 프롬프트에 따라 완전히 달라집니다.',
    assembled_label: '이렇게 조립됩니다',
    assembled_hint_bracket: '이 모델은 [대괄호] 카메라 태그를 지원합니다.',
    assembled_hint_nl: '이 모델은 카메라 서술 문장만 반영합니다 (태그 미지원 모델).',
    advanced_show: '고급 설정 ▸',
    advanced_hide: '고급 설정 ▾',
    adv_negative_label: 'Negative prompt — 빼고 싶은 요소',
    adv_negative_ph: '예: blurry, low quality, watermark',
    adv_cfg_label: 'CFG Scale — 프롬프트 충실도',
    adv_cfg_enable: 'CFG Scale 직접 조절',
    err_unknown_preset: '프리셋을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.',
    err_invalid_param: (k: string) => `고급 파라미터가 유효하지 않습니다: ${k}`,
    prompt_label: '프롬프트',
    prompt_ph: '생성할 영상을 설명하세요…',
    prompt_no_limit_note: '이 모델은 프롬프트 길이 제한이 확인되지 않았습니다. 너무 길면 생성이 실패할 수 있습니다.',
    cost_preview: (c: number) => `예상 차감: ${c} 크레딧`,
    eta_value: (secs: number) => (secs < 90 ? `${secs}초` : `${Math.round(secs / 60)}분`),
    eta_hint: (v: string) => `최근 실측 기준 보통 ~${v} · 혼잡 시 더 걸릴 수 있습니다`,
    notif_title: 'OXXOVO Studio',
    notif_ready: '영상 생성이 완료됐습니다.',
    notif_failed: '영상 생성이 실패했습니다 — 크레딧은 환불됩니다.',
    generate: '생성',
    generating: '생성 요청 중…',
    cap_reached: '이번 라운드 생성 횟수를 모두 사용했습니다.',
    insufficient: '크레딧이 부족합니다.',
    err_bad_duration: '선택한 모델의 허용 길이를 벗어났습니다.',
    err_prompt_too_long: (max: string) => `프롬프트가 이 모델의 최대 길이(${max}자)를 초과했습니다.`,
    err_generic: '생성 실패',
    my_gens: '내 생성물',
    empty_gens: '아직 생성한 영상이 없습니다.',
    clips_show_older: '이전 클립 더 보기',
    clips_collapse: '접기',
    compose_title: '클립을 하나로 조합해 제출하세요',
    compose_hint: (min: number, max: number) =>
      `이번 시즌은 조합 방식입니다. 만든 클립들을 ${min}~${max}초 완성본으로 이어 붙여 제출하세요.`,
    compose_cta: '조합 편집기 열기 →',
    status_queued: '대기 중',
    status_generating: '생성 중',
    status_uploading: '업로드 중',
    status_ready: '준비됨',
    status_submitted: '제출됨',
    status_failed: '실패',
    submit: '이 영상 제출',
    submitting: '제출 중…',
    submit_confirm: '제출하면 영구 확정되며 수정할 수 없습니다. 제출할까요?',
    submitted_badge: '제출 완료',
    delete: '삭제',
    delete_confirm: '이 클립을 삭제할까요? 화면에서 사라지지만 복구 문의는 가능합니다.',
    delete_err_protected: '제출한 작품은 삭제할 수 없습니다 (시합 기록).',
    delete_err_generic: '삭제 실패',
    submit_err_no_application: '이 시즌에 신청 기록이 없습니다. 먼저 신청하세요.',
    submit_err_already: '이미 제출했습니다.',
    submit_err_cryptobind: '생성 인증 검증에 실패했습니다(CryptoBind).',
    submit_err_generic: '제출 실패',
    applicant_title: '신청 정보 (예선 첫 제출)',
    applicant_hint: '예선 첫 제출 시 신청 정보가 함께 등록됩니다. Creator Statement는 Intent 채점 재료라 필수입니다.',
    f_name: '이름',
    f_country: '국가 (선택)',
    f_channel: '채널 URL (선택)',
    f_statement: 'Creator Statement',
    statement_ph: '화면에 보이는 것을 구체적으로 (주제·동작·스타일). 추상적 표현은 Intent 점수가 낮습니다.',
    agree_rules: '대회 규칙에 동의합니다.',
    agree_privacy: '개인정보 처리방침에 동의합니다.',
    agree_integrity: 'AI 무결성 검증에 동의합니다.',
    submit_err_name: '이름을 입력하세요.',
    submit_err_statement: `Creator Statement는 ${150}~${250}자여야 합니다.`,
    submit_err_agreements: '모든 약관에 동의해야 합니다.',
    submit_err_app_info: '신청 정보를 입력하세요.',
    submit_err_app_closed: '신청이 마감되었습니다.',
    submit_err_round_closed: '본선 제출 기한이 지났습니다.',
    submit_err_compose_required: '이 시즌은 조합(compose) 완성본으로만 제출합니다. 클립을 조합 편집기에서 이어 붙여 제출하세요.',
  },
  en: {
    brand: 'OXXOVO',
    log_out: 'Log out',
    auth_required: 'You need to sign in to use Studio.',
    go_login: 'Go to login',
    loading: 'Loading…',
    load_failed: 'Could not load data.',
    no_season: 'No active season right now.',
    title: 'Studio',
    subtitle: 'Generate and submit your video inside OXXOVO — no external tools.',
    mode_clip: 'Clip generator',
    mode_actor: 'AI actor',
    round_main: 'Main round',
    round_application: 'Application',
    round_label: (r: string) => `This submission: ${r}`,
    theme_label: 'Theme',
    twist_label: 'Twist',
    twist_hidden: 'The twist appears at reveal time.',
    no_theme: 'Theme TBD',
    balance: 'Credit balance',
    used_label: (u: number, m: number) => `${u}/${m} generations used`,
    need_apply: 'You can generate, but you must apply before you can submit.',
    apply_cta: 'Apply',
    already_submitted: 'You have already submitted. Submission is permanent and cannot be changed.',
    gen_title: 'New generation',
    model_label: 'Model (tier)',
    competition_group: 'Competition',
    sandbox_group: 'Sandbox · not submittable',
    draft_used_label: (u: number, m: number) => `Sandbox ${u}/${m}`,
    draft_badge: 'DRAFT · Sandbox',
    draft_note:
      '🎨 Sandbox model — cheap, low-res practice runs. Output carries a DRAFT watermark and can never be submitted or composed. Uses the separate Sandbox cap only.',
    draft_cap_reached: 'You have used all Sandbox (draft) generations for this round.',
    draft_no_submit: 'Practice clip — not submittable',
    promote: 'Final render with this prompt →',
    promote_notice:
      'A draft previews the feel — the final result can differ even with the same prompt. Review the model/prompt below and press Generate to confirm.',
    err_draft_not_submittable: 'Draft (practice) clips cannot be submitted.',
    silent_marker: 'silent',
    silent_note: '🔇 Silent model — this clip’s span in the final video has no sound. Pair it with an audio-capable model if you need sound.',
    duration_label: 'Length (s)',
    preset_title: 'Camera directing',
    preset_selected: 'Selected preset',
    preset_clear: 'Clear',
    preset_group_action: 'Action',
    preset_group_drama: 'Drama',
    preset_group_beauty: 'Elegant', // mood, not a product category -- see the KO note
    preset_labels: {} as Record<string, string>, // en falls back to DB label_en
    preset_example_badge: 'Example',
    preset_example_note:
      'An example clip showing this preset\'s camera feel — not a reference answer. Your result depends entirely on your prompt.',
    assembled_label: 'Assembled prompt',
    assembled_hint_bracket: 'This model supports [bracket] camera tags.',
    assembled_hint_nl: 'This model uses the camera description sentence only (no tag support).',
    advanced_show: 'Advanced ▸',
    advanced_hide: 'Advanced ▾',
    adv_negative_label: 'Negative prompt — what to avoid',
    adv_negative_ph: 'e.g. blurry, low quality, watermark',
    adv_cfg_label: 'CFG Scale — prompt adherence',
    adv_cfg_enable: 'Set CFG Scale manually',
    err_unknown_preset: 'Preset not found. Refresh and try again.',
    err_invalid_param: (k: string) => `Invalid advanced parameter: ${k}`,
    prompt_label: 'Prompt',
    prompt_ph: 'Describe the video to generate…',
    prompt_no_limit_note: "This model's prompt length limit is unconfirmed. A very long prompt may fail to generate.",
    cost_preview: (c: number) => `Estimated charge: ${c} credits`,
    eta_value: (secs: number) => (secs < 90 ? `${secs}s` : `${Math.round(secs / 60)} min`),
    eta_hint: (v: string) => `Usually ~${v} (recent measured) · can take longer when busy`,
    notif_title: 'OXXOVO Studio',
    notif_ready: 'Your video is ready.',
    notif_failed: 'A generation failed — credits are refunded.',
    generate: 'Generate',
    generating: 'Requesting…',
    cap_reached: 'You have used all generations for this round.',
    insufficient: 'Not enough credits.',
    err_bad_duration: 'Duration is outside the selected model range.',
    err_prompt_too_long: (max: string) => `Prompt exceeds this model's maximum length (${max} chars).`,
    err_generic: 'Generation failed',
    my_gens: 'My generations',
    empty_gens: 'No generations yet.',
    clips_show_older: 'Show older clips',
    clips_collapse: 'Collapse',
    compose_title: 'Stitch your clips into one final and submit',
    compose_hint: (min: number, max: number) =>
      `This season is compose-based. Combine your clips into a ${min}–${max}s final and submit.`,
    compose_cta: 'Open compose editor →',
    status_queued: 'Queued',
    status_generating: 'Generating',
    status_uploading: 'Uploading',
    status_ready: 'Ready',
    status_submitted: 'Submitted',
    status_failed: 'Failed',
    submit: 'Submit this video',
    submitting: 'Submitting…',
    submit_confirm: 'Submitting is permanent and cannot be changed. Submit?',
    submitted_badge: 'Submitted',
    delete: 'Delete',
    delete_confirm: 'Delete this clip? It disappears from your screen (recovery can be requested).',
    delete_err_protected: 'Submitted works cannot be deleted (competition record).',
    delete_err_generic: 'Delete failed',
    submit_err_no_application: 'No application for this season. Apply first.',
    submit_err_already: 'Already submitted.',
    submit_err_cryptobind: 'Generation authentication failed (CryptoBind).',
    submit_err_generic: 'Submission failed',
    applicant_title: 'Application info (first application-round submit)',
    applicant_hint: 'Your first application-round submit also registers your application. The Creator Statement is required (it feeds Intent scoring).',
    f_name: 'Name',
    f_country: 'Country (optional)',
    f_channel: 'Channel URL (optional)',
    f_statement: 'Creator Statement',
    statement_ph: 'Describe what is on screen (subject, action, style). Abstract wording scores low on Intent.',
    agree_rules: 'I agree to the Tournament Rules.',
    agree_privacy: 'I agree to the Privacy Policy.',
    agree_integrity: 'I agree to AI integrity verification.',
    submit_err_name: 'Name is required.',
    submit_err_statement: `Creator Statement must be ${150}–${250} characters.`,
    submit_err_agreements: 'You must agree to all terms.',
    submit_err_app_info: 'Enter your application info.',
    submit_err_app_closed: 'Applications are closed.',
    submit_err_round_closed: 'The main-round submission deadline has passed.',
    submit_err_compose_required: 'This season accepts only composed finals. Stitch your clips in the compose editor and submit that.',
  },
}

const STATEMENT_MIN = 150
const STATEMENT_MAX = 250

type Dict = (typeof DICT)['en']

function creditsPreview(costPerSec: number, duration: number, marginRate: number, creditUsdValue: number): number {
  return Math.ceil((costPerSec * duration * (1 + marginRate)) / creditUsdValue)
}

const ACTIVE_STATUSES = new Set(['queued', 'generating', 'uploading'])

export default function StudioPage() {
  const router = useRouter()
  const lang = useAdminLang()
  const t = DICT[lang]
  const token = useLocalToken()
  const [state, setState] = useState<StudioState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [prefill, setPrefill] = useState<Prefill | null>(null)
  // Top-level mode: existing clip generator vs the new AI-actor flow. The
  // switcher only swaps the working area below; the theme/status/buy header and
  // compose/Watch stay put.
  const [mode, setMode] = useState<'clip' | 'actor'>('clip')
  const [applicant, setApplicant] = useState<ApplicantDraft>({
    name: '', statement: '', country: '', channelUrl: '',
    rules: false, privacy: false, integrity: false,
  })

  useEffect(() => {
    if (!token) return
    let cancelled = false
    loadStudioState(token).then((res) => {
      if (cancelled) return
      if (res.ok) {
        setState(res.data)
        // Prefill account-level identity (name/country) from the profile; fill
        // only blanks so in-progress edits are never clobbered. Consents stay
        // per-submission and are not prefilled.
        setApplicant((a) => ({
          ...a,
          name: a.name || res.data.profile.creatorName || '',
          country: a.country || res.data.profile.country || '',
        }))
      } else if (res.error === 'invalid_token') clearLocalUser()
      else setLoadError(res.error)
    })
    return () => {
      cancelled = true
    }
  }, [token])

  // Completion notification: when a job flips active -> ready/failed while the
  // tab is hidden, fire a browser notification (if granted) and badge the tab
  // title with the unseen count. Generation itself is already background work
  // server-side; this only stops the participant from staring at "생성 중".
  const prevStatusRef = useRef<Map<string, string> | null>(null)
  const unseenRef = useRef(0)
  const baseTitleRef = useRef('')
  useEffect(() => {
    baseTitleRef.current = document.title
    const onVisible = () => {
      if (!document.hidden) {
        unseenRef.current = 0
        document.title = baseTitleRef.current
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
  useEffect(() => {
    if (!state) return
    const cur = new Map(state.jobs.map((j) => [j.id, j.status as string]))
    const prev = prevStatusRef.current
    prevStatusRef.current = cur
    if (!prev) return
    let ready = 0
    let failed = 0
    for (const [id, s] of cur) {
      const p = prev.get(id)
      if (p && p !== s && ACTIVE_STATUSES.has(p)) {
        if (s === 'ready') ready++
        else if (s === 'failed') failed++
      }
    }
    if ((ready || failed) && document.hidden) {
      unseenRef.current += ready + failed
      document.title = `(${unseenRef.current}) ${baseTitleRef.current}`
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification(t.notif_title, { body: failed ? t.notif_failed : t.notif_ready })
        } catch {
          // Notification constructor can throw (e.g. Android Chrome) -- badge suffices.
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.jobs])

  // Poll while any job is mid-flight.
  const hasActive = !!state?.jobs.some((j) => ACTIVE_STATUSES.has(j.status))
  useEffect(() => {
    if (!token || !hasActive) return
    const id = setInterval(async () => {
      const res = await pollJobsAction(token)
      if (res.ok) {
        setState((prev) =>
          prev
            ? { ...prev, jobs: res.jobs, balance: res.balance, generationsUsed: res.generationsUsed, draftGenerationsUsed: res.draftGenerationsUsed }
            : prev,
        )
      }
    }, 4000)
    return () => clearInterval(id)
  }, [token, hasActive])

  const refresh = async () => {
    if (!token) return
    const res = await pollJobsAction(token)
    if (res.ok) {
      setState((prev) =>
        prev
          ? { ...prev, jobs: res.jobs, balance: res.balance, generationsUsed: res.generationsUsed, draftGenerationsUsed: res.draftGenerationsUsed }
          : prev,
      )
    }
  }

  // Full reload: re-reads fields pollJobsAction omits (image caps, models). Used
  // after AI-actor generations so the image counter reflects the new job.
  const reloadFull = async () => {
    if (!token) return
    const res = await loadStudioState(token)
    if (res.ok) setState(res.data)
    else await refresh()
  }

  if (token === null) {
    return (
      <Shell t={t} onLogout={() => router.push('/')} hideLogout>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-24">
          <p className="text-white/70">{t.auth_required}</p>
          <Link
            href="/login"
            className="rounded-lg border border-[#8b22ff]/60 px-5 py-2.5 text-sm font-bold text-[#b66cff] hover:bg-[#8b22ff]/10 transition"
          >
            {t.go_login}
          </Link>
        </div>
      </Shell>
    )
  }

  if (loadError) {
    return (
      <Shell t={t} onLogout={() => { clearLocalUser(); router.push('/') }}>
        <p className="px-6 py-24 text-center text-[#ff8888]">
          {loadError === 'no_season' ? t.no_season : t.load_failed}
        </p>
      </Shell>
    )
  }

  if (!state) {
    return (
      <Shell t={t} onLogout={() => { clearLocalUser(); router.push('/') }}>
        <p className="px-6 py-24 text-center text-white/60">{t.loading}</p>
      </Shell>
    )
  }

  // Application round + no row yet => the first submit also registers the
  // application, so we must collect applicant info (incl. the Intent statement).
  const needsApplicantInfo = !state.hasApplication && state.season.round === 'application'

  // Clip mode lists video jobs; AI-actor mode lists image (t2i) jobs. Splitting
  // here keeps the existing Generator/Generations code untouched (they only ever
  // see video jobs, exactly as before image jobs existed).
  const videoJobs = state.jobs.filter((j) => j.media_type !== 'image')
  const imageJobs = state.jobs.filter((j) => j.media_type === 'image')

  return (
    <Shell t={t} email={state.email} onLogout={() => { clearLocalUser(); router.push('/') }}>
      <section className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-black">{t.title}</h1>
          <p className="mt-1 text-sm text-white/50">{t.subtitle}</p>
        </div>

        <ThemeBanner t={t} state={state} />
        <StatusBar t={t} state={state} />
        <BuyCredits token={token} />

        {/* Top-level mode switcher. Only shown once the season exposes image
            models (Stage 3 active); until then AI-actor has nothing to select so
            the switcher stays hidden and Studio looks exactly as before. */}
        {state.imageModels.length > 0 && (
          <div className="mt-6 inline-flex rounded-lg border border-white/10 bg-white/[.02] p-1">
            {([['clip', t.mode_clip], ['actor', t.mode_actor]] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${
                  mode === id
                    ? 'bg-gradient-to-br from-[#7d23ff] to-[#6220dc] text-white'
                    : 'text-white/55 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* The "apply via /apply" banner points to the external-URL (YouTube)
            application form, which an in-platform studio participant structurally
            cannot fill. It is hidden in the application round (the inline form is
            the entry) AND in any compose season (compose is the entry, no external
            URL exists) -- so for Season 0 (compose) it never shows. It remains only
            for legacy external-URL seasons outside the application round. */}
        {!state.hasApplication && !needsApplicantInfo && !state.composeEnabled && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <span className="text-sm text-amber-200">{t.need_apply}</span>
            <a href="/apply" className="shrink-0 text-xs font-bold text-amber-200 underline hover:text-amber-100">
              {t.apply_cta}
            </a>
          </div>
        )}
        {state.alreadySubmitted && (
          <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {t.already_submitted}
          </div>
        )}

        {mode === 'actor' ? (
          <ActorMode token={token} state={state} imageJobs={imageJobs} onCreated={reloadFull} />
        ) : (
          <>
            <Generator
              t={t}
              token={token}
              state={state}
              onCreated={refresh}
              prefill={prefill}
              onPrefillApplied={() => setPrefill(null)}
            />

            {/* Inline applicant form pairs with the per-clip submit (single-clip
                entry). In a compose season that path is off and the applicant info
                is collected in the compose editor instead, so hide it here to keep
                one entry path. */}
            {needsApplicantInfo && !state.composeEnabled && (
              <ApplicantForm t={t} applicant={applicant} onChange={setApplicant} />
            )}

            <Generations
              t={t}
              token={token}
              state={{ ...state, jobs: videoJobs }}
              needsApplicantInfo={needsApplicantInfo}
              applicant={applicant}
          onPromote={(job) => {
            // Sandbox -> Competition: prefill the form with the draft's raw
            // prompt/preset/advanced and its competition sibling model.
            const draftModel = state.models.find((m) => m.id === job.model_id)
            const target =
              (draftModel?.promotesTo && state.models.find((m) => m.id === draftModel.promotesTo)) ||
              state.models.find((m) => m.tier !== 'draft')
            if (!target) return
            const adv = job.user_params?.advanced ?? {}
            setPrefill({
              modelId: target.id,
              prompt: job.user_params?.user_prompt ?? job.prompt,
              presetId: job.user_params?.preset_id ?? null,
              negPrompt: typeof adv.negative_prompt === 'string' ? adv.negative_prompt : '',
              cfgScale: typeof adv.cfg_scale === 'number' ? adv.cfg_scale : null,
            })
            document.getElementById('studio-generator')?.scrollIntoView({ behavior: 'smooth' })
          }}
          onChanged={async () => {
            // After submit, reload full state (to flip alreadySubmitted) + jobs.
            const res = await loadStudioState(token)
            if (res.ok) setState(res.data)
            else await refresh()
          }}
            />
          </>
        )}
      </section>
    </Shell>
  )
}

function ThemeBanner({ t, state }: { t: Dict; state: StudioState }) {
  const roundLabel = state.season.round === 'main' ? t.round_main : t.round_application
  return (
    <div className="rounded-xl border border-[#8b22ff]/30 bg-[#8b22ff]/[.06] p-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.25em] text-[#b66cff] font-bold">
          {state.season.displayName}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-white/40">
          {t.round_label(roundLabel)}
        </span>
      </div>
      <div className="mt-3">
        <div className="text-[10px] uppercase tracking-wider text-white/40">{t.theme_label}</div>
        <div className="text-lg font-bold text-white">{state.season.theme ?? t.no_theme}</div>
      </div>
      <div className="mt-3">
        <div className="text-[10px] uppercase tracking-wider text-white/40">{t.twist_label}</div>
        {state.season.twistRevealed && state.season.twist ? (
          <div className="text-sm text-[#d9b8ff]">{state.season.twist}</div>
        ) : (
          <div className="text-sm text-white/35 italic">{t.twist_hidden}</div>
        )}
      </div>
    </div>
  )
}

function StatusBar({ t, state }: { t: Dict; state: StudioState }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      <span className="text-white/70">
        {t.balance}: <span className="font-bold text-[#b66cff]">{state.balance}</span>
      </span>
      <span className="text-white/50">{t.used_label(state.generationsUsed, state.maxGenerations)}</span>
      {/* Sandbox cap -- independent of the competition cap. */}
      <span className="text-white/40">
        {t.draft_used_label(state.draftGenerationsUsed, state.maxDraftGenerations)}
      </span>
    </div>
  )
}

function BuyCredits({ token }: { token: string }) {
  const [opts, setOpts] = useState<PurchaseOptions | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getPurchaseOptions().then((o) => {
      if (!cancelled) setOpts(o)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Hidden unless the buy flow is enabled (studio_purchase_enabled) with packs.
  if (!opts || !opts.enabled || opts.packUsd.length === 0) return null

  const buy = (usd: number) => {
    setErr(null)
    setBusy(usd)
    fetch('/api/studio/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, usd }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.url) window.location.href = j.url
        else {
          setErr(j.error || 'error')
          setBusy(null)
        }
      })
      .catch(() => {
        setErr('network')
        setBusy(null)
      })
  }

  return (
    <section className="mt-6 rounded-xl border border-white/10 bg-white/[.02] p-5">
      <h2 className="text-xs uppercase tracking-[0.2em] text-[#b66cff] font-bold mb-3">
        Buy credits <span className="ml-1 text-[9px] text-amber-300/80">test mode</span>
      </h2>
      <div className="flex flex-wrap gap-3">
        {opts.packUsd.map((usd) => {
          const credits = Math.floor(usd / opts.creditUsdValue)
          return (
            <button
              key={usd}
              type="button"
              onClick={() => buy(usd)}
              disabled={busy !== null}
              className="rounded-lg border border-[#8b22ff]/40 px-4 py-2.5 text-sm font-bold text-[#b66cff] transition hover:bg-[#8b22ff]/10 disabled:opacity-40"
            >
              {busy === usd ? '…' : `$${usd} · ${credits} credits`}
            </button>
          )
        })}
      </div>
      {err && <p className="mt-2 text-[11px] text-[#ff8888]">{err}</p>}
    </section>
  )
}

function Generator({
  t,
  token,
  state,
  onCreated,
  prefill,
  onPrefillApplied,
}: {
  t: Dict
  token: string
  state: StudioState
  onCreated: () => void | Promise<void>
  prefill: Prefill | null
  onPrefillApplied: () => void
}) {
  // ★Text-to-video only. An i2v model (accepts_start_image) needs a start image
  // this form has no way to supply -- it belongs to the AI-actor "shoot shots"
  // step, which builds that input server-side. Today this filter removes nothing
  // (the one i2v row is inactive, measured 2026-08-02), and that is exactly why
  // it has to exist before ⑪ flips it on: activating the model for step ③ would
  // otherwise also drop it into this picker, where every generation would 422.
  const t2vModels = state.models.filter((m) => !m.acceptsI2v)
  const [modelId, setModelId] = useState(t2vModels[0]?.id ?? '')
  const model = t2vModels.find((m) => m.id === modelId) ?? t2vModels[0]
  const [duration, setDuration] = useState(model?.min_duration_seconds ?? 4)
  const [prompt, setPrompt] = useState('')
  // CameraDirector (Stage 1): chosen preset + advanced params. No preset = the
  // legacy free-prompt path, untouched.
  const [presetId, setPresetId] = useState<string | null>(null)
  const [negPrompt, setNegPrompt] = useState('')
  const [cfgOn, setCfgOn] = useState(false)
  const [cfgScale, setCfgScale] = useState(0.5)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Set while a draft promotion prefill is active -- shows the "final can
  // differ" honesty notice until the participant generates or edits away.
  const [promoteNote, setPromoteNote] = useState(false)

  // Clamp duration into the selected model's range when the model changes.
  useEffect(() => {
    if (!model) return
    setDuration((d) => Math.min(Math.max(d, model.min_duration_seconds), model.max_duration_seconds))
  }, [model])

  // Apply a draft promotion prefill (one-shot; parent clears it after).
  useEffect(() => {
    if (!prefill) return
    setModelId(prefill.modelId)
    setPrompt(prefill.prompt)
    setPresetId(prefill.presetId)
    setNegPrompt(prefill.negPrompt)
    setCfgOn(prefill.cfgScale !== null)
    if (prefill.cfgScale !== null) setCfgScale(prefill.cfgScale)
    setPromoteNote(true)
    onPrefillApplied()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill])

  const preset = presetId ? state.presets.find((p) => p.id === presetId) ?? null : null
  // The SERVER assembles the real prompt; this mirror exists only so the
  // participant sees exactly what will be generated (same shared function).
  const assembled = assemblePresetPrompt(prompt, preset, model?.promptStyle ?? null)
  // Length budget: the limit applies to the ASSEMBLED prompt, so the preset's
  // overhead shrinks what the participant can type.
  const presetOverhead = preset ? assemblePresetPrompt('x', preset, model?.promptStyle ?? null).length - 1 : 0
  const typeMax = model?.promptMax != null ? Math.max(0, model.promptMax - presetOverhead) : null

  const credits = model
    ? creditsPreview(model.cost_per_second_usd, duration, state.pricing.marginRate, state.pricing.creditUsdValue)
    : 0
  // Sandbox and competition caps are independent -- check the one the selected
  // model actually consumes (server re-checks with the same split).
  const isDraftModel = model?.tier === 'draft'
  const capReached = isDraftModel
    ? state.draftGenerationsUsed >= state.maxDraftGenerations
    : state.generationsUsed >= state.maxGenerations
  const insufficient = credits > state.balance
  const disabled = pending || !model || prompt.trim() === '' || capReached || insufficient || !t2vModels.length

  const errText = (e: string, detail?: string): string => {
    switch (e) {
      case 'cap_reached': return detail === 'draft' ? t.draft_cap_reached : t.cap_reached
      case 'insufficient_credits': return t.insufficient
      case 'bad_duration': return t.err_bad_duration
      case 'prompt_too_long': return t.err_prompt_too_long(detail ?? '')
      case 'unknown_preset': return t.err_unknown_preset
      case 'invalid_param': return t.err_invalid_param(detail ?? '')
      default: return t.err_generic
    }
  }

  const handle = () => {
    setError(null)
    // Ask for notification permission at the moment it becomes useful (first
    // generate), never on page load.
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    startTransition(async () => {
      // Advanced params ride along only when the model's whitelist offers them
      // (the panel is hidden otherwise, but never trust hidden UI state).
      const wl = model?.paramWhitelist ?? null
      const advanced: Record<string, unknown> = {}
      if (wl?.negative_prompt && negPrompt.trim()) advanced.negative_prompt = negPrompt.trim()
      if (wl?.cfg_scale && cfgOn) advanced.cfg_scale = cfgScale
      const res = await createGenerationAction(token, {
        modelId,
        prompt: prompt.trim(),
        durationSeconds: duration,
        ...(preset ? { presetId: preset.id } : {}),
        ...(Object.keys(advanced).length > 0 ? { advanced } : {}),
      })
      if (res.ok) {
        setPrompt('')
        setPromoteNote(false)
        await onCreated()
      } else {
        setError(errText(res.error, res.detail))
      }
    })
  }

  const competitionModels = t2vModels.filter((m) => m.tier !== 'draft')
  const draftModels = t2vModels.filter((m) => m.tier === 'draft')
  const optionLabel = (m: (typeof state.models)[number]) =>
    `${m.display_name} · ${m.tier}${m.hasAudio ? '' : ` · ${t.silent_marker}`}`

  return (
    <section id="studio-generator" className="mt-8 rounded-xl border border-white/10 bg-white/[.02] p-5">
      <h2 className="text-xs uppercase tracking-[0.2em] text-[#b66cff] font-bold mb-4">{t.gen_title}</h2>
      <div className="space-y-4">
        {promoteNote && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[12px] leading-relaxed text-amber-200">
            {t.promote_notice}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="sm:col-span-2 block">
            <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{t.model_label}</div>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className={inputCls}
            >
              <optgroup label={t.competition_group}>
                {competitionModels.map((m) => (
                  <option key={m.id} value={m.id}>{optionLabel(m)}</option>
                ))}
              </optgroup>
              {draftModels.length > 0 && (
                <optgroup label={t.sandbox_group}>
                  {draftModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {optionLabel(m)}{m.resolutionLabel ? ` · ${m.resolutionLabel}` : ''}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {model && isDraftModel && (
              <p className="mt-1.5 text-[11px] leading-relaxed text-[#d9b8ff]/80">{t.draft_note}</p>
            )}
            {model && !model.hasAudio && (
              <p className="mt-1.5 text-[11px] leading-relaxed text-amber-300/80">{t.silent_note}</p>
            )}
            {/* Rolling measured ETA only -- a model with too few samples shows
                nothing rather than a made-up number (honesty rule). */}
            {model && state.modelEtas[model.id] !== undefined && (
              <p className="mt-1.5 text-[11px] text-white/45">
                ⏱ {t.eta_hint(t.eta_value(state.modelEtas[model.id]))}
              </p>
            )}
          </label>
          <label className="block">
            <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{t.duration_label}</div>
            {model && model.min_duration_seconds === model.max_duration_seconds ? (
              // Fixed length (e.g. Season 0 = 20s for all rounds): show it, don't
              // offer an editable field. Range seasons fall through to the input.
              <div className={`${inputCls} flex items-center text-white/70`}>{model.max_duration_seconds}s</div>
            ) : (
              <input
                type="number"
                min={model?.min_duration_seconds ?? 1}
                max={model?.max_duration_seconds ?? 30}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className={inputCls}
              />
            )}
          </label>
        </div>
        <CameraDirector
          t={t}
          presets={state.presets}
          model={model ?? null}
          presetId={presetId}
          onPick={setPresetId}
        />
        <label className="block">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-white/40">{t.prompt_label}</span>
            {model && (
              // The limit applies to the ASSEMBLED prompt (preset overhead
              // included), so count what will actually be sent to the model.
              <span
                className={`text-[10px] ${
                  model.promptMax != null && assembled.length >= model.promptMax
                    ? 'text-[#ff8888]'
                    : model.promptMax != null && assembled.length > model.promptMax * 0.9
                      ? 'text-amber-300'
                      : 'text-white/40'
                }`}
              >
                {assembled.length.toLocaleString()}
                {model.promptMax != null ? ` / ${model.promptMax.toLocaleString()}` : ''}
              </span>
            )}
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            // Hard-cap typing at the model's known limit MINUS the preset's
            // overhead; unknown (Seedance) -> no cap, a caution note instead.
            maxLength={typeMax ?? undefined}
            placeholder={t.prompt_ph}
            className={`${inputCls} resize-y`}
          />
          {model && model.promptMax == null && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-amber-300/80">{t.prompt_no_limit_note}</p>
          )}
        </label>
        {preset && model && (
          <div className="rounded-lg border border-[#8b22ff]/25 bg-[#8b22ff]/[.05] px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-[#b66cff] font-bold">{t.assembled_label}</div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-white/70 font-mono break-words">
              {assemblePresetPrompt(prompt.trim() || '…', preset, model.promptStyle)}
            </p>
            <p className="mt-1.5 text-[10px] text-white/40">
              {model.promptStyle === 'bracket' ? t.assembled_hint_bracket : t.assembled_hint_nl}
            </p>
          </div>
        )}
        {model?.paramWhitelist && (
          <AdvancedPanel
            t={t}
            whitelist={model.paramWhitelist}
            negPrompt={negPrompt}
            onNegPrompt={setNegPrompt}
            cfgOn={cfgOn}
            onCfgOn={setCfgOn}
            cfgScale={cfgScale}
            onCfgScale={setCfgScale}
          />
        )}
        <div className="flex items-center justify-between gap-3">
          <span className={`text-xs ${insufficient ? 'text-[#ff8888]' : 'text-white/50'}`}>
            {t.cost_preview(credits)}
          </span>
          <button
            type="button"
            onClick={handle}
            disabled={disabled}
            className="px-5 py-2.5 rounded-lg bg-gradient-to-br from-[#7d23ff] to-[#6220dc] text-white text-sm font-bold hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? t.generating : t.generate}
          </button>
        </div>
        {capReached && (
          <p className="text-[11px] text-amber-300">{isDraftModel ? t.draft_cap_reached : t.cap_reached}</p>
        )}
        {error && <p className="text-[11px] text-[#ff8888]">{error}</p>}
      </div>
    </section>
  )
}

// Stage 1 CameraDirector: genre segments -> one-click preset chips -> example
// preview. Picking nothing = the legacy free-prompt path. Presets come from
// studio_presets (data, not code) via the server loader.
function CameraDirector({
  t,
  presets,
  model,
  presetId,
  onPick,
}: {
  t: Dict
  presets: StudioPreset[]
  model: StudioModel | null
  presetId: string | null
  onPick: (id: string | null) => void
}) {
  const GROUPS: { id: StudioPresetGroup; label: string }[] = [
    { id: 'action', label: t.preset_group_action },
    { id: 'drama', label: t.preset_group_drama },
    { id: 'beauty', label: t.preset_group_beauty },
  ]
  const [group, setGroup] = useState<StudioPresetGroup | null>(null)
  if (presets.length === 0) return null
  const selected = presetId ? presets.find((p) => p.id === presetId) ?? null : null
  const label = (p: StudioPreset) => t.preset_labels[p.id] ?? p.label_en
  const visible = group ? presets.filter((p) => p.group_id === group) : []

  return (
    <div className="rounded-lg border border-white/10 bg-white/[.015] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-white/40 mr-1">{t.preset_title}</span>
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setGroup((cur) => (cur === g.id ? null : g.id))}
            className={`px-3 py-1 rounded-full text-[11px] font-bold border transition ${
              group === g.id
                ? 'border-[#8b22ff] bg-[#8b22ff]/20 text-[#d9b8ff]'
                : 'border-white/15 text-white/50 hover:border-white/30'
            }`}
          >
            {g.label}
          </button>
        ))}
        {selected && (
          // Stays visible even when the segment view is on another group, so the
          // active preset is never silently "hidden state".
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[#8b22ff]/50 bg-[#8b22ff]/10 pl-3 pr-1.5 py-0.5 text-[11px] text-[#d9b8ff]">
            {t.preset_selected}: <b>{label(selected)}</b>
            <button
              type="button"
              onClick={() => onPick(null)}
              className="rounded-full px-1.5 text-white/60 hover:text-white hover:bg-white/10"
              aria-label={t.preset_clear}
            >
              ×
            </button>
          </span>
        )}
      </div>

      {visible.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {visible.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(presetId === p.id ? null : p.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                presetId === p.id
                  ? 'border-[#8b22ff] bg-gradient-to-br from-[#7d23ff]/30 to-[#6220dc]/30 text-white'
                  : 'border-white/15 text-white/60 hover:border-[#8b22ff]/50 hover:text-white'
              }`}
            >
              {label(p)}
            </button>
          ))}
        </div>
      )}

      {selected?.preview_url && (
        <div className="mt-3">
          <div className="relative overflow-hidden rounded-lg border border-white/10 max-w-md">
            <video
              key={selected.id}
              src={selected.preview_url}
              muted
              loop
              autoPlay
              playsInline
              controls
              preload="metadata"
              className="w-full bg-black"
            />
            <span className="absolute top-2 left-2 rounded bg-black/70 border border-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/90 pointer-events-none">
              {t.preset_example_badge}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-white/40 max-w-md">{t.preset_example_note}</p>
        </div>
      )}
    </div>
  )
}

// Collapsed advanced panel -- rendered ONLY for models whose measured
// param_whitelist offers something (kling-v3-pro today). Fields are driven by
// the whitelist so a data-only catalog change lights them up without code.
function AdvancedPanel({
  t,
  whitelist,
  negPrompt,
  onNegPrompt,
  cfgOn,
  onCfgOn,
  cfgScale,
  onCfgScale,
}: {
  t: Dict
  whitelist: NonNullable<StudioModel['paramWhitelist']>
  negPrompt: string
  onNegPrompt: (v: string) => void
  cfgOn: boolean
  onCfgOn: (v: boolean) => void
  cfgScale: number
  onCfgScale: (v: number) => void
}) {
  const [open, setOpen] = useState(false)
  const neg = whitelist.negative_prompt
  const cfg = whitelist.cfg_scale
  if (!neg && !cfg) return null
  return (
    <div className="rounded-lg border border-white/10 bg-white/[.015]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-white/50 hover:text-white/80 transition"
      >
        {open ? t.advanced_hide : t.advanced_show}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {neg && (
            <label className="block">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-white/40">{t.adv_negative_label}</span>
                {typeof neg.max_len === 'number' && (
                  <span className="text-[10px] text-white/40">
                    {negPrompt.length} / {neg.max_len}
                  </span>
                )}
              </div>
              <textarea
                value={negPrompt}
                onChange={(e) => onNegPrompt(e.target.value)}
                rows={2}
                maxLength={typeof neg.max_len === 'number' ? neg.max_len : undefined}
                placeholder={t.adv_negative_ph}
                className={`${inputCls} resize-y`}
              />
            </label>
          )}
          {cfg && (
            <div>
              <label className="flex items-center gap-2 text-[11px] text-white/60">
                <input type="checkbox" checked={cfgOn} onChange={(e) => onCfgOn(e.target.checked)} />
                {t.adv_cfg_enable}
              </label>
              {cfgOn && (
                <label className="mt-2 block">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-[10px] uppercase tracking-wider text-white/40">{t.adv_cfg_label}</span>
                    <span className="text-[10px] text-[#b66cff] font-bold">{cfgScale.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={cfg.min ?? 0}
                    max={cfg.max ?? 1}
                    step={0.05}
                    value={cfgScale}
                    onChange={(e) => onCfgScale(Number(e.target.value))}
                    className="w-full accent-[#8b22ff]"
                  />
                </label>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Generations({
  t,
  token,
  state,
  needsApplicantInfo,
  applicant,
  onPromote,
  onChanged,
}: {
  t: Dict
  token: string
  state: StudioState
  needsApplicantInfo: boolean
  applicant: ApplicantDraft
  onPromote: (job: StudioJob) => void
  onChanged: () => void | Promise<void>
}) {
  // Workspace, not a library: show only recent clips by default so old clips
  // don't drown the current work. Full history -> My Videos. (TK 2026-07-12)
  const [showOlder, setShowOlder] = useState(false)
  const RECENT_CLIPS = 8
  // Click a card to play it in a single modal player -- only ONE full <video>
  // loads at a time; the grid cards themselves are lightweight metadata thumbs.
  const [preview, setPreview] = useState<StudioJob | null>(null)
  useEffect(() => {
    if (!preview) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreview(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview])
  return (
    <section className="mt-8">
      <h2 className="text-xs uppercase tracking-[0.2em] text-[#b66cff] font-bold mb-3">{t.my_gens}</h2>
      {state.composeEnabled && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[#8b22ff]/30 bg-[#8b22ff]/[.05] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-white">{t.compose_title}</p>
            <p className="mt-1 text-[11px] text-white/50">
              {t.compose_hint(state.composeMinSeconds, state.composeMaxSeconds)}
            </p>
          </div>
          <Link
            href="/studio/compose"
            className="shrink-0 self-start rounded-lg bg-gradient-to-br from-[#7d23ff] to-[#6220dc] px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 sm:self-auto"
          >
            {t.compose_cta}
          </Link>
        </div>
      )}
      {state.jobs.length === 0 ? (
        <p className="text-xs text-white/40 py-6 text-center">{t.empty_gens}</p>
      ) : (
        <>
          {/* Responsive grid: 1 col mobile -> 2 -> 3 -> 4 as width allows. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(showOlder ? state.jobs : state.jobs.slice(0, RECENT_CLIPS)).map((job) => (
              <JobCard
                key={job.id}
                t={t}
                token={token}
                job={job}
                etaSeconds={state.modelEtas[job.model_id]}
                // Single-path unification: in a compose season the per-clip "Submit
                // this video" is hidden -- the only entry is the composed final
                // (compose CTA above). The server enforces this too (compose_required).
                canSubmit={!state.alreadySubmitted && !state.composeEnabled}
                needsApplicantInfo={needsApplicantInfo}
                applicant={applicant}
                onPromote={onPromote}
                onPreview={setPreview}
                onChanged={onChanged}
              />
            ))}
          </div>
          {state.jobs.length > RECENT_CLIPS && (
            <button
              type="button"
              onClick={() => setShowOlder((v) => !v)}
              className="mt-4 w-full rounded-lg border border-white/10 py-2 text-xs text-white/50 transition hover:border-white/25 hover:text-white/75"
            >
              {showOlder ? t.clips_collapse : `${t.clips_show_older} (${state.jobs.length - RECENT_CLIPS})`}
            </button>
          )}
        </>
      )}
      {preview && preview.video_url && (
        <div onClick={() => setPreview(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-3xl">
            <video src={preview.video_url} controls autoPlay playsInline className="max-h-[75vh] w-full rounded-lg border border-white/10 bg-black" />
            <p className="mt-2 line-clamp-2 text-xs text-white/60">{preview.prompt}</p>
            <button type="button" onClick={() => setPreview(null)} aria-label="Close"
              className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-bold text-black shadow">×</button>
          </div>
        </div>
      )}
    </section>
  )
}

function ApplicantForm({
  t,
  applicant,
  onChange,
}: {
  t: Dict
  applicant: ApplicantDraft
  onChange: (a: ApplicantDraft) => void
}) {
  const set = (patch: Partial<ApplicantDraft>) => onChange({ ...applicant, ...patch })
  const len = applicant.statement.length
  const stmtOk = len >= STATEMENT_MIN && len <= STATEMENT_MAX
  return (
    <section className="mt-8 rounded-xl border border-[#8b22ff]/30 bg-[#8b22ff]/[.05] p-5">
      <h2 className="text-xs uppercase tracking-[0.2em] text-[#b66cff] font-bold mb-1">{t.applicant_title}</h2>
      <p className="text-[11px] text-white/60 mb-4">{t.applicant_hint}</p>
      <div className="space-y-3">
        <label className="block">
          <div className="text-[10px] uppercase tracking-wider text-white/70 mb-1">{t.f_name}</div>
          <input value={applicant.name} onChange={(e) => set({ name: e.target.value })} className={inputCls} />
        </label>
        <label className="block">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-white/70">{t.f_statement}</span>
            <span className={`text-[10px] ${stmtOk ? 'text-[#b66cff]' : len > STATEMENT_MAX ? 'text-[#ff8888]' : 'text-white/50'}`}>
              {len} / {STATEMENT_MIN}–{STATEMENT_MAX}
            </span>
          </div>
          <textarea value={applicant.statement} onChange={(e) => set({ statement: e.target.value })} rows={4} placeholder={t.statement_ph} className={`${inputCls} resize-y`} />
        </label>
        {/* Studio is an in-platform submission -- no external channel URL (that
            field belongs to the /apply YouTube path). Country stays (optional). */}
        <label className="block">
          <div className="text-[10px] uppercase tracking-wider text-white/70 mb-1">{t.f_country}</div>
          <input value={applicant.country} onChange={(e) => set({ country: e.target.value })} className={inputCls} />
        </label>
        <div className="space-y-2 pt-1 text-sm text-white/70">
          <Agree checked={applicant.rules} onChange={(v) => set({ rules: v })} label={t.agree_rules} />
          <Agree checked={applicant.privacy} onChange={(v) => set({ privacy: v })} label={t.agree_privacy} />
          <Agree checked={applicant.integrity} onChange={(v) => set({ integrity: v })} label={t.agree_integrity} />
        </div>
      </div>
    </section>
  )
}

function Agree({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#8b22ff]" />
      <span>{label}</span>
    </label>
  )
}

const STATUS_STYLE: Record<string, string> = {
  queued: 'bg-white/10 text-white/70 border-white/20',
  generating: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  uploading: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  ready: 'bg-[#8b22ff]/15 text-[#b66cff] border-[#8b22ff]/40',
  submitted: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  failed: 'bg-[#ff4444]/15 text-[#ff8888] border-[#ff4444]/30',
}

function JobCard({
  t,
  token,
  job,
  etaSeconds,
  canSubmit,
  needsApplicantInfo,
  applicant,
  onPromote,
  onPreview,
  onChanged,
}: {
  t: Dict
  token: string
  job: StudioJob
  etaSeconds?: number
  canSubmit: boolean
  needsApplicantInfo: boolean
  applicant: ApplicantDraft
  onPromote: (job: StudioJob) => void
  onPreview: (job: StudioJob) => void
  onChanged: () => void | Promise<void>
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const statusLabel: Record<string, string> = {
    queued: t.status_queued,
    generating: t.status_generating,
    uploading: t.status_uploading,
    ready: t.status_ready,
    submitted: t.status_submitted,
    failed: t.status_failed,
  }

  const submitErr = (e: string): string => {
    switch (e) {
      case 'no_application': return t.submit_err_no_application
      case 'already_submitted': return t.submit_err_already
      case 'cryptobind_failed': return t.submit_err_cryptobind
      case 'application_info_required': return t.submit_err_app_info
      case 'name_required': return t.submit_err_name
      case 'bad_statement': return t.submit_err_statement
      case 'agreements_required': return t.submit_err_agreements
      case 'application_closed': return t.submit_err_app_closed
      case 'round_closed': return t.submit_err_round_closed
      case 'compose_required': return t.submit_err_compose_required
      default: return t.submit_err_generic
    }
  }

  const handleSubmit = () => {
    setError(null)
    let info: ApplicantInfo | undefined
    if (needsApplicantInfo) {
      const name = applicant.name.trim()
      const statement = applicant.statement.trim()
      if (!name) return setError(t.submit_err_name)
      if (statement.length < STATEMENT_MIN || statement.length > STATEMENT_MAX) return setError(t.submit_err_statement)
      if (!applicant.rules || !applicant.privacy || !applicant.integrity) return setError(t.submit_err_agreements)
      info = {
        creatorName: name,
        creatorStatement: statement,
        country: applicant.country.trim() || undefined,
        channelUrl: applicant.channelUrl.trim() || undefined,
        agreedRules: applicant.rules,
        agreedPrivacy: applicant.privacy,
        agreedIntegrity: applicant.integrity,
      }
    }
    if (typeof window !== 'undefined' && !window.confirm(t.submit_confirm)) return
    startTransition(async () => {
      const res = await submitGenerationAction(token, job.id, info)
      if (res.ok) await onChanged()
      else setError(submitErr(res.error))
    })
  }

  const handleDelete = () => {
    setError(null)
    if (typeof window !== 'undefined' && !window.confirm(t.delete_confirm)) return
    startTransition(async () => {
      const res = await deleteClipAction(token, job.id)
      if (res.ok) await onChanged()
      else setError(res.error === 'protected' ? t.delete_err_protected : t.delete_err_generic)
    })
  }

  const isDraft = job.tier === 'draft'
  const hasVideo = (job.status === 'ready' || job.status === 'submitted') && !!job.video_url

  return (
    <div className={`flex flex-col overflow-hidden rounded-lg border ${isDraft ? 'border-dashed border-[#8b22ff]/30 bg-[#8b22ff]/[.03]' : 'border-white/10 bg-white/[.02]'}`}>
      {/* Media / status area (16:9). Thumbnails preload metadata only (first frame,
          no controls) so a grid of clips stays light; the full player opens in a
          single modal on click. */}
      <div className="relative aspect-video w-full bg-black">
        {hasVideo ? (
          <button type="button" onClick={() => onPreview(job)} title={job.prompt} className="group block h-full w-full">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={job.video_url!} preload="metadata" muted playsInline className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center text-4xl text-white/0 transition group-hover:bg-black/30 group-hover:text-white/90">▶</span>
          </button>
        ) : job.status === 'failed' ? (
          <div className="flex h-full w-full items-center justify-center p-3 text-center text-[11px] text-[#ff8888]">
            {job.error_message || t.err_generic}
          </div>
        ) : (
          // In-flight: spinner + status + rolling ETA (no samples -> no number).
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-3 text-center">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-[#b66cff]" />
            <span className="text-[10px] uppercase tracking-wider text-white/55">{statusLabel[job.status] ?? job.status}</span>
            {ACTIVE_STATUSES.has(job.status) && etaSeconds !== undefined && (
              <span className="text-[10px] text-white/35">⏱ {t.eta_value(etaSeconds)}</span>
            )}
          </div>
        )}
        <span className={`absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-bold border ${STATUS_STYLE[job.status] ?? STATUS_STYLE.queued}`}>
          {statusLabel[job.status] ?? job.status}
        </span>
        {isDraft && (
          <span className="absolute right-1.5 top-1.5 rounded border border-[#8b22ff]/40 bg-[#8b22ff]/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-bold text-[#d9b8ff]">
            {t.draft_badge}
          </span>
        )}
        {job.duration_seconds ? (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] tabular-nums text-white/80">{job.duration_seconds}s</span>
        ) : null}
      </div>

      {/* Body: prompt summary + compact actions */}
      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 text-xs text-white/75">{job.prompt}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          {job.status === 'ready' && isDraft ? (
            // A draft can never be submitted (server enforces too). Its action is
            // promotion: prefill the generator with this prompt on the competition
            // sibling model -- nothing is charged until Generate.
            <button
              type="button"
              onClick={() => onPromote(job)}
              title={t.draft_no_submit}
              className="rounded-md bg-gradient-to-br from-[#7d23ff] to-[#6220dc] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white transition hover:brightness-110"
            >
              {t.promote}
            </button>
          ) : job.status === 'ready' && canSubmit ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending}
              className="rounded-md border border-[#8b22ff]/50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#b66cff] transition hover:bg-[#8b22ff]/10 disabled:opacity-40"
            >
              {pending ? t.submitting : t.submit}
            </button>
          ) : job.status === 'submitted' ? (
            <span className="text-[11px] font-bold text-emerald-300">✓ {t.submitted_badge}</span>
          ) : (
            <span />
          )}
          {/* A submitted clip is competition record -- no delete affordance. */}
          {job.status !== 'submitted' && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="text-[11px] text-white/40 transition hover:text-[#ff8888] disabled:opacity-40"
            >
              {t.delete}
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-[11px] text-[#ff8888]">{error}</p>}
      </div>
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2 bg-[#0c0a14] border border-white/20 rounded text-sm text-[#ededed] placeholder-white/45 focus:border-[#8b22ff] focus:outline-none'

function Shell({
  t,
  email,
  onLogout,
  hideLogout,
  children,
}: {
  t: Dict
  email?: string
  onLogout: () => void
  hideLogout?: boolean
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen bg-[#030305] text-white flex flex-col">
      <header className="flex h-20 items-center justify-between px-12 max-md:px-6 border-b border-white/10">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/oxxovo_logo.png" alt={t.brand} className="h-12 drop-shadow-[0_0_18px_rgba(139,34,255,.6)]" />
          <span className="text-[22px] font-black tracking-wide text-[#8b22ff]">{t.brand}</span>
        </Link>
        <div className="flex items-center gap-3">
          <LangSwitch />
          {!hideLogout && email && (
            <button
              onClick={onLogout}
              className="rounded-lg border border-white/20 px-5 py-2.5 text-[14px] font-bold text-white/80 transition hover:border-[#8b22ff] hover:text-white"
            >
              {t.log_out}
            </button>
          )}
        </div>
      </header>
      {children}
    </main>
  )
}

function LangSwitch() {
  const lang = useAdminLang()
  const cls = (active: boolean) =>
    `px-2 py-1 text-[11px] transition ${active ? 'text-[#b66cff] font-bold' : 'text-white/40 hover:text-white/70'}`
  const set = (next: Lang) => setAdminLang(next)
  return (
    <div className="flex items-center border border-white/10 rounded overflow-hidden">
      <button type="button" onClick={() => set('ko')} className={cls(lang === 'ko')}>KO</button>
      <span className="text-white/20 text-[11px]">|</span>
      <button type="button" onClick={() => set('en')} className={cls(lang === 'en')}>EN</button>
    </div>
  )
}
