-- ============================================================================
-- CANONICAL DEFINITION: public.handle_new_user() + on_auth_user_created
-- ============================================================================
-- This file exists because the original definition did NOT. The signup trigger
-- was created in the Supabase dashboard and never committed, so the repo said
-- "no such trigger" while it had been firing in production since <= 2026-06-20.
--
-- THIS FILE IS NOW THE SOURCE OF TRUTH. If the function is ever changed in the
-- dashboard, update this file in the same session.
--
-- ----------------------------------------------------------------------------
-- INCIDENT (2026-07-28)
-- ----------------------------------------------------------------------------
-- Migration 0010 from an unrelated project (triptiptip) was run against the
-- OXXOVO database. It used the Supabase quickstart's default object names
-- (handle_new_user / on_auth_user_created), so its CREATE OR REPLACE silently
-- overwrote OXXOVO's own signup trigger function with one that inserts
-- profiles.locale (no such column) and public.workspaces (no such table).
--
-- Result: the AFTER INSERT trigger raised, which rolled back the whole
-- auth.users insert. Signup was 100% blocked. The stray function+trigger were
-- dropped, which unblocked signup but left NO profile-creating trigger, so
-- profiles rows stopped being created at all -- silently, because every app
-- path that could have filled the gap wrote without email and discarded the
-- NOT NULL error.
--
-- ----------------------------------------------------------------------------
-- THIS DEFINITION IS A RECONSTRUCTION, NOT THE ORIGINAL
-- ----------------------------------------------------------------------------
-- The original body was not recoverable (no repo copy, not in the dashboard
-- query history, PITR not enabled). It was reconstructed from the observed
-- behaviour of the 5 rows the original trigger created, then verified against
-- them column by column.
--
-- Evidence the reconstruction is faithful (E2E 22/22, 2026-07-28):
--   * profiles.created_at vs auth.users.created_at = 314 microseconds apart,
--     inside the 320..470us band of the 5 original rows -> same transaction.
--   * role='user' / membership_tier='general' / membership_status='none' /
--     membership_source=NULL / display_name=NULL / creator_name=NULL /
--     founding_creator_number=NULL -- identical to every original row still at
--     its defaults.
--
-- Known-by-evidence, NOT guessed:
--   * inserts (id, email) only -- profiles.email is NOT NULL and every original
--     row has it, while display_name/creator_name are NULL on all of them.
--   * does NOT assign founding_creator_number. That is app-layer only
--     (lib/membership.ts claimFoundingCreator, CAS on
--     membership_founding_counter).
--   * does NOT write membership_events (Stripe-webhook-only table).
--   * does NOT set membership_tier/status -- those are column DEFAULTs.
--
-- Inferred (behaviourally equivalent, so harmless if the original differed):
--   * SECURITY DEFINER + fixed search_path (required to write public.profiles
--     from an auth.users trigger).
--   * ON CONFLICT (id) DO NOTHING (defensive; no observable difference).
--   * role not set explicitly -- profiles.role DEFAULT 'user' produces the same
--     result either way.
--
-- ----------------------------------------------------------------------------
-- CAVEAT
-- ----------------------------------------------------------------------------
-- new.email must be non-NULL or the insert violates profiles.email NOT NULL and
-- blocks signup. OXXOVO uses email OTP only, so this holds today. If phone-only
-- or anonymous auth is ever enabled, revisit this function FIRST.
--
-- The app also has a second, independent path that creates the row on self
-- paths (lib/profile-row.ts ensureProfileRow), so this trigger is no longer the
-- single point of failure. Read paths deliberately do NOT create rows.
-- ============================================================================


-- ============================================================================
-- STEP 1. function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;


-- ============================================================================
-- STEP 2. trigger
-- ============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================================
-- STEP 3. verify -- expect exactly 2 rows
-- ============================================================================
SELECT 'function' AS kind, p.proname AS name
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'
UNION ALL
SELECT 'trigger', t.tgname
FROM pg_trigger t
WHERE NOT t.tgisinternal AND t.tgname = 'on_auth_user_created';


-- ============================================================================
-- STEP 4. drift check -- run this whenever you suspect the DB was edited
-- outside the repo. Paste the output and diff it against STEP 1 above.
-- ============================================================================
SELECT pg_get_functiondef(p.oid) AS live_definition
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'handle_new_user';


-- ============================================================================
-- ROLLBACK -- NOT part of the execution order above. Do not run while working
-- through STEP 1..4. Running this removes automatic profiles-row creation.
-- ============================================================================
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP FUNCTION IF EXISTS public.handle_new_user();
-- ============================================================================
