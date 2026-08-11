// PURE decision logic for app/login/actions.ts recordEmailConsentForUser --
// split out because 'use server' files may only export async functions, and
// this needs to be unit-testable without a DB round-trip.
//
// TK's control-group ask (2026-08-11): does re-login after unsubscribe
// silently re-consent someone? This function is the one place that decides,
// so proving it here is proving the whole guarantee -- recordEmailConsentForUser
// has no other branch that writes.

export type ConsentRow = {
  email_consent_at: string | null
  email_opt_out_at: string | null
}

// true only for a row that has NEVER been stamped and was NEVER opted out.
// Once either is set, this returns false forever for that row -- there is no
// code path back to true (unsubscribe is permanent until the account holder
// re-authenticates through a flow that shows the notice again, which today
// does not exist; see app/profile/EmailConsentCard.tsx comment).
export function shouldRecordSignupConsent(row: ConsentRow | null): boolean {
  if (!row) return false
  return row.email_consent_at == null && row.email_opt_out_at == null
}
