# Membership P4d + P4e -- E2E Test Procedure

2026-06-15. Deploy = main e6de385 (dpl_7BARrYAm... READY, aliased www.oxxovo.ai).
Test mode Stripe (sk_test_). All temp config flips are REVERTED at the end ->
dark launch restored. Secrets (CRON_SECRET, sk_*) are entered by TK, never
printed.

## 0. Pre-state confirmation (dark launch is intact)
Run in Supabase SQL editor:
```
select key, value from platform_config
where key in ('membership_enabled','membership_founding_free_count',
  'membership_founding_free_months','membership_creator_price_usd',
  'membership_billing_interval','membership_renewal_notice_days');
select claimed from membership_founding_counter where id = 1;
```
Expect: membership_enabled=false, founding_free_count=100, price=19.99,
interval=month, renewal_notice_days=7, counter claimed=0. (false => zero
membership surface anywhere.)

## 1. P4d -- Cancel / Resume E2E

### Setup (temporary)
```
update platform_config set value='true'  where key='membership_enabled';
update platform_config set value='0'      where key='membership_founding_free_count';
```
(founding_free_count=0 -> founding is "full" -> /apply shows the PAID Subscribe
button instead of the free claim.)

### Steps
1. Log in (cookie session) as a TEST account. Go to **/apply**.
   -> MembershipGateScreen renders ("Subscribe to Creator Membership").
2. Click Subscribe -> Stripe Checkout. Pay with test card
   `4242 4242 4242 4242`, any future expiry / any CVC / any ZIP. Complete.
3. Back on site, verify profiles (replace EMAIL):
```
select membership_tier, membership_status, membership_source,
  membership_expires_at, membership_cancel_at_period_end,
  stripe_subscription_id, stripe_customer_id
from profiles where email ilike 'TEST_EMAIL';
```
   Expect: tier=creator, status=active, source=paid, expires_at=+1 month,
   cancel_at_period_end=false, sub/customer ids set.
4. Go **/profile** -> Membership card: "Creator membership / Active /
   Renews on <date> / [Cancel membership]".
5. Click **Cancel membership** -> confirm dialog -> confirm.
   - Verify card flips to "Cancels on <date> -- access until then / [Resume
     membership]". Access is still creator (within window).
   - Verify DB:
```
select membership_cancel_at_period_end, membership_status
from profiles where email ilike 'TEST_EMAIL';
```
     Expect cancel_at_period_end=true, status=active.
   - (Optional) Stripe Dashboard -> the subscription shows
     "Cancels at period end". Webhook customer.subscription.updated logged:
```
select event_type, created_at from membership_events order by created_at desc limit 5;
```
6. Click **Resume membership** -> card back to "Renews on <date> / [Cancel]".
   Verify cancel_at_period_end=false again (DB + Stripe).

### Revert P4d
```
-- Cancel the test sub fully in Stripe Dashboard (or `stripe subscriptions cancel`).
update platform_config set value='false' where key='membership_enabled';
update platform_config set value='100'   where key='membership_founding_free_count';
-- Clear the test account's membership so no stray creator row remains:
update profiles set
  membership_tier='general', membership_status='none', membership_source=null,
  membership_started_at=null, membership_expires_at=null,
  membership_cancel_at_period_end=false, membership_renewal_notified_at=null,
  founding_creator_number=null, stripe_subscription_id=null
where email ilike 'TEST_EMAIL';
```
(Leave stripe_customer_id -- harmless, reused if they ever subscribe again.)

## 2. P4e -- Renewal / Founding-Expiry Notices E2E

The notice fires when `membership_expires_at` is within notice_days AND
`membership_renewal_notified_at IS NULL`. Trigger on demand by pulling ONE test
profile's expires_at into the window, then manually invoking the cron. (We move
expires_at on a single test row -- NOT notice_days globally -- to stay isolated.)

### Setup (temporary)
```
update platform_config set value='true' where key='membership_enabled';
```

### 2A. Renewal notice (paid)
Reuse the P4d subscriber (before reverting) OR set a test row directly:
```
update profiles set
  membership_tier='creator', membership_status='active', membership_source='paid',
  membership_cancel_at_period_end=false, founding_creator_number=null,
  membership_expires_at = now() + interval '1 day',   -- inside the 7-day window
  membership_renewal_notified_at = null
where email ilike 'TEST_EMAIL';
```
Trigger the cron (TK runs; CRON_SECRET stays in the terminal, not printed):
```
curl -s -X POST https://www.oxxovo.ai/api/cron/email-tick \
  -H "Authorization: Bearer $CRON_SECRET"
```
Verify:
- Response JSON `membershipNotices.renewalSent` == 1.
- Email arrives at TEST_EMAIL (subject "Your creator membership renews soon").
  Or check the log:
```
select template_key, status, to_email, created_at from email_logs
where template_key='membership_renewal' order by created_at desc limit 3;
select membership_renewal_notified_at from profiles where email ilike 'TEST_EMAIL';
```
  Expect a 'sent' row + notified_at now set (NOT null).
- **Dedup check**: re-run the curl -> `renewalSent` == 0 (candidate excluded by
  notified_at). Confirms no double-send.

### 2B. Founding-expiry notice (founding_free)
```
update profiles set
  membership_tier='creator', membership_status='active',
  membership_source='founding_free', founding_creator_number=1,
  membership_cancel_at_period_end=false, stripe_subscription_id=null,
  membership_expires_at = now() + interval '1 day',
  membership_renewal_notified_at = null
where email ilike 'TEST_EMAIL';
```
Trigger the cron (same curl). Verify:
- Response `membershipNotices.foundingSent` == 1.
- Email "Your founding free year is ending" with a **Subscribe to continue**
  button (-> /apply), and the "no automatic charge" line.
- email_logs membership_founding_expiry 'sent'; notified_at set.
- Re-run -> foundingSent == 0 (dedup).

### (Optional) 2C. Per-period reset proof (paid)
After 2A, simulate a successful renewal so notified_at resets:
- Stripe Dashboard / CLI: send a test `invoice.paid` for the test sub (or
  `stripe trigger invoice.paid`). P4c sets membership_renewal_notified_at=null.
- Re-run the cron with expires_at still in-window -> renewalSent == 1 again.
  Confirms the per-billing-period dedup reset.

### Revert P4e
```
update platform_config set value='false' where key='membership_enabled';
-- restore the test row (same clear block as "Revert P4d").
```

## 3. Final dark-launch re-confirmation
Re-run section 0. Expect membership_enabled=false, founding_free_count=100,
counter=0, and the test profile cleared. /apply and /profile show zero
membership surface.

## Notes
- Manual cron trigger also runs the season email logic (harmless: season 0
  schedule is unset/closed, so no applicant is in any send window).
- 2A/2B are mutually exclusive on the SAME test row (source differs) -- run one,
  verify, reset notified_at/source, then the other. Or use two test accounts.
- If `membershipNotices` is ABSENT from the response, membership_enabled was not
  true at trigger time (the block is switch-gated).
