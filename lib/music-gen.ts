// AI music generation (Studio Music v1, Stage 6) -- SERVER ONLY.
//
// In-platform AI music beds (Genesis Rule: generated inside OXXOVO, NEVER an
// upload). Mirrors the clip-generation discipline (lib/studio.ts createGeneration):
//   1. gate  -- season studio_music_enabled AND config studio_music_ai_enabled
//   2. guard -- prompt bounds + imitation block + AI moderation, BEFORE any credit
//   3. charge -- credits from platform_config pricing, rolled back if the row/charge fails
//   4. enqueue -- insert a studio_music_assets row status='queued' for the worker
//   5. finalize -- worker downloads the audio, uploads R2, then this signs (v1m) + ready
//   6. refund  -- provider fails/times out -> refund the charge, mark asset 'failed'
//
// The provider (Beatoven.ai) API shape/pricing is NOT asserted here -- it is a
// pure interface (MusicProvider) so the actual HTTP call slots in once TK confirms
// it (실측), exactly as we deferred fal concurrency. getMusicProvider() returns a
// stub that refuses until then, so nothing silently pretends to generate.
//
// -------------------------------------------------------------------------
// WORKER CONTRACT (oxxovo-studio, mirror repo -- next task, after Beatoven 실측):
//   poll studio_music_assets WHERE status='queued' AND source='ai'
//     -> markMusicGenerating(id)
//     -> provider.generate({ prompt, durationSeconds, assetId })
//         success -> upload audio to R2 (music/ namespace) -> finalizeMusicGeneration(...)
//         failure/timeout -> refundMusicGeneration({ assetId, detail })
//   The worker mirrors buildMusicAssetBind byte-for-byte (its own cryptobind copy)
//   OR calls finalizeMusicGeneration here; either way the v1m signature is the same.
// -------------------------------------------------------------------------

import 'server-only'
import { randomUUID } from 'crypto'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getBalance, getStudioPricing, creditsForCost } from '@/lib/credits'
import { moderateSubmission } from '@/lib/moderation'
import { buildMusicAssetBind, hashMusicAsset } from '@/lib/cryptobind'
import {
  validateMusicPrompt,
  findImitation,
  parseArtistBlocklist,
  type MusicReason,
} from '@/lib/music-limits'

// ===========================================================================
// Provider interface -- the Beatoven boundary. The API shape is deferred (실측),
// so the caller only knows: given a prompt + duration, eventually get audio bytes.
// The provider owns whatever sync/async/polling the real API needs.
// ===========================================================================

export interface MusicGenParams {
  prompt: string // the ASSEMBLED prompt the server stored (never client-trusted)
  durationSeconds: number
  assetId: string // studio_music_assets.id -- for provider-side idempotency/logging
}

export type MusicGenOutput = {
  audio: Buffer // the raw track bytes (what gets hashed for v1m + uploaded to R2)
  durationSeconds: number // the ACTUAL rendered length (may differ from requested)
  format: 'mp3' | 'wav'
}

export interface MusicProvider {
  readonly id: string
  // Generate a track. May block/poll internally -- the caller just awaits the
  // finished audio. MUST throw on failure (the caller refunds on throw).
  generate(params: MusicGenParams): Promise<MusicGenOutput>
}

// Placeholder until Beatoven's API is confirmed. Refuses so a mis-config never
// silently "succeeds" with empty audio.
export const stubMusicProvider: MusicProvider = {
  id: 'stub',
  async generate(): Promise<MusicGenOutput> {
    throw new Error('music_provider_not_configured')
  },
}

// Factory. The Beatoven impl slots in here (switch on STUDIO_MUSIC_PROVIDER)
// once its request/response shape + auth are confirmed. Stub until then.
export function getMusicProvider(): MusicProvider {
  // e.g. if (process.env.STUDIO_MUSIC_PROVIDER === 'beatoven') return beatovenProvider()
  return stubMusicProvider
}

// ===========================================================================
// Config (platform_config -- dynamic, NO hardcode). All AI-music operational
// parameters live here so they can move per season without a deploy.
// ===========================================================================

export interface MusicGenConfig {
  aiEnabled: boolean // studio_music_ai_enabled -- AI gen on/off (library can be on while this is off)
  genCostUsd: number // studio_music_gen_cost_usd -- raw provider cost per generation
  maxSeconds: number // studio_music_gen_max_seconds -- 0 => no explicit cap here
  maxPerUser: number // studio_music_gen_max_per_user -- 0 => unlimited (see note below)
  artistBlocklist: string[] // studio_music_artist_blocklist
}

export async function getMusicGenConfig(): Promise<MusicGenConfig> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('platform_config')
    .select('key, value')
    .in('key', [
      'studio_music_ai_enabled',
      'studio_music_gen_cost_usd',
      'studio_music_gen_max_seconds',
      'studio_music_gen_max_per_user',
      'studio_music_artist_blocklist',
    ])
  if (error) throw new Error('getMusicGenConfig: ' + error.message)
  const map = new Map<string, string>()
  for (const r of data ?? []) map.set(r.key as string, r.value as string)
  const num = (k: string) => {
    const n = Number(map.get(k))
    return Number.isFinite(n) && n >= 0 ? n : 0
  }
  return {
    aiEnabled: String(map.get('studio_music_ai_enabled')).toLowerCase() === 'true',
    genCostUsd: num('studio_music_gen_cost_usd'),
    maxSeconds: num('studio_music_gen_max_seconds'),
    maxPerUser: num('studio_music_gen_max_per_user'),
    artistBlocklist: parseArtistBlocklist(map.get('studio_music_artist_blocklist')),
  }
}

// ===========================================================================
// 1-4. Enqueue: gate + guard + charge + insert a queued asset. Mirrors
//      createGeneration (roll the row back if the charge fails).
// ===========================================================================

export type CreateMusicResult =
  | { ok: true; assetId: string; credits: number }
  | { ok: false; reason: MusicReason; detail?: string }

export async function createMusicGeneration(args: {
  userId: string
  seasonId: string
  prompt: string
  durationSeconds: number
}): Promise<CreateMusicResult> {
  const admin = createSupabaseAdmin()

  // 1. Season allowlist gate (studio_music_enabled) + the AI-gen switch. Music
  //    can ship library-only (aiEnabled off) while Beatoven is still being 실측.
  const { data: season } = await admin
    .from('seasons')
    .select('studio_music_enabled')
    .eq('id', args.seasonId)
    .maybeSingle()
  if (!season?.studio_music_enabled) return { ok: false, reason: 'music_disabled' }

  const cfg = await getMusicGenConfig()
  if (!cfg.aiEnabled) return { ok: false, reason: 'music_ai_disabled' }

  // 2a. Prompt bounds (pure).
  const pv = validateMusicPrompt(args.prompt)
  if (!pv.ok) return { ok: false, reason: pv.reason }
  const prompt = pv.prompt

  // 2b. Duration bounds. Must be positive; capped by config when set (>0).
  const duration = Math.round(args.durationSeconds)
  if (!Number.isFinite(duration) || duration <= 0) return { ok: false, reason: 'music_duration' }
  if (cfg.maxSeconds > 0 && duration > cfg.maxSeconds) {
    return { ok: false, reason: 'music_duration', detail: String(cfg.maxSeconds) }
  }

  // 2c. ★Imitation block -- copyright-mimicry is refused BEFORE spending a credit
  //     (curated artist/track blocklist + generic imitation phrasing).
  const hit = findImitation(prompt, cfg.artistBlocklist)
  if (hit) return { ok: false, reason: 'music_imitation', detail: hit }

  // 2d. AI moderation of the prompt. flagged -> refused; pending (no key/timeout)
  //     -> ALSO refused here (never charge a credit for a prompt we could not
  //     clear). This is stricter than the video path's fail-safe-to-admin-queue,
  //     because for AI music the scan is the pre-spend gate, not a post-hoc hide.
  const mod = await moderateSubmission({ text: prompt })
  if (mod.status !== 'approved') {
    return { ok: false, reason: 'music_moderation', detail: mod.categories.join(',') || mod.status }
  }

  // 3. Per-user cap (optional, config). NOTE: studio_music_assets has no season_id,
  //    so this counts the user's live AI beds platform-wide (queued/generating/
  //    ready), not per-round. Round-scoping would need a season_id column (deferred
  //    -- do not amend the base migration TK is running). 0 => unlimited.
  if (cfg.maxPerUser > 0) {
    const { count } = await admin
      .from('studio_music_assets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', args.userId)
      .eq('source', 'ai')
      .in('status', ['queued', 'generating', 'ready'])
    if ((count ?? 0) >= cfg.maxPerUser) return { ok: false, reason: 'music_cap_reached' }
  }

  // 4. Price + balance (platform_config pricing, like a clip generation).
  const pricing = await getStudioPricing()
  const credits = creditsForCost(cfg.genCostUsd, pricing)
  const balance = await getBalance(args.userId)
  if (balance < credits) return { ok: false, reason: 'music_insufficient_credits' }

  // 5. Insert the queued asset (unsigned until the worker downloads + finalizes).
  const assetId = randomUUID()
  const { error: insErr } = await admin.from('studio_music_assets').insert({
    id: assetId,
    source: 'ai',
    user_id: args.userId,
    title: '',
    mood: '',
    prompt,
    duration_seconds: duration,
    status: 'queued',
    active: true,
  })
  if (insErr) return { ok: false, reason: 'music_not_found', detail: 'insert failed: ' + insErr.message }

  // 6. Charge credits (negative ledger row). No generation_job_id (that FK is for
  //    generation_jobs); the asset id rides in metadata. Roll the asset back if the
  //    charge fails so we never leave an uncharged queued asset for the worker.
  const { error: chErr } = await admin.from('credit_transactions').insert({
    user_id: args.userId,
    amount_credits: -credits,
    type: 'generation_charge',
    reason: 'studio_music_ai',
    metadata: { music_asset_id: assetId, cost_usd: cfg.genCostUsd },
  })
  if (chErr) {
    await admin.from('studio_music_assets').delete().eq('id', assetId)
    return { ok: false, reason: 'music_not_found', detail: 'charge failed: ' + chErr.message }
  }

  return { ok: true, assetId, credits }
}

// ===========================================================================
// Lifecycle transitions (worker-driven; shared here so the signing stays in one
// place and the app can also drive an API-route path if we choose one).
// ===========================================================================

// Claim a queued asset for generation (queued -> generating). CAS on status so
// two worker passes can't double-run the same asset. Returns true iff claimed.
export async function markMusicGenerating(assetId: string): Promise<boolean> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('studio_music_assets')
    .update({ status: 'generating', updated_at: new Date().toISOString() })
    .eq('id', assetId)
    .eq('status', 'queued')
    .select('id')
  if (error) return false
  return (data?.length ?? 0) > 0
}

// 5. Finalize a generated asset: sign the EXACT audio bytes (v1m) and mark ready.
//    Called AFTER the worker uploads the audio to R2 (r2Key/url are the uploaded
//    object). Hash-based binding so a later r2_key repoint / byte tamper breaks the
//    signature (verifyMusicAssetBind at render). Idempotent-safe: only a
//    'generating' row is advanced.
export async function finalizeMusicGeneration(args: {
  assetId: string
  audio: Buffer | Uint8Array
  durationSeconds: number
  r2Key: string
  url: string
  title?: string
}): Promise<{ ok: boolean; errorMessage?: string }> {
  const admin = createSupabaseAdmin()
  const contentHash = hashMusicAsset(args.audio)
  const bind = buildMusicAssetBind({
    assetId: args.assetId,
    source: 'ai',
    contentHash,
    generatedAt: new Date(),
  })
  const { data, error } = await admin
    .from('studio_music_assets')
    .update({
      status: 'ready',
      r2_key: args.r2Key,
      url: args.url,
      duration_seconds: Math.round(args.durationSeconds),
      ...(args.title ? { title: args.title } : {}),
      cryptobind_content_hash: bind.cryptobind_content_hash,
      cryptobind_signature: bind.cryptobind_signature,
      cryptobind_generated_at: bind.cryptobind_generated_at,
      cryptobind_algo: bind.cryptobind_algo,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.assetId)
    .in('status', ['queued', 'generating'])
    .select('id')
  if (error) return { ok: false, errorMessage: error.message }
  if ((data?.length ?? 0) === 0) return { ok: false, errorMessage: 'asset not in a finalizable state' }
  return { ok: true }
}

// 6. Refund on failure: mark the asset 'failed' and return the charged credits.
//    Idempotent -- if a refund row already exists for this asset, or the charge
//    can't be found, it does not double-refund. Mirrors the fal generation refund.
export async function refundMusicGeneration(args: {
  assetId: string
  detail?: string
}): Promise<{ ok: boolean; refunded?: number; errorMessage?: string }> {
  const admin = createSupabaseAdmin()

  // Always record the failure state (even if the refund is a no-op).
  await admin
    .from('studio_music_assets')
    .update({ status: 'failed', error_message: args.detail ?? 'generation failed', updated_at: new Date().toISOString() })
    .eq('id', args.assetId)

  // Already refunded? (idempotent guard)
  const { data: prior } = await admin
    .from('credit_transactions')
    .select('id')
    .eq('type', 'refund')
    .eq('metadata->>music_asset_id', args.assetId)
    .limit(1)
  if (prior && prior.length > 0) return { ok: true, refunded: 0 }

  // Find the original charge to mirror its amount.
  const { data: charge } = await admin
    .from('credit_transactions')
    .select('user_id, amount_credits')
    .eq('type', 'generation_charge')
    .eq('metadata->>music_asset_id', args.assetId)
    .limit(1)
    .maybeSingle()
  if (!charge) return { ok: true, refunded: 0 } // never charged (rolled back) -> nothing to refund

  const refund = Math.abs(Number(charge.amount_credits))
  if (!(refund > 0)) return { ok: true, refunded: 0 }

  const { error } = await admin.from('credit_transactions').insert({
    user_id: charge.user_id,
    amount_credits: refund,
    type: 'refund',
    reason: 'studio_music_ai_failed',
    metadata: { music_asset_id: args.assetId },
  })
  if (error) return { ok: false, errorMessage: error.message }
  return { ok: true, refunded: refund }
}
