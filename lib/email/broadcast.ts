// Pure send-plan decision for the admin broadcast tick (lib/email/broadcast-
// tick.ts). Split out so it is unit-testable without a DB or Resend.
//
// admin_broadcasts.recipient_emails is a snapshot taken when the campaign was
// queued (by the /admin/broadcasts screen, not yet built) -- it names WHO was
// a target THEN, not who consents NOW. Between queuing and this tick actually
// running, a recipient can unsubscribe, or may never have consented at all.
// This function is the ONE place that turns "was a target" into "gets mail
// right now", and it decides on liveConsent (a fresh read passed in by the
// caller), never on the snapshot's mere presence.

import { canSendMarketingEmail, type EmailConsentRow } from './consent'

export type BroadcastSendPlan = {
  toSend: string[]
  toSkip: string[]
}

// liveConsent: keyed by LOWERCASED trimmed email, one fresh profiles read per
// recipient. A recipient missing from the map (no profiles row at all -- e.g.
// they never signed up) is treated the same as "no consent" -- fail closed,
// same as a row that exists but never opted in.
export function planBroadcastSend(
  recipientEmails: string[],
  liveConsent: Map<string, EmailConsentRow>,
): BroadcastSendPlan {
  const toSend: string[] = []
  const toSkip: string[] = []
  for (const email of recipientEmails) {
    const row = liveConsent.get(email.trim().toLowerCase())
    if (row && canSendMarketingEmail(row)) {
      toSend.push(email)
    } else {
      toSkip.push(email)
    }
  }
  return { toSend, toSkip }
}
