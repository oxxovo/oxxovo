// email_logs writer — SERVER ONLY. Uses the service-role client so the admin
// RLS policy is bypassed (logs are written by automated triggers and Cron,
// not by an authenticated admin session).

import 'server-only'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type { EmailLang } from './lang'

export type TemplateKey =
  | 'application_received'
  | 'waitlisted'
  | 'selected_top50'
  | 'not_selected'
  | 'main_round_start'
  | 'submission_deadline'
  | 'results_announced'
  | 'awarded_contact_request'
  | 'partner_invitation'
  | 'partner_eligible'

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

export async function logEmail(input: LogEmailInput): Promise<void> {
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
  }
}

// Returns true if (applicationId, templateKey [, reminderHour]) already has
// a 'sent' row. The DB partial unique index also blocks duplicates, but
// checking up front lets us return 'skipped' cleanly without hitting Resend.
//
// submission_deadline is intentionally a multi-fire template (one row per
// reminder_hour in seasons.deadline_reminder_hours), so callers MUST pass
// reminderHour for that template. Other templates ignore it.
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
  if (await alreadySent(applicationId, templateKey, reminderHour)) {
    return { ok: false, reason: 'already_sent' }
  }

  const admin = createSupabaseAdmin()
  let q = admin
    .from('email_logs')
    .select('sent_at, metadata')
    .eq('application_id', applicationId)
    .eq('template_key', templateKey)
    .eq('status', 'failed')
    .order('sent_at', { ascending: false })

  if (templateKey === 'submission_deadline' && reminderHour != null) {
    q = q.eq('metadata->>reminder_hour', String(reminderHour))
  }

  const { data, error } = await q
  if (error) {
    console.error('[email log] canSend failed:', error.message)
    return { ok: true } // fail open — don't block on a transient log query error
  }

  const failedCount = data?.length ?? 0
  if (failedCount === 0) return { ok: true }
  if (failedCount >= RETRY_BACKOFF_MINUTES.length + 1) {
    return { ok: false, reason: 'gave_up' }
  }

  const lastFailedAt = data?.[0]?.sent_at as string | undefined
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
