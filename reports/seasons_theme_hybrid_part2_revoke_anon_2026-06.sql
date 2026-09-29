-- =========================================================================
-- OXXOVO seasons -- Theme Hybrid PART 2  (BREAKING -- anon REVOKE) 2026-06
-- Run in Supabase SQL Editor.
--
-- This is the BREAKING half of the theme-hybrid rollout, split into its own
-- file on purpose: running it together with PART 1 once knocked the public home
-- page offline (anon lost its seasons read before the app was pointed at the
-- view). Keep it separate; run it on its own, at the right time.
--
-- *** PRECONDITION -- do NOT run until BOTH are true: ***
--   1. PART 1 (seasons_theme_hybrid_migration_2026-06.sql) has been applied
--      -- the seasons_public view exists and anon can read it.
--   2. The app build where getSeasonById() reads seasons_public (PR #6) is
--      DEPLOYED and live (home page loads its season through the view).
--
-- If the home page season data disappears after this runs, the deploy was not
-- actually live yet. Recover with:  GRANT SELECT ON public.seasons TO anon;
-- then re-run this only after confirming the deploy.
--
-- What it does: removes anon's direct read of the base seasons table, so the
-- public key can no longer fetch main_round_twist / main_round_theme at all --
-- the only public read path left is the secret-free seasons_public view.
-- authenticated KEEPS base access (the admin console reads through it); closing
-- that vector too is a separate, deferred step -- see the OPTIONAL note below.
--
-- ASCII-only. Idempotent.
-- =========================================================================

BEGIN;

REVOKE SELECT ON public.seasons FROM anon;

COMMIT;


-- =========================================================================
-- Verification (run AFTER the COMMIT above)
-- =========================================================================

-- anon grant on base seasons should be GONE; authenticated remains.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'seasons'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;
-- expect: only 'authenticated' rows; no 'anon' row.


-- =========================================================================
-- OPTIONAL  full lockdown (authenticated contestants too) -- DO NOT RUN YET
--
-- A logged-in user can still read seasons.main_round_twist directly with their
-- own token, because the admin console reads seasons through the authenticated
-- role. To close that, FIRST switch every admin seasons read to the
-- service-role client (app/admin/seasons/{page,[id]/page,new/page,actions}.ts),
-- deploy, and ONLY THEN run:
--
--   REVOKE SELECT ON public.seasons FROM authenticated;
--
-- Those files overlap the 지수2 platform-internal season-creation sprint, so
-- this is intentionally deferred to coordinate and avoid a merge collision.
-- =========================================================================
