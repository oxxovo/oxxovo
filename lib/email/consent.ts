// Gate for any FUTURE broadcast/marketing email (season/tournament
// announcements sent to the whole user base, not tied to one recipient's own
// application). PURE -- no DB, no env, so it can be unit-tested without a
// live send path.
//
// Every email template today (lib/email/templates/*) is transactional --
// triggered by the recipient's OWN application/season activity (selected,
// deadline, results, membership renewal, ...) -- and is NOT gated by this.
// See app/privacy Section 11: "emails about your own application, account,
// or payment are sent regardless of this setting." That boundary is also why
// genesis_applications.agreed_to_rules/agreed_to_privacy/
// agreed_to_integrity_notice (apply-time layer) are untouched here.
//
// No broadcast sender exists yet (2026-08-11) -- this exists so the FIRST one
// is gated from day one instead of retrofitted after it ships unguarded.
// Any future "next season is open" / "come back" mailer MUST filter its
// recipient list through this before sending.

export type EmailConsentRow = {
  email_opt_in: boolean | null
  email_opt_out_at: string | null
}

export function canSendMarketingEmail(row: EmailConsentRow): boolean {
  return Boolean(row.email_opt_in) && !row.email_opt_out_at
}
