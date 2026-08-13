// Dedup for the "season below the absolute floor" admin alert. SERVER ONLY.
//
// defer_season_schedule returning reason='below_floor' is a STANDING state --
// the RPC returns it again every tick the condition holds, not once on a
// transition. Alerting on the condition itself would mail every hour
// forever, and an alert nobody reads is worse than none (same problem
// lib/pricing-health.ts already solved). So this mirrors that file's
// signature pattern exactly, just scoped per season instead of global: the
// mail goes out only when the signature CHANGES -- entering below_floor, or
// leaving it (a recovery notice, including the case where a human resolved
// it manually and the next tick's RPC call no longer says below_floor).
//
// HQ 2026-08-12: below_floor is deliberately "alert, then a human decides" --
// this module owns only the dedup, never the decision.

import 'server-only'
import { createSupabaseAdmin } from './supabase-admin'

export function belowFloorAlertStateKey(seasonId: string): string {
  return `alert_state_below_floor_${seasonId}`
}

export type BelowFloorAlertDecision = {
  /** true = the signature moved this tick, i.e. send a mail. */
  shouldAlert: boolean
  /** true = it moved FROM below_floor back to ok -- the mail is a recovery notice. */
  recovered: boolean
  stateError?: string
}

export async function reportBelowFloorAlert(
  seasonId: string,
  isBelowFloor: boolean,
): Promise<BelowFloorAlertDecision> {
  const admin = createSupabaseAdmin()
  const key = belowFloorAlertStateKey(seasonId)
  const signature = isBelowFloor ? 'below_floor' : 'ok'

  let previousSignature = 'ok'
  let stateError: string | undefined
  const { data: prev, error: readErr } = await admin
    .from('platform_config')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  if (readErr) stateError = `read ${key}: ${readErr.message}`
  else if (prev?.value) previousSignature = String(prev.value)

  const changed = signature !== previousSignature
  if (changed) {
    const { error: writeErr } = await admin.from('platform_config').upsert(
      {
        key,
        value: signature,
        value_type: 'text',
        description:
          'ALERT STATE, not a setting. Last below-floor signature season-tick ' +
          'alerted on for this season. Deleting it only causes one repeat alert.',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    )
    // A failed write must not suppress the alert: better a repeated mail than
    // a silent one -- shouldAlert stays true on the caller's signature compare.
    if (writeErr) stateError = `${stateError ? stateError + '; ' : ''}write: ${writeErr.message}`
  }

  return {
    shouldAlert: changed,
    recovered: changed && signature === 'ok',
    ...(stateError ? { stateError } : {}),
  }
}
