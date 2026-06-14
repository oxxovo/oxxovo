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
  countGenerationsForRound,
  listUserJobs,
  createGeneration,
  submitGeneration,
  createRender,
  listUserRenders,
  submitRender,
  STATEMENT_MIN,
  STATEMENT_MAX,
  type StudioModel,
  type StudioJob,
  type ApplicantInfo,
  type EdlSegment,
  type EffectiveRound,
} from '@/lib/studio'
import { getBalance, getStudioPricing, getStudioPurchaseConfig } from '@/lib/credits'
import { isSession6Enabled } from '@/lib/session6'

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
  balance: number
  generationsUsed: number
  maxGenerations: number
  jobs: StudioJob[]
  hasApplication: boolean
  alreadySubmitted: boolean
  pricing: { marginRate: number; creditUsdValue: number }
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

    const [cfg, models, balance, jobs, theme, pricing] = await Promise.all([
      getSeasonStudioConfig(season.id),
      getActiveModels(),
      getBalance(auth.userId),
      listUserJobs(auth.userId, season.id),
      getRevealedTheme(season.id),
      getStudioPricing(),
    ])

    // The round is decided server-side from the schedule (client never chooses).
    const effectiveRound = resolveEffectiveRound(cfg)
    const used = await countGenerationsForRound(auth.userId, season.id, cfg, effectiveRound)

    // Application presence + whether a studio submission already landed for the
    // current (effective) round.
    const admin = createSupabaseAdmin()
    const { data: appRow } = await admin
      .from('genesis_applications')
      .select('id, studio_application_submitted_at, main_round_submitted_at, final_submitted_at')
      .eq('season_id', season.id)
      .ilike('email', auth.email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const alreadySubmitted = !!(
      appRow &&
      (effectiveRound === 'main'
        ? appRow.main_round_submitted_at
        : effectiveRound === 'final'
          ? appRow.final_submitted_at
          : appRow.studio_application_submitted_at)
    )

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
        balance,
        generationsUsed: used,
        maxGenerations: cfg.maxGenerationsPerRound,
        jobs,
        hasApplication: !!appRow,
        alreadySubmitted,
        pricing: { marginRate: pricing.marginRate, creditUsdValue: pricing.creditUsdValue },
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
      error: 'invalid_token' | 'no_season' | 'unknown_model' | 'bad_duration' | 'cap_reached' | 'insufficient_credits' | 'disabled' | 'failed'
      detail?: string
    }

export async function createGenerationAction(
  token: string,
  input: { modelId: string; prompt: string; durationSeconds: number },
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
  })
  if (!res.ok) return { ok: false, error: res.reason, detail: res.detail }
  return { ok: true, jobId: res.jobId, credits: res.credits }
}

export type PollResult =
  | { ok: true; jobs: StudioJob[]; balance: number; generationsUsed: number }
  | { ok: false; error: 'invalid_token' | 'no_season' | 'disabled' }

export async function pollJobsAction(token: string): Promise<PollResult> {
  if (!(await isSession6Enabled())) return { ok: false, error: 'disabled' }
  const auth = await verifyToken(token)
  if (!auth) return { ok: false, error: 'invalid_token' }
  const season = await getCurrentSeason()
  if (!season) return { ok: false, error: 'no_season' }
  const cfg = await getSeasonStudioConfig(season.id)
  const effectiveRound = resolveEffectiveRound(cfg)
  const [jobs, balance, used] = await Promise.all([
    listUserJobs(auth.userId, season.id),
    getBalance(auth.userId),
    countGenerationsForRound(auth.userId, season.id, cfg, effectiveRound),
  ])
  return { ok: true, jobs, balance, generationsUsed: used }
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

export type LoadComposeResult =
  | { ok: true; data: { clips: ComposeClip[]; minSeconds: number; maxSeconds: number; maxClips: number; submit: ComposeSubmitCtx } }
  | { ok: false; error: 'invalid_token' | 'no_season' | 'disabled' | 'load_failed'; detail?: string }

export async function loadComposeState(token: string): Promise<LoadComposeResult> {
  if (!(await isSession6Enabled())) return { ok: false, error: 'disabled' }
  const auth = await verifyToken(token)
  if (!auth) return { ok: false, error: 'invalid_token' }
  const season = await getCurrentSeason()
  if (!season) return { ok: false, error: 'no_season' }
  try {
    const jobs = await listUserJobs(auth.userId, season.id)
    const clips: ComposeClip[] = jobs
      .filter((j) => j.status === 'ready' && j.video_url)
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

    // Submission context (round, application presence, already-submitted).
    const cfg = await getSeasonStudioConfig(season.id)
    const effectiveRound = resolveEffectiveRound(cfg)
    const { data: appRow } = await admin
      .from('genesis_applications')
      .select('id, studio_application_submitted_at, main_round_submitted_at, final_submitted_at')
      .eq('season_id', season.id)
      .ilike('email', auth.email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const hasApplication = !!appRow
    const alreadySubmitted = !!(
      appRow &&
      (effectiveRound === 'main'
        ? appRow.main_round_submitted_at
        : effectiveRound === 'final'
          ? appRow.final_submitted_at
          : appRow.studio_application_submitted_at)
    )

    return {
      ok: true,
      data: {
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
