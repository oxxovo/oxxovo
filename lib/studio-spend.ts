// Vendor spend across every Studio lane that spends it. CANONICAL COPY.
// Mirrored byte-for-byte into oxxovo-studio/src/studio-spend.ts.
//
// Two consumers, ONE original: the worker needs the totals for its float guard,
// the app needs the drift number for the alert pipe. Both are the same
// arithmetic over the same two tables. A mirror was going to exist either way --
// the question was how many ORIGINALS there would be, and two originals is what
// produced a duplicate boundary declaration and a duplicate attempt-key helper
// on 2026-08-02. So it is written once and copied, like music-provider.ts and
// music-license.ts. The app owns this copy; the worker re-syncs, never patches.
//
// ★TAKES A CLIENT, NEVER MAKES ONE. That is what lets the file be identical in
// both repos -- the app passes createSupabaseAdmin(), the worker passes
// getSupabase(). It is also why there is no `server-only` import: this module
// holds no credentials and reaches nothing on its own.
//
// ---------------------------------------------------------------------------
// ★WHAT THE GUARD IS FOR, because reading it as a cost ceiling gets the numbers
// set wrong. Participants pre-pay for their own generations (cost x 1.25,
// prepaid), so a prepaid balance at a vendor is NOT company cost -- it is FLOAT.
// The guards exist for two reasons and neither is "spend less":
//   1. THE FLOAT MUST NOT RUN DRY. If it empties, generation stops, and inside a
//      72h submission window that is a competition incident, not a billing one.
//   2. ANOMALY DETECTION. A runaway loop or an abuse spike shows here first.
// A ceiling set as though this were a budget would throttle a round we have
// already been paid for.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Every table that can carry a vendor bill, with the column that says when the
 * bill was incurred.
 *
 * ★Renders are absent and always will be. A render is ffmpeg on our own CPU, so
 * it spends no vendor money -- zero by construction, not by omission. Saying so
 * here stops someone "fixing" the omission later.
 *
 * The two tables use different completion timestamps, which is why a time window
 * is applied per table rather than once.
 */
export const VENDOR_SPEND_SOURCES = [
  { table: 'generation_jobs', finishedAt: 'worker_finished_at' },
  { table: 'studio_music_assets', finishedAt: 'updated_at' },
] as const

/**
 * Total vendor spend, optionally since an ISO instant.
 *
 * ★NULL actual_cost_usd is EXCLUDED, not counted as zero. Null means "the vendor
 * has not billed us / we do not know"; zero means "it was free". Treating null
 * as zero makes the remaining float look larger than it is, which is the exact
 * failure the guard exists to prevent.
 */
export async function sumVendorSpendUsd(db: SupabaseClient, sinceIso: string | null): Promise<number> {
  let total = 0
  for (const src of VENDOR_SPEND_SOURCES) {
    let q = db.from(src.table).select('actual_cost_usd').not('actual_cost_usd', 'is', null)
    if (sinceIso) q = q.gte(src.finishedAt, sinceIso)
    const { data, error } = await q
    if (error) throw new Error(`sumVendorSpendUsd(${src.table}): ` + error.message)
    total += (data ?? []).reduce((s, r) => s + Number((r as { actual_cost_usd: number }).actual_cost_usd ?? 0), 0)
  }
  return total
}

/** One credit-ledger row, reduced to what this file needs from it. */
export type SpendLedgerRow = {
  type: string
  generation_job_id: string | null
  metadata: { music_asset_id?: string } | null
}

/**
 * Which jobs and assets a participant has actually PAID for, net of refunds.
 * Pure, so the netting rule is testable without a database.
 *
 * ★A refund cancels its charge. Getting this wrong in either direction is bad in
 * a different way: counting a refunded job as paid hides real unpaid spend,
 * while ignoring charges entirely reports every job as unpaid and makes the
 * signal useless.
 *
 * Clips are linked by generation_job_id; a music charge has no such id and rides
 * in metadata.music_asset_id instead. Two id spaces, one rule.
 */
export function paidTargets(rows: SpendLedgerRow[]): { jobs: Set<string>; assets: Set<string> } {
  const jobs = new Set<string>()
  const assets = new Set<string>()
  const refundedJobs = new Set<string>()
  const refundedAssets = new Set<string>()
  for (const r of rows) {
    const assetId = r.metadata?.music_asset_id
    if (r.type === 'refund') {
      if (r.generation_job_id) refundedJobs.add(r.generation_job_id)
      if (assetId) refundedAssets.add(assetId)
    } else if (r.type === 'generation_charge') {
      if (r.generation_job_id) jobs.add(r.generation_job_id)
      if (assetId) assets.add(assetId)
    }
  }
  for (const id of refundedJobs) jobs.delete(id)
  for (const id of refundedAssets) assets.delete(id)
  return { jobs, assets }
}

export type UnpaidVendorSpend = { usd: number; jobs: number }

/**
 * ★VENDOR MONEY NOBODY PAID FOR -- the drift number, for the alert pipe.
 *
 * WHY A SECOND NUMBER. sumVendorSpendUsd answers "how much float is left", and a
 * balance alone cannot show the two ledgers coming apart. This is that, stated
 * as the only form of it that matters.
 *
 * ★Measured 2026-08-02, and the first framing of this was wrong, so the working
 * is recorded rather than the conclusion. Comparing GROSS ledger charges
 * ($27.7456) with vendor actual ($21.4846) reads as a 29% divergence. It is not
 * divergence; it decomposes exactly:
 *     $7.5210   charges on failed jobs that were REFUNDED -- subtracting them
 *               was the query's job, not a real gap
 *     $1.2600   vendor spend on 6 jobs created outside the charge path
 *               (seed/admin: 4x ltx2-fast, 2x nano-banana-pro, all ready)
 *     $20.2246  matched pairs, IDENTICAL on both sides, 0 of 37 differing
 * Net ledger $20.2246 against actual $21.4846, and the whole -$1.26 is that seed
 * bucket. So "29% is normal" would have pinned an artefact of how the sum was
 * taken, and it would move the moment the refund mix changed.
 *
 * ★BASELINE: $1.26 across 6 jobs, fully explained. It grows for exactly two
 * reasons worth waking someone for:
 *   - a DEADLINE LEAK: we abandoned a vendor call and refunded the participant
 *     while the vendor billed us anyway. An abandoned fal request is walked away
 *     from, not cancelled. Zero today only because the deadline is new.
 *   - a MODEL SWAP anomaly: the job billed for something other than what ran.
 * A number that names its own causes is worth alerting on; a percentage that
 * moves with the refund mix is not.
 */
export async function unpaidVendorSpendUsd(db: SupabaseClient): Promise<UnpaidVendorSpend> {
  const { data: tx, error: txErr } = await db
    .from('credit_transactions')
    .select('type, generation_job_id, metadata')
    .in('type', ['generation_charge', 'refund'])
  if (txErr) throw new Error('unpaidVendorSpendUsd(ledger): ' + txErr.message)

  const paid = paidTargets((tx ?? []) as SpendLedgerRow[])
  const paidFor: Record<string, Set<string>> = {
    generation_jobs: paid.jobs,
    studio_music_assets: paid.assets,
  }

  let usd = 0
  let jobs = 0
  for (const src of VENDOR_SPEND_SOURCES) {
    const { data, error } = await db.from(src.table).select('id, actual_cost_usd').not('actual_cost_usd', 'is', null)
    if (error) throw new Error(`unpaidVendorSpendUsd(${src.table}): ` + error.message)
    for (const r of data ?? []) {
      const row = r as { id: string; actual_cost_usd: number }
      const cost = Number(row.actual_cost_usd ?? 0)
      if (cost > 0 && !paidFor[src.table].has(row.id)) {
        usd += cost
        jobs++
      }
    }
  }
  return { usd, jobs }
}
