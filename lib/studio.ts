// Studio domain logic -- SERVER ONLY. Generation enqueue (with credit charge +
// CryptoBind generation-time signature) and submission (CryptoBind verify +
// immutable write into genesis_applications). All state transitions are
// server-authoritative; the worker (oxxovo-studio) advances the job through the
// 6-stage machine and produces the artifact.

import 'server-only'
import { randomUUID } from 'crypto'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getBalance, getStudioPricing, creditsForCostOrNull, isSellableCost } from '@/lib/credits'
import { moderateSubmission } from '@/lib/moderation'
import { getCreatorProfile, upsertCreatorProfile } from '@/lib/profile'
import { getDisplayName } from '@/lib/nickname'
import {
  buildCryptoBind,
  verifyCryptoBind,
  buildComposeRequestBind,
  verifyComposeBind,
  buildImageBind,
  buildI2vBind,
  computeSourceBundle,
  verifyMusicAssetBind,
  CRYPTOBIND_ALGO,
  type EdlSegment,
  type ComposeEdl,
  type MusicBed,
} from '@/lib/cryptobind'
import { verifySourceClipCrypto } from '@/lib/studio-verify'
import { validateTexts, parseTrademarkBlocklist, findBlockedTrademark, type TextReason } from '@/lib/text-limits'
import { validateMusicBed, type MusicReason } from '@/lib/music-limits'
import { isOwnedBy } from '@/lib/studio-sweep-scope'
import { isMusicEnabled } from '@/lib/music-gate'

// Re-export so callers (server actions, the editor) get the EDL segment type
// from the studio module alongside createRender, without importing the
// server-only cryptobind module directly.
export type { EdlSegment, ComposeEdl } from '@/lib/cryptobind'
import {
  getSeasonById,
  getActiveApplicationCount,
  isApplicationClosed,
  isCapacityFull,
  canSubmitMainRound,
} from '@/lib/seasons'

import {
  assemblePresetPrompt,
  type StudioParamRule,
  type StudioPreset,
  type StudioPresetGroup,
} from '@/lib/studio-shared'

export type { StudioParamRule, StudioPreset, StudioPresetGroup } from '@/lib/studio-shared'
export { assemblePresetPrompt } from '@/lib/studio-shared'

// 'draft' = Sandbox tier (연습장): cheap low-res practice generations with their
// own per-round cap, watermarked by the worker, and blocked from EVERY
// submission path (submitGeneration + createRender sources) -- fairness rule.
export type StudioTier = 'draft' | 'budget' | 'standard' | 'premium'

export type StudioModel = {
  id: string
  tier: StudioTier
  display_name: string
  cost_per_second_usd: number
  min_duration_seconds: number
  max_duration_seconds: number
  // Whether the model produces native audio. false for silent models (Hailuo 02
  // Pro / Video-01 Director) so the picker can flag them -- a silent clip plays
  // silent for its span in a composition (render.ts Plan C fills silence).
  hasAudio: boolean
  // Max prompt length the fal model accepts (from metadata.prompt_max, measured
  // per-model). null = unknown/unspecified (e.g. Seedance) -> the UI shows a
  // char counter + caution but does NOT hard-cap (never fabricate a limit).
  promptMax: number | null
  // 'bracket' -> preset [tags] prefix the prompt (Hailuo/Director, measured).
  // null -> natural-language description only.
  promptStyle: 'bracket' | null
  // Participant-tunable fal params (measured per model). null = none -> the
  // advanced panel does not render for this model.
  paramWhitelist: Record<string, StudioParamRule> | null
  // Draft models only: the competition sibling this draft promotes to
  // ("이 프롬프트로 최종 렌더" prefills the form with this model).
  promotesTo: string | null
  // Native output resolution label ('720p', '480p', ...) for the draft badge.
  resolutionLabel: string | null
  // Stage 3: participant-facing positioning shown on the image-model selector
  // ('premium' -> 고품질 / 'value' -> 가성비). null = no label. Data, from metadata.
  tierLabel: string | null
  // Stage 3 i2v: video model that accepts a start image + elements (Kling i2v),
  // i.e. it can shoot shots from an AI actor. false for plain t2v models.
  acceptsI2v: boolean
  // Stage 3: 'video' (default) or 'image' (t2i character sheet model). The video
  // model picker filters to 'video'; image gen loads 'image' models.
  mediaType: 'video' | 'image'
}

export type StudioJob = {
  id: string
  status: 'queued' | 'generating' | 'uploading' | 'ready' | 'submitted' | 'failed'
  tier: string
  model_id: string
  prompt: string
  duration_seconds: number
  video_url: string | null
  error_message: string | null
  submitted_at: string | null
  created_at: string
  // Stage 3: 'video' (t2v / i2v) or 'image' (t2i character sheet). NOT NULL
  // DEFAULT 'video' in the DB, so legacy rows read as video. The AI-actor mode
  // lists image jobs; the clip/compose paths list video jobs.
  media_type: 'video' | 'image'
  image_url: string | null
  // What the participant picked (preset/advanced + the RAW pre-assembly prompt).
  // Feeds the draft "이 프롬프트로 최종 렌더" form prefill. NULL on legacy rows.
  user_params: {
    user_prompt?: string
    preset_id?: string
    advanced?: Record<string, unknown>
    // Path B: R2 url of the OWN reference image this shot was generated from
    // (character consistency). Set by createImageGeneration, read by the worker.
    image_ref?: string
  } | null
}

export type StudioRoundSetting = 'application' | 'main' | 'both'
// 2-stage tournament: preliminary(application) -> main round (본선) -> 1/2/3.
// There is no separate final (결승) stage.
export type EffectiveRound = 'application' | 'main'

export type SeasonStudioConfig = {
  round: StudioRoundSetting
  maxGenerationsPerRound: number
  // Sandbox(draft) cap -- counted SEPARATELY from the competition cap above.
  // Draft generations never consume competition slots and vice versa.
  maxDraftGenerationsPerRound: number
  // Stage 3: per-round IMAGE (t2i character sheet) caps, counted separately from
  // the video caps (media_type='image'). Draft image tier has its own cap.
  maxImageGenerationsPerRound: number
  maxDraftImageGenerationsPerRound: number
  mainRoundStartAt: string | null
  // S-3: main-round submission window = mainRoundStartAt + submissionHours.
  submissionHours: number
  // S-7: per-round video-length bounds (seconds). The generation duration must
  // fall within the bounds of the round it belongs to, not just the model's.
  // NOTE: in compose mode a generation is a building-block CLIP whose final
  // length is governed by studio_compose_* on the composed render, so S-7 is
  // SKIPPED when studioComposeEnabled (see createGeneration).
  applicationVideoMinSeconds: number
  applicationVideoMaxSeconds: number
  mainRoundVideoMinSeconds: number
  mainRoundVideoMaxSeconds: number
  // Compose on? When true, clip generation is gated by model-native bounds only.
  studioComposeEnabled: boolean
  // Length bounds of the FINAL composed render (not of a clip). The authority is
  // createRender/submitRender, which re-read these columns; these copies exist so
  // the UI can STATE the rule without hardcoding it. 0 = unset -> caller decides.
  studioComposeMinSeconds: number
  studioComposeMaxSeconds: number
  // Fairness hold: when true, a prelim submission is held off /watch until the
  // cohort is released together (anti-copy). Visibility only -- never scoring.
  prelimHoldEnabled: boolean
}

// Per-round video-length bounds, resolved from the season config. Application
// round uses application_video_*; main round uses main_round_video_*.
export function videoBoundsForRound(
  cfg: SeasonStudioConfig,
  round: EffectiveRound,
): { min: number; max: number } {
  if (round === 'main') {
    return { min: cfg.mainRoundVideoMinSeconds, max: cfg.mainRoundVideoMaxSeconds }
  }
  // application round uses application_video_* (single source -- 15..30s).
  return { min: cfg.applicationVideoMinSeconds, max: cfg.applicationVideoMaxSeconds }
}

// S-3: the absolute submission deadline for the main round (ms epoch), or null
// when the season has no main_round_start_at yet. After this instant a main-
// round studio submission is refused.
export function mainRoundDeadlineMs(cfg: SeasonStudioConfig): number | null {
  if (!cfg.mainRoundStartAt) return null
  return new Date(cfg.mainRoundStartAt).getTime() + cfg.submissionHours * 3_600_000
}

// Server-authoritative round resolution. For a fixed-round season the setting IS
// the effective round. For 'both', the schedule decides: before the main round
// starts it is the application round; at/after main_round_start_at it is the
// main round. The client never chooses.
export function resolveEffectiveRound(
  cfg: Pick<SeasonStudioConfig, 'round' | 'mainRoundStartAt'>,
  now: Date = new Date(),
): EffectiveRound {
  if (cfg.round === 'application') return 'application'
  if (cfg.round === 'main') return 'main'
  // 'both'
  if (cfg.mainRoundStartAt && now.getTime() >= new Date(cfg.mainRoundStartAt).getTime()) {
    return 'main'
  }
  return 'application'
}

// Whether a clip created at `createdAtISO` belongs to the CURRENT effective
// round. For a 'both' season the round boundary is main_round_start_at (created
// before it = application clip, at/after = main clip). Fixed-round seasons have
// no boundary -- every clip is that one round. Single source of truth for the
// round split (compose picker + generation cap both use it).
export function isInEffectiveRound(
  createdAtISO: string,
  cfg: Pick<SeasonStudioConfig, 'round' | 'mainRoundStartAt'>,
  effectiveRound: EffectiveRound,
): boolean {
  if (cfg.round !== 'both' || !cfg.mainRoundStartAt) return true
  const boundary = new Date(cfg.mainRoundStartAt).getTime()
  const t = new Date(createdAtISO).getTime()
  return effectiveRound === 'main' ? t >= boundary : t < boundary
}

const MODEL_COLS = 'id, tier, display_name, cost_per_second_usd, min_duration_seconds, max_duration_seconds, metadata'

// Map a model_catalog row -> StudioModel. Shared by getActiveModels (selector)
// and getModelById (enqueue). Keeps metadata parsing in one place.
function mapModelRow(m: Record<string, unknown>): StudioModel {
  const md = (m.metadata ?? {}) as {
    media_type?: string
    has_audio?: boolean
    prompt_max?: number
    prompt_style?: string
    param_whitelist?: Record<string, StudioParamRule>
    promotes_to?: string
    resolution_label?: string
    tier_label?: string
    accepts_start_image?: boolean
  }
  return {
    id: m.id as string,
    tier: m.tier as StudioTier,
    display_name: m.display_name as string,
    cost_per_second_usd: m.cost_per_second_usd as number,
    min_duration_seconds: m.min_duration_seconds as number,
    max_duration_seconds: m.max_duration_seconds as number,
    hasAudio: md.has_audio !== false,
    promptMax: typeof md.prompt_max === 'number' ? md.prompt_max : null,
    promptStyle: md.prompt_style === 'bracket' ? 'bracket' : null,
    paramWhitelist: md.param_whitelist ?? null,
    promotesTo: typeof md.promotes_to === 'string' ? md.promotes_to : null,
    resolutionLabel: typeof md.resolution_label === 'string' ? md.resolution_label : null,
    // Stage 3: participant-facing positioning label (e.g. 'premium' / 'value').
    tierLabel: typeof md.tier_label === 'string' ? md.tier_label : null,
    // Stage 3 i2v: this (video) model accepts a start image + elements, i.e. it
    // drives the AI-actor "shoot shots" step. Filters the ③ model list.
    acceptsI2v: md.accepts_start_image === true,
    mediaType: md.media_type === 'image' ? 'image' : 'video',
  }
}

// Active models for the picker. Video-only by default (the /studio video picker
// must never list image models); pass 'image' for the character-sheet picker.
export async function getActiveModels(mediaType: 'video' | 'image' = 'video'): Promise<StudioModel[]> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('model_catalog')
    .select(MODEL_COLS)
    .eq('active', true)
    .order('cost_per_second_usd', { ascending: true })
  if (error) throw new Error('getActiveModels: ' + error.message)
  const rows = (data ?? []).map(mapModelRow).filter((m) => m.mediaType === mediaType)
  // ★A model with no usable price is not offered. cost_per_second_usd is
  // NOT NULL DEFAULT 0, so a model onboarded without its probe number is active
  // and free -- and free is not cheap, it is a generation whose balance check
  // cannot fail (see creditsForCost). The enqueue paths refuse it anyway, but a
  // refusal the participant meets after writing a prompt reads as "the site is
  // broken"; not listing it is the same safety one step earlier. This does NOT
  // replace the server guard: getModelById (image / i2v) loads by id and never
  // consults `active`, so it never passes through here.
  // Measured 2026-08-01: 19/19 catalogue rows priced > 0, so this filters
  // nothing today. It is here for the next model onboarding, not for now.
  const sellable = rows.filter((m) => isSellableCost(m.cost_per_second_usd))
  if (sellable.length !== rows.length) {
    const dropped = rows.filter((m) => !isSellableCost(m.cost_per_second_usd)).map((m) => m.id)
    console.error(
      `[studio] ${dropped.length} active ${mediaType} model(s) withheld from the picker -- ` +
        `no usable price in model_catalog.cost_per_second_usd: ${dropped.join(', ')}`,
    )
  }
  return sellable
}

// Load ONE model by id regardless of `active` (image/i2v models stay active=false
// until the Stage 3 UI ships; the image/i2v enqueue paths load them by id and
// gate on media_type instead of the selector's active flag). null if not found.
export async function getModelById(id: string): Promise<StudioModel | null> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin.from('model_catalog').select(MODEL_COLS).eq('id', id).maybeSingle()
  if (error) throw new Error('getModelById: ' + error.message)
  return data ? mapModelRow(data) : null
}

// Honest per-model ETA: rolling MEDIAN of the last <=20 real completed
// generations per model (worker start -> finish). Measured 2026-07-16: fal
// queue wait is ~0 and congestion varies by the hour, so a static per-model
// label would lie -- only rolling measurement is shown, and models without
// samples show nothing (never a fabricated number). FAL_FAKE loadtest rows are
// excluded (fake requestId).
export async function getModelEtas(): Promise<Record<string, number>> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('generation_jobs')
    .select('model_id, worker_started_at, worker_finished_at, fal_request_id')
    .eq('status', 'ready')
    .not('worker_started_at', 'is', null)
    .not('worker_finished_at', 'is', null)
    .order('worker_finished_at', { ascending: false })
    .limit(400)
  if (error) throw new Error('getModelEtas: ' + error.message)
  const samples = new Map<string, number[]>()
  for (const r of data ?? []) {
    if (!r.fal_request_id || String(r.fal_request_id).startsWith('fake-')) continue
    const arr = samples.get(r.model_id as string) ?? []
    if (arr.length >= 20) continue
    const secs =
      (new Date(r.worker_finished_at as string).getTime() -
        new Date(r.worker_started_at as string).getTime()) /
      1000
    if (secs > 0 && Number.isFinite(secs)) {
      arr.push(secs)
      samples.set(r.model_id as string, arr)
    }
  }
  const etas: Record<string, number> = {}
  for (const [modelId, arr] of samples) {
    if (arr.length < 3) continue // too few samples -> show nothing, not a guess
    const sorted = [...arr].sort((a, b) => a - b)
    etas[modelId] = Math.round(sorted[Math.floor(sorted.length / 2)])
  }
  return etas
}

// The 8 TK-approved camera/motion presets (studio_presets, data not code).
// Server-only read via the admin client -- the table is RLS-locked like the
// rest of the studio tables; the UI receives these through the page loader.
export async function getActivePresets(): Promise<StudioPreset[]> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('studio_presets')
    .select('id, group_id, label_en, bracket_tags, desc_text, preview_url, sort_order')
    .eq('active', true)
    .order('sort_order', { ascending: true })
  if (error) throw new Error('getActivePresets: ' + error.message)
  // URLs cannot contain whitespace, so stripping is lossless. Guards against
  // copy-paste line-wrap corruption in hand-run SQL/dashboard edits -- exactly
  // what shipped a CRLF into every preview_url on 2026-07-16 and made the
  // preview fail SILENTLY (R2 404 -> browser ORB block, no console error).
  return ((data ?? []) as StudioPreset[]).map((p) => ({
    ...p,
    preview_url: p.preview_url ? p.preview_url.replace(/\s+/g, '') : p.preview_url,
  }))
}

export async function getSeasonStudioConfig(seasonId: string): Promise<SeasonStudioConfig> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('seasons')
    .select('studio_round, studio_max_generations_per_round, studio_max_draft_generations_per_round, studio_max_image_generations_per_round, studio_max_draft_image_generations_per_round, main_round_start_at, submission_hours, application_video_min_seconds, application_video_max_seconds, main_round_video_min_seconds, main_round_video_max_seconds, studio_compose_enabled, studio_compose_min_seconds, studio_compose_max_seconds, studio_prelim_hold_enabled')
    .eq('id', seasonId)
    .single()
  if (error) throw new Error('getSeasonStudioConfig: ' + error.message)
  return {
    round: (data.studio_round as StudioRoundSetting) ?? 'main',
    maxGenerationsPerRound: Number(data.studio_max_generations_per_round ?? 10),
    maxDraftGenerationsPerRound: Number(data.studio_max_draft_generations_per_round ?? 30),
    maxImageGenerationsPerRound: Number(data.studio_max_image_generations_per_round ?? 20),
    maxDraftImageGenerationsPerRound: Number(data.studio_max_draft_image_generations_per_round ?? 40),
    mainRoundStartAt: (data.main_round_start_at as string | null) ?? null,
    submissionHours: Number(data.submission_hours ?? 48),
    applicationVideoMinSeconds: Number(data.application_video_min_seconds ?? 0),
    applicationVideoMaxSeconds: Number(data.application_video_max_seconds ?? 0),
    mainRoundVideoMinSeconds: Number(data.main_round_video_min_seconds ?? 0),
    mainRoundVideoMaxSeconds: Number(data.main_round_video_max_seconds ?? 0),
    studioComposeEnabled: Boolean(data.studio_compose_enabled),
    studioComposeMinSeconds: Number(data.studio_compose_min_seconds ?? 0),
    studioComposeMaxSeconds: Number(data.studio_compose_max_seconds ?? 0),
    prelimHoldEnabled: Boolean(data.studio_prelim_hold_enabled),
  }
}

// Per-participant generation count toward the per-round cap. For a 'both' season
// the cap is per round, so generations are split by the schedule boundary
// (created before main_round_start_at = application phase; at/after = main).
// For a fixed-round season every generation counts toward that one round.
export async function countGenerationsForRound(
  userId: string,
  seasonId: string,
  cfg: SeasonStudioConfig,
  effectiveRound: EffectiveRound,
  // Which cap this count feeds. Draft (Sandbox) and competition generations
  // have INDEPENDENT per-round caps -- one never consumes the other's slots.
  kind: 'draft' | 'competition' = 'competition',
  // Stage 3: image and video generations have INDEPENDENT caps. Every legacy row
  // is media_type='video' (migration default NOT NULL), so the default filter is
  // a no-op on existing data.
  mediaType: 'video' | 'image' = 'video',
): Promise<number> {
  const admin = createSupabaseAdmin()
  let q = admin
    .from('generation_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('season_id', seasonId)
    .eq('media_type', mediaType)

  if (kind === 'draft') q = q.eq('tier', 'draft')
  else q = q.neq('tier', 'draft')

  if (cfg.round === 'both' && cfg.mainRoundStartAt) {
    if (effectiveRound === 'main') q = q.gte('created_at', cfg.mainRoundStartAt)
    else q = q.lt('created_at', cfg.mainRoundStartAt)
  }

  const { count, error } = await q
  if (error) throw new Error('countGenerationsForRound: ' + error.message)
  return count ?? 0
}

export async function listUserJobs(userId: string, seasonId: string): Promise<StudioJob[]> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('generation_jobs')
    .select('id, status, tier, model_id, prompt, duration_seconds, video_url, error_message, submitted_at, created_at, media_type, image_url, user_params')
    .eq('user_id', userId)
    .eq('season_id', seasonId)
    // Active workspace only: archived clips (round submitted) live in My Library,
    // not the generate screen or the Compose picker. (TK 2026-07-12)
    .is('archived_at', null)
    // Soft-deleted clips are hidden everywhere (row + R2 file preserved).
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error('listUserJobs: ' + error.message)
  return (data ?? []) as StudioJob[]
}

export type CreateGenerationResult =
  | { ok: true; jobId: string; credits: number }
  | {
      ok: false
      reason:
        | 'unknown_model'
        | 'bad_duration'
        | 'prompt_too_long'
        | 'cap_reached'
        | 'insufficient_credits'
        | 'unknown_preset'
        | 'invalid_param'
        | 'failed'
        // Stage 3 (image / i2v):
        | 'not_image_model'
        | 'not_video_model'
        | 'character_not_found'
        | 'parent_not_found'
        | 'parent_not_ready'
        | 'parent_not_image'
        | 'bad_shots'
      detail?: string
    }

// Server-side STRICT validation of participant advanced params against the
// model's measured whitelist. Unlike the worker (which silently drops, as the
// last line before fal), the server REJECTS so the participant gets feedback.
// Returns the normalized params to store, or the offending key.
function validateAdvancedParams(
  advanced: Record<string, unknown>,
  whitelist: Record<string, StudioParamRule> | null,
): { ok: true; params: Record<string, unknown> } | { ok: false; key: string } {
  const out: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(advanced)) {
    if (raw === undefined || raw === null) continue
    const rule = whitelist?.[key]
    if (!rule) return { ok: false, key }
    if (rule.type === 'string') {
      if (typeof raw !== 'string') return { ok: false, key }
      const s = raw.trim()
      if (!s) continue // empty after trim -> treat as not provided
      if (typeof rule.max_len === 'number' && s.length > rule.max_len) return { ok: false, key }
      out[key] = s
    } else if (rule.type === 'number') {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return { ok: false, key }
      if (typeof rule.min === 'number' && raw < rule.min) return { ok: false, key }
      if (typeof rule.max === 'number' && raw > rule.max) return { ok: false, key }
      out[key] = raw
    } else {
      return { ok: false, key } // unmeasured rule type -> never accepted
    }
  }
  return { ok: true, params: out }
}

export async function createGeneration(args: {
  userId: string
  seasonId: string
  modelId: string
  prompt: string
  durationSeconds: number
  // Stage 1 (CameraDirector): optional preset + measured advanced params.
  // Omitted -> the legacy free-prompt path, byte-for-byte unchanged.
  presetId?: string
  advanced?: Record<string, unknown>
}): Promise<CreateGenerationResult> {
  const admin = createSupabaseAdmin()

  const userPrompt = (args.prompt ?? '').trim()
  if (!userPrompt) return { ok: false, reason: 'failed', detail: 'empty prompt' }

  // 1. Model must exist + be active.
  const models = await getActiveModels()
  const model = models.find((m) => m.id === args.modelId)
  if (!model) return { ok: false, reason: 'unknown_model' }

  // 1a. Preset (optional). Must exist + be active; the server assembles the
  // final prompt itself -- a client-assembled prompt is never trusted.
  let preset: StudioPreset | null = null
  if (args.presetId !== undefined && args.presetId !== null && args.presetId !== '') {
    const presets = await getActivePresets()
    preset = presets.find((p) => p.id === args.presetId) ?? null
    if (!preset) return { ok: false, reason: 'unknown_preset' }
  }

  // 1a2. Advanced params: STRICT-validate against the model's measured
  // whitelist (reject with the offending key, so the UI can point at it).
  let advancedParams: Record<string, unknown> = {}
  if (args.advanced && Object.keys(args.advanced).length > 0) {
    const v = validateAdvancedParams(args.advanced, model.paramWhitelist)
    if (!v.ok) return { ok: false, reason: 'invalid_param', detail: v.key }
    advancedParams = v.params
  }

  // 1a3. Assemble the final prompt (preset tags/description around the
  // participant's prompt; no preset -> untouched).
  const prompt = assemblePresetPrompt(userPrompt, preset, model.promptStyle)

  // 1b. ASSEMBLED prompt within the model's max length (fal rejects over-limit
  // prompts; surface it here instead of a silent worker failure that burned
  // credits). The preset adds real characters, so the check must run on the
  // assembled result, not the raw input. promptMax null -> no server cap.
  if (model.promptMax !== null && prompt.length > model.promptMax) {
    return { ok: false, reason: 'prompt_too_long', detail: String(model.promptMax) }
  }

  // 2. Duration within the model's bounds.
  const duration = Math.round(args.durationSeconds)
  if (duration < model.min_duration_seconds || duration > model.max_duration_seconds) {
    return { ok: false, reason: 'bad_duration' }
  }

  // 3. Per-round generation cap (round resolved server-side from the schedule).
  const cfg = await getSeasonStudioConfig(args.seasonId)
  const effectiveRound = resolveEffectiveRound(cfg)

  // S-7: duration must also satisfy the SEASON's video-length bounds for this
  // round, not only the model's. A configured bound of 0 means "unset" -> skip.
  // In compose mode this generation is a building-block CLIP -- its length is
  // capped only by the model's native enum; the FINAL composed length is gated
  // by studio_compose_min/max_seconds in createRender. So the round submission
  // bounds (application_video_*/main_round_video_* = 15..30) must NOT reject a
  // short clip here. Skip S-7 when compose is on.
  if (!cfg.studioComposeEnabled) {
    const bounds = videoBoundsForRound(cfg, effectiveRound)
    if (bounds.min > 0 && duration < bounds.min) return { ok: false, reason: 'bad_duration' }
    if (bounds.max > 0 && duration > bounds.max) return { ok: false, reason: 'bad_duration' }
  }

  // Draft (Sandbox) and competition generations count toward SEPARATE caps.
  const capKind = model.tier === 'draft' ? 'draft' : 'competition'
  const capMax =
    capKind === 'draft' ? cfg.maxDraftGenerationsPerRound : cfg.maxGenerationsPerRound
  const used = await countGenerationsForRound(args.userId, args.seasonId, cfg, effectiveRound, capKind)
  if (used >= capMax) return { ok: false, reason: 'cap_reached', detail: capKind }

  // 4. Price + balance.
  const pricing = await getStudioPricing()
  const estCost = model.cost_per_second_usd * duration
  // null = the model has no usable price (cost_per_second_usd defaults to 0).
  // Refuse: at 0 credits the balance test below passes for every account.
  const credits = creditsForCostOrNull(estCost, pricing)
  if (credits === null) return { ok: false, reason: 'failed', detail: 'pricing_unavailable' }
  const balance = await getBalance(args.userId)
  if (balance < credits) return { ok: false, reason: 'insufficient_credits' }

  // 5. Insert the job WITH its CryptoBind (generation-time binding).
  const jobId = randomUUID()
  const generatedAt = new Date()
  const cb = buildCryptoBind({
    jobId,
    pid: args.userId,
    tid: args.seasonId,
    modelId: model.id,
    durationSeconds: duration,
    generatedAt,
  })
  // What the participant actually picked, for audit/UI redisplay + the worker's
  // advanced-param merge. user_prompt keeps the RAW pre-assembly text so the
  // draft promotion flow can prefill the form without double-assembling the
  // preset. NULL when nothing beyond a plain competition prompt was involved.
  const userParams =
    preset || Object.keys(advancedParams).length > 0 || model.tier === 'draft'
      ? {
          user_prompt: userPrompt,
          ...(preset ? { preset_id: preset.id } : {}),
          ...(Object.keys(advancedParams).length > 0 ? { advanced: advancedParams } : {}),
        }
      : null

  const { error: insErr } = await admin.from('generation_jobs').insert({
    id: jobId,
    user_id: args.userId,
    season_id: args.seasonId,
    model_id: model.id,
    tier: model.tier,
    prompt,
    duration_seconds: duration,
    status: 'queued',
    estimated_cost_usd: estCost,
    credits_charged: credits,
    user_params: userParams,
    ...cb,
  })
  if (insErr) return { ok: false, reason: 'failed', detail: insErr.message }

  // 6. Charge credits (negative ledger row). If this fails, roll back the job
  //    so we never leave an uncharged queued job for the worker to run.
  const { error: chErr } = await admin.from('credit_transactions').insert({
    user_id: args.userId,
    amount_credits: -credits,
    type: 'generation_charge',
    generation_job_id: jobId,
    metadata: { cost_usd: estCost },
  })
  if (chErr) {
    await admin.from('generation_jobs').delete().eq('id', jobId)
    return { ok: false, reason: 'failed', detail: 'charge failed: ' + chErr.message }
  }

  return { ok: true, jobId, credits }
}

// ===========================================================================
// Stage 3: image (t2i character sheet) + i2v (Kling elements) generation, and
// the character library. All ADDITIVE -- the video generation/compose paths are
// unchanged. i2v clips flow into the existing compose layer as ready videos.
// ===========================================================================

type ImageLoadError = {
  ok: false
  reason: 'failed' | 'parent_not_found' | 'parent_not_image' | 'parent_not_ready'
  detail?: string
}

// Load + validate that the given ids are the caller's OWN, in THIS season, ready,
// and media_type='image'. Returns rows keyed by id. Shared by createCharacter +
// createI2vGeneration (the parent-image validation for v1v binding).
async function loadOwnedReadyImages(
  admin: ReturnType<typeof createSupabaseAdmin>,
  ids: string[],
  userId: string,
  seasonId: string,
): Promise<{ ok: true; rows: Map<string, any> } | ImageLoadError> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return { ok: false, reason: 'parent_not_found', detail: 'no images' }
  const { data, error } = await admin
    .from('generation_jobs')
    .select(
      'id, user_id, season_id, status, media_type, image_url, model_id, cryptobind_pid, cryptobind_tid, cryptobind_generated_at, cryptobind_signature, cryptobind_algo, cryptobind_content_hash, cryptobind_content_signature',
    )
    .in('id', unique)
  if (error) return { ok: false, reason: 'failed', detail: error.message }
  const byId = new Map((data ?? []).map((r) => [r.id as string, r]))
  for (const id of unique) {
    const r = byId.get(id)
    if (!r) return { ok: false, reason: 'parent_not_found', detail: id }
    if (r.media_type !== 'image') return { ok: false, reason: 'parent_not_image', detail: id }
    if (r.user_id !== userId || r.season_id !== seasonId) {
      return { ok: false, reason: 'parent_not_found', detail: id + ' (owner/season)' }
    }
    if (r.status !== 'ready') return { ok: false, reason: 'parent_not_ready', detail: id }
    if (!r.image_url) return { ok: false, reason: 'parent_not_ready', detail: id + ' (no image_url)' }
  }
  return { ok: true, rows: byId }
}

// Verify ONE source clip's CryptoBind for compose (create + submit). A normal
// clip (no parent images) takes the EXACT existing v1/v1c path -- byte-for-byte
// old behavior, so plain-video submissions are unaffected. An i2v clip (media_
// type='video' AND parent_image_job_ids present) additionally verifies every
// parent image (v1i/v1ic + own + season + ready + image), recomputes parentBundle
// from the LIVE parent signatures, and checks the clip's v1v. Returns the clip's
// own signature (v1 or v1v) for the render source bundle. `row` must carry
// media_type + parent_image_job_ids + cryptobind_parent_bundle + duration_seconds.
async function verifySourceCryptoBind(
  admin: ReturnType<typeof createSupabaseAdmin>,
  row: any,
  expectedTid: string,
): Promise<{ ok: true; signature: string } | { ok: false; detail: string }> {
  const parents = ((row.parent_image_job_ids as string[] | null) ?? []) as string[]
  if (row.media_type === 'video' && parents.length > 0) {
    // Load + own/season/ready/image-validate the parents (DB), then route to the
    // pure crypto core (which recomputes parentBundle + checks v1i/v1ic/v1v).
    const loaded = await loadOwnedReadyImages(admin, parents, row.user_id, expectedTid)
    if (!loaded.ok) return { ok: false, detail: `parent ${loaded.reason}${loaded.detail ? ' ' + loaded.detail : ''}` }
    return verifySourceClipCrypto(row, expectedTid, (id) => loaded.rows.get(id))
  }
  return verifySourceClipCrypto(row, expectedTid, () => undefined)
}

// Enqueue a t2i character-sheet image. Mirrors createGeneration (credit charge +
// generation-time CryptoBind) but IMAGE: no duration, v1i signature, per-image
// cost (cost_per_second_usd holds the per-image USD), its own per-round cap.
export async function createImageGeneration(args: {
  userId: string
  seasonId: string
  modelId: string
  prompt: string
  advanced?: Record<string, unknown>
  // Path B (character consistency): an OWN, ready, image job to generate FROM.
  // Present => the worker calls the model's edit endpoint with image_urls.
  referenceImageJobId?: string
}): Promise<CreateGenerationResult> {
  const admin = createSupabaseAdmin()
  const userPrompt = (args.prompt ?? '').trim()
  if (!userPrompt) return { ok: false, reason: 'failed', detail: 'empty prompt' }

  const model = await getModelById(args.modelId)
  if (!model) return { ok: false, reason: 'unknown_model' }
  if (model.mediaType !== 'image') return { ok: false, reason: 'not_image_model' }
  if (model.promptMax !== null && userPrompt.length > model.promptMax) {
    return { ok: false, reason: 'prompt_too_long', detail: String(model.promptMax) }
  }

  let advancedParams: Record<string, unknown> = {}
  if (args.advanced && Object.keys(args.advanced).length > 0) {
    const v = validateAdvancedParams(args.advanced, model.paramWhitelist)
    if (!v.ok) return { ok: false, reason: 'invalid_param', detail: v.key }
    advancedParams = v.params
  }

  // Path B reference (character-consistency shot): validate an OWN/ready/image
  // parent; the worker calls the model's edit endpoint with image_urls. The
  // reference is a generation INPUT (like the prompt), NOT part of the crypto
  // chain -- the output image still gets its own v1i + v1ic (platform-generated
  // bytes), so provenance holds without binding to the reference.
  let imageRefUrl: string | null = null
  if (args.referenceImageJobId) {
    const loaded = await loadOwnedReadyImages(admin, [args.referenceImageJobId], args.userId, args.seasonId)
    if (!loaded.ok) return { ok: false, reason: loaded.reason, detail: loaded.detail }
    imageRefUrl = (loaded.rows.get(args.referenceImageJobId)?.image_url as string | undefined) ?? null
  }

  const cfg = await getSeasonStudioConfig(args.seasonId)
  const effectiveRound = resolveEffectiveRound(cfg)
  const capKind = model.tier === 'draft' ? 'draft' : 'competition'
  const capMax = capKind === 'draft' ? cfg.maxDraftImageGenerationsPerRound : cfg.maxImageGenerationsPerRound
  const used = await countGenerationsForRound(args.userId, args.seasonId, cfg, effectiveRound, capKind, 'image')
  if (used >= capMax) return { ok: false, reason: 'cap_reached', detail: `image_${capKind}` }

  const pricing = await getStudioPricing()
  const estCost = model.cost_per_second_usd // per-image (no duration)
  const credits = creditsForCostOrNull(estCost, pricing)
  if (credits === null) return { ok: false, reason: 'failed', detail: 'pricing_unavailable' }
  const balance = await getBalance(args.userId)
  if (balance < credits) return { ok: false, reason: 'insufficient_credits' }

  const jobId = randomUUID()
  const generatedAt = new Date()
  const cb = buildImageBind({ jobId, pid: args.userId, tid: args.seasonId, modelId: model.id, generatedAt })
  const userParams =
    Object.keys(advancedParams).length > 0 || imageRefUrl
      ? {
          ...(Object.keys(advancedParams).length > 0 ? { advanced: advancedParams } : {}),
          ...(imageRefUrl ? { image_ref: imageRefUrl } : {}),
        }
      : null

  const { error: insErr } = await admin.from('generation_jobs').insert({
    id: jobId,
    user_id: args.userId,
    season_id: args.seasonId,
    model_id: model.id,
    tier: model.tier,
    media_type: 'image',
    prompt: userPrompt,
    duration_seconds: null,
    status: 'queued',
    estimated_cost_usd: estCost,
    credits_charged: credits,
    user_params: userParams,
    ...cb,
  })
  if (insErr) return { ok: false, reason: 'failed', detail: insErr.message }

  const { error: chErr } = await admin.from('credit_transactions').insert({
    user_id: args.userId,
    amount_credits: -credits,
    type: 'generation_charge',
    generation_job_id: jobId,
    metadata: { cost_usd: estCost, media_type: 'image' },
  })
  if (chErr) {
    await admin.from('generation_jobs').delete().eq('id', jobId)
    return { ok: false, reason: 'failed', detail: 'charge failed: ' + chErr.message }
  }
  return { ok: true, jobId, credits }
}

// --- character library (AI-actor naming layer over image jobs) ---
export type StudioCharacter = {
  id: string
  name: string
  status: string
  frontalImageJobId: string | null
  frontalImageUrl: string | null
  referenceImageJobIds: string[]
  referenceImageUrls: string[]
  createdAt: string
}

export type CreateCharacterResult = { ok: true; characterId: string } | ImageLoadError

export async function createCharacter(args: {
  userId: string
  seasonId: string
  name: string
  frontalImageJobId: string
  referenceImageJobIds?: string[]
}): Promise<CreateCharacterResult> {
  const admin = createSupabaseAdmin()
  const refs = [...new Set(args.referenceImageJobIds ?? [])].filter((id) => id && id !== args.frontalImageJobId)
  const loaded = await loadOwnedReadyImages(admin, [args.frontalImageJobId, ...refs], args.userId, args.seasonId)
  if (!loaded.ok) return loaded
  const id = randomUUID()
  const { error } = await admin.from('studio_characters').insert({
    id,
    user_id: args.userId,
    season_id: args.seasonId,
    name: (args.name ?? '').trim().slice(0, 80),
    status: 'ready',
    frontal_image_job_id: args.frontalImageJobId,
    reference_image_job_ids: refs,
  })
  if (error) return { ok: false, reason: 'failed', detail: error.message }
  return { ok: true, characterId: id }
}

export async function listCharacters(userId: string, seasonId: string): Promise<StudioCharacter[]> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('studio_characters')
    .select('id, name, status, frontal_image_job_id, reference_image_job_ids, created_at')
    .eq('user_id', userId)
    .eq('season_id', seasonId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error('listCharacters: ' + error.message)
  const rows = data ?? []
  const jobIds = [
    ...new Set(
      rows.flatMap((c) => [c.frontal_image_job_id, ...((c.reference_image_job_ids as string[] | null) ?? [])]).filter(Boolean),
    ),
  ] as string[]
  const urlById = new Map<string, string>()
  if (jobIds.length) {
    const { data: imgs } = await admin.from('generation_jobs').select('id, image_url').in('id', jobIds)
    for (const r of imgs ?? []) if (r.image_url) urlById.set(r.id as string, r.image_url as string)
  }
  return rows.map((c) => {
    const refIds = ((c.reference_image_job_ids as string[] | null) ?? []) as string[]
    return {
      id: c.id as string,
      name: c.name as string,
      status: c.status as string,
      frontalImageJobId: (c.frontal_image_job_id as string | null) ?? null,
      frontalImageUrl: c.frontal_image_job_id ? urlById.get(c.frontal_image_job_id as string) ?? null : null,
      referenceImageJobIds: refIds,
      referenceImageUrls: refIds.map((id) => urlById.get(id)).filter((u): u is string => Boolean(u)),
      createdAt: c.created_at as string,
    }
  })
}

export async function deleteCharacter(
  userId: string,
  characterId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('studio_characters')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', characterId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .select('id')
  if (error) return { ok: false, reason: error.message }
  if (!data || data.length === 0) return { ok: false, reason: 'not_found' }
  return { ok: true }
}

// Enqueue an i2v (Kling elements) generation from a character. Assembles the fal
// input (start_image_url + elements + multi_prompt) from INTERNAL R2 urls only
// (Genesis Rule), binds v1v over the parent images' v1i signatures, and enqueues
// a VIDEO job (counts toward the video cap). The output clip flows into compose
// like any ready video.
export async function createI2vGeneration(args: {
  userId: string
  seasonId: string
  modelId: string
  characterId: string
  shots: { prompt: string; durationSeconds: number }[]
}): Promise<CreateGenerationResult> {
  const admin = createSupabaseAdmin()
  const model = await getModelById(args.modelId)
  if (!model) return { ok: false, reason: 'unknown_model' }
  if (model.mediaType !== 'video') return { ok: false, reason: 'not_video_model' }

  const shots = (args.shots ?? []).map((s) => ({
    prompt: (s.prompt ?? '').trim(),
    durationSeconds: Math.round(s.durationSeconds),
  }))
  if (shots.length < 1 || shots.length > 6) return { ok: false, reason: 'bad_shots', detail: '1..6 shots' }
  if (shots.some((s) => !s.prompt)) return { ok: false, reason: 'bad_shots', detail: 'empty shot prompt' }
  const totalDuration = shots.reduce((a, s) => a + s.durationSeconds, 0)
  if (totalDuration < model.min_duration_seconds || totalDuration > model.max_duration_seconds) {
    return { ok: false, reason: 'bad_duration' }
  }

  const { data: charRow, error: cErr } = await admin
    .from('studio_characters')
    .select('id, frontal_image_job_id, reference_image_job_ids')
    .eq('id', args.characterId)
    .eq('user_id', args.userId)
    .eq('season_id', args.seasonId)
    .is('deleted_at', null)
    .maybeSingle()
  if (cErr) return { ok: false, reason: 'failed', detail: cErr.message }
  if (!charRow || !charRow.frontal_image_job_id) return { ok: false, reason: 'character_not_found' }
  const refIds = ((charRow.reference_image_job_ids as string[] | null) ?? []) as string[]
  const parentIds = [...new Set([charRow.frontal_image_job_id as string, ...refIds])]

  const loaded = await loadOwnedReadyImages(admin, parentIds, args.userId, args.seasonId)
  if (!loaded.ok) return loaded

  const frontal = loaded.rows.get(charRow.frontal_image_job_id as string)
  const refRows = refIds.map((id) => loaded.rows.get(id)).filter(Boolean)
  // Genesis Rule: fal input references ONLY internal R2 image urls.
  const i2vInput: Record<string, unknown> = {
    start_image_url: frontal.image_url,
    elements: [
      { frontal_image_url: frontal.image_url, reference_image_urls: refRows.map((r) => r.image_url) },
    ],
    multi_prompt: shots.map((s) => ({ prompt: s.prompt, duration: String(s.durationSeconds) })),
  }

  // parentBundle over the parents' v1i signatures (sorted) -> folded into v1v.
  const parentSignatures = parentIds.map((id) => String(loaded.rows.get(id).cryptobind_signature))
  const parentBundle = computeSourceBundle(parentSignatures)

  const cfg = await getSeasonStudioConfig(args.seasonId)
  const effectiveRound = resolveEffectiveRound(cfg)
  const capKind = model.tier === 'draft' ? 'draft' : 'competition'
  const capMax = capKind === 'draft' ? cfg.maxDraftGenerationsPerRound : cfg.maxGenerationsPerRound
  const used = await countGenerationsForRound(args.userId, args.seasonId, cfg, effectiveRound, capKind, 'video')
  if (used >= capMax) return { ok: false, reason: 'cap_reached', detail: capKind }

  const pricing = await getStudioPricing()
  const estCost = model.cost_per_second_usd * totalDuration
  const credits = creditsForCostOrNull(estCost, pricing)
  if (credits === null) return { ok: false, reason: 'failed', detail: 'pricing_unavailable' }
  const balance = await getBalance(args.userId)
  if (balance < credits) return { ok: false, reason: 'insufficient_credits' }

  const jobId = randomUUID()
  const generatedAt = new Date()
  const cb = buildI2vBind({
    jobId,
    pid: args.userId,
    tid: args.seasonId,
    modelId: model.id,
    durationSeconds: totalDuration,
    generatedAt,
    parentBundle,
  })
  const displayPrompt = shots.map((s) => s.prompt).join(' / ').slice(0, 2000)

  const { error: insErr } = await admin.from('generation_jobs').insert({
    id: jobId,
    user_id: args.userId,
    season_id: args.seasonId,
    model_id: model.id,
    tier: model.tier,
    media_type: 'video',
    prompt: displayPrompt,
    duration_seconds: totalDuration,
    status: 'queued',
    estimated_cost_usd: estCost,
    credits_charged: credits,
    parent_image_job_ids: parentIds,
    user_params: { i2v_input: i2vInput, character_id: args.characterId },
    ...cb, // includes cryptobind_parent_bundle
  })
  if (insErr) return { ok: false, reason: 'failed', detail: insErr.message }

  const { error: chErr } = await admin.from('credit_transactions').insert({
    user_id: args.userId,
    amount_credits: -credits,
    type: 'generation_charge',
    generation_job_id: jobId,
    metadata: { cost_usd: estCost, media_type: 'video', i2v: true },
  })
  if (chErr) {
    await admin.from('generation_jobs').delete().eq('id', jobId)
    return { ok: false, reason: 'failed', detail: 'charge failed: ' + chErr.message }
  }
  return { ok: true, jobId, credits }
}

// Creator Statement bounds. Mirrors /apply (no per-season column exists yet);
// it is the Triple-AI Intent scoring material, so it is required.
export const STATEMENT_MIN = 150
export const STATEMENT_MAX = 250

// Applicant info needed to AUTO-CREATE the application row at studio submission
// time (application round, when the participant has no row yet -- external-URL
// entry is retired). Statement feeds Intent scoring, so it is mandatory.
export type ApplicantInfo = {
  creatorName: string
  creatorStatement: string
  country?: string
  channelUrl?: string
  agreedRules: boolean
  agreedPrivacy: boolean
  agreedIntegrity: boolean
}

export type SubmitResult =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'job_not_found'
        | 'not_owner'
        | 'not_ready'
        | 'draft_not_submittable'
        | 'compose_required'
        | 'cryptobind_failed'
        | 'no_application'
        | 'already_submitted'
        | 'application_info_required'
        | 'bad_statement'
        | 'agreements_required'
        | 'name_required'
        | 'application_closed'
        | 'round_closed'
        | 'not_selected'
        | 'failed'
      detail?: string
    }

// Submit a ready generation into the participant's application for the season.
// CryptoBind is verified here (signature + TID match). The application row is
// matched by email (case-insensitive) like the rest of the public site. Status
// is intentionally NOT changed -- the scoring system owns status transitions.
export async function submitGeneration(args: {
  userId: string
  email: string
  seasonId: string
  jobId: string
  applicant?: ApplicantInfo
}): Promise<SubmitResult> {
  const admin = createSupabaseAdmin()

  // 1. Load the job + ownership + readiness.
  const { data: job, error: jErr } = await admin
    .from('generation_jobs')
    .select(
      'id, user_id, season_id, status, tier, video_url, duration_seconds, model_id, cryptobind_pid, cryptobind_tid, cryptobind_generated_at, cryptobind_signature, cryptobind_algo, cryptobind_content_hash, cryptobind_content_signature',
    )
    .eq('id', args.jobId)
    .single()
  if (jErr || !job) return { ok: false, reason: 'job_not_found' }
  if (job.user_id !== args.userId) return { ok: false, reason: 'not_owner' }
  if (job.status !== 'ready') return { ok: false, reason: 'not_ready' }
  // Sandbox fairness rule: a draft generation can NEVER be an entry. This is
  // the server layer of the triple block (low-res + watermark + server).
  if (job.tier === 'draft') return { ok: false, reason: 'draft_not_submittable' }

  // 2. CryptoBind verify -- signature valid AND bound to THIS tournament.
  const v = verifyCryptoBind(job, args.seasonId)
  if (!v.ok) return { ok: false, reason: 'cryptobind_failed', detail: v.reason }

  // 3. Studio round for this season -- effective round resolved server-side.
  //    The main-round window + 'selected' gate is enforced below at the CAS step
  //    via canSubmitMainRound -- unified with the canonical saveMainRoundSubmission
  //    path so a studio main-round submission transitions status the same way.
  const cfg = await getSeasonStudioConfig(args.seasonId)
  const effectiveRound = resolveEffectiveRound(cfg)

  // 3b. Single-path enforcement: when the season is compose-based, a raw single
  //     clip is a building-block, NOT a valid entry -- the entry is the composed
  //     final submitted via submitRender. Rejecting here closes the split-path
  //     bypass (a raw clip minting an application) so compose seasons have ONE
  //     submission path (both rounds). Non-compose studio seasons are unchanged:
  //     there the single clip IS the entry. UI mirrors this (submit hidden when
  //     composeEnabled); this is the server-authoritative layer.
  if (cfg.studioComposeEnabled) return { ok: false, reason: 'compose_required' }

  // 4. Find the participant's application (by email, like the rest of the site).
  const email = args.email.toLowerCase()
  const { data: appRow, error: aErr } = await admin
    .from('genesis_applications')
    .select('id, status, studio_application_submitted_at, main_round_submitted_at')
    .eq('season_id', args.seasonId)
    .ilike('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (aErr) return { ok: false, reason: 'failed', detail: aErr.message }

  const now = new Date().toISOString()

  // 5a. No application row yet. For the application round the studio submission
  //     IS the application, so create the row (with the applicant info + the
  //     Intent-scoring statement). The main round requires a pre-existing row.
  if (!appRow) {
    // Only the application round can mint a new row; the main round requires a
    // pre-existing application.
    if (effectiveRound !== 'application') return { ok: false, reason: 'no_application' }
    const info = args.applicant
    if (!info) return { ok: false, reason: 'application_info_required' }
    const name = (info.creatorName ?? '').trim()
    const statement = (info.creatorStatement ?? '').trim()
    if (!name) return { ok: false, reason: 'name_required' }
    if (statement.length < STATEMENT_MIN || statement.length > STATEMENT_MAX) {
      return { ok: false, reason: 'bad_statement' }
    }
    if (!info.agreedRules || !info.agreedPrivacy || !info.agreedIntegrity) {
      return { ok: false, reason: 'agreements_required' }
    }

    // S-1/S-2: this auto-created row IS an application, so it must obey the same
    // gates as POST /api/apply -- the application window and the capacity/
    // waitlist split. A studio submission cannot mint a 'pending' row past the
    // close time or beyond max_applicants.
    const season = await getSeasonById(args.seasonId)
    if (!season) return { ok: false, reason: 'failed', detail: 'season not found' }
    if (isApplicationClosed(season)) return { ok: false, reason: 'application_closed' }
    const activeCount = await getActiveApplicationCount(args.seasonId)
    const resolvedStatus: 'pending' | 'waitlist' = isCapacityFull(season, activeCount)
      ? 'waitlist'
      : 'pending'

    // Content safety (Patent 3): scan the creator statement before the row can
    // go public on /watch. Mirrors POST /api/apply policy. Studio has no external
    // thumbnail; the composed video's frame scan is phase C2 (worker). No key or
    // an API error -> moderateSubmission returns 'pending' (fail-safe: not
    // public, lands in the admin moderation queue).
    const mod = await moderateSubmission({ text: statement })

    const { error: insErr } = await admin.from('genesis_applications').insert({
      season_id: args.seasonId,
      user_id: args.userId,
      email,
      creator_name: name,
      creator_statement: statement,
      country: info.country?.trim() || null,
      channel_url: info.channelUrl?.trim() || null,
      ai_service: 'OXXOVO Studio',
      free_entry_url: job.video_url,
      video_duration_seconds: job.duration_seconds,
      agreed_to_rules: true,
      agreed_to_privacy: true,
      agreed_to_integrity_notice: true,
      status: resolvedStatus,
      moderation_status: mod.status,
      moderation_flags: mod.categories.length ? mod.categories : null,
      moderation_checked_at: now,
      // Fairness hold (anti-copy), prelim only -- see submitRender. Visibility only.
      watch_hold: cfg.prelimHoldEnabled,
      studio_application_job_id: job.id,
      studio_application_signature: job.cryptobind_signature,
      studio_application_submitted_at: now,
    })
    if (insErr) return { ok: false, reason: 'failed', detail: insErr.message }
    // Mirror account-level identity to profiles so the next submission prefills
    // it (profile/work split). Non-fatal: genesis already has the snapshot.
    const mirror = await upsertCreatorProfile(args.userId, args.email, {
      creatorName: name,
      country: info.country,
    }).catch((e) => ({ ok: false as const, error: String(e) }))
    if (!mirror.ok) {
      console.error('[studio] creator profile mirror failed (non-fatal)', { userId: args.userId, path: 'submitGeneration', error: mirror.error })
    }
    // Lock the job below (step 7).
  } else if (effectiveRound === 'main') {
    // 5b-main. Mirror saveMainRoundSubmission EXACTLY: 'selected' gate via
    // canSubmitMainRound (status + window, single source of truth), then a
    // selected -> main_round_submitted CAS transition. This is what makes a
    // studio main-round submission visible to the scorer (candidateStatus =
    // 'main_round_submitted'). Score columns are never touched here.
    const season = await getSeasonById(args.seasonId)
    if (!season) return { ok: false, reason: 'failed', detail: 'season not found' }
    const gate = canSubmitMainRound({ status: appRow.status }, season)
    if (!gate.ok) {
      if (gate.reason === 'not_selected') return { ok: false, reason: 'not_selected' }
      // reason === null -> already main_round_submitted / awarded / rejected / flagged
      if (gate.reason === null) return { ok: false, reason: 'already_submitted' }
      // before_start / after_close / season_dates_not_set
      return { ok: false, reason: 'round_closed', detail: gate.reason }
    }
    const { data: updated, error: upErr } = await admin
      .from('genesis_applications')
      .update({
        status: 'main_round_submitted',
        main_round_video_url: job.video_url,
        main_round_submitted_at: now,
        studio_main_job_id: job.id,
        studio_main_signature: job.cryptobind_signature,
      })
      .eq('id', appRow.id)
      .eq('status', 'selected')
      .select('id')
      .single()
    if (upErr || !updated) {
      // PGRST116 = no row matched (race lost or already submitted).
      if (upErr?.code === 'PGRST116') return { ok: false, reason: 'already_submitted' }
      return { ok: false, reason: 'failed', detail: upErr?.message }
    }
  } else {
    // 5c-application. Row exists -- single application submission (status unchanged).
    if (appRow.studio_application_submitted_at) return { ok: false, reason: 'already_submitted' }
    const { error: upErr } = await admin
      .from('genesis_applications')
      .update({
        free_entry_url: job.video_url,
        video_duration_seconds: job.duration_seconds,
        ai_service: 'OXXOVO Studio',
        studio_application_job_id: job.id,
        studio_application_signature: job.cryptobind_signature,
        studio_application_submitted_at: now,
      })
      .eq('id', appRow.id)
    if (upErr) return { ok: false, reason: 'failed', detail: upErr.message }
  }

  // 7. Lock the job: ready -> submitted (terminal, immutable).
  const { error: jUpErr } = await admin
    .from('generation_jobs')
    .update({ status: 'submitted', submitted_at: now, updated_at: now })
    .eq('id', job.id)
    .eq('status', 'ready')
  if (jUpErr) return { ok: false, reason: 'failed', detail: jUpErr.message }

  return { ok: true }
}

// ===========================================================================
// Compose (in-platform stitching). createRender enqueues a render_jobs row from
// an EDL (ordered { jobId, startMs, endMs } segments). It validates the segment
// list, confirms every source clip is the participant's own, same-season, ready
// generation (re-verifying each clip's CryptoBind), and stamps the request-stage
// composition signature (v1sr). The worker (oxxovo-studio) renders it; submission
// (a later step) verifies the full v1s chain. The render is the SCORED artifact.
// ===========================================================================

export type MusicAsset = { id: string; url: string; title: string; mood: string; source: 'library' | 'ai' }

// List the music beds a participant can pick for a season: the platform library
// (active, ready, SIGNED) + the participant's own ready AI tracks. `enabled=false`
// when the season's studio_music_enabled gate is off (allowlist) -> the editor
// hides the music panel. Unsigned / not-ready assets are never offered, so a bed
// the render couldn't verify is never selectable.
export async function listMusicAssets(
  seasonId: string,
  userId: string,
): Promise<{ enabled: boolean; assets: MusicAsset[] }> {
  const admin = createSupabaseAdmin()
  if (!(await isMusicEnabled(seasonId))) return { enabled: false, assets: [] }
  const { data, error } = await admin
    .from('studio_music_assets')
    .select('id, url, title, mood, source, user_id, active, cryptobind_signature')
    .eq('status', 'ready')
    .not('url', 'is', null)
    .order('source', { ascending: true })
    .order('mood', { ascending: true })
  if (error || !data) return { enabled: true, assets: [] }
  const assets: MusicAsset[] = data
    .filter(
      (a) =>
        a.cryptobind_signature &&
        ((a.source === 'library' && a.active) || (a.source === 'ai' && a.user_id === userId)),
    )
    .map((a) => ({
      id: String(a.id),
      url: String(a.url),
      title: String(a.title ?? ''),
      mood: String(a.mood ?? ''),
      source: a.source as 'library' | 'ai',
    }))
  return { enabled: true, assets }
}

export type CreateRenderResult =
  | { ok: true; renderId: string; totalDurationSeconds: number }
  | {
      ok: false
      reason:
        | 'compose_disabled'
        | 'empty_edl'
        | 'too_many_clips'
        | 'too_short'
        | 'too_long'
        | 'bad_segment'
        | 'source_not_found'
        | 'source_not_owned'
        | 'source_draft'
        | 'source_not_ready'
        | 'source_cryptobind_failed'
        | 'bad_aspect'
        | 'failed'
        | TextReason
        | MusicReason
      detail?: string
    }

// Resolve + verify the music bed asset for a render, and return the asset's v1m
// signature to fold into the compose-request source bundle (anti-swap). SHARED by
// createRender (request) and submitRender (verify) so the bundle is byte-identical
// on both sides. Returns { ok:true, signature:null } when the EDL has no music
// (music-free renders keep their exact bundle -- append-only). Season gate is
// checked by the caller (it holds the season row) via `musicEnabled`.
async function resolveMusicSignature(
  admin: ReturnType<typeof createSupabaseAdmin>,
  music: MusicBed | undefined,
  userId: string,
  musicEnabled: boolean,
): Promise<{ ok: true; signature: string | null } | { ok: false; reason: MusicReason; detail?: string }> {
  if (!music) return { ok: true, signature: null }
  if (!musicEnabled) return { ok: false, reason: 'music_disabled' }
  const { data: asset, error } = await admin
    .from('studio_music_assets')
    .select('id, source, status, active, user_id, cryptobind_content_hash, cryptobind_signature, cryptobind_algo')
    .eq('id', music.assetId)
    .maybeSingle()
  if (error) return { ok: false, reason: 'music_not_found', detail: error.message }
  if (!asset) return { ok: false, reason: 'music_not_found', detail: music.assetId }
  if (asset.source !== music.source) return { ok: false, reason: 'music_not_found', detail: 'source mismatch' }
  if (asset.status !== 'ready') return { ok: false, reason: 'music_not_ready', detail: String(asset.status) }
  // library beds must be curation-active; AI beds must belong to this participant.
  if (asset.source === 'library' && !asset.active) return { ok: false, reason: 'music_not_found', detail: 'inactive' }
  if (asset.source === 'ai' && asset.user_id !== userId) return { ok: false, reason: 'music_not_owned' }
  const av = verifyMusicAssetBind({
    id: String(asset.id),
    source: String(asset.source),
    cryptobind_content_hash: asset.cryptobind_content_hash as string | null,
    cryptobind_signature: asset.cryptobind_signature as string | null,
    cryptobind_algo: asset.cryptobind_algo as string | null,
  })
  if (!av.ok) return { ok: false, reason: 'music_cryptobind_failed', detail: av.reason }
  return { ok: true, signature: String(asset.cryptobind_signature) }
}

export async function createRender(args: {
  userId: string
  seasonId: string
  edl: EdlSegment[] | ComposeEdl
}): Promise<CreateRenderResult> {
  const admin = createSupabaseAdmin()
  // EDL v2 (with effects/transitions/global) or a bare v1 array. Validation runs
  // on the segments; the FULL edl is stored + signed so the worker applies the
  // effects and the composed final matches the WYSIWYG preview.
  const segments = Array.isArray(args.edl) ? args.edl : (args.edl.segments ?? [])
  if (!segments.length) return { ok: false, reason: 'empty_edl' }

  // 1. Season compose config (caps are season-variable).
  const { data: seasonRow, error: sErr } = await admin
    .from('seasons')
    // The music gate is deliberately NOT in this column list. Folding it in is
    // what broke compose: one un-migrated column fails the WHOLE PostgREST
    // select (42703) and takes the compose config down with it. It is read
    // separately, fail-closed, via lib/music-gate.
    .select('studio_compose_enabled, studio_compose_min_seconds, studio_compose_max_seconds, studio_compose_max_clips')
    .eq('id', args.seasonId)
    .single()
  if (sErr || !seasonRow) return { ok: false, reason: 'failed', detail: 'season not found' }
  if (!seasonRow.studio_compose_enabled) return { ok: false, reason: 'compose_disabled' }
  const maxClips = Number(seasonRow.studio_compose_max_clips ?? 10)
  const minSeconds = Number(seasonRow.studio_compose_min_seconds ?? 0)
  const maxSeconds = Number(seasonRow.studio_compose_max_seconds ?? 30)

  if (segments.length > maxClips) return { ok: false, reason: 'too_many_clips' }

  // 2. Segment shape + total duration <= compose cap.
  let totalMs = 0
  for (const seg of segments) {
    if (
      !seg ||
      typeof seg.jobId !== 'string' ||
      !Number.isFinite(seg.startMs) ||
      !Number.isFinite(seg.endMs)
    ) {
      return { ok: false, reason: 'bad_segment' }
    }
    if (seg.startMs < 0 || seg.endMs <= seg.startMs) return { ok: false, reason: 'bad_segment' }
    // per-clip fit (aspect fill mode): only the two enums, else reject.
    const fit = (seg as { fit?: unknown }).fit
    if (fit !== undefined && fit !== 'contain' && fit !== 'cover') return { ok: false, reason: 'bad_segment', detail: 'fit' }
    totalMs += seg.endMs - seg.startMs
  }
  if (totalMs <= 0) return { ok: false, reason: 'empty_edl' }
  if (minSeconds > 0 && totalMs < minSeconds * 1000) return { ok: false, reason: 'too_short' }
  if (totalMs > maxSeconds * 1000) return { ok: false, reason: 'too_long' }

  // 2a. Output aspect (EDL v2): only the two enums.
  const aspect = Array.isArray(args.edl) ? undefined : args.edl.aspect
  if (aspect !== undefined && aspect !== '16:9' && aspect !== '9:16') return { ok: false, reason: 'bad_aspect' }

  // 2b. Text/title overlays (EDL v2). Server is authority for the shape + the 5%
  //     size floor (client mirrors both). Content moderation is a later step.
  const texts = Array.isArray(args.edl) ? [] : (args.edl.texts ?? [])
  const tv = validateTexts(texts, totalMs)
  if (!tv.ok) return { ok: false, reason: tv.reason, detail: tv.index >= 0 ? `text#${tv.index + 1}` : undefined }
  // Trademark blocklist (no-deploy tunable). Cheap local check; the AI content
  // scan runs at submit (the public gate). Absent list -> no block.
  if (texts.length) {
    const { data: cfg } = await admin.from('platform_config').select('value').eq('key', 'text_trademark_blocklist').maybeSingle()
    const blocklist = parseTrademarkBlocklist(cfg?.value as string | undefined)
    if (blocklist.length) {
      for (let i = 0; i < texts.length; i++) {
        const hit = findBlockedTrademark(texts[i].content, blocklist)
        if (hit) return { ok: false, reason: 'text_trademark', detail: `text#${i + 1}: ${hit}` }
      }
    }
  }

  // 2c. Music bed (EDL v2). Shape/bounds validated here (client mirrors); asset
  //     existence + signature are resolved at step 4 (needs the DB). Gated by the
  //     season's studio_music_enabled (music stays OFF until the library is ready).
  const music = Array.isArray(args.edl) ? undefined : args.edl.music
  const mv = validateMusicBed(music, totalMs)
  if (!mv.ok) return { ok: false, reason: mv.reason }

  // 3. Load distinct sources; each must be the participant's own, same-season,
  //    ready clip with a valid CryptoBind, and each trim must fit the clip.
  const ids = [...new Set(segments.map((s) => s.jobId))]
  const { data: sources, error: srcErr } = await admin
    .from('generation_jobs')
    .select(
      'id, user_id, season_id, status, tier, duration_seconds, model_id, media_type, parent_image_job_ids, cryptobind_pid, cryptobind_tid, cryptobind_generated_at, cryptobind_signature, cryptobind_algo, cryptobind_parent_bundle, cryptobind_content_hash, cryptobind_content_signature',
    )
    .in('id', ids)
  if (srcErr) return { ok: false, reason: 'failed', detail: srcErr.message }
  const byId = new Map((sources ?? []).map((r) => [r.id as string, r]))

  for (const id of ids) {
    const row = byId.get(id)
    if (!row) return { ok: false, reason: 'source_not_found', detail: id }
    if (row.user_id !== args.userId) return { ok: false, reason: 'source_not_owned', detail: id }
    if (row.season_id !== args.seasonId) {
      return { ok: false, reason: 'source_not_owned', detail: id + ' (season mismatch)' }
    }
    if (row.status !== 'ready') {
      return { ok: false, reason: 'source_not_ready', detail: `${id} (${row.status})` }
    }
    // Sandbox fairness rule: draft clips can never enter a composition -- this
    // closes the "launder a draft through compose" path. Server layer of the
    // triple block (the picker also hides drafts, but the server is authority).
    if (row.tier === 'draft') return { ok: false, reason: 'source_draft', detail: id }
    // v1/v1c for a normal clip; v1v + parent v1i/v1ic for an i2v clip (unchanged
    // path for parent-less clips).
    const sv = await verifySourceCryptoBind(admin, row, args.seasonId)
    if (!sv.ok) return { ok: false, reason: 'source_cryptobind_failed', detail: `${id}: ${sv.detail}` }
  }
  // trim must lie within each clip's duration (a small +1ms tolerance for rounding).
  for (const seg of segments) {
    const row = byId.get(seg.jobId)!
    const durMs = Number(row.duration_seconds) * 1000
    if (seg.endMs > durMs + 1) {
      return { ok: false, reason: 'bad_segment', detail: `${seg.jobId} trim exceeds clip length` }
    }
  }

  // 4. Request-stage CryptoBind (v1sr) over EDL + the source signature bundle,
  //    then insert the queued render.
  const renderId = randomUUID()
  const generatedAt = new Date()
  const sourceSignatures = ids.map((id) => String(byId.get(id)!.cryptobind_signature))
  // Fold the music asset's v1m signature into the bundle so the bed can't be
  // swapped after signing (append-only: music-free renders push nothing).
  const ms = await resolveMusicSignature(admin, music, args.userId, await isMusicEnabled(args.seasonId))
  if (!ms.ok) return { ok: false, reason: ms.reason, detail: ms.detail }
  if (ms.signature) sourceSignatures.push(ms.signature)
  const cb = buildComposeRequestBind({
    pid: args.userId,
    tid: args.seasonId,
    renderId,
    edl: args.edl,
    sourceSignatures,
  })

  const { error: insErr } = await admin.from('render_jobs').insert({
    id: renderId,
    user_id: args.userId,
    season_id: args.seasonId,
    status: 'queued',
    edl: args.edl,
    source_job_ids: ids,
    total_duration_seconds: totalMs / 1000,
    cryptobind_pid: args.userId,
    cryptobind_tid: args.seasonId,
    cryptobind_generated_at: generatedAt.toISOString(),
    cryptobind_algo: CRYPTOBIND_ALGO,
    ...cb,
  })
  if (insErr) return { ok: false, reason: 'failed', detail: insErr.message }

  return { ok: true, renderId, totalDurationSeconds: totalMs / 1000 }
}

export type StudioRender = {
  id: string
  status: 'queued' | 'rendering' | 'uploading' | 'ready' | 'submitted' | 'failed'
  total_duration_seconds: number
  video_url: string | null
  error_message: string | null
  edl: EdlSegment[]
  submitted_at: string | null
  // Asynchronous submission: accepted before the deadline vs. actually finalised. The
  // participant screen needs both -- "accepted" is the reassurance, "finalised" is the
  // completion.
  submit_intent_at: string | null
  finalized_at: string | null
  created_at: string
}

export async function listUserRenders(userId: string, seasonId: string): Promise<StudioRender[]> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('render_jobs')
    .select('id, status, total_duration_seconds, video_url, error_message, edl, submitted_at, submit_intent_at, finalized_at, created_at')
    .eq('user_id', userId)
    .eq('season_id', seasonId)
    // Soft-deleted renders are hidden everywhere (row + R2 file preserved).
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error('listUserRenders: ' + error.message)
  return (data ?? []) as StudioRender[]
}

// ===========================================================================
// Soft-delete: a participant removes a clip / composed final from their Studio
// workspace + library. deleted_at is SET; the row and its R2 file are NEVER
// removed, the lists just hide it (deleted_at IS NULL). A SUBMITTED work is
// competition record and is never deletable (TK 2026-07-12, protection A):
//   - a render with status='submitted'
//   - a clip that is itself submitted, or was used inside a submitted render
// Everything else (failures, unused clips, unsubmitted renders, spare clips
// from a submitted round) is deletable. Best-effort ownership-scoped.
// ===========================================================================

export type DeleteResult = { ok: boolean; reason?: string }

export async function deleteClip(userId: string, jobId: string): Promise<DeleteResult> {
  const admin = createSupabaseAdmin()
  const { data: job, error } = await admin
    .from('generation_jobs')
    .select('id, status, deleted_at')
    .eq('id', jobId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return { ok: false, reason: error.message }
  if (!job) return { ok: false, reason: 'not_found' }
  if (job.deleted_at) return { ok: true } // idempotent: already hidden
  // Protection: a directly-submitted clip is competition record.
  if (job.status === 'submitted') return { ok: false, reason: 'submitted' }
  // Protection: a clip used inside a SUBMITTED render is competition record.
  const { data: subs, error: subErr } = await admin
    .from('render_jobs')
    .select('source_job_ids')
    .eq('user_id', userId)
    .eq('status', 'submitted')
  if (subErr) return { ok: false, reason: subErr.message }
  const lockedByRender = (subs ?? []).some(
    (r) => Array.isArray(r.source_job_ids) && (r.source_job_ids as string[]).includes(jobId),
  )
  if (lockedByRender) return { ok: false, reason: 'in_submitted_render' }
  const now = new Date().toISOString()
  const { error: upErr } = await admin
    .from('generation_jobs')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', jobId)
    .eq('user_id', userId)
  if (upErr) return { ok: false, reason: upErr.message }
  return { ok: true }
}

export async function deleteRender(userId: string, renderId: string): Promise<DeleteResult> {
  const admin = createSupabaseAdmin()
  const { data: render, error } = await admin
    .from('render_jobs')
    .select('id, status, deleted_at')
    .eq('id', renderId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return { ok: false, reason: error.message }
  if (!render) return { ok: false, reason: 'not_found' }
  if (render.deleted_at) return { ok: true } // idempotent: already hidden
  // Protection: a submitted final is the entry itself -- competition record.
  if (render.status === 'submitted') return { ok: false, reason: 'submitted' }
  const now = new Date().toISOString()
  const { error: upErr } = await admin
    .from('render_jobs')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', renderId)
    .eq('user_id', userId)
  if (upErr) return { ok: false, reason: upErr.message }
  return { ok: true }
}

// Render statuses an intent may be accepted against: the render was REQUESTED (and
// signed) before the deadline. 'submitted' is terminal, so it is the only exclusion.
//
// ★'failed' is INCLUDED. Excluding it recreated the very unfairness this design
// exists to remove: a participant whose render failed a minute before the deadline
// could not submit at all, with no time left to retry. The sweep gives an accepted
// failed render ONE re-render of the same EDL (v1sr unchanged, so no re-signing and
// no cap impact); if that also fails it goes to staff review with the entry intact.
// There is nothing to game here -- an accepted submission with no file scores nothing.
const ASYNC_SUBMIT_STATUSES = ['queued', 'rendering', 'uploading', 'ready', 'failed'] as const

// ===========================================================================
// Shared compose verification (steps 3 / 3b / 4 of a submission).
//
// Both submission phases need EXACTLY this, which is why it is one function: the
// intent phase runs it at the deadline with requireFinal=false (v1sc does not exist
// until the render lands) and the finalize phase runs it again with true. Running it
// twice is deliberate -- it is what makes "swap the EDL or the bed after intent" fail
// at finalize instead of going out signed.
// ===========================================================================
async function verifyComposeChain(
  admin: ReturnType<typeof createSupabaseAdmin>,
  render: {
    id: string
    edl: EdlSegment[] | ComposeEdl
    source_job_ids: string[] | null
    cryptobind_pid: string
    cryptobind_tid: string
    cryptobind_algo: string
    cryptobind_render_signature: string
    cryptobind_final_hash: string | null
    cryptobind_final_signature: string | null
  },
  args: { userId: string; seasonId: string },
  requireFinal: boolean,
): Promise<{ ok: true } | (SubmitRenderResult & { ok: false })> {
  // 3. Re-verify EVERY source clip: own-account, same season, valid CryptoBind.
  //    The signature bundle is rebuilt from these to check the render v1sr sig.
  const sourceIds = (render.source_job_ids as string[] | null) ?? []
  if (!sourceIds.length) return { ok: false, reason: 'source_not_found', detail: 'empty source set' }
  const { data: sources, error: srcErr } = await admin
    .from('generation_jobs')
    .select(
      'id, user_id, season_id, status, duration_seconds, model_id, media_type, parent_image_job_ids, cryptobind_pid, cryptobind_tid, cryptobind_generated_at, cryptobind_signature, cryptobind_algo, cryptobind_parent_bundle, cryptobind_content_hash, cryptobind_content_signature',
    )
    .in('id', sourceIds)
  if (srcErr) return { ok: false, reason: 'failed', detail: srcErr.message }
  const byId = new Map((sources ?? []).map((r) => [r.id as string, r]))

  const sourceSignatures: string[] = []
  for (const id of sourceIds) {
    const row = byId.get(id)
    if (!row) return { ok: false, reason: 'source_not_found', detail: id }
    if (row.user_id !== args.userId) {
      return { ok: false, reason: 'source_cryptobind_failed', detail: `${id}: not owned` }
    }
    if (row.season_id !== args.seasonId) {
      return { ok: false, reason: 'source_cryptobind_failed', detail: `${id}: season mismatch` }
    }
    const sv = await verifySourceCryptoBind(admin, row, args.seasonId)
    if (!sv.ok) return { ok: false, reason: 'source_cryptobind_failed', detail: `${id}: ${sv.detail}` }
    sourceSignatures.push(String(row.cryptobind_signature))
  }

  // 3b. Fold the music asset's v1m signature into the bundle EXACTLY as createRender
  //     did (append-only), so the recomputed v1sr matches. A swapped/removed bed
  //     changes the bundle -> render_sig_mismatch.
  const submitMusic = Array.isArray(render.edl) ? undefined : (render.edl as ComposeEdl).music
  const ms = await resolveMusicSignature(admin, submitMusic, args.userId, await isMusicEnabled(args.seasonId))
  if (!ms.ok) return { ok: false, reason: ms.reason, detail: ms.detail }
  if (ms.signature) sourceSignatures.push(ms.signature)

  // 4. Verify the composition itself: v1sr (EDL + source bundle), and v1sc (final)
  //    once the render exists. requireFinal is the ONLY thing the two phases differ
  //    by -- see verifyComposeBind.
  const cv = verifyComposeBind(
    {
      id: render.id,
      cryptobind_pid: String(render.cryptobind_pid),
      cryptobind_tid: String(render.cryptobind_tid),
      cryptobind_algo: String(render.cryptobind_algo),
      cryptobind_render_signature: String(render.cryptobind_render_signature),
      cryptobind_final_hash: render.cryptobind_final_hash,
      cryptobind_final_signature: render.cryptobind_final_signature,
      edl: (render.edl as EdlSegment[] | ComposeEdl) ?? [],
    },
    args.seasonId,
    sourceSignatures,
    { requireFinal },
  )
  if (!cv.ok) return { ok: false, reason: 'compose_cryptobind_failed', detail: cv.reason }
  return { ok: true }
}

// ===========================================================================
// submitRender -- submit a READY composed final into the participant's
// application for the season. This is the compose analogue of submitGeneration.
// It verifies the FULL v1s integrity chain before writing:
//   1. each source clip's own v1/v1c CryptoBind + ownership + same season
//   2. the render's v1sr request signature (EDL + source bundle recomputed live)
//   3. the worker's v1sc content signature (final hash) -- verifyComposeBind
//   4. total duration <= the season compose cap
// On success the render is locked ready->submitted (terminal); the SOURCE clips
// are intentionally left 'ready' (a clip may be reused / individually tracked).
// Status of the application row is NOT touched -- the scoring system owns that.
// ===========================================================================

export type SubmitRenderResult =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'render_not_found'
        | 'not_owner'
        | 'not_ready'
        | 'compose_disabled'
        | 'too_short'
        | 'too_long'
        | 'source_not_found'
        | 'source_cryptobind_failed'
        | 'compose_cryptobind_failed'
        | MusicReason
        | 'no_application'
        | 'already_submitted'
        | 'application_info_required'
        | 'bad_statement'
        | 'agreements_required'
        | 'name_required'
        | 'application_closed'
        | 'round_closed'
        | 'not_selected'
        | 'failed'
      detail?: string
    }

export async function submitRender(args: {
  userId: string
  email: string
  seasonId: string
  renderId: string
  applicant?: ApplicantInfo
}): Promise<SubmitRenderResult> {
  const admin = createSupabaseAdmin()

  // 1. Load the render + ownership + readiness.
  const { data: render, error: rErr } = await admin
    .from('render_jobs')
    .select(
      'id, user_id, season_id, status, video_url, thumbnail_url, total_duration_seconds, edl, source_job_ids, submit_intent_at, finalized_at, cryptobind_pid, cryptobind_tid, cryptobind_algo, cryptobind_render_signature, cryptobind_final_hash, cryptobind_final_signature',
    )
    .eq('id', args.renderId)
    .single()
  if (rErr || !render) return { ok: false, reason: 'render_not_found' }
  if (render.user_id !== args.userId) return { ok: false, reason: 'not_owner' }

  // ★ASYNCHRONOUS SUBMISSION. `rendered` -- not the caller's intent -- decides which
  // phase this call performs, so there is exactly ONE submission path:
  //   rendered  -> accept + finalize in one go (identical to the old behaviour, which
  //                is what the render_jobs rows already sitting at 'ready' get)
  //   not yet   -> accept the INTENT: everything except the parts that need the
  //                rendered bytes. The 24h buffer's sweep finalizes it later.
  // A render REQUESTED before the deadline can therefore no longer cost a
  // participant their submission just because the queue was busy.
  const rendered = render.status === 'ready' && !!render.video_url
  if (!rendered && !(ASYNC_SUBMIT_STATUSES as readonly string[]).includes(String(render.status))) {
    // failed / submitted / anything else: there is nothing to accept.
    return { ok: false, reason: 'not_ready', detail: `status=${render.status}` }
  }
  // Per-render idempotence: one render can be accepted once.
  if (render.submit_intent_at) return { ok: false, reason: 'already_submitted' }

  // 2. Season compose gate + cap (defense; caps are season-variable).
  const { data: seasonRow, error: sErr } = await admin
    .from('seasons')
    // Music gate read separately (fail-closed) -- see the note in createRender.
    .select('studio_compose_enabled, studio_compose_min_seconds, studio_compose_max_seconds, studio_prelim_hold_enabled')
    .eq('id', args.seasonId)
    .single()
  if (sErr || !seasonRow) return { ok: false, reason: 'failed', detail: 'season not found' }
  if (!seasonRow.studio_compose_enabled) return { ok: false, reason: 'compose_disabled' }
  const minSeconds = Number(seasonRow.studio_compose_min_seconds ?? 0)
  const maxSeconds = Number(seasonRow.studio_compose_max_seconds ?? 30)
  const totalSeconds = Number(render.total_duration_seconds)
  if (minSeconds > 0 && totalSeconds < minSeconds - 0.001) return { ok: false, reason: 'too_short' }
  if (totalSeconds > maxSeconds + 0.001) return { ok: false, reason: 'too_long' }

  // 3 / 3b / 4. Source clips + music bed + the composition's own signatures.
  //    requireFinal follows whether the render has actually landed: at intent time
  //    v1sc does not exist yet, and finalize runs this again with it required.
  const chain = await verifyComposeChain(admin, render, args, rendered)
  if (!chain.ok) return chain as SubmitRenderResult

  // 5. Studio round for this season -- effective round resolved server-side.
  //    Main-round window + 'selected' gate enforced below at the CAS step via
  //    canSubmitMainRound (unified with saveMainRoundSubmission).
  const cfg = await getSeasonStudioConfig(args.seasonId)
  const effectiveRound = resolveEffectiveRound(cfg)

  // 6. Find the participant's application (by email, like the rest of the site).
  const email = args.email.toLowerCase()
  const { data: appRow, error: aErr } = await admin
    .from('genesis_applications')
    .select('id, status, studio_application_submitted_at, main_round_submitted_at, studio_application_intent_at')
    .eq('season_id', args.seasonId)
    .ilike('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (aErr) return { ok: false, reason: 'failed', detail: aErr.message }

  const now = new Date().toISOString()
  const durationInt = Math.round(totalSeconds)

  // 7a. No application row yet -- application round only (the compose IS the
  //     application; main round requires a pre-existing row).
  if (!appRow) {
    // Only the application round can mint a new row; the main round requires a
    // pre-existing application.
    if (effectiveRound !== 'application') return { ok: false, reason: 'no_application' }
    const info = args.applicant
    if (!info) return { ok: false, reason: 'application_info_required' }
    const statement = (info.creatorStatement ?? '').trim()
    if (statement.length < STATEMENT_MIN || statement.length > STATEMENT_MAX) {
      return { ok: false, reason: 'bad_statement' }
    }
    if (!info.agreedRules || !info.agreedPrivacy || !info.agreedIntegrity) {
      return { ok: false, reason: 'agreements_required' }
    }

    // Identity is account-level, resolved server-side (the compose form no longer
    // asks for name/country -- profile/work split, option A). A "real" name is a
    // form value (legacy/other callers) or the saved profile name; the account
    // nickname is the fallback for the entry snapshot so creator_name is never
    // empty and matches what Watch displays. We deliberately do NOT persist the
    // nickname fallback back into profiles.creator_name (that column stays a real
    // name or null, never an auto-generated nickname).
    const profile = await getCreatorProfile(args.userId)
    const providedName = (info.creatorName ?? '').trim() || profile.creatorName
    const name = providedName || (await getDisplayName(args.userId, args.email))
    const country = info.country?.trim() || profile.country || null

    // S-1/S-2: same gates as POST /api/apply -- window + capacity/waitlist split.
    const season = await getSeasonById(args.seasonId)
    if (!season) return { ok: false, reason: 'failed', detail: 'season not found' }
    if (isApplicationClosed(season)) return { ok: false, reason: 'application_closed' }
    const activeCount = await getActiveApplicationCount(args.seasonId)
    const resolvedStatus: 'pending' | 'waitlist' = isCapacityFull(season, activeCount)
      ? 'waitlist'
      : 'pending'

    // Content safety (Patent 3): scan the creator statement AND any burned-in
    // text overlays (both are public-facing text on the entry) before the composed
    // final can go public on /watch. Mirrors POST /api/apply policy. The composed
    // video's frame scan is phase C2 (worker). No key or an API error ->
    // moderateSubmission returns 'pending' (fail-safe: not public, admin queue).
    const edlTexts = Array.isArray(render.edl) ? [] : (((render.edl as ComposeEdl).texts) ?? [])
    const overlayText = edlTexts.map((tx) => tx.content).join('\n')
    const mod = await moderateSubmission({ text: [statement, overlayText].filter((s) => s.trim()).join('\n') })

    const { error: insErr } = await admin.from('genesis_applications').insert({
      season_id: args.seasonId,
      user_id: args.userId,
      email,
      creator_name: name,
      creator_statement: statement,
      country,
      channel_url: info.channelUrl?.trim() || null,
      ai_service: 'OXXOVO Studio',
      // The URL columns are written by FINALIZE only. That is deliberate and is the
      // contract the scoring side reads: free_entry_url IS NOT NULL means "the file
      // exists and its v1sc was verified", so an accepted-but-unrendered entry is
      // never picked up as scorable. studio_application_intent_at is what records
      // that the submission itself arrived before the deadline.
      free_entry_url: rendered ? render.video_url : null,
      thumbnail_url: rendered ? render.thumbnail_url : null,
      video_duration_seconds: rendered ? durationInt : null,
      agreed_to_rules: true,
      agreed_to_privacy: true,
      agreed_to_integrity_notice: true,
      status: resolvedStatus,
      moderation_status: mod.status,
      moderation_flags: mod.categories.length ? mod.categories : null,
      moderation_checked_at: now,
      // Fairness hold (anti-copy): when the season enables it, the prelim entry is
      // held off /watch until the cohort is released together (manual/auto). Never
      // blocks scoring -- only public visibility (isPublicRow). Prelim only.
      watch_hold: !!seasonRow.studio_prelim_hold_enabled,
      studio_application_render_id: render.id,
      // submitted_at stays the "this account has submitted" marker for every other
      // caller, and it is set at ACCEPT time because that is when the submission was
      // received -- before the deadline. Only the file lags.
      studio_application_submitted_at: now,
      studio_application_intent_at: now,
      studio_submission_state: rendered ? 'finalized' : 'intent',
    })
    if (insErr) return { ok: false, reason: 'failed', detail: insErr.message }
    // Mirror account-level identity to profiles for next-submission prefill
    // (profile/work split). Non-fatal: genesis already has the snapshot.
    const mirror = await upsertCreatorProfile(args.userId, args.email, {
      creatorName: providedName ?? undefined,
      country,
    }).catch((e) => ({ ok: false as const, error: String(e) }))
    if (!mirror.ok) {
      console.error('[studio] creator profile mirror failed (non-fatal)', { userId: args.userId, path: 'submitRender', error: mirror.error })
    }
  } else if (effectiveRound === 'main') {
    // 7b-main. Mirror saveMainRoundSubmission EXACTLY: 'selected' gate via
    // canSubmitMainRound, then a selected -> main_round_submitted CAS transition.
    // This is what makes the composed main-round final visible to the scorer.
    const season = await getSeasonById(args.seasonId)
    if (!season) return { ok: false, reason: 'failed', detail: 'season not found' }
    const gate = canSubmitMainRound({ status: appRow.status }, season)
    if (!gate.ok) {
      if (gate.reason === 'not_selected') return { ok: false, reason: 'not_selected' }
      if (gate.reason === null) return { ok: false, reason: 'already_submitted' }
      return { ok: false, reason: 'round_closed', detail: gate.reason }
    }
    const { data: updated, error: upErr } = await admin
      .from('genesis_applications')
      .update({
        status: 'main_round_submitted',
        main_round_video_url: rendered ? render.video_url : null,
        thumbnail_url: rendered ? render.thumbnail_url : null,
        main_round_submitted_at: now,
        studio_main_render_id: render.id,
        studio_application_intent_at: now,
        studio_submission_state: rendered ? 'finalized' : 'intent',
      })
      .eq('id', appRow.id)
      .eq('status', 'selected')
      .select('id')
      .single()
    if (upErr || !updated) {
      if (upErr?.code === 'PGRST116') return { ok: false, reason: 'already_submitted' }
      return { ok: false, reason: 'failed', detail: upErr?.message }
    }
  } else {
    // 7c-application. Row exists -- single application submission (status unchanged).
    if (appRow.studio_application_submitted_at || appRow.studio_application_intent_at) {
      return { ok: false, reason: 'already_submitted' }
    }
    // ★The read above is not the guard -- this UPDATE is. `.is(intent_at, null)` makes
    // single submission a DB-level CAS instead of a read-then-write with a race
    // window (two tabs pressing submit within the same round trip).
    const { data: claimed, error: upErr } = await admin
      .from('genesis_applications')
      .update({
        free_entry_url: rendered ? render.video_url : null,
        thumbnail_url: rendered ? render.thumbnail_url : null,
        video_duration_seconds: rendered ? durationInt : null,
        ai_service: 'OXXOVO Studio',
        studio_application_render_id: render.id,
        studio_application_submitted_at: now,
        studio_application_intent_at: now,
        studio_submission_state: rendered ? 'finalized' : 'intent',
      })
      .eq('id', appRow.id)
      .is('studio_application_intent_at', null)
      .select('id')
    if (upErr) return { ok: false, reason: 'failed', detail: upErr.message }
    if (!claimed?.length) return { ok: false, reason: 'already_submitted' }
  }

  // 8. Lock the render. Both branches CAS on `submit_intent_at IS NULL` so a double
  //    submit cannot take the row twice.
  if (rendered) {
    const { error: rUpErr } = await admin
      .from('render_jobs')
      .update({ status: 'submitted', submitted_at: now, submit_intent_at: now, finalized_at: now, updated_at: now })
      .eq('id', render.id)
      .eq('status', 'ready')
      .is('submit_intent_at', null)
    if (rUpErr) return { ok: false, reason: 'failed', detail: rUpErr.message }
  } else {
    // Accepted, not finalized. status is left alone ON PURPOSE so the worker keeps
    // rendering it; submit_intent_at is what marks it as claimed for submission and
    // is what the finalize sweep looks for.
    const { data: marked, error: rUpErr } = await admin
      .from('render_jobs')
      .update({ submit_intent_at: now, updated_at: now })
      .eq('id', render.id)
      .is('submit_intent_at', null)
      .select('id')
    if (rUpErr) return { ok: false, reason: 'failed', detail: rUpErr.message }
    if (!marked?.length) return { ok: false, reason: 'already_submitted' }
    // Nothing else to do: archiving the round's clips waits for finalize, because a
    // participant whose render is still queued must keep seeing their workspace.
    return { ok: true }
  }

  // 9. Move THIS round's remaining ready source clips into My Library (soft
  //    archive) so the Compose workspace + generate screen empty out -- single
  //    submission means the round is done. NEVER deletes. Round-scoped by the
  //    same created_at boundary as the compose picker. Best-effort: an archive
  //    failure must NOT undo a successful submit.
  let arch = admin
    .from('generation_jobs')
    .update({ archived_at: now, updated_at: now })
    .eq('user_id', args.userId)
    .eq('season_id', args.seasonId)
    .eq('status', 'ready')
    .is('archived_at', null)
  if (cfg.round === 'both' && cfg.mainRoundStartAt) {
    arch = effectiveRound === 'main'
      ? arch.gte('created_at', cfg.mainRoundStartAt)
      : arch.lt('created_at', cfg.mainRoundStartAt)
  }
  const { error: archErr } = await arch
  if (archErr) console.error('[studio] submit archive failed (non-fatal):', archErr.message)

  return { ok: true }
}

// ===========================================================================
// finalizeSubmission -- the second half of an asynchronous submission.
//
// Runs after the worker has rendered an ACCEPTED submission: verifies the full chain
// again (now including v1sc), publishes the file onto the application row, and closes
// the render out. Idempotent and safe to call from two places at once -- the season
// tick sweeps every pending row hourly, and a participant viewing their own render
// triggers it for their own row so they are not waiting on the cron.
//
// ★It must never run for a render that was not accepted: without `submit_intent_at`
// this would fill free_entry_url before the deadline, and free_entry_url IS NOT NULL
// is exactly what makes an entry scorable. The four conditions below are the gate.
// ===========================================================================
export type FinalizeResult =
  | { ok: true; finalized: boolean }
  | { ok: false; reason: string; detail?: string }

export async function finalizeSubmission(renderId: string): Promise<FinalizeResult> {
  const admin = createSupabaseAdmin()
  const { data: render, error: rErr } = await admin
    .from('render_jobs')
    .select(
      'id, user_id, season_id, status, video_url, thumbnail_url, total_duration_seconds, edl, source_job_ids, submit_intent_at, finalized_at, cryptobind_pid, cryptobind_tid, cryptobind_algo, cryptobind_render_signature, cryptobind_final_hash, cryptobind_final_signature',
    )
    .eq('id', renderId)
    .single()
  if (rErr || !render) return { ok: false, reason: 'render_not_found' }

  // The gate. Any miss is a no-op, not an error: the sweep calls this speculatively.
  if (!render.submit_intent_at) return { ok: true, finalized: false }
  if (render.finalized_at) return { ok: true, finalized: false }
  if (render.status !== 'ready' || !render.video_url) return { ok: true, finalized: false }

  const seasonId = String(render.season_id)
  const userId = String(render.user_id)

  // Full chain INCLUDING v1sc. Re-running it here is what catches an EDL or bed that
  // was swapped between accept and finalize.
  const chain = await verifyComposeChain(admin, render, { userId, seasonId }, true)
  if (!chain.ok) {
    await admin
      .from('genesis_applications')
      .update({ studio_submission_state: 'finalize_rejected', updated_at: new Date().toISOString() })
      .eq('studio_application_render_id', render.id)
    return { ok: false, reason: chain.reason, detail: chain.detail }
  }

  const { data: seasonRow } = await admin
    .from('seasons')
    .select('studio_prelim_hold_enabled')
    .eq('id', seasonId)
    .single()

  const now = new Date().toISOString()
  const durationInt = Math.round(Number(render.total_duration_seconds))
  const { data: appRow } = await admin
    .from('genesis_applications')
    .select('id, status, studio_main_render_id')
    .eq('studio_application_render_id', render.id)
    .maybeSingle()

  if (appRow) {
    // Prelim entry: publish the file. The hold flag is stamped HERE (not at accept)
    // because it gates public visibility of a file that did not exist yet.
    await admin
      .from('genesis_applications')
      .update({
        free_entry_url: render.video_url,
        thumbnail_url: render.thumbnail_url,
        video_duration_seconds: durationInt,
        watch_hold: !!seasonRow?.studio_prelim_hold_enabled,
        studio_submission_state: 'finalized',
        updated_at: now,
      })
      .eq('id', appRow.id)
  } else {
    // Main round: the render is referenced by studio_main_render_id instead.
    await admin
      .from('genesis_applications')
      .update({
        main_round_video_url: render.video_url,
        thumbnail_url: render.thumbnail_url,
        studio_submission_state: 'finalized',
        updated_at: now,
      })
      .eq('studio_main_render_id', render.id)
  }

  // Close the render out. CAS on finalized_at so two concurrent sweeps cannot both
  // archive the participant's clips.
  const { data: closed, error: cErr } = await admin
    .from('render_jobs')
    .update({ status: 'submitted', submitted_at: now, finalized_at: now, updated_at: now })
    .eq('id', render.id)
    .is('finalized_at', null)
    .select('id')
  if (cErr) return { ok: false, reason: 'failed', detail: cErr.message }
  if (!closed?.length) return { ok: true, finalized: false }

  // Archive this round's remaining ready clips (same rule as the synchronous path).
  const cfg = await getSeasonStudioConfig(seasonId)
  let arch = admin
    .from('generation_jobs')
    .update({ archived_at: now, updated_at: now })
    .eq('user_id', userId)
    .eq('season_id', seasonId)
    .eq('status', 'ready')
    .is('archived_at', null)
  if (cfg.round === 'both' && cfg.mainRoundStartAt) {
    arch = appRow ? arch.lt('created_at', cfg.mainRoundStartAt) : arch.gte('created_at', cfg.mainRoundStartAt)
  }
  const { error: archErr } = await arch
  if (archErr) console.error('[studio] finalize archive failed (non-fatal):', archErr.message)

  return { ok: true, finalized: true }
}

// ===========================================================================
// sweepAsyncSubmissions -- the 24h processing buffer's engine. Called from the
// SEASON TICK (hourly), deliberately NOT from a new Vercel cron entry: the plan's
// cron limit is already at 3, and exceeding it deploys fine while the schedule
// silently never fires.
//
// It also runs the render LEASE recovery, which is a pre-existing bug rather than
// anything to do with asynchronous submission: claimNextRender() moves a row to
// 'rendering' with no claimed_at and nothing anywhere reclaims it, so a worker that
// dies mid-render leaves that row stuck forever -- no retry, no failure, no trace.
// A worker WAS down for a month, so this is not hypothetical.
//
// Nothing here ever fails a participant: an overdue render is flagged for staff, not
// rejected. A platform backlog is not a participant's failure.
// ===========================================================================
export type AsyncSweepReport = {
  finalized: string[]
  requeued: string[]
  overdue: string[]
  rejected: { renderId: string; reason: string }[]
}

// ★Lease threshold, derived rather than guessed. The worker now enforces a 15 minute
// timeout on every ffmpeg call (RENDER_TIMEOUT_MS), itself based on a measured 20.6s
// wall clock for a 40s five-clip 720p render with effects, transitions and text
// (local machine, 2026-07-30). This is 2x that bound: the worker's own timeout fires
// first and marks the render failed, so this only triggers when the PROCESS died
// without cleaning up. My earlier 3h had no source and would have burned 12.5% of the
// 24h buffer; 30 minutes burns 2%.
const RENDER_LEASE_STALE_MS = Math.max(60_000, Number(process.env.RENDER_LEASE_STALE_MS ?? '1800000'))
// How long an accepted submission may sit unfinished before staff are told. This does
// NOT fail anything -- it only raises a flag. The buffer itself is a season parameter.
const SUBMISSION_OVERDUE_MS = Math.max(60_000, Number(process.env.SUBMISSION_OVERDUE_MS ?? '86400000'))
// One re-render, tracked by the application row's state rather than a new column.
const REQUEUED_STATE = 'render_requeued'
// ★How many times a render may be CLAIMED before the lease sweep stops handing it
// out again. The worker increments `attempts` on every claim, so 3 means: the
// original attempt plus two recoveries. Derived from what the failures look like
// rather than picked: a render that dies twice in a row is not a transient worker
// death, it is a render that kills workers, and the third recovery only adds
// another zombie window. Env-overridable like the two thresholds above, so a bad
// value can be corrected without a deploy.
const MAX_RENDER_ATTEMPTS = Math.max(1, Number(process.env.MAX_RENDER_ATTEMPTS ?? '3'))

export async function sweepAsyncSubmissions(): Promise<AsyncSweepReport> {
  const admin = createSupabaseAdmin()
  const out: AsyncSweepReport = { finalized: [], requeued: [], overdue: [], rejected: [] }
  const nowMs = Date.now()

  // ★TARGET SET, declared rather than implied: this sweep owns renders that were
  // ACCEPTED for submission. Everything else -- clips, music, and renders nobody
  // submitted -- belongs to sweepStudioLeases. The split is lane C's
  // lib/studio-sweep-scope.ts, used here rather than restated, because two sweeps
  // over one table that merely "agree today" is how a row gets requeued twice per
  // tick: the attempts bound is bypassed and each extra requeue re-opens the
  // zombie window.
  const { data: pending, error } = await admin
    .from('render_jobs')
    .select('id, status, submit_intent_at, claimed_at, updated_at, attempts')
    .not('submit_intent_at', 'is', null) // the query half of the same rule
    .is('finalized_at', null)
  if (error) {
    console.error('[studio] async sweep query failed:', error.message)
    return out
  }

  for (const row of pending ?? []) {
    const id = String(row.id)
    // Defence in depth: the filter above is a string in a query builder and the
    // predicate is the actual rule. If they ever disagree, skip loudly rather than
    // act on a row this sweep does not own.
    if (!isOwnedBy('async_submission', { table: 'render_jobs', hasSubmitIntent: row.submit_intent_at != null })) {
      console.error(`[studio] async sweep fetched a row it does not own (${id}) -- filter drift; skipping`)
      continue
    }
    if (row.status === 'ready') {
      const res = await finalizeSubmission(id)
      if (res.ok && res.finalized) out.finalized.push(id)
      else if (!res.ok) out.rejected.push({ renderId: id, reason: res.reason })
      continue
    }

    // ★An accepted render that FAILED gets exactly one re-render of the same EDL. The
    // marker is the application row's state, so no extra column is needed. A second
    // failure is a staff matter, never an automatic elimination.
    if (row.status === 'failed') {
      const { data: app } = await admin
        .from('genesis_applications')
        .select('id, studio_submission_state')
        .eq('studio_application_render_id', id)
        .maybeSingle()
      if (app?.studio_submission_state === REQUEUED_STATE) {
        out.overdue.push(id)
        await admin
          .from('genesis_applications')
          .update({ studio_submission_state: 'render_failed' })
          .eq('id', app.id)
        continue
      }
      const { data: requeued } = await admin
        .from('render_jobs')
        // ★claim_token: null is what actually disowns the previous attempt. Clearing
        // claimed_at only makes the row look free; the token is what the worker's
        // writes are CAS'd against, so leaving it set means a stalled worker that
        // wakes between the requeue and the next claim still passes its own CAS and
        // writes onto a row that is queued for someone else. Matches
        // sweepStudioLeases, which clears it for the same reason.
        .update({ status: 'queued', claimed_at: null, claim_token: null, error_message: null, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'failed')
        .select('id')
      if (requeued?.length) {
        out.requeued.push(id)
        if (app) {
          await admin
            .from('genesis_applications')
            .update({ studio_submission_state: REQUEUED_STATE })
            .eq('id', app.id)
        }
      }
      continue
    }

    // Lease recovery: 'rendering'/'uploading' with no progress for too long means the
    // claiming worker is gone. Back to 'queued' so another lane picks it up.
    //
    // ★BOUNDED. This used to say "attempts is left untouched so this cannot loop
    // forever", which was simply wrong: nothing read attempts, and the worker
    // increments it on the next claim anyway, so a render that kills its worker
    // every time was requeued once an hour indefinitely. A render costs no vendor
    // money (CPU only), so the cost was not the argument against it -- the zombie
    // window was. Every requeue is another chance for the stalled worker to wake
    // up and write over the one that finished, so an unbounded retry is an
    // unbounded number of draws at that race. The cap ends the draws.
    //
    // Past the cap the row is LEFT ALONE, deliberately: not requeued, and not
    // failed either. Auto-failing would take a decision that belongs to staff and
    // hand a participant an error for a platform problem. It goes into `overdue`,
    // which is the tick's "a human should look at this" channel.
    if (row.status === 'rendering' || row.status === 'uploading') {
      const since = Date.parse(String(row.claimed_at ?? row.updated_at ?? ''))
      if (Number.isFinite(since) && nowMs - since > RENDER_LEASE_STALE_MS) {
        const attempts = Number(row.attempts ?? 0)
        if (attempts >= MAX_RENDER_ATTEMPTS) {
          out.overdue.push(id)
          console.error(
            `[studio] render ${id} stalled at attempt ${attempts} (cap ${MAX_RENDER_ATTEMPTS}) -- ` +
              'not requeued, left for staff',
          )
          continue
        }
        const { data: requeued } = await admin
          .from('render_jobs')
          .update({ status: 'queued', claimed_at: null, claim_token: null, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('status', row.status)
          .select('id')
        if (requeued?.length) out.requeued.push(id)
      }
    }

    // Overdue: flag for staff, never auto-fail.
    const accepted = Date.parse(String(row.submit_intent_at))
    if (Number.isFinite(accepted) && nowMs - accepted > SUBMISSION_OVERDUE_MS) {
      out.overdue.push(id)
      await admin
        .from('genesis_applications')
        .update({ studio_submission_state: 'render_overdue' })
        .eq('studio_application_render_id', id)
        .neq('studio_submission_state', 'finalized')
    }
  }
  return out
}
