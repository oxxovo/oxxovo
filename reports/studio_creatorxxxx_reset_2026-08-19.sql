-- ============================================================================
-- Reset the 3 auto-generated "CreatorXXXX" nicknames to NULL (2026-08-19)
-- ============================================================================
-- Now safe to be meaningful: app/auth/callback redirects to /welcome/nickname
-- when display_name is NULL (deployed, sha 6591c85), and getDisplayName() no
-- longer auto-writes a fallback back into the DB -- so NULL here now actually
-- means "onboarding required," not "will silently regenerate the same value
-- on next read" (that was true before the gate shipped, per 2026-08-19
-- real-time trace).
--
-- 3 rows, confirmed by direct query 2026-08-19:
--   dcf59288-b4a0-4752-8a14-906bb824f684  studio-demo@oxxovo.ai        CreatorF684
--   c67e76f0-489f-476b-9b0c-9af3429cbd1f  e2e-studio@oxxovo-e2e.test   CreatorBD1F
--   9b5ceed5-34b3-4a64-af4a-3fe898dd547f  tkckusa@gmail.com (TK)       Creator547F
--
-- Run BLOCK 0 first and confirm the 3 rows still match the values above --
-- if they do not, STOP and re-check before running BLOCK 1 (someone may have
-- already changed one of these nicknames since this file was written).
--
-- BLOCK 2 (rollback) is NOT meant to run right after BLOCK 1 -- it exists so
-- TK can restore the exact prior values by hand if the new onboarding gate
-- misbehaves for any of these 3 accounts (in particular TK's own login).
-- Run it only if that happens.
--
-- ASCII-only in code/comments. Run each block separately in the Supabase SQL
-- editor. Project = qrnkovokjmimagrwjebs.
-- ============================================================================

-- ============================================================================
-- BLOCK 0 -- preview. Expect exactly the 3 rows listed above.
-- ============================================================================
SELECT id, email, display_name
FROM public.profiles
WHERE id IN (
  'dcf59288-b4a0-4752-8a14-906bb824f684',
  'c67e76f0-489f-476b-9b0c-9af3429cbd1f',
  '9b5ceed5-34b3-4a64-af4a-3fe898dd547f'
)
ORDER BY email;

-- ============================================================================
-- BLOCK 1 -- the reset. Only run after confirming BLOCK 0's output matches.
-- ============================================================================
UPDATE public.profiles
SET display_name = NULL
WHERE id IN (
  'dcf59288-b4a0-4752-8a14-906bb824f684',
  'c67e76f0-489f-476b-9b0c-9af3429cbd1f',
  '9b5ceed5-34b3-4a64-af4a-3fe898dd547f'
)
RETURNING id, email, display_name;

-- ============================================================================
-- BLOCK 2 -- ROLLBACK. Do NOT run this after BLOCK 1 as a matter of course --
-- only if the new gate breaks login/onboarding for one of these 3 accounts
-- and TK wants the exact prior value restored immediately.
-- ============================================================================
-- UPDATE public.profiles SET display_name = 'CreatorF684' WHERE id = 'dcf59288-b4a0-4752-8a14-906bb824f684' RETURNING id, email, display_name;
-- UPDATE public.profiles SET display_name = 'CreatorBD1F' WHERE id = 'c67e76f0-489f-476b-9b0c-9af3429cbd1f' RETURNING id, email, display_name;
-- UPDATE public.profiles SET display_name = 'Creator547F' WHERE id = '9b5ceed5-34b3-4a64-af4a-3fe898dd547f' RETURNING id, email, display_name;
