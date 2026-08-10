'use client'

// Stage 3 "AI 배우" mode. A separate top-level mode from the clip generator
// (the mode switcher lives in page.tsx). Three internal steps:
//   ① 배우 만들기  -- t2i character-sheet generation
//   ② 내 배우       -- character library (register from ready images / delete)
//   ③ 샷 촬영       -- i2v multi-shot from a chosen actor (Kling multi_prompt)
// Path B: generating "이 배우로 더 만들기" passes referenceImageJobId, so the
// server routes to the model's edit endpoint (character consistency). i2v output
// clips flow into the shared clip list + compose automatically (2.4 wiring). Clip
// mode, compose, and Watch are untouched -- everything here is additive.

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useAdminLang } from '@/lib/admin-i18n'
import {
  createImageGenerationAction,
  createI2vGenerationAction,
  listCharactersAction,
  createCharacterAction,
  deleteCharacterAction,
  type StudioState,
} from './actions'
import { type StudioJob, type StudioCharacter } from '@/lib/studio'
import { STUDIO_ACTOR_EXAMPLES } from '@/lib/studio-actors'

const DICT = {
  ko: {
    heading: 'AI 배우 만들기',
    sub: '배우 얼굴을 생성해 등록하고, 그 배우로 영상 샷을 촬영하세요.',
    step_make: '① 배우 만들기',
    step_library: '② 내 배우',
    step_shots: '③ 샷 촬영',
    // ① make
    models_pending: '이미지 모델이 아직 활성화되지 않았습니다. 곧 사용할 수 있습니다.',
    model_label: '모델',
    prompt_label: '배우 설명 프롬프트',
    prompt_ph: '예: 20대 중반 동양 여성, 이슬 같은 피부, 왼쪽 눈밑 점, 작은 금 후프 귀걸이, 부드러운 스튜디오 조명',
    tip: '먼저 정면 얼굴 1장을 만든 뒤, 그 얼굴로 "이 배우로 더 만들기"를 눌러 다른 컷을 이어 만드세요.',
    ref_on: '이 배우 기준으로 생성',
    ref_clear: '기준 해제',
    cost: (c: number) => `예상 차감: ${c} 크레딧`,
    used_img: (u: number, m: number) => `이미지 ${u}/${m}회`,
    generate: '생성',
    generating: '생성 요청 중…',
    cap_reached: '이번 라운드 이미지 생성 횟수를 모두 사용했습니다.',
    balance: '크레딧 잔액',
    results: '생성한 얼굴',
    empty_faces: '아직 만든 얼굴이 없습니다. 위에서 배우를 생성하세요.',
    more_of: '이 배우로 더 만들기',
    ref_badge: '기준 배우',
    // ② library
    lib_register: '배우 등록',
    lib_hint: '만든 얼굴 중 정면 1장을 고르고 이름을 붙여 배우로 등록하세요. 다른 각도 컷을 참조로 추가하면 영상에서 얼굴 일관성이 좋아집니다.',
    lib_no_ready: '먼저 ① 배우 만들기에서 얼굴을 생성하세요. 준비된 얼굴만 등록할 수 있습니다.',
    pick_frontal: '정면 (필수)',
    pick_refs: '추가 참조 컷 (선택)',
    name_label: '배우 이름',
    // Example names come from the single actor roster (lib/studio-actors.ts) so a
    // clearance rename is a one-line swap. KIRA/ANNA/RIN are OXXOVO's own
    // showcase actors, shown here only as naming examples.
    name_ph: `예: ${STUDIO_ACTOR_EXAMPLES}`,
    register_btn: '이 배우 등록',
    registering: '등록 중…',
    my_actors: '내 배우',
    no_actors: '아직 등록한 배우가 없습니다.',
    ref_count: (n: number) => `참조 ${n}장`,
    delete: '삭제',
    delete_confirm: '이 배우를 삭제할까요? (만든 이미지는 남습니다)',
    err_name: '배우 이름을 입력하세요.',
    err_frontal: '정면 이미지를 선택하세요.',
    err_register: '등록 실패',
    // ③ shots
    shots_pick_actor: '배우 선택',
    shots_no_actor: '먼저 ② 내 배우에서 배우를 등록하세요.',
    shots_model: 'i2v 모델',
    shots_model_pending: 'i2v 모델이 아직 활성화되지 않았습니다.',
    shots_title: '샷 스토리보드',
    shots_hint: (max: number) => `한 번의 생성으로 같은 배우의 멀티샷 영상이 나옵니다. 샷 최대 6개, 길이 합 최대 ${max}초.`,
    shot_n: (n: number) => `샷 ${n}`,
    shot_prompt_ph: '이 샷에서 배우가 하는 동작·장면을 묘사',
    shot_len: '길이(초)',
    add_shot: '+ 샷 추가',
    remove: '제거',
    total_len: (s: number, max: number) => `길이 합계 ${s}/${max}초`,
    shoot: '영상 생성',
    shooting: '생성 요청 중…',
    shot_done: '영상 생성을 시작했습니다 — "클립 생성" 탭과 조합에서 확인하세요.',
    err_shots: '샷 프롬프트를 확인하세요.',
    err_duration: '길이 합계가 모델 허용 범위를 벗어났습니다.',
    err_i2v: '영상 생성 실패',
    err_insufficient: '크레딧이 부족합니다.',
    err_generic: '생성 실패',
    // status
    st_queued: '대기 중', st_generating: '생성 중', st_uploading: '업로드 중', st_ready: '준비됨', st_failed: '실패',
  },
  en: {
    heading: 'Create an AI actor',
    sub: 'Generate and register an actor face, then shoot video with that actor.',
    step_make: '① Create actor',
    step_library: '② My actors',
    step_shots: '③ Shoot shots',
    models_pending: 'Image models are not active yet. Available soon.',
    model_label: 'Model',
    prompt_label: 'Actor description prompt',
    prompt_ph: 'e.g. East Asian woman, mid-20s, dewy skin, a beauty mark below the left eye, small gold hoop earrings, soft studio light',
    tip: 'Make one frontal face first, then press "More of this actor" on it to generate more shots that keep the same face.',
    ref_on: 'Generating from this actor',
    ref_clear: 'Clear',
    cost: (c: number) => `Estimated charge: ${c} credits`,
    used_img: (u: number, m: number) => `Images ${u}/${m}`,
    generate: 'Generate',
    generating: 'Requesting…',
    cap_reached: 'You have used all image generations for this round.',
    balance: 'Credit balance',
    results: 'Faces you made',
    empty_faces: 'No faces yet. Generate an actor above.',
    more_of: 'More of this actor',
    ref_badge: 'Reference actor',
    lib_register: 'Register actor',
    lib_hint: 'Pick one frontal face, name it, and register it as an actor. Adding other angles as references improves face consistency in video.',
    lib_no_ready: 'Generate a face in ① Create actor first. Only ready faces can be registered.',
    pick_frontal: 'Frontal (required)',
    pick_refs: 'Extra reference shots (optional)',
    name_label: 'Actor name',
    name_ph: `e.g. ${STUDIO_ACTOR_EXAMPLES}`,
    register_btn: 'Register this actor',
    registering: 'Registering…',
    my_actors: 'My actors',
    no_actors: 'No actors registered yet.',
    ref_count: (n: number) => `${n} refs`,
    delete: 'Delete',
    delete_confirm: 'Delete this actor? (Your images are kept.)',
    err_name: 'Enter an actor name.',
    err_frontal: 'Select a frontal image.',
    err_register: 'Registration failed',
    shots_pick_actor: 'Choose actor',
    shots_no_actor: 'Register an actor in ② My actors first.',
    shots_model: 'i2v model',
    shots_model_pending: 'i2v model is not active yet.',
    shots_title: 'Shot storyboard',
    shots_hint: (max: number) => `One generation yields a multi-shot video of the same actor. Up to 6 shots, ${max}s total.`,
    shot_n: (n: number) => `Shot ${n}`,
    shot_prompt_ph: 'Describe the action / scene in this shot',
    shot_len: 'Length (s)',
    add_shot: '+ Add shot',
    remove: 'Remove',
    total_len: (s: number, max: number) => `Total ${s}/${max}s`,
    shoot: 'Generate video',
    shooting: 'Requesting…',
    shot_done: 'Video generation started — check the "Clip generator" tab and Compose.',
    err_shots: 'Check your shot prompts.',
    err_duration: 'Total length is outside the model range.',
    err_i2v: 'Video generation failed',
    err_insufficient: 'Not enough credits.',
    err_generic: 'Generation failed',
    st_queued: 'Queued', st_generating: 'Generating', st_uploading: 'Uploading', st_ready: 'Ready', st_failed: 'Failed',
  },
}
type Dict = (typeof DICT)['en']

const inputCls =
  'w-full px-3 py-2 bg-[#0c0a14] border border-white/20 rounded text-sm text-[#ededed] placeholder-white/45 focus:border-[#8b22ff] focus:outline-none'

const ACTIVE = new Set(['queued', 'generating', 'uploading'])

function creditsFor(costUsd: number, marginRate: number, creditUsdValue: number): number {
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
  const [characters, setCharacters] = useState<StudioCharacter[]>([])

  const reloadCharacters = useCallback(async () => {
    const res = await listCharactersAction(token)
    if (res.ok) setCharacters(res.characters)
  }, [token])

  useEffect(() => {
    void reloadCharacters()
  }, [reloadCharacters])

  return (
    <section className="mt-6">
      <div className="mb-5">
        <h2 className="text-xl font-black text-white">{t.heading}</h2>
        <p className="mt-1 text-sm text-white/50">{t.sub}</p>
      </div>

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
            {id === 'library' && characters.length > 0 ? ` (${characters.length})` : ''}
          </button>
        ))}
      </div>

      {step === 'make' && <MakeActor t={t} token={token} state={state} imageJobs={imageJobs} onCreated={onCreated} />}
      {step === 'library' && (
        <Library t={t} token={token} imageJobs={imageJobs} characters={characters} onChanged={reloadCharacters} />
      )}
      {step === 'shots' && (
        <Shots t={t} token={token} state={state} characters={characters} onCreated={onCreated} />
      )}
    </section>
  )
}

// ------------------------------------------------------------------ ① make
function MakeActor({
  t,
  token,
  state,
  imageJobs,
  onCreated,
}: {
  t: Dict
  token: string
  state: StudioState
  imageJobs: StudioJob[]
  onCreated: () => void | Promise<void>
}) {
  const models = state.imageModels
  const [modelId, setModelId] = useState(models[0]?.id ?? '')
  const model = models.find((m) => m.id === modelId) ?? models[0]
  const [prompt, setPrompt] = useState('')
  const [refJobId, setRefJobId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const credits = model ? creditsFor(model.cost_per_second_usd, state.pricing.marginRate, state.pricing.creditUsdValue) : 0
  const capReached = state.imageGenerationsUsed >= state.maxImageGenerations
  const insufficient = credits > state.balance
  const disabled = pending || !model || prompt.trim() === '' || capReached || insufficient
  const refJob = refJobId ? imageJobs.find((j) => j.id === refJobId) ?? null : null

  const errText = (e: string): string => {
    switch (e) {
      case 'cap_reached': return t.cap_reached
      case 'insufficient_credits': return t.err_insufficient
      case 'parent_not_found':
      case 'parent_not_ready':
      case 'parent_not_image': return t.err_generic
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
                {t.used_img(state.imageGenerationsUsed, state.maxImageGenerations)}
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
              <button type="button" onClick={() => setRefJobId(null)} className="ml-auto text-[11px] text-white/50 hover:text-white transition">
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
          <p className="text-xs text-white/40 py-6 text-center">{t.empty_faces}</p>
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
                        {statusLabel[job.status] ?? job.status}{ACTIVE.has(job.status) ? '…' : ''}
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
                      onClick={() => { setRefJobId(job.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
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

// --------------------------------------------------------------- ② library
function Library({
  t,
  token,
  imageJobs,
  characters,
  onChanged,
}: {
  t: Dict
  token: string
  imageJobs: StudioJob[]
  characters: StudioCharacter[]
  onChanged: () => void | Promise<void>
}) {
  const ready = imageJobs.filter((j) => j.status === 'ready' && j.image_url)
  const [frontalId, setFrontalId] = useState<string | null>(null)
  const [refIds, setRefIds] = useState<string[]>([])
  const [name, setName] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const toggleRef = (id: string) =>
    setRefIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  const pickFrontal = (id: string) => {
    setFrontalId(id)
    setRefIds((cur) => cur.filter((x) => x !== id)) // frontal can't also be a ref
  }

  const register = () => {
    setError(null)
    if (!name.trim()) return setError(t.err_name)
    if (!frontalId) return setError(t.err_frontal)
    startTransition(async () => {
      const res = await createCharacterAction(token, {
        name: name.trim(),
        frontalImageJobId: frontalId,
        referenceImageJobIds: refIds,
      })
      if (res.ok) {
        setName(''); setFrontalId(null); setRefIds([])
        await onChanged()
      } else {
        setError(t.err_register)
      }
    })
  }

  const remove = (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm(t.delete_confirm)) return
    startTransition(async () => {
      await deleteCharacterAction(token, id)
      await onChanged()
    })
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-white/10 bg-white/[.02] p-5">
        <h3 className="text-xs uppercase tracking-[0.2em] text-[#b66cff] font-bold mb-1">{t.lib_register}</h3>
        <p className="text-[11px] text-white/50 mb-4">{t.lib_hint}</p>

        {ready.length === 0 ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{t.lib_no_ready}</p>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">{t.pick_frontal}</div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {ready.map((j) => (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => pickFrontal(j.id)}
                    className={`relative aspect-[3/4] overflow-hidden rounded-lg border-2 transition ${
                      frontalId === j.id ? 'border-[#8b22ff]' : 'border-white/10 hover:border-white/30'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={j.image_url as string} alt="" className="h-full w-full object-cover" />
                    {frontalId === j.id && (
                      <span className="absolute inset-x-0 bottom-0 bg-[#8b22ff] py-0.5 text-center text-[9px] font-bold text-white">정면</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {frontalId && ready.length > 1 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">{t.pick_refs}</div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {ready.filter((j) => j.id !== frontalId).map((j) => (
                    <button
                      key={j.id}
                      type="button"
                      onClick={() => toggleRef(j.id)}
                      className={`relative aspect-[3/4] overflow-hidden rounded-lg border-2 transition ${
                        refIds.includes(j.id) ? 'border-[#b66cff]' : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={j.image_url as string} alt="" className={`h-full w-full object-cover ${refIds.includes(j.id) ? '' : 'opacity-70'}`} />
                      {refIds.includes(j.id) && (
                        <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#b66cff] text-[9px] font-bold text-white">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="block flex-1">
                <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{t.name_label}</div>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={t.name_ph} className={inputCls} />
              </label>
              <button
                type="button"
                onClick={register}
                disabled={pending || !frontalId || !name.trim()}
                className="shrink-0 rounded-lg bg-gradient-to-br from-[#7d23ff] to-[#6220dc] px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {pending ? t.registering : t.register_btn}
              </button>
            </div>
            {error && <p className="text-[11px] text-[#ff8888]">{error}</p>}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-[0.2em] text-[#b66cff] font-bold mb-3">{t.my_actors}</h3>
        {characters.length === 0 ? (
          <p className="text-xs text-white/40 py-6 text-center">{t.no_actors}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {characters.map((c) => (
              <div key={c.id} className="rounded-lg border border-white/10 bg-white/[.02] overflow-hidden">
                <div className="aspect-[3/4] bg-black">
                  {c.frontalImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.frontalImageUrl} alt={c.name} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="p-2.5">
                  <p className="truncate text-sm font-bold text-white">{c.name || '—'}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[10px] text-white/40">{t.ref_count(c.referenceImageUrls.length)}</span>
                    <button type="button" onClick={() => remove(c.id)} className="text-[10px] text-white/40 hover:text-[#ff8888] transition">
                      {t.delete}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ------------------------------------------------------------------ ③ shots
type ShotDraft = { prompt: string; durationSeconds: number }

function Shots({
  t,
  token,
  state,
  characters,
  onCreated,
}: {
  t: Dict
  token: string
  state: StudioState
  characters: StudioCharacter[]
  onCreated: () => void | Promise<void>
}) {
  const models = state.models.filter((m) => m.acceptsI2v)
  const [characterId, setCharacterId] = useState(characters[0]?.id ?? '')
  const [modelId, setModelId] = useState(models[0]?.id ?? '')
  const model = models.find((m) => m.id === modelId) ?? models[0]
  const maxTotal = model?.max_duration_seconds ?? 15
  const [shots, setShots] = useState<ShotDraft[]>([{ prompt: '', durationSeconds: 5 }])
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Keep the selectors valid as the underlying lists arrive/change.
  useEffect(() => {
    if (characters.length && !characters.some((c) => c.id === characterId)) setCharacterId(characters[0].id)
  }, [characters, characterId])
  useEffect(() => {
    if (models.length && !models.some((m) => m.id === modelId)) setModelId(models[0].id)
  }, [models, modelId])

  const total = shots.reduce((a, s) => a + (Number(s.durationSeconds) || 0), 0)
  const credits = model ? creditsFor(model.cost_per_second_usd * total, state.pricing.marginRate, state.pricing.creditUsdValue) : 0
  const durationOk = model ? total >= model.min_duration_seconds && total <= model.max_duration_seconds : false
  const promptsOk = shots.every((s) => s.prompt.trim() !== '')
  const disabled = pending || !model || !characterId || !promptsOk || !durationOk || credits > state.balance

  const setShot = (i: number, patch: Partial<ShotDraft>) =>
    setShots((cur) => cur.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  const addShot = () => setShots((cur) => (cur.length >= 6 ? cur : [...cur, { prompt: '', durationSeconds: 5 }]))
  const removeShot = (i: number) => setShots((cur) => (cur.length <= 1 ? cur : cur.filter((_, idx) => idx !== i)))

  const errText = (e: string): string => {
    switch (e) {
      case 'bad_shots': return t.err_shots
      case 'bad_duration': return t.err_duration
      case 'insufficient_credits': return t.err_insufficient
      case 'cap_reached': return t.cap_reached
      default: return t.err_i2v
    }
  }

  const shoot = () => {
    setError(null); setDone(false)
    startTransition(async () => {
      const res = await createI2vGenerationAction(token, {
        modelId,
        characterId,
        shots: shots.map((s) => ({ prompt: s.prompt.trim(), durationSeconds: Number(s.durationSeconds) })),
      })
      if (res.ok) {
        setShots([{ prompt: '', durationSeconds: 5 }])
        setDone(true)
        await onCreated()
      } else {
        setError(errText(res.error))
      }
    })
  }

  if (characters.length === 0) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-6 text-sm text-amber-200">{t.shots_no_actor}</div>
    )
  }
  if (models.length === 0) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-6 text-sm text-amber-200">{t.shots_model_pending}</div>
    )
  }

  return (
    <section className="rounded-xl border border-white/10 bg-white/[.02] p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{t.shots_pick_actor}</div>
          <select value={characterId} onChange={(e) => setCharacterId(e.target.value)} className={inputCls}>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>{c.name || '—'} · {t.ref_count(c.referenceImageUrls.length)}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{t.shots_model}</div>
          <select value={modelId} onChange={(e) => setModelId(e.target.value)} className={inputCls}>
            {models.map((m) => (<option key={m.id} value={m.id}>{m.display_name}</option>))}
          </select>
        </label>
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-white/40">{t.shots_title}</span>
          <span className={`text-[10px] ${durationOk ? 'text-white/45' : 'text-[#ff8888]'}`}>{t.total_len(total, maxTotal)}</span>
        </div>
        <p className="mb-3 text-[11px] leading-relaxed text-white/45">🎬 {t.shots_hint(maxTotal)}</p>
        <div className="space-y-2">
          {shots.map((s, i) => (
            <div key={i} className="flex gap-2">
              <div className="mt-2 w-10 shrink-0 text-[11px] font-bold text-[#b66cff]">{t.shot_n(i + 1)}</div>
              <textarea
                value={s.prompt}
                onChange={(e) => setShot(i, { prompt: e.target.value })}
                rows={2}
                placeholder={t.shot_prompt_ph}
                className={`${inputCls} resize-y flex-1`}
              />
              <div className="w-20 shrink-0">
                <input
                  type="number"
                  min={1}
                  max={maxTotal}
                  value={s.durationSeconds}
                  onChange={(e) => setShot(i, { durationSeconds: Number(e.target.value) })}
                  className={inputCls}
                  aria-label={t.shot_len}
                />
                {shots.length > 1 && (
                  <button type="button" onClick={() => removeShot(i)} className="mt-1 w-full text-[10px] text-white/40 hover:text-[#ff8888] transition">
                    {t.remove}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {shots.length < 6 && (
          <button type="button" onClick={addShot} className="mt-2 rounded-lg border border-white/15 px-3 py-1.5 text-[11px] font-bold text-white/60 hover:border-[#8b22ff]/50 hover:text-white transition">
            {t.add_shot}
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
        <span className={`text-xs ${credits > state.balance ? 'text-[#ff8888]' : 'text-white/50'}`}>{t.cost(credits)}</span>
        <button
          type="button"
          onClick={shoot}
          disabled={disabled}
          className="px-5 py-2.5 rounded-lg bg-gradient-to-br from-[#7d23ff] to-[#6220dc] text-white text-sm font-bold hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? t.shooting : t.shoot}
        </button>
      </div>
      {done && <p className="text-[11px] text-emerald-300">✓ {t.shot_done}</p>}
      {error && <p className="text-[11px] text-[#ff8888]">{error}</p>}
    </section>
  )
}
