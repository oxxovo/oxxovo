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
    .select('studio_round, studio_max_generations_per_round, main_round_start_at, submission_hours, application_video_min_seconds, application_video_max_seconds, main_round_video_min_seconds, main_round_video_max_seconds, studio_compose_enabled')
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
    .order('created_at', { ascending: false })
  if (error) throw new Error('listUserRenders: ' + error.message)
  return (data ?? []) as StudioRender[]
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
    const name = (info.creatorName ?? '').trim()
    const statement = (info.creatorStatement ?? '').trim()
    if (!name) return { ok: false, reason: 'name_required' }
    if (statement.length < STATEMENT_MIN || statement.length > STATEMENT_MAX) {
      return { ok: false, reason: 'bad_statement' }
    }
    if (!info.agreedRules || !info.agreedPrivacy || !info.agreedIntegrity) {
      return { ok: false, reason: 'agreements_required' }
    }

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
      country: info.country?.trim() || null,
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
  //    submit race. Source clips are intentionally left 'ready'.
  const { error: rUpErr } = await admin
    .from('render_jobs')
    .update({ status: 'submitted', submitted_at: now, updated_at: now })
    .eq('id', render.id)
    .eq('status', 'ready')
  if (rUpErr) return { ok: false, reason: 'failed', detail: rUpErr.message }

  return { ok: true }
}
