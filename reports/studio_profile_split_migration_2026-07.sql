-- ===========================================================================
-- Profile / work split (pre-launch item 3) -- extend profiles
-- ===========================================================================
-- Scope (TK): account-level creator_name + country move to profiles so they are
-- collected once and prefilled on every later submission instead of being
-- re-typed into each genesis_applications entry. ALL THREE consents (rules,
-- privacy, integrity) stay per-submission (TK: "동의 3개는 매번 유지"), so no
-- consent columns are added here -- the per-entry agreed_to_* on
-- genesis_applications remains the record of consent.
--
--   creator_name   display/entry name (prefill; genesis keeps a snapshot)
--   country        optional
--
-- Idempotent (IF NOT EXISTS), additive only -> rollback-safe. No backfill here:
-- existing creators get profiles filled lazily on their next submission (the
-- forms prefill from the latest genesis_applications when profiles is empty).
-- profiles already has service-role-only RLS; these columns inherit it.
--
-- (Deferred: consent-once versioning -- rules/privacy_agreed_at+version -- is
-- the fuller design in studio_profile_work_split_design_2026-07.md, for when
-- consents should be asked once instead of every submission. Not in this scope.)
-- ===========================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS creator_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country text;

-- ===========================================================================
-- Verify (optional):
-- ===========================================================================
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'profiles'
--    AND column_name IN ('creator_name','country')
--  ORDER BY column_name;
