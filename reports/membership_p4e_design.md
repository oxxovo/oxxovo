# Membership P4e -- Renewal / Founding-Expiry Notices (Design)

2026-06-15. Measure-first per TK. Folds membership notices into the EXISTING
email-tick cron (NO 4th cron -- Vercel plan limit). dark launch preserved.
No new migration (columns + config exist from P4a; template_key has no CHECK).

## 1. Measurement (what exists)

### email-tick cron (app/api/cron/email-tick/route.ts)
- Single Vercel cron, every 15 min (vercel.json), Bearer CRON_SECRET auth.
- Loops `seasons`, fires 3 season-scoped templates (main_round_start,
  submission_deadline, results_announced) via `dispatchBatch` -> per-applicant
  `canSend()` (email_logs dedup + backoff) -> send* helper.
- Returns a JSON TickReport (counts per template). `dynamic = 'force-dynamic'`.

### email infra
- `lib/email/send.tsx`: per-template `send*` helpers funnel through `executeSend`
  (render -> Resend -> log). `executeSend` dedup runs ONLY when `applicationId`
  is set; user/profile-scoped mails (pre_registered, partner_*) pass no
  applicationId, so the caller owns gating. EMAIL_FROM defaults to
  `OXXOVO <info@oxxovo.com>` (env override). Lang via `detectEmailLang(country)`.
- `lib/email/log.ts`: `TemplateKey` union; `email_logs.template_key` is plain
  TEXT (NO CHECK) -> new keys need no migration. Partial unique index is on
  (application_id, template_key); null application_id rows are exempt (Postgres
  treats NULLs as distinct), so multiple membership rows coexist.
- Templates are React-Email components (Layout + Heading/Text), each exports
  `subjectFor(props)` + ko/en branches. Signup-tone palette (#8b22ff accents).

### profiles + reuse
- `profiles` has `email` but NOT country/creator_name. Established pattern
  (lib/partners.ts:410) -> name/country come from the user's MOST RECENT
  genesis_applications row; default en + name=email when none.
- P4a already seeded `membership_renewal_notice_days='7'` (config) and added
  `membership_renewal_notified_at` (profiles). P4c `applyFromSubscription` on
  `invoice.paid` already does `resetNotice:true` -> sets notified_at=null each
  successful renewal. So the dedup column auto-resets per billing period.

## 2. Design

### Two notices (both in email-tick, both gated on membership_enabled)
1. **Renewal pre-notice** (paid creators): source='paid', status='active',
   cancel_at_period_end=FALSE, expires_at within notice_days. "Your creator
   membership renews on <date> for <$price>/<interval>." Auto-resets per period
   (P4c invoice.paid) so each cycle gets exactly one notice.
   - cancel_at_period_end=TRUE -> SKIP (they already chose to end; the /profile
     card shows "Cancels on <date>" -- no email needed; out of TK's 2 notices).
2. **Founding-expiry pre-notice** (founding_free): source='founding_free',
   founding_creator_number != null, status='active', expires_at within
   notice_days. "Your founding free year ends on <date>. Subscribe to keep
   creator access." CTA -> /apply (later /membership). NOTE: founding members
   have NO Stripe subscription -> NO auto-charge; this is a subscribe invite,
   not a "you'll be billed" notice. One-time term, notified_at never auto-resets
   (correct -- a single notice).

### Candidate query (profiles, one cheap query)
```
membership_tier='creator' AND membership_status='active'
AND membership_expires_at IS NOT NULL
AND membership_expires_at >  now
AND membership_expires_at <= now + notice_days   (threshold computed in JS)
AND membership_renewal_notified_at IS NULL
AND membership_source IN ('paid','founding_free')
```
Branch in memory by source (+ skip paid with cancel_at_period_end=true).
notice_days from config (fail-closed: if missing/invalid -> skip the whole
membership block, no hardcoded default).

### Dedup / retry (single column, per TK)
- Gate = `membership_renewal_notified_at IS NULL` (in the query).
- On a SUCCESSFUL send -> set notified_at=now (so it won't resend this period).
- On FAILURE -> leave null + log a 'failed' email_logs row -> retried next tick
  (15-min cadence; volume tiny, no backoff needed). Visible in /admin/emails.

### New code
- `lib/email/templates/MembershipRenewal.tsx` (lang, creatorName, priceUsd,
  interval, renewsOn) + `subjectFor`.
- `lib/email/templates/MembershipFoundingExpiry.tsx` (lang, creatorName,
  foundingNumber, endsOn, priceUsd, subscribeUrl) + `subjectFor`.
- `lib/email/log.ts`: add 'membership_renewal' + 'membership_founding_expiry' to
  TemplateKey (logging/transparency only; dedup is the profiles column).
- `lib/email/send.tsx`: `sendMembershipRenewal` + `sendMembershipFoundingExpiry`
  (no applicationId -> executeSend dedup skipped, as with partner mails).
- `app/api/cron/email-tick/route.ts`: after the season loop, gated on
  isMembershipEnabled() -> `fireMembershipNotices(now, report)`: query
  candidates, resolve name/country from latest application, send the right
  template, set notified_at on success. Adds `membershipNotices` to TickReport.

### Flow
billing period advances (invoice.paid, P4c) -> notified_at reset -> ~7 days
before expires_at the cron sends the renewal notice once -> Stripe charges at the
boundary -> invoice.paid resets again. Founding: free year -> ~7 days before end,
one founding-expiry notice -> CTA to subscribe.

## 3. Compliance
- NO 4th cron (folded into email-tick) -- Vercel plan limit respected.
- No hardcode: notice_days / price / interval all from platform_config
  (fail-closed if absent). info@oxxovo.com from EMAIL_FROM.
- dark launch: whole block gated on membership_enabled=false -> zero membership
  emails until launch. No new migration (P4a columns/config; template_key TEXT).
- Reuses executeSend/Resend/email_logs + the partners name/country pattern + the
  P4c notified_at reset.

## 4. Out of scope
- /membership landing (next).
- cancel-ending "your membership ends" notice (the /profile card already shows
  it; not in TK's 2-notice scope).
- Stripe Billing Portal card-update link in the past_due note (future).
