-- OXXOVO promo_videos soft delete + trash. Delivered to TK in chat, run via
-- Supabase SQL Editor. ASCII only, add-only.

ALTER TABLE public.promo_videos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS promo_videos_deleted_at_idx ON public.promo_videos (deleted_at);

-- Logs a video's file URL when a permanent delete cannot also delete the
-- backing file (R2-hosted videos -- this app has no R2 credentials, only the
-- separate worker repo does). Nothing is silently lost; this is the record.
CREATE TABLE IF NOT EXISTS public.promo_video_orphan_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_video_id UUID,
  video_url TEXT NOT NULL,
  reason TEXT NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.promo_video_orphan_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.promo_video_orphan_files FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.promo_video_orphan_files TO service_role;

-- ===========================================================================
-- Verification (run after, separately)
-- ===========================================================================
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'promo_videos' AND column_name = 'deleted_at';
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'promo_video_orphan_files';
