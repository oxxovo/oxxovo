// Studio domain logic -- SERVER ONLY. Generation enqueue (with credit charge +
// CryptoBind generation-time signature) and submission (CryptoBind verify +
// immutable write into genesis_applications). All state transitions are
// server-authoritative; the worker (oxxovo-studio) advances the job through the
// 6-stage machine and produces the artifact.

import 'server-only'
import { randomUUID } from 'crypto'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getBalance, getStudioPricing, creditsForCost } from '@/lib/credits'
import { moderateSubmission } from '@/lib/moderation'
import { getCreatorProfile, upsertCreatorProfile } from '@/lib/profile'
import { getDisplayName } from '@/lib/nickname'
import {
  buildCryptoBind,
  verifyCryptoBind,
  buildComposeRequestBind,
  verifyComposeBind,
  CRYPTOBIND_ALGO,
  type EdlSegment,
} from '@/lib/cryptobind'

// Re-export so callers (server actions, the editor) get the EDL segment type
// from the studio module alongside createRender, without importing the
// server-only cryptobind module directly.
export type { EdlSegment } from '@/lib/cryptobind'
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

export type StudioTier = 'budget' | 'standard' | 'premium'

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
}

export type StudioJob = {
  id: string
  status: 'queued' | 'generating' | 'uploading' | 'ready' | 'submitted' | 'failed'
  tier: string
  prompt: string
  duration_seconds: number
  video_url: string | null
  error_message: string | null
  submitted_at: string | null
  created_at: string
}

export type StudioRoundSetting = 'application' | 'main' | 'both'
// 2-stage tournament: preliminary(application) -> main round (본선) -> 1/2/3.
// There is no separate final (결승) stage.
export type EffectiveRound = 'application' | 'main'

export type SeasonStudioConfig = {
  round: StudioRoundSetting
  maxGenerationsPerRound: number
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

export async function getActiveModels(): Promise<StudioModel[]> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('model_catalog')
    .select('id, tier, display_name, cost_per_second_usd, min_duration_seconds, max_duration_seconds, metadata')
    .eq('active', true)
    .order('cost_per_second_usd', { ascending: true })
  if (error) throw new Error('getActiveModels: ' + error.message)
  return (data ?? []).map((m) => {
    const md = (m.metadata ?? {}) as {
      has_audio?: boolean
      prompt_max?: number
      prompt_style?: string
      param_whitelist?: Record<string, StudioParamRule>
    }
    return {
      id: m.id as string,
      tier: m.tier as StudioTier,
      display_name: m.display_name as string,
      cost_per_second_usd: m.cost_per_second_usd as number,
      min_duration_seconds: m.min_duration_seconds as number,
      max_duration_seconds: m.max_duration_seconds as number,
      // Missing flag -> assume audio (the audio-capable models are the norm);
      // only an explicit has_audio:false marks a silent model.
      hasAudio: md.has_audio !== false,
      // null when unspecified (Seedance) -> UI counts but does not hard-cap.
      promptMax: typeof md.prompt_max === 'number' ? md.prompt_max : null,
      promptStyle: md.prompt_style === 'bracket' ? 'bracket' : null,
      paramWhitelist: md.param_whitelist ?? null,
    }
  })
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
  return (data ?? []) as StudioPreset[]
}

export async function getSeasonStudioConfig(seasonId: string): Promise<SeasonStudioConfig> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('seasons')
    .select('studio_round, studio_max_generations_per_round, main_round_start_at, submission_hours, application_video_min_seconds, application_video_max_seconds, main_round_video_min_seconds, main_round_video_max_seconds, studio_compose_enabled, studio_compose_min_seconds, studio_compose_max_seconds')
    .eq('id', seasonId)
    .single()
  if (error) throw new Error('getSeasonStudioConfig: ' + error.message)
  return {
    round: (data.studio_round as StudioRoundSetting) ?? 'main',
    maxGenerationsPerRound: Number(data.studio_max_generations_per_round ?? 10),
    mainRoundStartAt: (data.main_round_start_at as string | null) ?? null,
    submissionHours: Number(data.submission_hours ?? 48),
    applicationVideoMinSeconds: Number(data.application_video_min_seconds ?? 0),
    applicationVideoMaxSeconds: Number(data.application_video_max_seconds ?? 0),
    mainRoundVideoMinSeconds: Number(data.main_round_video_min_seconds ?? 0),
    mainRoundVideoMaxSeconds: Number(data.main_round_video_max_seconds ?? 0),
    studioComposeEnabled: Boolean(data.studio_compose_enabled),
    studioComposeMinSeconds: Number(data.studio_compose_min_seconds ?? 0),
    studioComposeMaxSeconds: Number(data.studio_compose_max_seconds ?? 0),
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
): Promise<number> {
  const admin = createSupabaseAdmin()
  let q = admin
    .from('generation_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('season_id', seasonId)

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
    .select('id, status, tier, prompt, duration_seconds, video_url, error_message, submitted_at, created_at')
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

  const used = await countGenerationsForRound(args.userId, args.seasonId, cfg, effectiveRound)
  if (used >= cfg.maxGenerationsPerRound) return { ok: false, reason: 'cap_reached' }

  // 4. Price + balance.
  const pricing = await getStudioPricing()
  const estCost = model.cost_per_second_usd * duration
  const credits = creditsForCost(estCost, pricing)
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
  // advanced-param merge. NULL when neither was used (legacy-identical row).
  const userParams =
    preset || Object.keys(advancedParams).length > 0
      ? {
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
      'id, user_id, season_id, status, video_url, duration_seconds, model_id, cryptobind_pid, cryptobind_tid, cryptobind_generated_at, cryptobind_signature, cryptobind_algo, cryptobind_content_hash, cryptobind_content_signature',
    )
    .eq('id', args.jobId)
    .single()
  if (jErr || !job) return { ok: false, reason: 'job_not_found' }
  if (job.user_id !== args.userId) return { ok: false, reason: 'not_owner' }
  if (job.status !== 'ready') return { ok: false, reason: 'not_ready' }

  // 2. CryptoBind verify -- signature valid AND bound to THIS tournament.
  const v = verifyCryptoBind(job, args.seasonId)
  if (!v.ok) return { ok: false, reason: 'cryptobind_failed', detail: v.reason }

  // 3. Studio round for this season -- effective round resolved server-side.
  //    The main-round window + 'selected' gate is enforced below at the CAS step
  //    via canSubmitMainRound -- unified with the canonical saveMainRoundSubmission
  //    path so a studio main-round submission transitions status the same way.
  const cfg = await getSeasonStudioConfig(args.seasonId)
  const effectiveRound = resolveEffectiveRound(cfg)

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
      studio_application_job_id: job.id,
      studio_application_signature: job.cryptobind_signature,
      studio_application_submitted_at: now,
    })
    if (insErr) return { ok: false, reason: 'failed', detail: insErr.message }
    // Mirror account-level identity to profiles so the next submission prefills
    // it (profile/work split). Non-fatal: genesis already has the snapshot.
    await upsertCreatorProfile(args.userId, { creatorName: name, country: info.country }).catch(() => {})
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
        | 'source_not_ready'
        | 'source_cryptobind_failed'
        | 'failed'
      detail?: string
    }

export async function createRender(args: {
  userId: string
  seasonId: string
  edl: EdlSegment[]
}): Promise<CreateRenderResult> {
  const admin = createSupabaseAdmin()
  const edl = Array.isArray(args.edl) ? args.edl : []
  if (!edl.length) return { ok: false, reason: 'empty_edl' }

  // 1. Season compose config (caps are season-variable).
  const { data: seasonRow, error: sErr } = await admin
    .from('seasons')
    .select('studio_compose_enabled, studio_compose_min_seconds, studio_compose_max_seconds, studio_compose_max_clips')
    .eq('id', args.seasonId)
    .single()
  if (sErr || !seasonRow) return { ok: false, reason: 'failed', detail: 'season not found' }
  if (!seasonRow.studio_compose_enabled) return { ok: false, reason: 'compose_disabled' }
  const maxClips = Number(seasonRow.studio_compose_max_clips ?? 10)
  const minSeconds = Number(seasonRow.studio_compose_min_seconds ?? 0)
  const maxSeconds = Number(seasonRow.studio_compose_max_seconds ?? 30)

  if (edl.length > maxClips) return { ok: false, reason: 'too_many_clips' }

  // 2. Segment shape + total duration <= compose cap.
  let totalMs = 0
  for (const seg of edl) {
    if (
      !seg ||
      typeof seg.jobId !== 'string' ||
      !Number.isFinite(seg.startMs) ||
      !Number.isFinite(seg.endMs)
    ) {
      return { ok: false, reason: 'bad_segment' }
    }
    if (seg.startMs < 0 || seg.endMs <= seg.startMs) return { ok: false, reason: 'bad_segment' }
    totalMs += seg.endMs - seg.startMs
  }
  if (totalMs <= 0) return { ok: false, reason: 'empty_edl' }
  if (minSeconds > 0 && totalMs < minSeconds * 1000) return { ok: false, reason: 'too_short' }
  if (totalMs > maxSeconds * 1000) return { ok: false, reason: 'too_long' }

  // 3. Load distinct sources; each must be the participant's own, same-season,
  //    ready clip with a valid CryptoBind, and each trim must fit the clip.
  const ids = [...new Set(edl.map((s) => s.jobId))]
  const { data: sources, error: srcErr } = await admin
    .from('generation_jobs')
    .select(
      'id, user_id, season_id, status, duration_seconds, model_id, cryptobind_pid, cryptobind_tid, cryptobind_generated_at, cryptobind_signature, cryptobind_algo, cryptobind_content_hash, cryptobind_content_signature',
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
    const v = verifyCryptoBind(row as Parameters<typeof verifyCryptoBind>[0], args.seasonId)
    if (!v.ok) return { ok: false, reason: 'source_cryptobind_failed', detail: `${id}: ${v.reason}` }
  }
  // trim must lie within each clip's duration (a small +1ms tolerance for rounding).
  for (const seg of edl) {
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
  const cb = buildComposeRequestBind({
    pid: args.userId,
    tid: args.seasonId,
    renderId,
    edl,
    sourceSignatures,
  })

  const { error: insErr } = await admin.from('render_jobs').insert({
    id: renderId,
    user_id: args.userId,
    season_id: args.seasonId,
    status: 'queued',
    edl,
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
  created_at: string
}

export async function listUserRenders(userId: string, seasonId: string): Promise<StudioRender[]> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('render_jobs')
    .select('id, status, total_duration_seconds, video_url, error_message, edl, submitted_at, created_at')
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
      'id, user_id, season_id, status, video_url, thumbnail_url, total_duration_seconds, edl, source_job_ids, cryptobind_pid, cryptobind_tid, cryptobind_algo, cryptobind_render_signature, cryptobind_final_hash, cryptobind_final_signature',
    )
    .eq('id', args.renderId)
    .single()
  if (rErr || !render) return { ok: false, reason: 'render_not_found' }
  if (render.user_id !== args.userId) return { ok: false, reason: 'not_owner' }
  if (render.status !== 'ready') return { ok: false, reason: 'not_ready' }
  if (!render.video_url) return { ok: false, reason: 'not_ready', detail: 'no video_url' }

  // 2. Season compose gate + cap (defense; caps are season-variable).
  const { data: seasonRow, error: sErr } = await admin
    .from('seasons')
    .select('studio_compose_enabled, studio_compose_min_seconds, studio_compose_max_seconds')
    .eq('id', args.seasonId)
    .single()
  if (sErr || !seasonRow) return { ok: false, reason: 'failed', detail: 'season not found' }
  if (!seasonRow.studio_compose_enabled) return { ok: false, reason: 'compose_disabled' }
  const minSeconds = Number(seasonRow.studio_compose_min_seconds ?? 0)
  const maxSeconds = Number(seasonRow.studio_compose_max_seconds ?? 30)
  const totalSeconds = Number(render.total_duration_seconds)
  if (minSeconds > 0 && totalSeconds < minSeconds - 0.001) return { ok: false, reason: 'too_short' }
  if (totalSeconds > maxSeconds + 0.001) return { ok: false, reason: 'too_long' }

  // 3. Re-verify EVERY source clip: own-account, same season, valid CryptoBind.
  //    The signature bundle is rebuilt from these to check the render v1sr sig.
  const sourceIds = (render.source_job_ids as string[] | null) ?? []
  if (!sourceIds.length) return { ok: false, reason: 'source_not_found', detail: 'empty source set' }
  const { data: sources, error: srcErr } = await admin
    .from('generation_jobs')
    .select(
      'id, user_id, season_id, status, duration_seconds, model_id, cryptobind_pid, cryptobind_tid, cryptobind_generated_at, cryptobind_signature, cryptobind_algo, cryptobind_content_hash, cryptobind_content_signature',
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
    const v = verifyCryptoBind(row as Parameters<typeof verifyCryptoBind>[0], args.seasonId)
    if (!v.ok) return { ok: false, reason: 'source_cryptobind_failed', detail: `${id}: ${v.reason}` }
    sourceSignatures.push(String(row.cryptobind_signature))
  }

  // 4. Verify the composition itself: v1sr (EDL + source bundle) then v1sc (final).
  const cv = verifyComposeBind(
    {
      id: render.id as string,
      cryptobind_pid: String(render.cryptobind_pid),
      cryptobind_tid: String(render.cryptobind_tid),
      cryptobind_algo: String(render.cryptobind_algo),
      cryptobind_render_signature: String(render.cryptobind_render_signature),
      cryptobind_final_hash: render.cryptobind_final_hash as string | null,
      cryptobind_final_signature: render.cryptobind_final_signature as string | null,
      edl: (render.edl as EdlSegment[]) ?? [],
    },
    args.seasonId,
    sourceSignatures,
  )
  if (!cv.ok) return { ok: false, reason: 'compose_cryptobind_failed', detail: cv.reason }

  // 5. Studio round for this season -- effective round resolved server-side.
  //    Main-round window + 'selected' gate enforced below at the CAS step via
  //    canSubmitMainRound (unified with saveMainRoundSubmission).
  const cfg = await getSeasonStudioConfig(args.seasonId)
  const effectiveRound = resolveEffectiveRound(cfg)

  // 6. Find the participant's application (by email, like the rest of the site).
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
    const name = providedName || (await getDisplayName(args.userId))
    const country = info.country?.trim() || profile.country || null

    // S-1/S-2: same gates as POST /api/apply -- window + capacity/waitlist split.
    const season = await getSeasonById(args.seasonId)
    if (!season) return { ok: false, reason: 'failed', detail: 'season not found' }
    if (isApplicationClosed(season)) return { ok: false, reason: 'application_closed' }
    const activeCount = await getActiveApplicationCount(args.seasonId)
    const resolvedStatus: 'pending' | 'waitlist' = isCapacityFull(season, activeCount)
      ? 'waitlist'
      : 'pending'

    // Content safety (Patent 3): scan the creator statement before the composed
    // final can go public on /watch. Mirrors POST /api/apply policy. The composed
    // video's frame scan is phase C2 (worker). No key or an API error ->
    // moderateSubmission returns 'pending' (fail-safe: not public, admin queue).
    const mod = await moderateSubmission({ text: statement })

    const { error: insErr } = await admin.from('genesis_applications').insert({
      season_id: args.seasonId,
      user_id: args.userId,
      email,
      creator_name: name,
      creator_statement: statement,
      country,
      channel_url: info.channelUrl?.trim() || null,
      ai_service: 'OXXOVO Studio',
      free_entry_url: render.video_url,
      thumbnail_url: render.thumbnail_url,
      video_duration_seconds: durationInt,
      agreed_to_rules: true,
      agreed_to_privacy: true,
      agreed_to_integrity_notice: true,
      status: resolvedStatus,
      moderation_status: mod.status,
      moderation_flags: mod.categories.length ? mod.categories : null,
      moderation_checked_at: now,
      studio_application_render_id: render.id,
      studio_application_submitted_at: now,
    })
    if (insErr) return { ok: false, reason: 'failed', detail: insErr.message }
    // Mirror account-level identity to profiles for next-submission prefill
    // (profile/work split). Non-fatal: genesis already has the snapshot.
    await upsertCreatorProfile(args.userId, { creatorName: providedName ?? undefined, country }).catch(() => {})
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
        main_round_video_url: render.video_url,
        thumbnail_url: render.thumbnail_url,
        main_round_submitted_at: now,
        studio_main_render_id: render.id,
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
    if (appRow.studio_application_submitted_at) return { ok: false, reason: 'already_submitted' }
    const { error: upErr } = await admin
      .from('genesis_applications')
      .update({
        free_entry_url: render.video_url,
        thumbnail_url: render.thumbnail_url,
        video_duration_seconds: durationInt,
        ai_service: 'OXXOVO Studio',
        studio_application_render_id: render.id,
        studio_application_submitted_at: now,
      })
      .eq('id', appRow.id)
    if (upErr) return { ok: false, reason: 'failed', detail: upErr.message }
  }

  // 8. Lock the render: ready -> submitted (terminal). CAS guards a double
  //    submit race.
  const { error: rUpErr } = await admin
    .from('render_jobs')
    .update({ status: 'submitted', submitted_at: now, updated_at: now })
    .eq('id', render.id)
    .eq('status', 'ready')
  if (rUpErr) return { ok: false, reason: 'failed', detail: rUpErr.message }

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
