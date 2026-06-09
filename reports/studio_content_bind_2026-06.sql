-- =========================================================================
-- OXXOVO Studio -- CryptoBind content binding (S-6)
-- Run in Supabase SQL Editor (full file as one block).
--
-- Adds a second, integrity-only signature over the SHA-256 of the produced
-- video bytes. The worker stamps both columns at the 'ready' stage (the
-- generation-time signature cannot cover content that does not yet exist). At
-- submission the main app recomputes the signature over the stored hash: an
-- attacker who rewrites video_url / the hash after generation cannot forge a
-- match without STUDIO_CRYPTOBIND_SECRET.
--
--   cryptobind_content_hash       text -- sha256 hex of the video bytes
--   cryptobind_content_signature  text -- HMAC-SHA256 over v1c|jobId|tid|hash
--
-- Both NULL-able: rows produced before this change (or when the worker secret
-- was unset) simply skip the extra check. Integrity dimension only -- no patent
-- claim is made or implied here.
--
-- ASCII-only. Idempotent.
-- =========================================================================

BEGIN;

ALTER TABLE public.generation_jobs
  ADD COLUMN IF NOT EXISTS cryptobind_content_hash text,
  ADD COLUMN IF NOT EXISTS cryptobind_content_signature text;

COMMIT;

-- =========================================================================
-- Verification
-- =========================================================================
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='generation_jobs'
  AND column_name IN ('cryptobind_content_hash','cryptobind_content_signature')
ORDER BY column_name;
