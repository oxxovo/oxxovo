'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAdminLang, setAdminLang, type Lang } from '@/lib/admin-i18n'
import { useLocalToken, clearLocalUser } from '@/lib/use-local-user'
import {
  loadStudioState,
  createGenerationAction,
  pollJobsAction,
  submitGenerationAction,
  getPurchaseOptions,
  type StudioState,
  type PurchaseOptions,
} from './actions'
import { type StudioJob, type ApplicantInfo } from '@/lib/studio'

type ApplicantDraft = {
  name: string
  statement: string
  country: string
  channelUrl: string
  rules: boolean
  privacy: boolean
  integrity: boolean
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
    duration_label: '길이(초)',
    prompt_label: '프롬프트',
    prompt_ph: '생성할 영상을 설명하세요…',
    cost_preview: (c: number) => `예상 차감: ${c} 크레딧`,
    generate: '생성',
    generating: '생성 요청 중…',
    cap_reached: '이번 라운드 생성 횟수를 모두 사용했습니다.',
    insufficient: '크레딧이 부족합니다.',
    err_bad_duration: '선택한 모델의 허용 길이를 벗어났습니다.',
    err_generic: '생성 실패',
    my_gens: '내 생성물',
    empty_gens: '아직 생성한 영상이 없습니다.',
    compose_title: '클립을 하나로 조합해 제출하세요',
    compose_hint: '이번 시즌은 조합 방식입니다. 만든 클립들을 15~30초 완성본으로 이어 붙여 제출하세요.',
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
    duration_label: 'Length (s)',
    prompt_label: 'Prompt',
    prompt_ph: 'Describe the video to generate…',
    cost_preview: (c: number) => `Estimated charge: ${c} credits`,
    generate: 'Generate',
    generating: 'Requesting…',
    cap_reached: 'You have used all generations for this round.',
    insufficient: 'Not enough credits.',
    err_bad_duration: 'Duration is outside the selected model range.',
    err_generic: 'Generation failed',
    my_gens: 'My generations',
    empty_gens: 'No generations yet.',
    compose_title: 'Stitch your clips into one final and submit',
    compose_hint: 'This season is compose-based. Combine your clips into a 15–30s final and submit.',
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
  const [applicant, setApplicant] = useState<ApplicantDraft>({
    name: '', statement: '', country: '', channelUrl: '',
    rules: false, privacy: false, integrity: false,
  })

  useEffect(() => {
    if (!token) return
    let cancelled = false
    loadStudioState(token).then((res) => {
      if (cancelled) return
      if (res.ok) setState(res.data)
      else if (res.error === 'invalid_token') clearLocalUser()
      else setLoadError(res.error)
    })
    return () => {
      cancelled = true
    }
  }, [token])

  // Poll while any job is mid-flight.
  const hasActive = !!state?.jobs.some((j) => ACTIVE_STATUSES.has(j.status))
  useEffect(() => {
    if (!token || !hasActive) return
    const id = setInterval(async () => {
      const res = await pollJobsAction(token)
      if (res.ok) {
        setState((prev) =>
          prev ? { ...prev, jobs: res.jobs, balance: res.balance, generationsUsed: res.generationsUsed } : prev,
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
        prev ? { ...prev, jobs: res.jobs, balance: res.balance, generationsUsed: res.generationsUsed } : prev,
      )
    }
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


        {!state.hasApplication && (
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

        <Generator t={t} token={token} state={state} onCreated={refresh} />

        {needsApplicantInfo && (
          <ApplicantForm t={t} applicant={applicant} onChange={setApplicant} />
        )}

        <Generations
          t={t}
          token={token}
          state={state}
          needsApplicantInfo={needsApplicantInfo}
          applicant={applicant}
          onChanged={async () => {
            // After submit, reload full state (to flip alreadySubmitted) + jobs.
            const res = await loadStudioState(token)
            if (res.ok) setState(res.data)
            else await refresh()
          }}
        />
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
}: {
  t: Dict
  token: string
  state: StudioState
  onCreated: () => void | Promise<void>
}) {
  const [modelId, setModelId] = useState(state.models[0]?.id ?? '')
  const model = state.models.find((m) => m.id === modelId) ?? state.models[0]
  const [duration, setDuration] = useState(model?.min_duration_seconds ?? 4)
  const [prompt, setPrompt] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Clamp duration into the selected model's range when the model changes.
  useEffect(() => {
    if (!model) return
    setDuration((d) => Math.min(Math.max(d, model.min_duration_seconds), model.max_duration_seconds))
  }, [model])

  const credits = model
    ? creditsPreview(model.cost_per_second_usd, duration, state.pricing.marginRate, state.pricing.creditUsdValue)
    : 0
  const capReached = state.generationsUsed >= state.maxGenerations
  const insufficient = credits > state.balance
  const disabled = pending || !model || prompt.trim() === '' || capReached || insufficient || !state.models.length

  const errText = (e: string): string => {
    switch (e) {
      case 'cap_reached': return t.cap_reached
      case 'insufficient_credits': return t.insufficient
      case 'bad_duration': return t.err_bad_duration
      default: return t.err_generic
    }
  }

  const handle = () => {
    setError(null)
    startTransition(async () => {
      const res = await createGenerationAction(token, { modelId, prompt: prompt.trim(), durationSeconds: duration })
      if (res.ok) {
        setPrompt('')
        await onCreated()
      } else {
        setError(errText(res.error))
      }
    })
  }

  return (
    <section className="mt-8 rounded-xl border border-white/10 bg-white/[.02] p-5">
      <h2 className="text-xs uppercase tracking-[0.2em] text-[#b66cff] font-bold mb-4">{t.gen_title}</h2>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="sm:col-span-2 block">
            <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{t.model_label}</div>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className={inputCls}
            >
              {state.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name} · {m.tier}
                </option>
              ))}
            </select>
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
        <label className="block">
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{t.prompt_label}</div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder={t.prompt_ph}
            className={`${inputCls} resize-y`}
          />
        </label>
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
        {capReached && <p className="text-[11px] text-amber-300">{t.cap_reached}</p>}
        {error && <p className="text-[11px] text-[#ff8888]">{error}</p>}
      </div>
    </section>
  )
}

function Generations({
  t,
  token,
  state,
  needsApplicantInfo,
  applicant,
  onChanged,
}: {
  t: Dict
  token: string
  state: StudioState
  needsApplicantInfo: boolean
  applicant: ApplicantDraft
  onChanged: () => void | Promise<void>
}) {
  return (
    <section className="mt-8">
      <h2 className="text-xs uppercase tracking-[0.2em] text-[#b66cff] font-bold mb-3">{t.my_gens}</h2>
      {state.composeEnabled && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[#8b22ff]/30 bg-[#8b22ff]/[.05] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-white">{t.compose_title}</p>
            <p className="mt-1 text-[11px] text-white/50">{t.compose_hint}</p>
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
        <div className="space-y-4">
          {state.jobs.map((job) => (
            <JobCard
              key={job.id}
              t={t}
              token={token}
              job={job}
              canSubmit={!state.alreadySubmitted}
              needsApplicantInfo={needsApplicantInfo}
              applicant={applicant}
              onChanged={onChanged}
            />
          ))}
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
  canSubmit,
  needsApplicantInfo,
  applicant,
  onChanged,
}: {
  t: Dict
  token: string
  job: StudioJob
  canSubmit: boolean
  needsApplicantInfo: boolean
  applicant: ApplicantDraft
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

  return (
    <div className="rounded-lg border border-white/10 bg-white/[.02] p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span
          className={`inline-block px-2.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold border ${
            STATUS_STYLE[job.status] ?? STATUS_STYLE.queued
          }`}
        >
          {statusLabel[job.status] ?? job.status}
        </span>
        <span className="text-[10px] text-white/35">
          {new Date(job.created_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })} · {job.tier} · {job.duration_seconds}s
        </span>
      </div>

      <p className="text-sm text-white/80 mb-3 line-clamp-3">{job.prompt}</p>

      {job.status === 'ready' && job.video_url && (
        <video src={job.video_url} controls className="w-full rounded-lg border border-white/10 mb-3 bg-black" />
      )}
      {job.status === 'submitted' && (
        <>
          {job.video_url && (
            <video src={job.video_url} controls className="w-full rounded-lg border border-white/10 mb-2 bg-black" />
          )}
          <span className="inline-block text-[11px] font-bold text-emerald-300">✓ {t.submitted_badge}</span>
        </>
      )}
      {job.status === 'failed' && job.error_message && (
        <p className="text-[11px] text-[#ff8888]">{job.error_message}</p>
      )}

      {job.status === 'ready' && canSubmit && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="mt-1 px-4 py-2 rounded-lg border border-[#8b22ff]/50 text-[#b66cff] text-xs font-bold uppercase tracking-wider hover:bg-[#8b22ff]/10 transition disabled:opacity-40"
        >
          {pending ? t.submitting : t.submit}
        </button>
      )}
      {error && <p className="mt-2 text-[11px] text-[#ff8888]">{error}</p>}
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
