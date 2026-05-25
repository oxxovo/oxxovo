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

// Returns true if (applicationId, templateKey) already has a 'sent' row.
// The DB partial unique index also blocks duplicates, but checking up front
// lets us return 'skipped' cleanly without hitting Resend.
export async function alreadySent(
  applicationId: string,
  templateKey: TemplateKey,
): Promise<boolean> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('email_logs')
    .select('id')
    .eq('application_id', applicationId)
    .eq('template_key', templateKey)
    .eq('status', 'sent')
    .limit(1)
  if (error) {
    console.error('[email log] dedup check failed:', error.message)
    return false
  }
  return (data?.length ?? 0) > 0
}
