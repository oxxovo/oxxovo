// Studio domain logic -- SERVER ONLY. Generation enqueue (with credit charge +
// CryptoBind generation-time signature) and submission (CryptoBind verify +
// immutable write into genesis_applications). All state transitions are
// server-authoritative; the worker (oxxovo-studio) advances the job through the
// 6-stage machine and produces the artifact.

import 'server-only'
import { randomUUID } from 'crypto'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getBalance, getStudioPricing, creditsForCost } from '@/lib/credits'
import { buildCryptoBind, verifyCryptoBind } from '@/lib/cryptobind'

export type StudioTier = 'budget' | 'standard' | 'premium'

export type StudioModel = {
  id: string
  tier: StudioTier
  display_name: string
  cost_per_second_usd: number
  min_duration_seconds: number
  max_duration_seconds: number
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
export type EffectiveRound = 'application' | 'main'

export type SeasonStudioConfig = {
  round: StudioRoundSetting
  maxGenerationsPerRound: number
  mainRoundStartAt: string | null
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

export async function getActiveModels(): Promise<StudioModel[]> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('model_catalog')
    .select('id, tier, display_name, cost_per_second_usd, min_duration_seconds, max_duration_seconds')
    .eq('active', true)
    .order('cost_per_second_usd', { ascending: true })
  if (error) throw new Error('getActiveModels: ' + error.message)
  return (data ?? []) as StudioModel[]
}

export async function getSeasonStudioConfig(seasonId: string): Promise<SeasonStudioConfig> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('seasons')
    .select('studio_round, studio_max_generations_per_round, main_round_start_at')
    .eq('id', seasonId)
    .single()
  if (error) throw new Error('getSeasonStudioConfig: ' + error.message)
  return {
    round: (data.studio_round as StudioRoundSetting) ?? 'main',
    maxGenerationsPerRound: Number(data.studio_max_generations_per_round ?? 10),
    mainRoundStartAt: (data.main_round_start_at as string | null) ?? null,
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
    .order('created_at', { ascending: false })
  if (error) throw new Error('listUserJobs: ' + error.message)
  return (data ?? []) as StudioJob[]
}

export type CreateGenerationResult =
  | { ok: true; jobId: string; credits: number }
  | {
      ok: false
      reason: 'unknown_model' | 'bad_duration' | 'cap_reached' | 'insufficient_credits' | 'failed'
      detail?: string
    }

export async function createGeneration(args: {
  userId: string
  seasonId: string
  modelId: string
  prompt: string
  durationSeconds: number
}): Promise<CreateGenerationResult> {
  const admin = createSupabaseAdmin()

  const prompt = (args.prompt ?? '').trim()
  if (!prompt) return { ok: false, reason: 'failed', detail: 'empty prompt' }

  // 1. Model must exist + be active.
  const models = await getActiveModels()
  const model = models.find((m) => m.id === args.modelId)
  if (!model) return { ok: false, reason: 'unknown_model' }

  // 2. Duration within the model's bounds.
  const duration = Math.round(args.durationSeconds)
  if (duration < model.min_duration_seconds || duration > model.max_duration_seconds) {
    return { ok: false, reason: 'bad_duration' }
  }

  // 3. Per-round generation cap (round resolved server-side from the schedule).
  const cfg = await getSeasonStudioConfig(args.seasonId)
  const effectiveRound = resolveEffectiveRound(cfg)
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
}): Promise<SubmitResult> {
  const admin = createSupabaseAdmin()

  // 1. Load the job + ownership + readiness.
  const { data: job, error: jErr } = await admin
    .from('generation_jobs')
    .select(
      'id, user_id, season_id, status, video_url, duration_seconds, model_id, cryptobind_pid, cryptobind_tid, cryptobind_generated_at, cryptobind_signature, cryptobind_algo',
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
  const cfg = await getSeasonStudioConfig(args.seasonId)
  const effectiveRound = resolveEffectiveRound(cfg)

  // 4. Find the participant's application (by email, like the rest of the site).
  const email = args.email.toLowerCase()
  const { data: appRow, error: aErr } = await admin
    .from('genesis_applications')
    .select('id, studio_application_submitted_at, main_round_submitted_at')
    .eq('season_id', args.seasonId)
    .ilike('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (aErr) return { ok: false, reason: 'failed', detail: aErr.message }
  if (!appRow) return { ok: false, reason: 'no_application' }

  // 5. Immutability -- one studio submission PER ROUND, permanent.
  const now = new Date().toISOString()
  const update: Record<string, unknown> = {}
  if (effectiveRound === 'main') {
    if (appRow.main_round_submitted_at) return { ok: false, reason: 'already_submitted' }
    update.main_round_video_url = job.video_url
    update.main_round_submitted_at = now
    update.studio_main_job_id = job.id
    update.studio_main_signature = job.cryptobind_signature
  } else {
    if (appRow.studio_application_submitted_at) return { ok: false, reason: 'already_submitted' }
    update.free_entry_url = job.video_url
    update.video_duration_seconds = job.duration_seconds
    update.ai_service = 'OXXOVO Studio'
    update.studio_application_job_id = job.id
    update.studio_application_signature = job.cryptobind_signature
    update.studio_application_submitted_at = now
  }

  // 6. Write the submission (status intentionally unchanged).
  const { error: upErr } = await admin
    .from('genesis_applications')
    .update(update)
    .eq('id', appRow.id)
  if (upErr) return { ok: false, reason: 'failed', detail: upErr.message }

  // 7. Lock the job: ready -> submitted (terminal, immutable).
  const { error: jUpErr } = await admin
    .from('generation_jobs')
    .update({ status: 'submitted', submitted_at: now, updated_at: now })
    .eq('id', job.id)
    .eq('status', 'ready')
  if (jUpErr) return { ok: false, reason: 'failed', detail: jUpErr.message }

  return { ok: true }
}
