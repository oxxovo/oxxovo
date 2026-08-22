-- HQ 2026-08-22: admin-granted Studio test access. Approved design --
-- expires_at is REQUIRED (not a code-level "please remember to turn this
-- off" convention -- a grant with no end date cannot be inserted at all,
-- so it structurally cannot repeat the 2026-08-13 incident where a
-- flip-it-for-testing switch was left on). Season-scoped (does not leak
-- into season_1+). No 10/14 literal anywhere -- the admin sets the date at
-- grant time.
--
-- Table only -- checkStudioAccess wiring + the admin UI are code, not SQL.
--
-- ASCII only. LF only.
-- =========================================================================


-- =========================================================================
-- BLOCK 0 -- CONFIRM before touching anything. Read-only. Run alone.
--
-- EXPECT: has_table = false.
-- =========================================================================
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'studio_test_access'
) AS has_table;


-- =========================================================================
-- BLOCK 1 -- create the table + indexes + RLS/grants. Run alone, after
-- BLOCK 0 confirms. Whole block, one transaction.
-- =========================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.studio_test_access (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_id   text NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  -- admin who granted it -- SET NULL (not CASCADE) so deleting an admin
  -- account later never deletes the grant record itself, only the
  -- attribution (same pattern as credit_transactions.actor_id).
  granted_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  -- REQUIRED. This is the whole point -- see file header.
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- One ACTIVE grant per (user, season) at a time -- re-granting while one is
-- already active is a conflict the app surfaces, not a silent second row.
-- A revoked or expired row does not block a fresh grant (partial index).
CREATE UNIQUE INDEX IF NOT EXISTS studio_test_access_active_unique
  ON public.studio_test_access (user_id, season_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS studio_test_access_season_idx
  ON public.studio_test_access (season_id);

ALTER TABLE public.studio_test_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.studio_test_access FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.studio_test_access TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Verify BLOCK 1 (read-only):
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'studio_test_access'
ORDER BY grantee, privilege_type;
-- expect: service_role has all privileges (SELECT/INSERT/UPDATE/DELETE/...),
-- anon/authenticated/PUBLIC have 0 rows. (This is exactly the class of
-- mistake backlog #37 found and check-service-role-grants.mjs now gates
-- deploy on -- checking it here too, not relying only on that gate.)


-- =========================================================================
-- REVERT -- do NOT run with the blocks above. Separate action only.
-- =========================================================================
-- DROP TABLE IF EXISTS public.studio_test_access;
