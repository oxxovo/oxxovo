-- ============================================================================
-- VIDEO TITLE + DESCRIPTION (public, creator-authored) -- genesis_applications
-- ============================================================================
-- YouTube-style per-video title + description shown on Watch (card title +
-- detail). Kept SEPARATE from creator_statement, which stays the scoring input
-- for AI Intent (judging integrity -- the public blurb must not be the graded
-- text). Both nullable: existing rows have none and the card falls back to
-- creator_name; new applications collect both on /apply.
--
-- MUST run before launch -- the application form cannot be changed once Season 0
-- applications open (7/25), so the columns + form inputs go in now.
-- ============================================================================

ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS video_title       TEXT,
  ADD COLUMN IF NOT EXISTS video_description TEXT;

-- Verify (expect both columns present)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'genesis_applications'
  AND column_name IN ('video_title', 'video_description')
ORDER BY column_name;
