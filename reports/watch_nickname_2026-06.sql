-- OXXOVO -- creator nickname (profiles.display_name) (2026-06-28)
-- ===========================================================================
-- Run in Supabase SQL Editor (whole file as one block).
--
-- Why: Watch needs a YouTube-style account nickname shown identically on
--   submissions, comments, and likes -- never the email. Today the only name is
--   genesis_applications.creator_name, which is per-APPLICATION (can differ by
--   season). profiles has no nickname column. This adds ONE account-level
--   nickname (TK 2026-06-28: auto at sign-up, editable in profile).
--
--   Auto-generation + ensure-row happen in app code (lib/nickname.ts) via
--   upsert, since there is no handle_new_user trigger creating profiles rows.
--   This migration adds the column and best-effort backfills existing rows from
--   each user's most recent application creator_name.
--
-- Idempotent / ADD-only.
-- ===========================================================================

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Backfill: each user's latest non-empty application creator_name becomes their
-- nickname, only where the profile row exists and has no nickname yet. Users
-- with no profile row (or no application) get an auto nickname lazily in app
-- code on first use.
UPDATE public.profiles p
SET display_name = sub.creator_name
FROM (
  SELECT DISTINCT ON (user_id) user_id, creator_name
  FROM public.genesis_applications
  WHERE user_id IS NOT NULL
    AND creator_name IS NOT NULL
    AND btrim(creator_name) <> ''
  ORDER BY user_id, created_at DESC
) sub
WHERE p.id = sub.user_id
  AND (p.display_name IS NULL OR btrim(p.display_name) = '');

COMMIT;

-- ===========================================================================
-- Verification (run separately after COMMIT)
-- ===========================================================================

-- 1) Column exists -- expect display_name, text, nullable
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'display_name';

-- 2) Backfill coverage -- how many profiles now have a nickname
SELECT
  COUNT(*) FILTER (WHERE display_name IS NOT NULL AND btrim(display_name) <> '') AS with_nickname,
  COUNT(*) AS total
FROM public.profiles;
