-- HQ 2026-08-21: authenticated has INSERT/UPDATE/DELETE on public.seasons but
-- no SELECT -- backwards, and the app never writes to seasons except via the
-- service-role client. Empirically tested with a real signed-in non-admin
-- user (disposable auth account, deleted after): INSERT got past the GRANT
-- check and was rejected by RLS ("new row violates row-level security
-- policy"); UPDATE/DELETE errored "permission denied for table seasons"
-- (42501). Not exploitable today because RLS/the missing SELECT-for-WHERE
-- happens to cover it, but the grants themselves have no reason to exist and
-- are one loosened policy away from being real. Revoking.

REVOKE INSERT, UPDATE, DELETE ON public.seasons FROM authenticated;

-- verify: authenticated should now show 0 rows for these three privileges
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'seasons' AND grantee = 'authenticated';


-- ============================================================
-- REVERT (do NOT run with the block above -- separate action,
-- only if something downstream turns out to depend on these grants)
-- ============================================================
-- GRANT INSERT, UPDATE, DELETE ON public.seasons TO authenticated;
