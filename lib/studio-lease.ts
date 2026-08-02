// Lease recovery for the two Studio lanes that hold participants' money.
// SERVER ONLY. Called from the season tick, hourly.
//
// THE BUG. A worker claims a row, moves it to an in-flight status, and dies.
// Nothing reclaims it, so the row sits there forever: already charged, never
// refunded, no error, no trace. Lane A fixed this for renders (claimed_at +
// sweepAsyncSubmissions); clips and music were left, and they are the two that
// took the participant's credits before the work started. A worker WAS offline
// for a month, so this is a measured failure mode, not a hypothetical one.
//
// ★WHY THE APP AND NOT THE WORKER. Putting the sweep in the worker needs no
// cron slot and touches nobody else's files -- and is wrong, because a sweep
// inside the worker is dead in exactly the situation it exists to clean up.
// Requeueing is pointless with no worker running, but REFUNDING is not: that is
// money, and it has to happen whether or not the fleet is up.
//
// ★NOT gated on submit_intent_at. lane A's sweep only looks at rows with a
// submission intent, which is right for finalizing submissions and wrong here:
// a generation nobody has submitted yet was still paid for.

import 'server-only'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { refundMusicGeneration } from '@/lib/music-gen'
import { CLAIM_COLUMN, type StudioLeaseTable } from '@/lib/studio-claim-columns'
import { isOwnedBy } from '@/lib/studio-sweep-scope'
import { boundaryFor, isPastRound, seasonBoundsFrom, type SeasonBounds } from '@/lib/studio-round-bounds'

export { CLAIM_COLUMN, type StudioLeaseTable }

// ★DERIVED FROM THE WORKER'S OWN DEADLINE, not chosen. The worker bounds every
// third-party call at FAL_GEN_TIMEOUT_MS / MUSIC_GEN_TIMEOUT_MS (default 35 min,
// itself derived: 4 retry attempts x the slowest real success of 518.0s +
// backoff, measured over 43 live generations on 2026-08-02). The rule, taken
// from lane A's render lease, is that the worker's own deadline fires FIRST and
// marks the row failed, so this only ever catches a process that died without
// cleaning up. Two times the deadline leaves room for the failure write itself.
//
// ★It must stay ABOVE the deadline for a second reason: an abandoned fal request
// is not cancelled, only walked away from. Reclaiming a row while its ghost is
// still running is how two attempts end up writing the same artefact.
const MONEY_LEASE_STALE_MS = Math.max(60_000, Number(process.env.STUDIO_LEASE_STALE_MS ?? '4200000'))

// ★Lane A's render values, matched deliberately. 30 minutes is 2x the worker's
// ffmpeg timeout, exactly as 70 minutes is 2x the fal/music deadline -- the same
// rule, different call bound. The numbers differ because the evidence differs,
// not because two people picked separately.
const RENDER_LEASE_STALE_MS = Math.max(60_000, Number(process.env.RENDER_LEASE_STALE_MS ?? '1800000'))
const RENDER_MAX_ATTEMPTS = 3

// ★One automatic retry, then stop -- and the bound is doing two jobs.
//
// COST: every requeue is another vendor charge against a participant who paid
// once. Unbounded requeueing is unbounded spend. (Renders can requeue freely;
// they cost CPU. These cannot.)
// RACE: every requeue also opens another window in which a revived worker and a
// live one both hold the same row. The claim-token CAS makes that window safe,
// but "safe" is not "free" -- fewer windows is strictly better, and an unbounded
// retry draws unbounded windows.
//
// One retry is what a transient worker death costs. Beyond that it is not
// transient, and the honest answer is to give the credits back: a refund restores
// the balance AND frees the per-round cap slot (a 'failed' row is not counted),
// so the participant is whole and retrying becomes their choice rather than our
// spend on their behalf.
const MONEY_MAX_ATTEMPTS = 2

// Long enough queued that something is worth reporting, whether or not it is yet
// refundable. Detection, not a decision.
const QUEUE_OVERDUE_MS = Math.max(60_000, Number(process.env.STUDIO_QUEUE_OVERDUE_MS ?? '86400000'))

// ★Grace past the round boundary before a still-queued job is given back.
//
// The boundary itself is the honest deadline: after it, the job cannot be
// submitted for the round it was bought for, so holding the credits serves
// nobody. The grace exists because the 24h processing buffer is real -- work
// accepted right at the deadline is still being finished during it -- and
// refunding into that window would take credits back from a job that was about
// to complete. Same 24h the submission buffer uses, and env-overridable
// alongside it.
const ROUND_GRACE_MS = Math.max(0, Number(process.env.STUDIO_ROUND_GRACE_MS ?? '86400000'))

export type StudioLeaseReport = {
  /** In-flight rows handed back to the queue for one more attempt. */
  requeued: { table: StudioLeaseTable; id: string; attempts: number }[]
  /** In-flight rows past the retry bound: failed and refunded. */
  refunded: { table: StudioLeaseTable; id: string }[]
  /**
   * Rows still in 'queued' long enough to be worth a look, but NOT yet past
   * their round boundary (or with no boundary to compare against). Reported
   * only. A job that is merely slow is not a job to take money back for.
   */
  overdue: { table: StudioLeaseTable; id: string; ageHours: number }[]
  /**
   * Rows given back because their round has closed: the job can no longer be
   * submitted for the round it was bought for, so the credits go home. Distinct
   * from `refunded`, which is a lease that expired mid-flight.
   */
  expired: { table: StudioLeaseTable; id: string; seasonId: string }[]
  errors: string[]
}

function ageMs(value: unknown, fallback: unknown, now: number): number | null {
  // ★coalesce, exactly as lane A does: a row claimed before the claim-stamp
  // deploy has no stamp, and updated_at is the closest honest substitute. Without
  // this those rows are invisible to the sweep forever.
  const t = Date.parse(String(value ?? fallback ?? ''))
  return Number.isFinite(t) ? now - t : null
}

// ★When a round stops being able to use a job.
//
// Read-only over the seasons date columns. getSeasonPhase (head office) owns the
// question of which phase a season is IN; this only needs a timestamp to compare
// against, so it takes the columns directly and interprets nothing else.
//
// ★A NULL BOUNDARY MEANS "DO NOT ACT", NEVER "ACT NOW". Measured 2026-08-02:
// season_1 and every season_100x rehearsal row have application_close_at = null,
// and several have main_round_end_at = null too. Date.parse(null) is NaN, and a
// NaN comparison quietly reads as "not past" -- which is the safe direction here
// only by accident, so it is made explicit instead of relied on.
async function loadSeasonBounds(): Promise<Map<string, SeasonBounds>> {
  const admin = createSupabaseAdmin()
  const out = new Map<string, SeasonBounds>()
  const { data, error } = await admin
    .from('seasons')
    .select('id, application_close_at, main_round_end_at, awards_announcement_at')
  if (error) {
    // Unreadable schedule -> no boundary for anyone -> nothing is expired. The
    // sweep still does its lease work; it just does not spend the participant's
    // money on a guess.
    console.warn('[studio] season bounds unreadable, skipping round-expiry:', error.message)
    return out
  }
  for (const row of data ?? []) out.set(String(row.id), seasonBoundsFrom(row))
  return out
}

type LaneSpec = {
  table: StudioLeaseTable
  inFlight: string[]
  /** Rows in flight are handed back to this status. */
  queuedStatus: string
  /** Extra equality filters (music shares its table with library assets). */
  scope?: Record<string, string>
  /** Only rows whose column IS NULL. Used for the render split -- see below. */
  nullScope?: string[]
  /** Column holding the round this row belongs to, when the table has one. */
  roundColumn?: string
  /** How quiet the claim must be before the row is considered abandoned. */
  staleMs: number
  /** Automatic retries before the row is given up on. */
  maxAttempts: number
  /**
   * Terminal action. Renders pass null: they cost CPU, never credits
   * (createRender does not charge), so there is nothing to give back.
   */
  refund: ((id: string, detail: string) => Promise<void>) | null
}

// ★THE SPLIT IS DECLARED, NOT ASSUMED. Which rows belong to this sweep comes
// from studio-sweep-scope.ts, and a test executes both scopes over every
// (table, hasSubmitIntent) combination to prove they neither overlap nor leave a
// gap. Overlap would requeue an accepted render twice a tick and slip past lane
// A's attempt bound; the gap is the bug being fixed.
async function laneSpecs(): Promise<LaneSpec[]> {
  const admin = createSupabaseAdmin()
  return [
    {
      table: 'generation_jobs',
      inFlight: ['generating', 'uploading'],
      queuedStatus: 'queued',
      staleMs: MONEY_LEASE_STALE_MS,
      maxAttempts: MONEY_MAX_ATTEMPTS,
      refund: async (id, detail) => {
        // Mirror of the worker's refundFailedJob: a clip charge is linked by
        // generation_job_id, and the prior-refund lookup keeps it idempotent.
        const { data: prior } = await admin
          .from('credit_transactions')
          .select('id')
          .eq('generation_job_id', id)
          .eq('type', 'refund')
          .limit(1)
        if (prior?.length) return
        const { data: job } = await admin
          .from('generation_jobs')
          .select('user_id, credits_charged')
          .eq('id', id)
          .maybeSingle()
        const credits = Math.abs(Number(job?.credits_charged ?? 0))
        if (!job || !(credits > 0)) return
        await admin.from('credit_transactions').insert({
          user_id: job.user_id,
          amount_credits: credits,
          type: 'refund',
          generation_job_id: id,
          reason: 'generation_lease_expired',
        })
        await admin
          .from('generation_jobs')
          .update({ status: 'failed', error_message: detail, updated_at: new Date().toISOString() })
          .eq('id', id)
      },
    },
    {
      table: 'studio_music_assets',
      inFlight: ['generating'],
      queuedStatus: 'queued',
      staleMs: MONEY_LEASE_STALE_MS,
      maxAttempts: MONEY_MAX_ATTEMPTS,
      // A library bed is seeded straight to ready and must never be swept.
      scope: { source: 'ai' },
      roundColumn: 'round',
      // Already idempotent, already marks the row failed.
      refund: async (id, detail) => {
        await refundMusicGeneration({ assetId: id, detail })
      },
    },
    {
      // ★Renders that were never accepted for submission. Lane A sweeps the
      // accepted ones; this is the complement, and until now it was nobody's.
      // The symptom was not just a stuck row: the compose editor resumes onto
      // "the newest render that is neither submitted nor failed", so a
      // participant could be parked on a render that would never finish.
      // Marking it failed is what releases them.
      table: 'render_jobs',
      inFlight: ['rendering', 'uploading'],
      queuedStatus: 'queued',
      nullScope: ['submit_intent_at'],
      // ★Lane A's numbers, not this file's. A render costs CPU, so it can afford
      // more retries and a shorter fuse than a lane that pays a vendor per
      // attempt. Two sets of values for the same table would be arbitrary; two
      // sets across tables with different cost models are just correct.
      staleMs: RENDER_LEASE_STALE_MS,
      maxAttempts: RENDER_MAX_ATTEMPTS,
      // Nothing to refund -- createRender charges no credits.
      refund: null,
    },
  ]
}

/**
 * Reclaim or refund every in-flight row whose claiming worker has gone quiet.
 *
 * Never throws: a sweep that dies takes the rest of the season tick with it, and
 * a lease that goes unrecovered for one hour is a smaller problem than a tick
 * that stops running. Failures land in `report.errors`.
 */
export async function sweepStudioLeases(): Promise<StudioLeaseReport> {
  const admin = createSupabaseAdmin()
  const report: StudioLeaseReport = { requeued: [], refunded: [], overdue: [], expired: [], errors: [] }
  const now = Date.now()
  const seasonBounds = await loadSeasonBounds()

  for (const lane of await laneSpecs()) {
    const claimCol = CLAIM_COLUMN[lane.table]
    try {
      const nullCols = lane.nullScope ?? []
      // Widened to `string` on purpose: supabase-js parses a LITERAL select at
      // the type level, and the column list here is assembled per lane. The rows
      // are read through explicit casts below either way.
      const cols: string = [
        'id',
        'status',
        'attempts',
        claimCol,
        'created_at',
        'updated_at',
        'season_id',
        ...(lane.roundColumn ? [lane.roundColumn] : []),
        ...nullCols,
      ].join(', ')
      let q = admin
        .from(lane.table)
        .select(cols)
        .in('status', [...lane.inFlight, lane.queuedStatus])
      for (const [k, v] of Object.entries(lane.scope ?? {})) q = q.eq(k, v)
      // ★The ownership split, applied at the query. Selected as well as filtered
      // so the per-row assertion below can re-check it rather than trust it.
      for (const c of nullCols) q = q.is(c, null)
      const { data, error } = await q
      if (error) {
        report.errors.push(`${lane.table}: ${error.message}`)
        continue
      }

      for (const row of data ?? []) {
        const id = String((row as unknown as Record<string, unknown>).id)
        const status = String((row as unknown as Record<string, unknown>).status)

        // ★Belt and braces on the split. The .is(col, null) filter above should
        // already have excluded lane A's rows; this asserts it per row, because
        // the cost of the filter silently not applying is two sweeps requeueing
        // the same accepted render every tick and bypassing lane A's bound.
        const hasSubmitIntent = (row as unknown as Record<string, unknown>).submit_intent_at != null
        if (!isOwnedBy('studio_lease', { table: lane.table, hasSubmitIntent })) continue

        if (status === lane.queuedStatus) {
          const age = ageMs((row as unknown as Record<string, unknown>).created_at, null, now)
          const seasonId = String((row as unknown as Record<string, unknown>).season_id ?? '')
          const round = lane.roundColumn
            ? String((row as unknown as Record<string, unknown>)[lane.roundColumn] ?? '')
            : null
          const boundary = boundaryFor(seasonBounds.get(seasonId), round)

          // ★Past the round it was bought for. The job can never be submitted
          // now, so holding the credits serves nobody -- give them back and take
          // the row out of the queue so no worker picks up work with no purpose.
          //
          // A missing boundary is NOT a reason to act. It means the season has
          // no date on that column (measured: season_1 and every season_100x
          // rehearsal row), and refunding off an absent value would be deciding
          // a participant's money from nothing.
          if (isPastRound(boundary, now, ROUND_GRACE_MS)) {
            const detail = `round closed ${new Date(boundary as number).toISOString()} -- job never became usable`
            try {
              if (lane.refund) await lane.refund(id, detail)
              else {
                await admin
                  .from(lane.table)
                  .update({ status: 'failed', error_message: detail, updated_at: new Date().toISOString() })
                  .eq('id', id)
                  .eq('status', status)
              }
              report.expired.push({ table: lane.table, id, seasonId })
            } catch (e) {
              report.errors.push(`${lane.table} expire ${id}: ${e instanceof Error ? e.message : String(e)}`)
            }
            continue
          }

          if (age !== null && age > QUEUE_OVERDUE_MS) {
            report.overdue.push({ table: lane.table, id, ageHours: Math.round(age / 3_600_000) })
          }
          continue
        }

        const age = ageMs((row as unknown as Record<string, unknown>)[claimCol], (row as unknown as Record<string, unknown>).updated_at, now)
        if (age === null || age <= lane.staleMs) continue

        const attempts = Number((row as unknown as Record<string, unknown>).attempts ?? 0)
        if (attempts < lane.maxAttempts) {
          // Hand it back. CAS on the observed status so a worker that is in fact
          // alive and finishing right now wins the race instead of being
          // trampled. claim_token is cleared, which is what actually invalidates
          // the old claim: the previous worker's writes are all guarded on it, so
          // clearing it turns a revived worker into a no-op.
          const { data: requeued, error: upErr } = await admin
            .from(lane.table)
            .update({ status: lane.queuedStatus, claim_token: null, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('status', status)
            .select('id')
          if (upErr) {
            report.errors.push(`${lane.table} requeue ${id}: ${upErr.message}`)
            continue
          }
          if (requeued?.length) report.requeued.push({ table: lane.table, id, attempts })
          continue
        }

        // Past the bound. Stop retrying: give the credits back where there are
        // any, and either way get the row out of a state it will never leave.
        const detail = `lease expired after ${attempts} attempts`
        try {
          if (lane.refund) {
            await lane.refund(id, detail)
            report.refunded.push({ table: lane.table, id })
          } else {
            // Renders: no charge to return, but the row still has to stop being
            // in flight -- that is what releases a participant whose editor is
            // resumed onto it.
            const { error: fErr } = await admin
              .from(lane.table)
              .update({ status: 'failed', error_message: detail, updated_at: new Date().toISOString() })
              .eq('id', id)
              .eq('status', status)
            if (fErr) report.errors.push(`${lane.table} fail ${id}: ${fErr.message}`)
            else report.refunded.push({ table: lane.table, id })
          }
        } catch (e) {
          report.errors.push(`${lane.table} refund ${id}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
    } catch (e) {
      report.errors.push(`${lane.table}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  if (report.requeued.length || report.refunded.length || report.expired.length || report.overdue.length || report.errors.length) {
    console.log(
      '[studio] lease sweep:',
      `requeued=${report.requeued.length}`,
      `refunded=${report.refunded.length}`,
      `expired=${report.expired.length}`,
      `overdue=${report.overdue.length}`,
      `errors=${report.errors.length}`,
    )
  }
  return report
}
