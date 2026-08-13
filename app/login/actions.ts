'use server'

// Signup/login email consent (see app/privacy Section 11, app/terms Section 12).
// "By creating an OXXOVO account, you agree to receive competition updates and
// announcements about future seasons by email or text message. You can opt out
// at any time in your settings." (TK-confirmed copy, 2026-08-11)
//
// ★Recorded at app/auth/callback/route.ts, on the authenticated user id --
// NOT at OTP-request time on the raw submitted email. An earlier version fired
// from the login page right after signInWithOtp() resolved, reasoning that the
// on_auth_user_created trigger runs inside Supabase Auth's own request so the
// profiles row already exists by then. That reasoning proves the row is
// writable at that moment; it does not prove consent belongs there -- anyone
// can type any email into the login form and the request succeeds whether or
// not they own that mailbox. Recording consent then meant a spoofed address,
// or a link nobody ever opened, still ended up "consented" on file. Passing
// through /auth/callback (a successful exchangeCodeForSession/verifyOtp) is
// the actual proof of mailbox ownership -- that is the only point that gets
// this call.
//
// Guard (lib/email/signup-consent.ts shouldRecordSignupConsent): only fires
// when the row has NEVER been stamped AND was never opted out. A returning
// user who already unsubscribed is not silently re-opted-in just because they
// logged in again -- their opt-out choice stands (control-group tests in
// signup-consent.test.ts).
//
// Independent of genesis_applications.agreed_to_rules/agreed_to_privacy/
// agreed_to_integrity_notice (apply-time layer, untouched here).

import { headers } from 'next/headers'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { shouldRecordSignupConsent } from '@/lib/email/signup-consent'

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
export async function recordEmailConsentForUser(userId: string): Promise<void> {
  if (!userId) return

  try {
    const admin = createSupabaseAdmin()
    const { data: row } = await admin
      .from('profiles')
      .select('email_consent_at, email_opt_out_at')
      .eq('id', userId)
      .maybeSingle()

    if (!shouldRecordSignupConsent(row)) return

    await admin
      .from('profiles')
      .update({
        email_opt_in: true,
        email_consent_at: new Date().toISOString(),
        email_consent_ip: await callerIp(),
        email_consent_text: EMAIL_CONSENT_DISCLOSURE,
      })
      .eq('id', userId)
  } catch {
    // best-effort, see above
  }
}
