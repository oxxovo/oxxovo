// Once-per-day dedup wrapper for sendAdminAlert, for STANDING conditions that
// a cron re-checks every tick (points_fee_basis_usd staying NULL, a flagged
// review sitting unresolved, a table read failing) -- as opposed to
// state-TRANSITION alerts like lib/pricing-health.ts / lib/below-floor-alert.ts,
// which already only fire on signature change and don't need this.
//
// HQ 2026-08-19: 58 identical "Championship Points blocked: season_test /
// season_test2 has no points_fee_basis_usd" mails in ~29 hours (hourly tick x
// 2 fixture seasons) buried real alerts. Root cause: the condition never
// becomes false for a fixture/test season (nobody is ever going to set a real
// fee basis on a rehearsal season), so the "alert once per season" comment at
// the call site was aspirational, not enforced -- there was no state to check
// it against. Fix is two independent pieces, both required (HQ decision):
//   (a) fixture seasons are excluded from the alert entirely at the call site
//       (this module doesn't know about is_fixture -- that's the caller's job)
//   (b) for everything else, this module caps it at one mail per key per UTC
//       day, so a real (non-fixture) season stuck on the same problem for a
//       week is one mail a day, not one an hour.
//
// Storage reuses platform_config as a state cell (same shape as
// pricing-health.ts / below-floor-alert.ts), keyed 'alert_last_sent_<key>',
// value = the UTC date (YYYY-MM-DD) it last fired. Fail-open on any read/write
// error, matching those two files' philosophy: a duplicate mail is recoverable,
// a silently swallowed one is not.

import 'server-only'
import { createSupabaseAdmin } from './supabase-admin'
import { sendAdminAlert } from './email/admin-alert'

function utcDateString(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/** true = not yet sent today for this key (and the day is now recorded as sent). */
async function claimOncePerDay(key: string, now: Date): Promise<boolean> {
  const admin = createSupabaseAdmin()
  const configKey = `alert_last_sent_${key}`
  const today = utcDateString(now)

  const { data: prev, error: readErr } = await admin
    .from('platform_config')
    .select('value')
    .eq('key', configKey)
    .maybeSingle()
  if (readErr) return true // fail-open -- see file header
  if (prev?.value === today) return false // already sent today

  const { error: writeErr } = await admin.from('platform_config').upsert(
    {
      key: configKey,
      value: today,
      value_type: 'text',
      description:
        'ALERT STATE, not a setting. UTC date this alert key last fired ' +
        '(lib/admin-alert-dedup.ts). Deleting it only causes one repeat alert.',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  )
  if (writeErr) return true // fail-open -- better a repeat than a silently dropped alert

  return true
}

/**
 * Send `subject`/`html` via sendAdminAlert, but skip if this exact `key`
 * already sent once today (UTC). `key` should identify the STANDING
 * condition (e.g. `championship_points_basis_null_${seasonId}`), not the
 * message text, so wording tweaks don't reset the dedup.
 */
export async function sendAdminAlertOnceDaily(
  key: string,
  subject: string,
  html: string,
  now: Date = new Date(),
): Promise<boolean> {
  const claimed = await claimOncePerDay(key, now)
  if (!claimed) return false
  return sendAdminAlert(subject, html)
}
