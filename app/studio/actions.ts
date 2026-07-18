'use server'

// Studio server actions. Public-site users authenticate via oxxovo_token (the
// Supabase access token in localStorage); every action verifies it via
// auth.getUser() before touching the DB with the service role -- same pattern as
// app/profile/actions.ts.

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentSeason } from '@/lib/seasons'
import { getRevealedTheme } from '@/lib/seasons-theme'
import {
  getActiveModels,
  getSeasonStudioConfig,
  resolveEffectiveRound,
  isInEffectiveRound,
  countGenerationsForRound,
  listUserJobs,
  createGeneration,
  createImageGeneration,
  createCharacter,
  listCharacters,
  deleteCharacter,
  createI2vGeneration,
  getActivePresets,
  getModelEtas,
  submitGeneration,
  createRender,
  listUserRenders,
  submitRender,
  deleteClip,
  deleteRender,
  STATEMENT_MIN,
  STATEMENT_MAX,
  type StudioModel,
  type StudioCharacter,
  type StudioPreset,
  type StudioJob,
  type ApplicantInfo,
  type EdlSegment,
  type EffectiveRound,
} from '@/lib/studio'
import { getBalance, getStudioPricing, getStudioPurchaseConfig } from '@/lib/credits'
import { isSession6Enabled } from '@/lib/session6'
import { getCreatorProfile } from '@/lib/profile'
import { getDisplayName } from '@/lib/nickname'

export type PurchaseOptions = { enabled: boolean; packUsd: number[]; creditUsdValue: number }

// Credit top-up packs for the /studio buy section. Gated by both session6 and
// the dedicated studio_purchase_enabled switch.
export async function getPurchaseOptions(): Promise<PurchaseOptions> {
  if (!(await isSession6Enabled())) return { enabled: false, packUsd: [], creditUsdValue: 0.1 }
  const cfg = await getStudioPurchaseConfig()
  return { enabled: cfg.enabled, packUsd: cfg.packUsd, creditUsdValue: cfg.creditUsdValue }
}

async function verifyToken(
  token: string,
): Promise<{ userId: string; email: string } | null> {
  if (!token) return null
  const admin = createSupabaseAdmin()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user?.email) return null
  return { userId: data.user.id, email: data.user.email.toLowerCase() }
}

export type StudioState = {
  email: string
  season: {
    id: string
    displayName: string
    seasonNumber: number
    round: EffectiveRound
    theme: string | null
    twist: string | null
    twistRevealed: boolean
  }
  models: StudioModel[]
  // The 8 camera/motion presets (Stage 1 CameraDirector), server-loaded from
  // studio_presets (RLS-locked; the client cannot read the table directly).
  presets: StudioPreset[]
  // Rolling median generation seconds per model (last <=20 real completions).
  // A model absent here has too few samples -- the UI shows NOTHING for it
  // (honest display: measured rolling data only, never a static label).
  modelEtas: Record<string, number>
  balance: number
  generationsUsed: number
  maxGenerations: number
  // Sandbox(draft) cap -- independent of the competition cap above.
  draftGenerationsUsed: number
  maxDraftGenerations: number
  jobs: StudioJob[]
  hasApplication: boolean
  alreadySubmitted: boolean
  pricing: { marginRate: number; creditUsdValue: number }
  // When the season runs in compose mode, clips are building blocks that get
  // stitched into one final in /studio/compose. Drives the compose entry CTA.
  composeEnabled: boolean
  // Final-render length rule, straight from the season. The CTA hint STATES this
  // rule, so it must never be written as a literal -- a season change has to move
  // the copy with it. Enforcement lives in createRender, not here.
  composeMinSeconds: number
  composeMaxSeconds: number
  // Account-level identity prefilled into the applicant form (profile/work
  // split) so name/country are not re-typed each submission. Consents are not
  // prefilled -- they stay per-submission.
  profile: { creatorName: string | null; country: string | null }
}

export type LoadStudioResult =
  | { ok: true; data: StudioState }
  | { ok: false; error: 'invalid_token' | 'no_season' | 'load_failed' | 'disabled'; detail?: string }

export async function loadStudioState(token: string): Promise<LoadStudioResult> {
  if (!(await isSession6Enabled())) return { ok: false, error: 'disabled' }
  const auth = await verifyToken(token)
  if (!auth) return { ok: false, error: 'invalid_token' }

  try {
    const season = await getCurrentSeason()
    if (!season) return { ok: false, error: 'no_season' }

    const [cfg, models, presets, modelEtas, balance, jobs, theme, pricing, creatorProfile] = await Promise.all([
      getSeasonStudioConfig(season.id),
      getActiveModels(),
      getActivePresets(),
      getModelEtas(),
      getBalance(auth.userId),
      listUserJobs(auth.userId, season.id),
      getRevealedTheme(season.id),
      getStudioPricing(),
      getCreatorProfile(auth.userId),
    ])

    // The round is decided server-side from the schedule (client never chooses).
    const effectiveRound = resolveEffectiveRound(cfg)
    const [used, draftUsed] = await Promise.all([
      countGenerationsForRound(auth.userId, season.id, cfg, effectiveRound, 'competition'),
      countGenerationsForRound(auth.userId, season.id, cfg, effectiveRound, 'draft'),
    ])

    // Application presence + whether a studio submission already landed for the
    // current (effective) round.
    const admin = createSupabaseAdmin()
    const { data: appRow } = await admin
      .from('genesis_applications')
      .select('id, studio_application_submitted_at, main_round_submitted_at, creator_name, country')
      .eq('season_id', season.id)
      .ilike('email', auth.email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const alreadySubmitted = !!(
      appRow &&
      (effectiveRound === 'main'
        ? appRow.main_round_submitted_at
        : appRow.studio_application_submitted_at)
    )

    // Prefill priority: account profile first, then the latest application row
    // (lazy source for creators who applied before the profile split).
    const prefillName =
      creatorProfile.creatorName ?? (appRow?.creator_name as string | null)?.trim() ?? null
    const prefillCountry =
      creatorProfile.country ?? (appRow?.country as string | null)?.trim() ?? null

    return {
      ok: true,
      data: {
        email: auth.email,
        season: {
          id: season.id,
          displayName: season.display_name,
          seasonNumber: season.season_number,
          round: effectiveRound,
          theme: theme.theme,
          twist: theme.twist,
          twistRevealed: theme.revealed,
        },
        models,
        presets,
        modelEtas,
        balance,
        generationsUsed: used,
        maxGenerations: cfg.maxGenerationsPerRound,
        draftGenerationsUsed: draftUsed,
        maxDraftGenerations: cfg.maxDraftGenerationsPerRound,
        jobs,
        hasApplication: !!appRow,
        alreadySubmitted,
        pricing: { marginRate: pricing.marginRate, creditUsdValue: pricing.creditUsdValue },
        composeEnabled: cfg.studioComposeEnabled,
        composeMinSeconds: cfg.studioComposeMinSeconds,
        composeMaxSeconds: cfg.studioComposeMaxSeconds,
        profile: { creatorName: prefillName, country: prefillCountry },
      },
    }
  } catch (e) {
    return { ok: false, error: 'load_failed', detail: e instanceof Error ? e.message : String(e) }
  }
}

export type CreateGenResult =
  | { ok: true; jobId: string; credits: number }
  | {
      ok: false
      error: 'invalid_token' | 'no_season' | 'unknown_model' | 'bad_duration' | 'prompt_too_long' | 'cap_reached' | 'insufficient_credits' | 'unknown_preset' | 'invalid_param' | 'disabled' | 'failed' | 'not_image_model' | 'not_video_model' | 'character_not_found' | 'parent_not_found' | 'parent_not_ready' | 'parent_not_image' | 'bad_shots'
      detail?: string
    }

export async function createGenerationAction(
  token: string,
  input: {
    modelId: string
    prompt: string
    durationSeconds: number
    // Stage 1 (CameraDirector). Optional; omitted = legacy free-prompt path.
    presetId?: string
    advanced?: Record<string, unknown>
  },
): Promise<CreateGenResult> {
  if (!(await isSession6Enabled())) return { ok: false, error: 'disabled' }
  const auth = await verifyToken(token)
  if (!auth) return { ok: false, error: 'invalid_token' }
  const season = await getCurrentSeason()
  if (!season) return { ok: false, error: 'no_season' }

  const res = await createGeneration({
    userId: auth.userId,
    seasonId: season.id,
    modelId: input.modelId,
    prompt: input.prompt,
    durationSeconds: input.durationSeconds,
    presetId: input.presetId,
    advanced: input.advanced,
  })
  if (!res.ok) return { ok: false, error: res.reason, detail: res.detail }
  return { ok: true, jobId: res.jobId, credits: res.credits }
}

// --- Stage 3: image (t2i character sheet) + character library + i2v ---

export async function createImageGenerationAction(
  token: string,
  input: { modelId: string; prompt: string; advanced?: Record<string, unknown> },
): Promise<CreateGenResult> {
  if (!(await isSession6Enabled())) return { ok: false, error: 'disabled' }
  const auth = await verifyToken(token)
  if (!auth) return { ok: false, error: 'invalid_token' }
  const season = await getCurrentSeason()
  if (!season) return { ok: false, error: 'no_season' }
  const res = await createImageGeneration({
    userId: auth.userId,
    seasonId: season.id,
    modelId: input.modelId,
    prompt: input.prompt,
    advanced: input.advanced,
  })
  if (!res.ok) return { ok: false, error: res.reason, detail: res.detail }
  return { ok: true, jobId: res.jobId, credits: res.credits }
}

export async function createI2vGenerationAction(
  token: string,
  input: { modelId: string; characterId: string; shots: { prompt: string; durationSeconds: number }[] },
): Promise<CreateGenResult> {
  if (!(await isSession6Enabled())) return { ok: false, error: 'disabled' }
  const auth = await verifyToken(token)
  if (!auth) return { ok: false, error: 'invalid_token' }
  const season = await getCurrentSeason()
  if (!season) return { ok: false, error: 'no_season' }
  const res = await createI2vGeneration({
    userId: auth.userId,
    seasonId: season.id,
    modelId: input.modelId,
    characterId: input.characterId,
    shots: input.shots,
  })
  if (!res.ok) return { ok: false, error: res.reason, detail: res.detail }
  return { ok: true, jobId: res.jobId, credits: res.credits }
}

export type CharacterListResult =
  | { ok: true; characters: StudioCharacter[] }
  | { ok: false; error: 'invalid_token' | 'no_season' | 'disabled' }

export async function listCharactersAction(token: string): Promise<CharacterListResult> {
  if (!(await isSession6Enabled())) return { ok: false, error: 'disabled' }
  const auth = await verifyToken(token)
  if (!auth) return { ok: false, error: 'invalid_token' }
  const season = await getCurrentSeason()
  if (!season) return { ok: false, error: 'no_season' }
  return { ok: true, characters: await listCharacters(auth.userId, season.id) }
}

export type CreateCharacterActionResult =
  | { ok: true; characterId: string }
  | { ok: false; error: string; detail?: string }

export async function createCharacterAction(
  token: string,
  input: { name: string; frontalImageJobId: string; referenceImageJobIds?: string[] },
): Promise<CreateCharacterActionResult> {
  if (!(await isSession6Enabled())) return { ok: false, error: 'disabled' }
  const auth = await verifyToken(token)
  if (!auth) return { ok: false, error: 'invalid_token' }
  const season = await getCurrentSeason()
  if (!season) return { ok: false, error: 'no_season' }
  const res = await createCharacter({
    userId: auth.userId,
    seasonId: season.id,
    name: input.name,
    frontalImageJobId: input.frontalImageJobId,
    referenceImageJobIds: input.referenceImageJobIds,
  })
  if (!res.ok) return { ok: false, error: res.reason, detail: res.detail }
  return { ok: true, characterId: res.characterId }
}

export async function deleteCharacterAction(
  token: string,
  characterId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isSession6Enabled())) return { ok: false, error: 'disabled' }
  const auth = await verifyToken(token)
  if (!auth) return { ok: false, error: 'invalid_token' }
  const res = await deleteCharacter(auth.userId, characterId)
  return res.ok ? { ok: true } : { ok: false, error: res.reason }
}

export type PollResult =
  | { ok: true; jobs: StudioJob[]; balance: number; generationsUsed: number; draftGenerationsUsed: number }
  | { ok: false; error: 'invalid_token' | 'no_season' | 'disabled' }

export async function pollJobsAction(token: string): Promise<PollResult> {
  if (!(await isSession6Enabled())) return { ok: false, error: 'disabled' }
  const auth = await verifyToken(token)
  if (!auth) return { ok: false, error: 'invalid_token' }
  const season = await getCurrentSeason()
  if (!season) return { ok: false, error: 'no_season' }
  const cfg = await getSeasonStudioConfig(season.id)
  const effectiveRound = resolveEffectiveRound(cfg)
  const [jobs, balance, used, draftUsed] = await Promise.all([
    listUserJobs(auth.userId, season.id),
    getBalance(auth.userId),
    countGenerationsForRound(auth.userId, season.id, cfg, effectiveRound, 'competition'),
    countGenerationsForRound(auth.userId, season.id, cfg, effectiveRound, 'draft'),
  ])
  return { ok: true, jobs, balance, generationsUsed: used, draftGenerationsUsed: draftUsed }
}

export type SubmitGenResult =
  | { ok: true }
  | {
      ok: false
      error:
        | 'invalid_token'
        | 'no_season'
        | 'job_not_found'
        | 'not_owner'
        | 'not_ready'
        | 'draft_not_submittable'
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
        | 'disabled'
        | 'failed'
      detail?: string
    }

export async function submitGenerationAction(
  token: string,
  jobId: string,
  applicant?: ApplicantInfo,
): Promise<SubmitGenResult> {
  if (!(await isSession6Enabled())) return { ok: false, error: 'disabled' }
  const auth = await verifyToken(token)
  if (!auth) return { ok: false, error: 'invalid_token' }
  const season = await getCurrentSeason()
  if (!season) return { ok: false, error: 'no_season' }

  const res = await submitGeneration({
    userId: auth.userId,
    email: auth.email,
    seasonId: season.id,
    jobId,
    applicant,
  })
  if (!res.ok) return { ok: false, error: res.reason, detail: res.detail }
  return { ok: true }
}

// =========================================================================
// Soft-delete actions. A participant removes a clip / composed final from their
// workspace. Submitted works are protected server-side (competition record).
// =========================================================================

export type DeleteActionResult =
  | { ok: true }
  | { ok: false; error: 'invalid_token' | 'disabled' | 'protected' | 'not_found' | 'failed'; detail?: string }

function mapDeleteReason(reason?: string): DeleteActionResult {
  if (reason === 'submitted' || reason === 'in_submitted_render') return { ok: false, error: 'protected', detail: reason }
  if (reason === 'not_found') return { ok: false, error: 'not_found' }
  return { ok: false, error: 'failed', detail: reason }
}

export async function deleteClipAction(token: string, jobId: string): Promise<DeleteActionResult> {
  if (!(await isSession6Enabled())) return { ok: false, error: 'disabled' }
  const auth = await verifyToken(token)
  if (!auth) return { ok: false, error: 'invalid_token' }
  const res = await deleteClip(auth.userId, jobId)
  return res.ok ? { ok: true } : mapDeleteReason(res.reason)
}

export async function deleteRenderAction(token: string, renderId: string): Promise<DeleteActionResult> {
  if (!(await isSession6Enabled())) return { ok: false, error: 'disabled' }
  const auth = await verifyToken(token)
  if (!auth) return { ok: false, error: 'invalid_token' }
  const res = await deleteRender(auth.userId, renderId)
  return res.ok ? { ok: true } : mapDeleteReason(res.reason)
}

// =========================================================================
// Compose (in-platform stitching) actions. The editor lists the participant's
// ready clips, sends an EDL to createRender, and polls render_jobs until ready.
// =========================================================================

export type ComposeClip = {
  id: string
  url: string
  durationSeconds: number
  prompt: string
  createdAt: string
}

// Submission context the editor needs to drive the "submit final" step: which
// round is live, whether the participant already has an application row, whether
// a submission already landed for this round, and the statement bounds (only the
// application round with NO existing row collects applicant info).
export type ComposeSubmitCtx = {
  round: EffectiveRound
  hasApplication: boolean
  alreadySubmitted: boolean
  needsApplicantInfo: boolean
  statementMin: number
  statementMax: number
}

// The participant's latest non-terminal render for this season, so the editor
// can restore it on re-entry (the render + its R2 video are server-persisted;
// the editor's client state is not). 'ready' means it is directly submittable.
export type ResumeRender = {
  id: string
  status: 'queued' | 'rendering' | 'uploading' | 'ready'
  videoUrl: string | null
  totalSeconds: number
  edl: EdlSegment[]
}

export type LoadComposeResult =
  | {
      ok: true
      data: {
        seasonId: string
        clips: ComposeClip[]
        minSeconds: number
        maxSeconds: number
        maxClips: number
        submit: ComposeSubmitCtx
        resumeRender: ResumeRender | null
        // Account nickname the entry will publish as (option A: the compose form
        // no longer asks for a name; identity is the account, editable in /profile).
        nickname: string
      }
    }
  | { ok: false; error: 'invalid_token' | 'no_season' | 'disabled' | 'load_failed'; detail?: string }

export async function loadComposeState(token: string): Promise<LoadComposeResult> {
  if (!(await isSession6Enabled())) return { ok: false, error: 'disabled' }
  const auth = await verifyToken(token)
  if (!auth) return { ok: false, error: 'invalid_token' }
  const season = await getCurrentSeason()
  if (!season) return { ok: false, error: 'no_season' }
  try {
    // Compose picks clips for the CURRENT round only -- a 'both' season splits
    // application vs main clips at main_round_start_at, so main-round compose
    // never lists prelim clips (and vice-versa). listUserJobs is season-wide;
    // isInEffectiveRound applies the round boundary. (TK 2026-07-12: matches the
    // "이번 라운드" copy the picker already showed.)
    const cfg = await getSeasonStudioConfig(season.id)
    const effectiveRound = resolveEffectiveRound(cfg)
    const jobs = await listUserJobs(auth.userId, season.id)
    const clips: ComposeClip[] = jobs
      // Drafts (Sandbox) are practice-only: hidden from the compose picker here,
      // and createRender rejects them server-side even if one sneaks into an EDL.
      .filter((j) => j.tier !== 'draft' && j.status === 'ready' && j.video_url && isInEffectiveRound(j.created_at, cfg, effectiveRound))
      .map((j) => ({
        id: j.id,
        url: j.video_url as string,
        durationSeconds: j.duration_seconds,
        prompt: j.prompt,
        createdAt: j.created_at,
      }))
    const admin = createSupabaseAdmin()
    const { data: s } = await admin
      .from('seasons')
      .select('studio_compose_min_seconds, studio_compose_max_seconds, studio_compose_max_clips')
      .eq('id', season.id)
      .single()

    // Submission context (application presence, already-submitted). cfg /
    // effectiveRound are computed above (used for the round-scoped clip filter).
    const [{ data: appRow }, nickname] = await Promise.all([
      admin
        .from('genesis_applications')
        .select('id, studio_application_submitted_at, main_round_submitted_at')
        .eq('season_id', season.id)
        .ilike('email', auth.email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      // The compose form no longer collects name/country (option A); the account
      // nickname is what the entry publishes as, shown in a notice.
      getDisplayName(auth.userId),
    ])
    const hasApplication = !!appRow
    const alreadySubmitted = !!(
      appRow &&
      (effectiveRound === 'main'
        ? appRow.main_round_submitted_at
        : appRow.studio_application_submitted_at)
    )

    // Resume support: the latest render that is neither submitted nor failed, so
    // a participant who navigated away can pick up where they left off instead of
    // re-arranging + re-rendering. listUserRenders is ordered newest-first.
    const renders = await listUserRenders(auth.userId, season.id)
    const resumable = renders.find((r) => r.status !== 'submitted' && r.status !== 'failed')
    const resumeRender = resumable
      ? {
          id: resumable.id,
          status: resumable.status as ResumeRender['status'],
          videoUrl: resumable.video_url,
          totalSeconds: Number(resumable.total_duration_seconds ?? 0),
          edl: (resumable.edl ?? []) as EdlSegment[],
        }
      : null

    return {
      ok: true,
      data: {
        seasonId: season.id,
        clips,
        minSeconds: Number(s?.studio_compose_min_seconds ?? 15),
        maxSeconds: Number(s?.studio_compose_max_seconds ?? 30),
        maxClips: Number(s?.studio_compose_max_clips ?? 10),
        submit: {
          round: effectiveRound,
          hasApplication,
          alreadySubmitted,
          // Only the application round with no existing row needs name/statement/agreements.
          needsApplicantInfo: effectiveRound === 'application' && !hasApplication,
          statementMin: STATEMENT_MIN,
          statementMax: STATEMENT_MAX,
        },
        nickname,
        resumeRender,
      },
    }
  } catch (e) {
    return { ok: false, error: 'load_failed', detail: e instanceof Error ? e.message : String(e) }
  }
}

export type CreateRenderActionResult = { ok: true; renderId: string } | { ok: false; error: string }

export async function createRenderAction(token: string, edl: EdlSegment[]): Promise<CreateRenderActionResult> {
  if (!(await isSession6Enabled())) return { ok: false, error: 'disabled' }
  const auth = await verifyToken(token)
  if (!auth) return { ok: false, error: 'invalid_token' }
  const season = await getCurrentSeason()
  if (!season) return { ok: false, error: 'no_season' }
  const res = await createRender({ userId: auth.userId, seasonId: season.id, edl })
  if (!res.ok) return { ok: false, error: res.reason }
  return { ok: true, renderId: res.renderId }
}

export type RenderStatusDTO = {
  status: 'queued' | 'rendering' | 'uploading' | 'ready' | 'failed'
  videoUrl: string | null
  totalSeconds: number
  error?: string | null
} | null

export async function pollRenderAction(token: string, renderId: string): Promise<RenderStatusDTO> {
  if (!(await isSession6Enabled())) return null
  const auth = await verifyToken(token)
  if (!auth) return null
  const season = await getCurrentSeason()
  if (!season) return null
  const renders = await listUserRenders(auth.userId, season.id)
  const r = renders.find((x) => x.id === renderId)
  if (!r) return null
  const status = (['queued', 'rendering', 'uploading', 'ready', 'failed'].includes(r.status) ? r.status : 'ready') as
    | 'queued'
    | 'rendering'
    | 'uploading'
    | 'ready'
    | 'failed'
  return { status, videoUrl: r.video_url, totalSeconds: Number(r.total_duration_seconds), error: r.error_message }
}

export type SubmitRenderActionResult =
  | { ok: true }
  | {
      ok: false
      error:
        | 'invalid_token'
        | 'no_season'
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
        | 'disabled'
        | 'failed'
      detail?: string
    }

export async function submitRenderAction(
  token: string,
  renderId: string,
  applicant?: ApplicantInfo,
): Promise<SubmitRenderActionResult> {
  if (!(await isSession6Enabled())) return { ok: false, error: 'disabled' }
  const auth = await verifyToken(token)
  if (!auth) return { ok: false, error: 'invalid_token' }
  const season = await getCurrentSeason()
  if (!season) return { ok: false, error: 'no_season' }

  const res = await submitRender({
    userId: auth.userId,
    email: auth.email,
    seasonId: season.id,
    renderId,
    applicant,
  })
  if (!res.ok) return { ok: false, error: res.reason, detail: res.detail }
  return { ok: true }
}
