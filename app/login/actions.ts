'use server'

// Signup/login email consent (see app/privacy Section 11, app/terms Section 12).
// "By creating an OXXOVO account, you agree to receive competition updates and
// announcements about future seasons by email or text message. You can opt out
// at any time in your settings." (TK-confirmed copy, 2026-08-11)
//
// Recorded once, on first successful signInWithOtp for an email that has never
// been stamped -- same evidence shape as SMS (app/profile/actions.ts
// saveSmsConsent): when, from where, and exactly what text was shown. The
// stamp fires from the login page rather than app/auth/callback because the
// profiles row already exists by the time signInWithOtp resolves (the
// on_auth_user_created trigger runs inside Supabase Auth's own request, before
// it returns to the client -- see reports/auth_handle_new_user_2026-07-28.sql).
//
// Guard: only fires when the row has NEVER been stamped AND was never opted
// out. A returning user who already unsubscribed is not silently re-opted-in
// just because they logged in again -- their opt-out choice stands.
//
// Independent of genesis_applications.agreed_to_rules/agreed_to_privacy/
// agreed_to_integrity_notice (apply-time layer, untouched here).

import { headers } from 'next/headers'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

const EMAIL_CONSENT_DISCLOSURE =
  'By creating an OXXOVO account, you agree to receive competition updates and announcements about future seasons by email or text message. You can opt out at any time in your settings.'

async function callerIp(): Promise<string | null> {
  try {
    const h = await headers()
    const fwd = h.get('x-forwarded-for')
    const first = fwd ? fwd.split(',')[0].trim() : ''
    return first || h.get('x-real-ip') || null
  } catch {
    return null
  }
}

// Best-effort: never blocks or surfaces an error to the login flow. A missed
// stamp (row not visible yet, replication lag) is caught on the next login --
// there is no scenario where failing this should stop someone signing in.
export async function recordEmailConsent(email: string): Promise<void> {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed) return

  try {
    const admin = createSupabaseAdmin()
    const { data: row } = await admin
      .from('profiles')
      .select('id, email_consent_at, email_opt_out_at')
      .eq('email', trimmed)
      .maybeSingle()

    if (!row || row.email_consent_at || row.email_opt_out_at) return

    await admin
      .from('profiles')
      .update({
        email_opt_in: true,
        email_consent_at: new Date().toISOString(),
        email_consent_ip: await callerIp(),
        email_consent_text: EMAIL_CONSENT_DISCLOSURE,
      })
      .eq('id', row.id)
  } catch {
    // best-effort, see above
  }
}
