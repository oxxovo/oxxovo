// Studio credit ledger -- SERVER ONLY.
//
// Balance is never stored; it is SUM(amount_credits) over credit_transactions
// for a user (append-only ledger). Positive rows = grant / purchase / refund;
// negative rows = generation charge. credit_transactions is reachable by the
// service role only (RLS + grants from the Phase 1 migration), so every helper
// here uses the admin client. Operational parameters (margin, credit value)
// are read from platform_config -- never hardcoded.

import 'server-only'
// Relative, not the '@/' alias: the pricing guard below is unit-tested under
// `node --test`, whose resolve hook (scripts/test-hooks.mjs) understands
// relative specifiers and not the bundler alias. Same reason as lib/music-gate.ts.
import { createSupabaseAdmin } from './supabase-admin'

export type CreditTxType = 'purchase' | 'admin_adjust' | 'generation_charge' | 'refund'

export type LedgerRow = {
  id: string
  user_id: string
  amount_credits: number
  type: CreditTxType
  reason: string | null
  generation_job_id: string | null
  actor_id: string | null
  created_at: string
}

// --- balance --------------------------------------------------------------

export async function getBalance(userId: string): Promise<number> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('credit_transactions')
    .select('amount_credits')
    .eq('user_id', userId)
  if (error) throw new Error('getBalance: ' + error.message)
  return (data ?? []).reduce((sum, r) => sum + Number(r.amount_credits), 0)
}

// --- pricing (margin x cost -> credits) -----------------------------------

export interface StudioPricing {
  marginRate: number // studio_margin_rate
  creditUsdValue: number // studio_credit_usd_value
}

export async function getStudioPricing(): Promise<StudioPricing> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('platform_config')
    .select('key, value')
    .in('key', ['studio_margin_rate', 'studio_credit_usd_value'])
  if (error) throw new Error('getStudioPricing: ' + error.message)
  const map = new Map<string, string>()
  for (const r of data ?? []) map.set(r.key as string, r.value as string)
  const num = (k: string) => {
    const v = map.get(k)
    const n = Number(v)
    if (v == null || !Number.isFinite(n)) throw new Error(`platform_config.${k} missing/invalid`)
    return n
  }
  return { marginRate: num('studio_margin_rate'), creditUsdValue: num('studio_credit_usd_value') }
}

// Credits charged for a generation: raw cost x (1 + margin) / credit value,
// rounded up to whole credits. Mirrors the worker's creditsForCost.
//
// ★It THROWS instead of returning 0. Every call site decides "may this account
// spend?" with `balance < credits`, and `balance < 0` is false for EVERY
// account -- so a zero price does not make a generation cheap, it removes the
// balance check entirely, for a zero-balance user as much as anyone. Two ways
// to reach a zero here, both live: model_catalog.cost_per_second_usd is
// `NOT NULL DEFAULT 0` (a model onboarded without its probe number prices at
// zero), and a missing platform_config price key reads as 0 (measured
// 2026-08-01: studio_music_gen_cost_usd does not exist in the live table).
// Neither is a free generation anyone decided to give away, so this refuses to
// name a price rather than name one that disables the check. A caller that must
// survive a misconfigured price uses creditsForCostOrNull and closes down the
// spend path it was pricing.
export function creditsForCost(costUsd: number, pricing: StudioPricing): number {
  const credits = Math.ceil((costUsd * (1 + pricing.marginRate)) / pricing.creditUsdValue)
  if (!Number.isFinite(credits) || credits <= 0) {
    throw new Error(
      `creditsForCost: refusing a non-positive charge (cost_usd=${costUsd}, ` +
        `margin_rate=${pricing.marginRate}, credit_usd_value=${pricing.creditUsdValue}) ` +
        '-- unpriced model row or missing platform_config price',
    )
  }
  return credits
}

// Same arithmetic, for the paths that have somewhere to fail closed TO: null
// means "this cannot be priced". The caller must then withhold the spend (hide
// the panel, refuse the generation) -- never charge 0 and never proceed.
export function creditsForCostOrNull(costUsd: number, pricing: StudioPricing): number | null {
  try {
    return creditsForCost(costUsd, pricing)
  } catch {
    return null
  }
}

// --- Stripe top-up (purchase) --------------------------------------------

export interface StudioPurchaseConfig {
  enabled: boolean
  packUsd: number[] // offered USD amounts
  creditUsdValue: number
}

// Buy-flow config: gate + offered USD packs + credit conversion. All dynamic
// (platform_config) -- no hardcoded packs.
export async function getStudioPurchaseConfig(): Promise<StudioPurchaseConfig> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('platform_config')
    .select('key, value')
    .in('key', ['studio_purchase_enabled', 'studio_credit_pack_usd', 'studio_credit_usd_value'])
  if (error) throw new Error('getStudioPurchaseConfig: ' + error.message)
  const map = new Map<string, string>()
  for (const r of data ?? []) map.set(r.key as string, r.value as string)
  const packUsd = (map.get('studio_credit_pack_usd') ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
  const cuv = Number(map.get('studio_credit_usd_value'))
  return {
    enabled: String(map.get('studio_purchase_enabled')).toLowerCase() === 'true',
    packUsd,
    creditUsdValue: Number.isFinite(cuv) && cuv > 0 ? cuv : 0.1,
  }
}

// Credits a USD amount buys (whole credits).
export function creditsForUsd(usd: number, creditUsdValue: number): number {
  return Math.floor(usd / creditUsdValue)
}

// Idempotent purchase credit. Keyed by the Stripe session id (unique partial
// index), so a webhook redelivery never double-credits.
export async function grantPurchasedCredits(args: {
  userId: string
  usd: number
  credits: number
  stripeSessionId: string
}): Promise<{ ok: boolean; duplicate?: boolean; errorMessage?: string }> {
  const admin = createSupabaseAdmin()
  // Pre-check (the unique index is the real guard).
  const { data: existing } = await admin
    .from('credit_transactions')
    .select('id')
    .eq('stripe_session_id', args.stripeSessionId)
    .limit(1)
  if (existing && existing.length > 0) return { ok: true, duplicate: true }

  const { error } = await admin.from('credit_transactions').insert({
    user_id: args.userId,
    amount_credits: args.credits,
    type: 'purchase',
    stripe_session_id: args.stripeSessionId,
    metadata: { usd: args.usd },
  })
  if (error) {
    // Unique-violation = a concurrent webhook already inserted it.
    if ((error as { code?: string }).code === '23505') return { ok: true, duplicate: true }
    return { ok: false, errorMessage: error.message }
  }
  return { ok: true }
}

// --- mutations ------------------------------------------------------------

export interface GrantResult {
  ok: boolean
  errorMessage?: string
  newBalance?: number
}

// Admin promo grant. reason is REQUIRED (audit), amount must be a positive whole
// number of credits, actorId is the granting admin. The inserted row is itself
// the audit record (reason + actor_id + created_at).
export async function grantPromoCredits(args: {
  userId: string
  amountCredits: number
  reason: string
  actorId: string
}): Promise<GrantResult> {
  const reason = args.reason?.trim()
  if (!reason) return { ok: false, errorMessage: 'reason_required' }
  if (!Number.isFinite(args.amountCredits) || args.amountCredits <= 0) {
    return { ok: false, errorMessage: 'amount_invalid' }
  }
  const amount = Math.round(args.amountCredits)

  const admin = createSupabaseAdmin()
  const { error } = await admin.from('credit_transactions').insert({
    user_id: args.userId,
    amount_credits: amount,
    type: 'admin_adjust',
    reason,
    actor_id: args.actorId,
    metadata: { source: 'admin_promo' },
  })
  if (error) return { ok: false, errorMessage: error.message }

  const newBalance = await getBalance(args.userId)
  return { ok: true, newBalance }
}

// Charge a user for a generation (negative ledger row). Used by the enqueue
// path in Phase 3. Computes credits from the recorded cost via platform_config.
export async function chargeForGeneration(args: {
  userId: string
  generationJobId: string
  costUsd: number
  pricing?: StudioPricing
}): Promise<{ ok: boolean; credits?: number; errorMessage?: string }> {
  const pricing = args.pricing ?? (await getStudioPricing())
  const credits = creditsForCost(args.costUsd, pricing)
  const admin = createSupabaseAdmin()
  const { error } = await admin.from('credit_transactions').insert({
    user_id: args.userId,
    amount_credits: -credits,
    type: 'generation_charge',
    generation_job_id: args.generationJobId,
    metadata: { cost_usd: args.costUsd },
  })
  if (error) return { ok: false, errorMessage: error.message }
  return { ok: true, credits }
}

// --- read helpers for the admin ledger view -------------------------------

export async function listRecentTransactions(limit = 100): Promise<LedgerRow[]> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('credit_transactions')
    .select('id, user_id, amount_credits, type, reason, generation_job_id, actor_id, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error('listRecentTransactions: ' + error.message)
  return (data ?? []) as LedgerRow[]
}

// auth.users has no getUserByEmail; page through listUsers (service role).
export async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const target = email.trim().toLowerCase()
  if (!target) return null
  const admin = createSupabaseAdmin()
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error('findUserByEmail: ' + error.message)
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === target)
    if (hit) return { id: hit.id, email: hit.email ?? target }
    if (data.users.length < 200) return null
    page += 1
    if (page > 50) return null
  }
}

// Resolve emails for a set of user ids (for the ledger display).
export async function getEmailMap(userIds: string[]): Promise<Map<string, string>> {
  const want = new Set(userIds.filter(Boolean))
  const out = new Map<string, string>()
  if (want.size === 0) return out
  const admin = createSupabaseAdmin()
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error('getEmailMap: ' + error.message)
    for (const u of data.users) {
      if (want.has(u.id)) out.set(u.id, u.email ?? '')
    }
    if (out.size >= want.size || data.users.length < 200) break
    page += 1
    if (page > 50) break
  }
  return out
}
