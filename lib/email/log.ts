// email_logs writer — SERVER ONLY. Uses the service-role client so the admin
// RLS policy is bypassed (logs are written by automated triggers and Cron,
// not by an authenticated admin session).

import 'server-only'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type { EmailLang } from './lang'

export type TemplateKey =
  | 'pre_registered'
  | 'application_received'
  | 'waitlisted'
  | 'selected_top50'
  | 'not_selected'
  | 'main_round_start'
  | 'submission_deadline'
  // HQ 2026-08-12: D-14/7/3/1 before registration_close_at, telling
  // registered participants the current count and whether the season might
  // defer. Multi-fire like submission_deadline (once per
  // seasons.registration_reminder_days entry) -- dedup on metadata->>
  // 'reminder_day', a separate key from submission_deadline's 'reminder_hour'
  // so the two multi-fire templates never share a match.
  | 'registration_count'
  // HQ 2026-08-12: fired when defer_season_schedule actually shifts a
  // season's calendar -- "registration reopened, does anyone know?" Multi-
  // fire like registration_count/submission_deadline (once per
  // application_defer_count value, so a season that defers 2 or 3 times
  // notifies each time, not just the first). Dedup on metadata->>
  // 'defer_count', its own key separate from reminder_hour/reminder_day.
  | 'deferral_notice'
  | 'results_announced'
  | 'awarded_contact_request'
  | 'partner_invitation'
  | 'partner_eligible'
  // Growth engine: sent when a creator's film goes live on Watch (once per
  // application per round). Application-scoped -> executeSend dedup applies.
  | 'video_live_prelim'
  | 'video_live_main'
  // ⑤/⑪ submission receipts. Studio split "applying" from "submitting a film";
  // application_received only covers the first. Application-scoped -> the
  // executeSend dedup + the partial unique index make them once-only per round.
  | 'studio_submission_received'
  | 'main_round_submission_received'
  // P4e membership notices (profile-scoped; dedup via profiles.
  // membership_renewal_notified_at, not email_logs). Logged for transparency.
  | 'membership_renewal'
  | 'membership_founding_expiry'
  // Admin recipient-console campaigns (admin_broadcasts). Not application-
  // scoped -- dedup is (campaign_id, to_email) via metadata->>campaign_id,
  // checked by lib/email/broadcast-tick.ts, not executeSend's applicationId
  // path. A 'skipped' row here means "no marketing consent at send time",
  // never "already sent" -- see lib/email/broadcast.ts.
  | 'admin_broadcast'

export type LogStatus = 'sent' | 'failed' | 'queued' | 'skipped'

export type LogEmailInput = {
  applicationId?: string | null
  seasonId?: string | null
  toEmail: string
  templateKey: TemplateKey
  language: EmailLang
  subject: string
  resendMessageId?: string | null
  status: LogStatus
  errorMessage?: string | null
  metadata?: Record<string, unknown> | null
}

// ★RETURNS WHETHER THE ROW ACTUALLY LANDED (2026-08-16, head office audit,
// backlog #26). Still never throws -- a logging failure must not break the
// email send path, that part was always right. What was wrong is that the
// caller had no way to tell the difference between "logged" and "didn't",
// so a 'sent' row that failed to insert read as success on both ends: the
// send genuinely happened AND executeSend reported ok:true, but the NEXT
// tick's canSend/alreadySent check finds no row and concludes "never sent" --
// a duplicate customer-facing email waiting to happen, not a hypothetical.
// The boolean lets executeSend alert on exactly that case without changing
// what it returns to ITS caller (the send itself still succeeded; lying
// about that would risk a retry-triggered duplicate from a different angle).
export async function logEmail(input: LogEmailInput): Promise<boolean> {
  const admin = createSupabaseAdmin()
  const { error } = await admin.from('email_logs').insert({
    application_id: input.applicationId ?? null,
    season_id: input.seasonId ?? null,
    to_email: input.toEmail,
    template_key: input.templateKey,
    language: input.language,
    subject: input.subject,
    resend_message_id: input.resendMessageId ?? null,
    status: input.status,
    error_message: input.errorMessage ?? null,
    metadata: input.metadata ?? null,
  })
  if (error) {
    // Don't throw — logging failure should not break the email send path.
    console.error('[email log] insert failed:', error.message, input.templateKey)
    return false
  }
  return true
}

// Returns true if (applicationId, templateKey [, reminderHour]) already has
// a 'sent' row. The DB partial unique index also blocks duplicates, but
// checking up front lets us return 'skipped' cleanly without hitting Resend.
//
// submission_deadline, registration_count, and deferral_notice are all
// multi-fire templates (one row per entry in seasons.deadline_reminder_hours
// / registration_reminder_days / per application_defer_count value
// respectively), so callers MUST pass the numeric variant for those three.
// Other templates ignore it. The three templates use DIFFERENT metadata keys
// (reminder_hour / reminder_day / defer_count) on purpose -- a shared key
// would let a "1" from one collide with a "1" from another if the values
// were ever compared or a query forgot to filter by templateKey.
export async function alreadySent(
  applicationId: string,
  templateKey: TemplateKey,
  reminderHour?: number,
): Promise<boolean> {
  const admin = createSupabaseAdmin()
  let q = admin
    .from('email_logs')
    .select('id, metadata')
    .eq('application_id', applicationId)
    .eq('template_key', templateKey)
    .eq('status', 'sent')

  if (templateKey === 'submission_deadline' && reminderHour != null) {
    // Match on metadata->>'reminder_hour' — PostgREST JSONB filter.
    q = q.eq('metadata->>reminder_hour', String(reminderHour))
  } else if (templateKey === 'registration_count' && reminderHour != null) {
    q = q.eq('metadata->>reminder_day', String(reminderHour))
  } else if (templateKey === 'deferral_notice' && reminderHour != null) {
    q = q.eq('metadata->>defer_count', String(reminderHour))
  }

  const { data, error } = await q.limit(1)
  if (error) {
    console.error('[email log] dedup check failed:', error.message)
    return false
  }
  return (data?.length ?? 0) > 0
}

// Cron retry gate. Combines the 'already sent' check with a backoff for
// previously-failed attempts. Returns a verdict explaining why a send is or
// isn't allowed right now.
//
// Backoff schedule indexed by prior-failure count:
//   1st retry → 15 min after the failed row (matches one cron tick)
//   2nd retry → 30 min
//   3rd retry → 60 min
//   4th retry → 120 min
// 5+ failures → give up; surfaces in /admin/emails as a stuck row.
const RETRY_BACKOFF_MINUTES = [15, 30, 60, 120]

export type SendVerdict =
  | { ok: true }
  | { ok: false; reason: 'already_sent' | 'gave_up' | 'backoff'; retryAfter?: string }

export async function canSend(
  applicationId: string,
  templateKey: TemplateKey,
  reminderHour?: number,
): Promise<SendVerdict> {
  // ★ONE query, not two. This used to call alreadySent() and then run a second
  // near-identical select for the failed rows -- same table, same two filters,
  // differing only in `status`. At 450 recipients that second round trip is 450
  // round trips, and the 11/8 finalist tick has a 300s ceiling it is not
  // comfortably inside (see the budget in the email-tick route). Asking for both
  // statuses at once costs nothing and gives the same two answers.
  //
  // ★alreadySent() itself is NOT removed and executeSend still calls it. That
  // call is the last-line dedup for every non-cron sender and for the race
  // between this verdict and the actual send; deleting it to save the same round
  // trip would trade a duplicate query for a duplicate email.
  const admin = createSupabaseAdmin()
  let q = admin
    .from('email_logs')
    .select('status, sent_at, metadata')
    .eq('application_id', applicationId)
    .eq('template_key', templateKey)
    .in('status', ['sent', 'failed'])
    .order('sent_at', { ascending: false })

  if (templateKey === 'submission_deadline' && reminderHour != null) {
    q = q.eq('metadata->>reminder_hour', String(reminderHour))
  } else if (templateKey === 'registration_count' && reminderHour != null) {
    q = q.eq('metadata->>reminder_day', String(reminderHour))
  } else if (templateKey === 'deferral_notice' && reminderHour != null) {
    q = q.eq('metadata->>defer_count', String(reminderHour))
  }

  const { data, error } = await q
  if (error) {
    console.error('[email log] canSend failed:', error.message)
    return { ok: true } // fail open — don't block on a transient log query error
  }

  const rows = data ?? []
  if (rows.some((r) => r.status === 'sent')) {
    return { ok: false, reason: 'already_sent' }
  }
  // Already newest-first from the order above, so [0] is the most recent failure.
  const failures = rows.filter((r) => r.status === 'failed')

  const failedCount = failures.length
  if (failedCount === 0) return { ok: true }
  if (failedCount >= RETRY_BACKOFF_MINUTES.length + 1) {
    return { ok: false, reason: 'gave_up' }
  }

  const lastFailedAt = failures[0]?.sent_at as string | undefined
  if (!lastFailedAt) return { ok: true }

  const backoffMinutes = RETRY_BACKOFF_MINUTES[failedCount - 1]
  const nextEligible = new Date(
    new Date(lastFailedAt).getTime() + backoffMinutes * 60_000,
  )
  if (Date.now() < nextEligible.getTime()) {
    return { ok: false, reason: 'backoff', retryAfter: nextEligible.toISOString() }
  }
  return { ok: true }
}

// Cron uses this to detect season-scoped one-shot templates
// (main_round_start, results_announced) that have already fired for any
// applicant in the given season. If at least one 'sent' row exists for
// (season_id, template_key), we treat the season as already notified and
// skip the whole batch on subsequent ticks.
//
// (Per-application dedup still applies via alreadySent — but the season
// check is a cheap short-circuit before we even iterate the recipient list.)
export async function seasonAlreadyFired(
  seasonId: string,
  templateKey: TemplateKey,
): Promise<boolean> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('email_logs')
    .select('id')
    .eq('season_id', seasonId)
    .eq('template_key', templateKey)
    .eq('status', 'sent')
    .limit(1)
  if (error) {
    console.error('[email log] season dedup check failed:', error.message)
    return false
  }
  return (data?.length ?? 0) > 0
}
