-- ============================================================================
-- profiles abuse check (READ ONLY, DRAFT 2026-10-16)
-- ============================================================================
-- Looks for rows whose membership / partner / founding / cumulative state has no
-- trace of a normal path. Normal paths (repo):
--   * paid membership: Stripe webhook (app/api/membership/stripe-webhook/route.ts)
--     writes profiles AND inserts membership_events (id = Stripe event id, type,
--     subscription_id, user_id). So a paid row should have events matching its
--     user_id or stripe_subscription_id.
--   * founding free: lib/membership.ts sets membership_source = 'founding_free'
--     together with founding_creator_number (no membership_events row by design,
--     reports/auth_handle_new_user_2026-07-28.sql:49).
--   * partner: admin invite / activation (partner_invited_at, partner_activated_at
--     filled by lib/partners.ts).
--   * cumulative_*: recomputed by app/api/cron/partner-stats from source data
--     (lib/partners.ts:274), so a tampered value may already have been
--     overwritten; a clean result here is weak evidence.
-- Limits: a row with no event is "unexplained", not proof of abuse (manual or
-- admin grants may exist; I did not read every source value of
-- membership_source). profiles.updated_at is moved by the trigger on ANY update,
-- so it cannot date a change. The strongest evidence is the Supabase API log:
-- search for PATCH /rest/v1/profiles from role authenticated.
-- Paste one block at a time. ASCII only.
-- ============================================================================


-- CHECK 1 membership / stripe / founding (rows with unexplained state first)
select p.id, p.email, p.membership_tier, p.membership_status, p.membership_source, p.membership_started_at, p.membership_expires_at, p.founding_creator_number, p.stripe_customer_id, p.stripe_subscription_id, p.updated_at, exists (select 1 from public.membership_events e where e.user_id = p.id or (p.stripe_subscription_id is not null and e.subscription_id = p.stripe_subscription_id)) as has_event, (p.membership_source is not distinct from 'founding_free' and p.founding_creator_number is not null) as founding_pair_ok from public.profiles p where p.membership_source is not null or p.membership_status is not null or p.membership_started_at is not null or p.founding_creator_number is not null or p.stripe_customer_id is not null or p.stripe_subscription_id is not null order by has_event, founding_pair_ok, p.updated_at desc;


-- CHECK 2 partner (active or tiered without an invite trail)
select p.id, p.email, p.partner_status, p.partner_source, p.partner_tier, p.partner_invited_by, p.partner_invited_at, p.partner_activated_at, p.partner_invite_note, p.updated_at from public.profiles p where (p.partner_status is not null or p.partner_tier is not null or p.partner_source is not null) and (p.partner_invited_at is null or p.partner_invited_by is null or (p.partner_status = 'active' and p.partner_activated_at is null)) order by p.updated_at desc;


-- CHECK 3 cumulative counters on accounts that are not partners
select p.id, p.email, p.cumulative_top50, p.cumulative_wins, p.partner_status, p.partner_tier, p.updated_at from public.profiles p where (coalesce(p.cumulative_top50, 0) <> 0 or coalesce(p.cumulative_wins, 0) <> 0) and p.partner_status is null order by p.updated_at desc;


-- CHECK 4 role: any non-user value besides the one admin (expect 1 row, TK)
select p.role, count(*) as n from public.profiles p group by p.role order by p.role;
