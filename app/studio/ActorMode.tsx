'use client'

// Stage 3 "AI 배우" mode. A separate top-level mode from the clip generator
// (the mode switcher lives in page.tsx). Three internal steps:
//   ① 배우 만들기  -- t2i character-sheet generation (this file, built)
//   ② 내 배우       -- character library (next step)
//   ③ 샷 촬영       -- i2v multi-shot from a chosen actor (next step)
// Path B: generating "이 배우로 더 만들기" passes referenceImageJobId, so the
// server routes to the model's edit endpoint (character consistency). Clip mode,
// compose, and Watch are untouched -- everything here is additive.

import { useState, useTransition } from 'react'
import { useAdminLang } from '@/lib/admin-i18n'
import { createImageGenerationAction, type StudioState } from './actions'
import { type StudioJob } from '@/lib/studio'

const DICT = {
  ko: {
    heading: 'AI 배우 만들기',
    sub: '배우 얼굴을 생성해 등록하고, 그 배우로 영상 샷을 촬영하세요.',
    step_make: '① 배우 만들기',
    step_library: '② 내 배우',
    step_shots: '③ 샷 촬영',
    soon: '다음 단계에서 배선됩니다.',
    models_pending: '이미지 모델이 아직 활성화되지 않았습니다. 곧 사용할 수 있습니다.',
    model_label: '모델',
    prompt_label: '배우 설명 프롬프트',
    prompt_ph: '예: 20대 중반 동양 여성, 이슬 같은 피부, 왼쪽 눈밑 점, 작은 금 후프 귀걸이, 부드러운 스튜디오 조명',
    tip: '먼저 정면 얼굴 1장을 만든 뒤, 그 얼굴로 "이 배우로 더 만들기"를 눌러 다른 컷을 이어 만드세요.',
    ref_on: '이 배우 기준으로 생성',
    ref_clear: '기준 해제',
    cost: (c: number) => `예상 차감: ${c} 크레딧`,
    used: (u: number, m: number) => `이미지 ${u}/${m}회`,
    generate: '생성',
    generating: '생성 요청 중…',
    cap_reached: '이번 라운드 이미지 생성 횟수를 모두 사용했습니다.',
    insufficient: '크레딧이 부족합니다.',
    balance: '크레딧 잔액',
    results: '생성한 얼굴',
    empty: '아직 만든 얼굴이 없습니다. 위에서 배우를 생성하세요.',
    more_of: '이 배우로 더 만들기',
    ref_badge: '기준 배우',
    st_queued: '대기 중', st_generating: '생성 중', st_uploading: '업로드 중', st_ready: '준비됨', st_failed: '실패',
    err_generic: '생성 실패',
    err_cap: '이번 라운드 이미지 생성 횟수를 모두 사용했습니다.',
    err_insufficient: '크레딧이 부족합니다.',
    err_parent: '기준 배우 이미지를 찾을 수 없습니다. 새로고침 후 다시 시도하세요.',
    err_prompt_long: '프롬프트가 너무 깁니다.',
  },
  en: {
    heading: 'Create an AI actor',
    sub: 'Generate and register an actor face, then shoot video with that actor.',
    step_make: '① Create actor',
    step_library: '② My actors',
    step_shots: '③ Shoot shots',
    soon: 'Wired in the next step.',
    models_pending: 'Image models are not active yet. Available soon.',
    model_label: 'Model',
    prompt_label: 'Actor description prompt',
    prompt_ph: 'e.g. East Asian woman, mid-20s, dewy skin, a beauty mark below the left eye, small gold hoop earrings, soft studio light',
    tip: 'Make one frontal face first, then press "More of this actor" on it to generate more shots that keep the same face.',
    ref_on: 'Generating from this actor',
    ref_clear: 'Clear',
    cost: (c: number) => `Estimated charge: ${c} credits`,
    used: (u: number, m: number) => `Images ${u}/${m}`,
    generate: 'Generate',
    generating: 'Requesting…',
    cap_reached: 'You have used all image generations for this round.',
    insufficient: 'Not enough credits.',
    balance: 'Credit balance',
    results: 'Faces you made',
    empty: 'No faces yet. Generate an actor above.',
    more_of: 'More of this actor',
    ref_badge: 'Reference actor',
    st_queued: 'Queued', st_generating: 'Generating', st_uploading: 'Uploading', st_ready: 'Ready', st_failed: 'Failed',
    err_generic: 'Generation failed',
    err_cap: 'You have used all image generations for this round.',
    err_insufficient: 'Not enough credits.',
    err_parent: 'Reference actor image not found. Refresh and try again.',
    err_prompt_long: 'Prompt is too long.',
  },
}

const inputCls =
  'w-full px-3 py-2 bg-[#0c0a14] border border-white/20 rounded text-sm text-[#ededed] placeholder-white/45 focus:border-[#8b22ff] focus:outline-none'

const ACTIVE = new Set(['queued', 'generating', 'uploading'])

function imageCredits(costUsd: number, marginRate: number, creditUsdValue: number): number {
  // Image jobs have no duration: cost_per_second_usd holds the per-image USD
  // (mirrors createImageGeneration server-side).
  return Math.ceil((costUsd * (1 + marginRate)) / creditUsdValue)
}

export default function ActorMode({
  token,
  state,
  imageJobs,
  onCreated,
}: {
  token: string
  state: StudioState
  imageJobs: StudioJob[]
  onCreated: () => void | Promise<void>
}) {
  const lang = useAdminLang()
  const t = DICT[lang]
  const [step, setStep] = useState<'make' | 'library' | 'shots'>('make')

  return (
    <section className="mt-6">
      <div className="mb-5">
        <h2 className="text-xl font-black text-white">{t.heading}</h2>
        <p className="mt-1 text-sm text-white/50">{t.sub}</p>
      </div>

      {/* Internal step bar. ② ③ are placeholders until their steps ship. */}
      <div className="mb-6 flex flex-wrap gap-2">
        {([
          ['make', t.step_make],
          ['library', t.step_library],
          ['shots', t.step_shots],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setStep(id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition ${
              step === id
                ? 'border-[#8b22ff] bg-gradient-to-br from-[#7d23ff]/30 to-[#6220dc]/30 text-white'
                : 'border-white/15 text-white/55 hover:border-[#8b22ff]/50 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {step === 'make' ? (
        <MakeActor t={t} token={token} state={state} imageJobs={imageJobs} onCreated={onCreated} />
      ) : (
        <div className="rounded-xl border border-dashed border-white/15 bg-white/[.02] px-6 py-12 text-center text-sm text-white/40">
          {(step === 'library' ? t.step_library : t.step_shots)} — {t.soon}
        </div>
      )}
    </section>
  )
}

function MakeActor({
  t,
  token,
  state,
  imageJobs,
  onCreated,
}: {
  t: (typeof DICT)['en']
  token: string
  state: StudioState
  imageJobs: StudioJob[]
  onCreated: () => void | Promise<void>
}) {
  const models = state.imageModels
  const [modelId, setModelId] = useState(models[0]?.id ?? '')
  const model = models.find((m) => m.id === modelId) ?? models[0]
  const [prompt, setPrompt] = useState('')
  // Path B: when set, the next generation runs on the model's edit endpoint with
  // this OWN ready image as the reference (character consistency).
  const [refJobId, setRefJobId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const credits = model
    ? imageCredits(model.cost_per_second_usd, state.pricing.marginRate, state.pricing.creditUsdValue)
    : 0
  const capReached = state.imageGenerationsUsed >= state.maxImageGenerations
  const insufficient = credits > state.balance
  const disabled = pending || !model || prompt.trim() === '' || capReached || insufficient

  const refJob = refJobId ? imageJobs.find((j) => j.id === refJobId) ?? null : null

  const errText = (e: string): string => {
    switch (e) {
      case 'cap_reached': return t.err_cap
      case 'insufficient_credits': return t.err_insufficient
      case 'parent_not_found':
      case 'parent_not_ready':
      case 'parent_not_image': return t.err_parent
      case 'prompt_too_long': return t.err_prompt_long
      default: return t.err_generic
    }
  }

  const handle = () => {
    setError(null)
    startTransition(async () => {
      const res = await createImageGenerationAction(token, {
        modelId,
        prompt: prompt.trim(),
        ...(refJobId ? { referenceImageJobId: refJobId } : {}),
      })
      if (res.ok) {
        setPrompt('')
        await onCreated()
      } else {
        setError(errText(res.error))
      }
    })
  }

  if (models.length === 0) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-6 text-sm text-amber-200">
        {t.models_pending}
      </div>
    )
  }

  const statusLabel: Record<string, string> = {
    queued: t.st_queued, generating: t.st_generating, uploading: t.st_uploading, ready: t.st_ready, failed: t.st_failed,
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-white/10 bg-white/[.02] p-5">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{t.model_label}</div>
              <select value={modelId} onChange={(e) => setModelId(e.target.value)} className={inputCls}>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}{m.tierLabel ? ` · ${m.tierLabel}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <div className="text-xs text-white/50">
                {t.balance}: <span className="font-bold text-[#b66cff]">{state.balance}</span>
                <span className="mx-2 text-white/20">|</span>
                {t.used(state.imageGenerationsUsed, state.maxImageGenerations)}
              </div>
            </div>
          </div>

          {refJob && (
            <div className="flex items-center gap-3 rounded-lg border border-[#8b22ff]/40 bg-[#8b22ff]/10 px-3 py-2">
              {refJob.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={refJob.image_url} alt={t.ref_badge} className="h-10 w-10 rounded object-cover border border-white/15" />
              )}
              <span className="text-xs font-bold text-[#d9b8ff]">{t.ref_on}</span>
              <button
                type="button"
                onClick={() => setRefJobId(null)}
                className="ml-auto text-[11px] text-white/50 hover:text-white transition"
              >
                {t.ref_clear} ×
              </button>
            </div>
          )}

          <label className="block">
            <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{t.prompt_label}</div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              maxLength={model?.promptMax ?? undefined}
              placeholder={t.prompt_ph}
              className={`${inputCls} resize-y`}
            />
          </label>

          <p className="text-[11px] leading-relaxed text-white/45">💡 {t.tip}</p>

          <div className="flex items-center justify-between gap-3">
            <span className={`text-xs ${insufficient ? 'text-[#ff8888]' : 'text-white/50'}`}>{t.cost(credits)}</span>
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

      <section>
        <h3 className="text-xs uppercase tracking-[0.2em] text-[#b66cff] font-bold mb-3">{t.results}</h3>
        {imageJobs.length === 0 ? (
          <p className="text-xs text-white/40 py-6 text-center">{t.empty}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {imageJobs.map((job) => (
              <figure key={job.id} className="rounded-lg border border-white/10 bg-white/[.02] overflow-hidden">
                <div className="relative aspect-[3/4] bg-black">
                  {job.status === 'ready' && job.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={job.image_url} alt={job.prompt} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${job.status === 'failed' ? 'text-[#ff8888]' : 'text-white/50'}`}>
                        {statusLabel[job.status] ?? job.status}
                        {ACTIVE.has(job.status) ? '…' : ''}
                      </span>
                    </div>
                  )}
                  {job.user_params?.image_ref && (
                    <span className="absolute top-1.5 left-1.5 rounded bg-[#8b22ff]/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                      {t.ref_badge}
                    </span>
                  )}
                </div>
                <figcaption className="p-2">
                  <p className="line-clamp-2 text-[11px] text-white/55">{job.prompt}</p>
                  {job.status === 'ready' && (
                    <button
                      type="button"
                      onClick={() => {
                        setRefJobId(job.id)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      className="mt-1.5 w-full rounded border border-[#8b22ff]/40 px-2 py-1 text-[10px] font-bold text-[#b66cff] hover:bg-[#8b22ff]/10 transition"
                    >
                      {t.more_of}
                    </button>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
