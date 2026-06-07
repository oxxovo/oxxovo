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
  type StudioModel,
  type StudioJob,
  type ApplicantInfo,
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
    round: 'application' | 'main'
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
      .select('id, studio_application_submitted_at, main_round_submitted_at')
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
