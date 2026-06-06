-- =========================================================================
-- OXXOVO pre_registrations -- Defense-in-Depth hardening (2026-06)
-- Run in Supabase SQL Editor (full file as one block).
--
-- pre_registrations holds personal data (email + UTM attribution). After the
-- initial migration the grant audit showed residual privileges that are not
-- needed and should not exist on a PII table:
--     anon          = REFERENCES, TRIGGER, TRUNCATE
--     authenticated = REFERENCES, TRIGGER, TRUNCATE, SELECT
--     service_role  = ALL
-- (These non-SELECT grants come from Supabase's default table privileges.)
--
-- RLS is already ENABLED with an admin-only SELECT policy, so there is no
-- current leak (anon has no SELECT at all; a non-admin authenticated user is
-- blocked by RLS and reads zero rows -- both verified empirically). This file
-- removes the reliance on RLS being the ONLY thing standing between a logged-in
-- user and the email list: it strips every anon/authenticated privilege so the
-- table is reachable by the service role only, with RLS kept on as a backstop.
--
-- *** ORDERING ***  Deploy the app first. The admin pre-registrations page now
-- reads this table through the SERVICE ROLE client (not the authenticated
-- session). Run this SQL only AFTER that build is live, otherwise the admin
-- page loses its SELECT and shows no rows until the deploy catches up.
--
-- ASCII-only. Idempotent.
-- =========================================================================

BEGIN;

-- 1. RLS stays on as a backstop (idempotent -- already enabled).
ALTER TABLE public.pre_registrations ENABLE ROW LEVEL SECURITY;

-- 2. Strip EVERY privilege from the browser-reachable roles. This removes the
--    residual REFERENCES/TRIGGER/TRUNCATE and the authenticated SELECT in one
--    shot. anon/authenticated end up with no table privileges whatsoever.
REVOKE ALL PRIVILEGES ON public.pre_registrations FROM anon;
REVOKE ALL PRIVILEGES ON public.pre_registrations FROM authenticated;

-- 3. Re-assert the only role that should touch the table (idempotent).
--    service_role bypasses RLS; this is the path the API route + admin page use.
GRANT ALL PRIVILEGES ON public.pre_registrations TO service_role;

-- The admin-only RLS SELECT policy from the original migration is left in
-- place as a harmless backstop: with no base privilege, anon/authenticated
-- cannot reach rows regardless, but if a future GRANT ever re-adds SELECT the
-- policy still confines reads to admins.

COMMIT;

-- =========================================================================
-- Verification (run AFTER the COMMIT above)
-- =========================================================================

-- 1) Grants -- expect ONLY service_role to appear. anon + authenticated rows
--    should be GONE entirely.
SELECT grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'pre_registrations'
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY grantee
ORDER BY grantee;

-- 2) RLS still enabled -- expect rowsecurity = true.
SELECT relname, relrowsecurity AS rls_enabled
FROM pg_class
WHERE oid = 'public.pre_registrations'::regclass;

-- 3) Policy still present (backstop) -- expect pre_registrations_admin_read.
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'pre_registrations';
