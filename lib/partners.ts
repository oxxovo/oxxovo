// Partner / Member-Hosted Tournament config readers. SERVER ONLY.
//
// platform_config, member_tier_config, partner_tournaments are granted to
// service_role ONLY (see reports/partner_schema_grants_migration_2026-06.sql),
// so every read here goes through createSupabaseAdmin. NEVER import this into a
// client component.
//
// Hardcode policy: operational VALUES (thresholds, caps, rates) always come
// from the DB. Only the config KEY NAMES are referenced in code — those are
// the contract. If a key is missing the readers return a documented fallback
// and log, rather than silently substituting a magic number.

import 'server-only'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { sendPartnerEligible } from '@/lib/email/send'
import { isMemberHostedEnabled } from '@/lib/member-hosted'

const APP_URL = process.env.APP_URL ?? 'https://www.oxxovo.ai'

// ─── platform_config ──────────────────────────────────────────────────────

export type PlatformConfigRow = {
  key: string
  value: string
  value_type: 'int' | 'decimal' | 'text' | 'bool' | string
}

export type ParsedConfigValue = number | string | boolean

function parseConfigValue(value: string, valueType: string): ParsedConfigValue {
  switch (valueType) {
    case 'int':
      return Number.parseInt(value, 10)
    case 'decimal':
      return Number.parseFloat(value)
    case 'bool':
      return value === 'true'
    default:
      return value
  }
}

// 60s TTL, per-warm-instance (HQ 2026-08-20: only the generation-path hot
// spots -- ip-check + cosmetic guard -- get this; the other ~30 platform_config
// call sites stay as fresh-every-call reads, untouched). Serverless caveat:
// this only helps within one warm Vercel instance's lifetime, resets on cold
// start -- reduces round-trips, doesn't guarantee a single fetch per 60s.
// A failed fetch is NEVER cached: caching an empty Map for 60s would silently
// blank the cosmetic guard's 5 lists (empty list = pass, not block) --
// [[feedback-absent-is-not-zero]].
let configCache: { map: Map<string, ParsedConfigValue>; expiresAt: number } | null = null
const CONFIG_CACHE_TTL_MS = 60_000

// Fetch the whole table once and return a key → parsed-value map. Callers that
// need several keys should use this (one round-trip) instead of N getters.
export async function getPlatformConfigMap(): Promise<Map<string, ParsedConfigValue>> {
  const now = Date.now()
  if (configCache && configCache.expiresAt > now) return configCache.map

  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('platform_config')
    .select('key, value, value_type')
  if (error) {
    console.error('[partners] platform_config read failed:', error.message)
    return new Map()
  }
  const map = new Map<string, ParsedConfigValue>()
  for (const row of (data ?? []) as PlatformConfigRow[]) {
    map.set(row.key, parseConfigValue(row.value, row.value_type))
  }
  configCache = { map, expiresAt: now + CONFIG_CACHE_TTL_MS }
  return map
}

// ─── member_tier_config ───────────────────────────────────────────────────

export type TierConfig = {
  tier: string
  max_applications_cap: number
  // null = unlimited (gold). Callers MUST treat null as "no per-season limit".
  max_tournaments_per_season: number | null
}

// All tiers, ascending by applicant cap (bronze → silver → gold). Used for the
// admin invite dropdown and for cap validation in /host/new.
export async function getTierConfigs(): Promise<TierConfig[]> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('member_tier_config')
    .select('tier, max_applications_cap, max_tournaments_per_season')
    .order('max_applications_cap', { ascending: true })
  if (error) {
    console.error('[partners] member_tier_config read failed:', error.message)
    return []
  }
  return (data ?? []) as TierConfig[]
}

export async function getTierConfig(tier: string): Promise<TierConfig | null> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('member_tier_config')
    .select('tier, max_applications_cap, max_tournaments_per_season')
    .eq('tier', tier)
    .maybeSingle()
  if (error) {
    console.error('[partners] tier read failed:', tier, error.message)
    return null
  }
  return (data as TierConfig | null) ?? null
}

// ─── partner profile helpers ──────────────────────────────────────────────

// partner_status values, mirrored from the profiles CHECK. Centralized so the
// admin UI and actions share one source. The list itself now lives in
// lib/partner-statuses.ts -- a module with no imports, so unit tests can read it
// (this file reaches next/headers and cannot be imported from a test). Re-exported
// here so every existing call site keeps importing it from the same place.
export {
  PARTNER_STATUSES,
  type PartnerStatus,
  type PartnerSource,
} from './partner-statuses'
// A re-export does not bind the name locally, and this file annotates with it.
import type { PartnerStatus } from './partner-statuses'

// ─── partner_status_events (audit log) ────────────────────────────────────
// See reports/partner_status_events_migration_2026-06.sql. profiles.partner_status
// is the current state; this table is the permanent transition log. reason is
// required at this layer for admin events (invited/suspended/restored).

export type PartnerEvent =
  | 'invited'
  | 'eligible'
  | 'activated'
  | 'suspended'
  | 'restored'

export type LogPartnerEventInput = {
  userId: string
  event: PartnerEvent
  // Required for admin events; null for system/auto events (eligible/activated).
  reason?: string | null
  // Admin who performed it; null = system/automatic.
  actorId?: string | null
  // Tier snapshot at the time of the event (member_tier_config name).
  tier?: string | null
  metadata?: Record<string, unknown> | null
}

export async function logPartnerStatusEvent(
  input: LogPartnerEventInput,
): Promise<void> {
  const admin = createSupabaseAdmin()
  const { error } = await admin.from('partner_status_events').insert({
    user_id: input.userId,
    event: input.event,
    reason: input.reason ?? null,
    actor_id: input.actorId ?? null,
    tier: input.tier ?? null,
    metadata: input.metadata ?? null,
  })
  if (error) {
    // Audit insert failing should not silently swallow — but it also must not
    // break the status mutation that triggered it. Log loudly.
    console.error('[partners] status event insert failed:', input.event, error.message)
  }
}

export type PartnerStatusEvent = {
  id: string
  event: PartnerEvent
  reason: string | null
  actor_id: string | null
  tier: string | null
  created_at: string
}

export async function getPartnerStatusEvents(
  userId: string,
): Promise<PartnerStatusEvent[]> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('partner_status_events')
    .select('id, event, reason, actor_id, tier, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[partners] status events read failed:', error.message)
    return []
  }
  return (data ?? []) as PartnerStatusEvent[]
}

// ─── partner profile lists (admin console) ────────────────────────────────
// Read via service-role AFTER a requireAdmin() gate in the caller. profiles
// RLS does not have a blanket admin-read-all policy, so the cookie/anon client
// would return only the admin's own row.

export type PartnerProfile = {
  id: string
  email: string
  partner_status: PartnerStatus
  partner_source: string | null
  partner_tier: string | null
  cumulative_top50: number
  cumulative_wins: number
  partner_invited_at: string | null
  partner_activated_at: string | null
  partner_invite_note: string | null
  // Derived: number of seasons this user hosts (host_user_id match).
  hosted_count: number
}

const PARTNER_PROFILE_COLUMNS =
  'id, email, partner_status, partner_source, partner_tier, cumulative_top50, cumulative_wins, partner_invited_at, partner_activated_at, partner_invite_note'

// Map of host_user_id → hosted season count (partner-hosted seasons only).
async function getHostedCounts(): Promise<Map<string, number>> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('seasons')
    .select('host_user_id')
    .eq('host_type', 'partner')
    .not('host_user_id', 'is', null)
  if (error) {
    console.error('[partners] hosted count read failed:', error.message)
    return new Map()
  }
  const counts = new Map<string, number>()
  for (const row of (data ?? []) as { host_user_id: string }[]) {
    counts.set(row.host_user_id, (counts.get(row.host_user_id) ?? 0) + 1)
  }
  return counts
}

async function getProfilesByStatus(
  status: PartnerStatus,
): Promise<PartnerProfile[]> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('profiles')
    .select(PARTNER_PROFILE_COLUMNS)
    .eq('partner_status', status)
    .order('partner_activated_at', { ascending: false, nullsFirst: false })
  if (error) {
    console.error('[partners] profiles by status read failed:', status, error.message)
    return []
  }
  const hosted = await getHostedCounts()
  return (data ?? []).map((r) => {
    const row = r as Omit<PartnerProfile, 'hosted_count'>
    return { ...row, hosted_count: hosted.get(row.id) ?? 0 }
  })
}

// Tab 1: partner_status='active' (+ suspended shown together so admins can
// restore). Tab 2: partner_status='auto_eligible'.
export async function getActivePartners(): Promise<PartnerProfile[]> {
  return getProfilesByStatus('active')
}

export async function getSuspendedPartners(): Promise<PartnerProfile[]> {
  return getProfilesByStatus('suspended')
}

export async function getEligibleMembers(): Promise<PartnerProfile[]> {
  return getProfilesByStatus('auto_eligible')
}

// ─── eligibility / tier recompute (task 2) ────────────────────────────────
// Source-of-truth recompute, NOT a blind +1. cumulative_top50 / cumulative_wins
// are derived from genesis_applications every time, so re-running (hook + weekly
// cron) is idempotent and never double-counts. This is the "주 1회 보정" design:
// the immediate hooks keep stats fresh; the cron repairs any missed events.

// Award-rank -> tier business rule (spec): 1st=gold, 2nd=silver,
// 3rd OR enough Top-50 finishes = bronze. These tier NAMES must exist in
// member_tier_config (profiles.partner_tier FK enforces it); the bronze Top-50
// threshold reuses the platform_config eligibility count (no separate magic
// number). Tier ORDERING for "highest wins" is derived from member_tier_config
// caps, not hardcoded, so adding a tier later needs no code change here.
function computeTierFromHistory(
  hasFirst: boolean,
  hasSecond: boolean,
  hasThird: boolean,
  top50: number,
  top50BronzeThreshold: number,
): string | null {
  if (hasFirst) return 'gold'
  if (hasSecond) return 'silver'
  if (hasThird || (top50BronzeThreshold > 0 && top50 >= top50BronzeThreshold)) {
    return 'bronze'
  }
  return null
}

// Rank map from tier configs (ascending by applicant cap = ascending prestige).
function buildTierRank(tiers: TierConfig[]): Map<string, number> {
  const m = new Map<string, number>()
  tiers.forEach((t, i) => m.set(t.tier, i + 1))
  return m
}

// Higher of two tiers per the cap-derived rank; never returns a lower tier than
// either input (so an admin-assigned tier is never silently downgraded).
function higherTier(
  a: string | null,
  b: string | null,
  rank: Map<string, number>,
): string | null {
  if (!a) return b
  if (!b) return a
  return (rank.get(a) ?? 0) >= (rank.get(b) ?? 0) ? a : b
}

type ApplicationStatRow = {
  season_id: string
  status: string
  award_rank: number | null
  creator_name: string | null
  country: string | null
  created_at: string
}

// Recompute one user's partner stats + tier, and auto-promote none ->
// auto_eligible (with email) when thresholds are met. Safe to call repeatedly.
export async function recomputePartnerStats(userId: string): Promise<void> {
  const admin = createSupabaseAdmin()

  const [appsRes, profileRes, cfg, tiers] = await Promise.all([
    admin
      .from('genesis_applications')
      .select('season_id, status, award_rank, creator_name, country, created_at')
      .eq('user_id', userId),
    admin
      .from('profiles')
      .select('partner_status, partner_tier, email')
      .eq('id', userId)
      .maybeSingle(),
    getPlatformConfigMap(),
    getTierConfigs(),
  ])

  const profile = profileRes.data
  if (!profile) return // no profile row — nothing to update

  const rows = (appsRes.data ?? []) as ApplicationStatRow[]

  // Top-50 = advanced to main round (selected/awarded) or holds an award rank.
  // Dedupe by season (one app per season per user, but defensive).
  const top50Seasons = new Set<string>()
  let wins = 0
  let hasFirst = false
  let hasSecond = false
  let hasThird = false
  for (const r of rows) {
    const advanced =
      r.status === 'selected' || r.status === 'awarded' || r.award_rank != null
    if (advanced) top50Seasons.add(r.season_id)
    if (r.award_rank === 1) {
      hasFirst = true
      wins++
    } else if (r.award_rank === 2) {
      hasSecond = true
      wins++
    } else if (r.award_rank === 3) {
      hasThird = true
      wins++
    }
  }
  const top50 = top50Seasons.size

  const top50Threshold = Number(cfg.get('partner_eligibility_top50_count') ?? 0)
  const winsThreshold = Number(cfg.get('partner_eligibility_wins_count') ?? 0)

  // Tier: compute from history, validate against config, then never downgrade
  // below the current (possibly admin-assigned) tier.
  let computed = computeTierFromHistory(hasFirst, hasSecond, hasThird, top50, top50Threshold)
  if (computed && !tiers.some((t) => t.tier === computed)) {
    console.warn(`[partners] computed tier '${computed}' not in member_tier_config — ignoring`)
    computed = null
  }
  const finalTier = higherTier(computed, profile.partner_tier ?? null, buildTierRank(tiers))

  const eligible =
    (top50Threshold > 0 && top50 >= top50Threshold) ||
    (winsThreshold > 0 && wins >= winsThreshold)
  // M-1: auto-promotion (partner_status flip) and the PartnerEligible email are
  // member-hosted surfaces -- they only fire when the master switch is on. The
  // cumulative stats + tier above still recompute (harmless), so the moment the
  // program is enabled the next recompute promotes anyone already qualified.
  const memberHostedOn = await isMemberHostedEnabled()
  const becameEligible = memberHostedOn && eligible && profile.partner_status === 'none'

  const update: Record<string, unknown> = {
    cumulative_top50: top50,
    cumulative_wins: wins,
    partner_tier: finalTier,
    updated_at: new Date().toISOString(),
  }
  if (becameEligible) {
    update.partner_status = 'auto_eligible'
    update.partner_source = 'auto'
  }

  const { error: updErr } = await admin.from('profiles').update(update).eq('id', userId)
  if (updErr) {
    console.error('[partners] recompute update failed:', userId, updErr.message)
    return
  }

  if (becameEligible) {
    await logPartnerStatusEvent({
      userId,
      event: 'eligible',
      reason: null,
      actorId: null, // system / automatic
      tier: finalTier,
      metadata: { cumulative_top50: top50, cumulative_wins: wins },
    })
    // Name/country come from the user's most recent application.
    const latest = [...rows].sort((a, b) =>
      a.created_at < b.created_at ? 1 : -1,
    )[0]
    try {
      await sendPartnerEligible({
        toEmail: profile.email,
        country: latest?.country ?? null,
        creatorName: latest?.creator_name ?? profile.email,
        tier: finalTier ?? '',
        applyUrl: `${APP_URL}/host/new`,
      })
    } catch (e) {
      console.error('[partners] eligible email error:', e)
    }
  }
}

// ─── partner tournaments (admin escrow review) ────────────────────────────

export type PartnerTournamentRow = {
  id: string
  display_name: string
  host_user_id: string | null
  host_email: string | null
  total_prize_pool: number
  max_applicants: number
  status: string
  prize_funding_mode: string
  prize_pool_escrow_status: string
  application_open_at: string | null
  application_close_at: string | null
  created_at: string
}

// All partner-hosted seasons with the host's email resolved, newest first.
// Admins use this to confirm prize-pool escrow before a tournament goes public.
export async function getPartnerTournaments(): Promise<PartnerTournamentRow[]> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('seasons')
    .select(
      'id, display_name, host_user_id, total_prize_pool, max_applicants, status, prize_funding_mode, prize_pool_escrow_status, application_open_at, application_close_at, created_at',
    )
    .eq('host_type', 'partner')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[partners] partner tournaments read failed:', error.message)
    return []
  }
  const rows = (data ?? []) as Omit<PartnerTournamentRow, 'host_email'>[]

  const hostIds = [...new Set(rows.map((r) => r.host_user_id).filter(Boolean))] as string[]
  const emailById = new Map<string, string>()
  if (hostIds.length > 0) {
    const { data: profs } = await admin
      .from('profiles')
      .select('id, email')
      .in('id', hostIds)
    for (const p of (profs ?? []) as { id: string; email: string }[]) {
      emailById.set(p.id, p.email)
    }
  }

  return rows.map((r) => ({
    ...r,
    host_email: r.host_user_id ? emailById.get(r.host_user_id) ?? null : null,
  }))
}

// ─── partner settlement (정산) ────────────────────────────────────────────
// Canonical formula. No hardcoded rates or fees: the commission rate comes from
// the season override or platform_config, and processing_fees is the ACTUAL
// payment-processing cost (card/ACH/withdrawal) recorded at settlement time and
// stored on partner_tournaments.processing_fees.
//
//   host_payout = total_revenue - commission - processing_fees - prize_paid

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export type SettlementInput = {
  totalRevenue: number
  commissionRate: number // 0..1
  processingFees: number // actual measured cost recorded at settlement
  prizePaid: number
}

export type Settlement = {
  commissionAmount: number
  processingFees: number
  prizePaid: number
  hostPayout: number
}

export function computePartnerSettlement(input: SettlementInput): Settlement {
  const commissionAmount = round2(input.totalRevenue * input.commissionRate)
  const hostPayout = round2(
    input.totalRevenue - commissionAmount - input.processingFees - input.prizePaid,
  )
  return {
    commissionAmount,
    processingFees: round2(input.processingFees),
    prizePaid: round2(input.prizePaid),
    hostPayout,
  }
}

// Effective commission rate for a tournament: a per-season override beats the
// platform_config default. Both DB-sourced; never hardcoded.
export async function getEffectiveCommissionRate(
  commissionRateOverride: number | null,
): Promise<number> {
  if (commissionRateOverride != null) return commissionRateOverride
  const cfg = await getPlatformConfigMap()
  return Number(cfg.get('partner_commission_rate') ?? 0)
}

// Weekly correction cron: recompute every user that has a linked application.
export async function recomputeAllPartnerStats(): Promise<{ processed: number }> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('genesis_applications')
    .select('user_id')
    .not('user_id', 'is', null)
  if (error) {
    console.error('[partners] recomputeAll user load failed:', error.message)
    return { processed: 0 }
  }
  const ids = [...new Set((data ?? []).map((r) => r.user_id as string))]
  for (const id of ids) {
    await recomputePartnerStats(id)
  }
  return { processed: ids.length }
}
