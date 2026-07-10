-- ===========================================================================
-- Studio Watch thumbnails -- add thumbnail_url columns
-- ===========================================================================
-- Context: studio compose finals are R2 self-hosted mp4s, which deriveThumbnail
-- cannot poster (it only handles YouTube). Every /watch card therefore fell back
-- to a gradient tile. The worker now extracts a poster JPEG per render; these two
-- columns store its public URL so the card/detail can show a real frame.
--
-- render_jobs.thumbnail_url        -- written by the worker when a render is ready
-- genesis_applications.thumbnail_url -- copied on submit (submitRender) so /watch
--                                       reads it directly with the row.
--
-- Idempotent (IF NOT EXISTS), additive only -> rollback-safe. No backfill: rows
-- written before this ship keep thumbnail_url=NULL and render the gradient tile.
-- ===========================================================================

ALTER TABLE render_jobs
  ADD COLUMN IF NOT EXISTS thumbnail_url text;

ALTER TABLE genesis_applications
  ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- ===========================================================================
-- Verify (optional): both columns should now exist.
-- ===========================================================================
-- SELECT table_name, column_name
--   FROM information_schema.columns
--  WHERE column_name = 'thumbnail_url'
--    AND table_name IN ('render_jobs', 'genesis_applications');
