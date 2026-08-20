-- ============================================================================
-- Nickname uniqueness -- normalized DB unique index (2026-08-19)
-- ============================================================================
-- app/welcome/nickname's duplicate check (lib/nickname.ts isDisplayNameTaken)
-- is app-level only -- not race-proof against two signups submitting the same
-- name at the same instant. TK 2026-08-19: that gap is part of THIS feature,
-- not a separate item. This index is the actual guarantee; the app check
-- above is just so a normal (non-race) collision gets a nice error instead of
-- a raw constraint violation.
--
-- Normalized the same way lib/nickname.ts's nicknameCollisionKey() does:
-- lowercase, then strip space/./_/- (the only non-alphanumeric characters
-- validateNickname allows) -- "Kira" / "kira" / "K i r a" / "K.i.r.a" all
-- collide. Keep the two definitions in sync if either changes.
--
-- Partial (WHERE display_name IS NOT NULL): every pre-onboarding account has
-- display_name = NULL, and NULLs must NOT collide with each other.
--
-- Pre-check (2026-08-19): 0 normalized collisions among the 7 existing
-- profiles rows, so this creates cleanly against current data.
--
-- ASCII-only, idempotent. Run in Supabase SQL editor. Project = qrnkovokjmimagrwjebs.
-- ============================================================================

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_display_name_normalized_unique
  ON public.profiles (lower(regexp_replace(display_name, '[ ._-]', '', 'g')))
  WHERE display_name IS NOT NULL;

COMMIT;

-- ============================================================================
-- Verification -- expect 1 row
-- ============================================================================
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND indexname = 'profiles_display_name_normalized_unique';
