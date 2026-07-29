-- ============================================================================
-- One-off backfill: auth.users rows that have no public.profiles row
-- ============================================================================
-- WHY THIS IS A ONE-OFF AND NOT RUNTIME CODE
-- ----------------------------------------------------------------------------
-- Accounts created before the signup trigger existed (and any created while it
-- was broken on 2026-07-28) have no profiles row. The app deliberately does NOT
-- self-heal on read paths: a public Watch page creating rows for whoever it is
-- rendering would, if the trigger ever dies again, turn one broken signup into a
-- write storm across all audience traffic (TK, 2026-07-28). Read paths log and
-- fall back to the deterministic auto nickname instead.
--
-- So the historical gap is closed here, once, deliberately.
--
-- Known target as of 2026-07-28: hellovegastour@gmail.com (auth 2026-05-11),
-- the only account predating the trigger. tkckusa@gmail.com already has a row
-- (created manually 12 minutes after signup, 2026-05-24).
--
-- NOTE: if that account is going to be deleted outright instead, skip this file
-- -- there is a separate pending cleanup for its season_0 test application
-- (reports/delete_season0_tk_test_application_2026-06.sql). Backfilling first
-- is harmless either way.
-- ============================================================================


-- ============================================================================
-- STEP 0. DRY RUN. Read the output before running STEP 1.
-- Expect: 1 row (hellovegastour@gmail.com). Investigate anything else.
-- ============================================================================
SELECT u.id, u.email, u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ORDER BY u.created_at;


-- ============================================================================
-- STEP 1. Backfill. Inserts id + email only -- every other column takes its
-- table DEFAULT, exactly like the signup trigger does.
-- ============================================================================
INSERT INTO public.profiles (id, email)
SELECT u.id, lower(u.email)
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
  AND u.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- STEP 2. Verify -- expect 0 rows.
-- ============================================================================
SELECT u.id, u.email, u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ORDER BY u.created_at;


-- ============================================================================
-- STEP 3. Sanity: the backfilled rows must sit at column defaults and must NOT
-- have taken a Founding Creator slot. Expect role='user', tier='general',
-- status='none', founding_creator_number NULL.
-- ============================================================================
SELECT email, role, membership_tier, membership_status, membership_source,
       founding_creator_number, display_name, creator_name
FROM public.profiles
ORDER BY created_at;


-- ============================================================================
-- ROLLBACK -- NOT part of the execution order above. Do not run while working
-- through STEP 0..3.
--
-- Deletes ONLY rows that are still untouched defaults, so a row that has since
-- gained a nickname / membership / founding number is never removed. Replace the
-- id list with the ids STEP 0 printed.
-- ============================================================================
-- DELETE FROM public.profiles
-- WHERE id IN ('<paste ids from STEP 0>')
--   AND display_name IS NULL
--   AND creator_name IS NULL
--   AND founding_creator_number IS NULL
--   AND membership_source IS NULL
--   AND membership_tier = 'general'
--   AND membership_status = 'none';
-- ============================================================================
