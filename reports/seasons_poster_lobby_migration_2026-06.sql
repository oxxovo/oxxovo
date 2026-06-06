-- OXXOVO seasons — poster_url + lobby_featured (2026-06-06)
-- ===========================================================================
-- Run in Supabase SQL Editor.
--
-- ADD-only 컬럼 2개 (포스터 업로드 UI 는 10월 작업 — 지금은 컬럼만 선반영):
--   poster_url     TEXT            (NULL 허용) — 시즌 포스터 이미지 URL.
--   lobby_featured BOOLEAN NOT NULL DEFAULT false — 로비 featured 노출 여부.
--
-- 옥소보 정책: ADD-only, 멱등(IF NOT EXISTS). ASCII-only.
-- ===========================================================================

BEGIN;

ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS poster_url TEXT;

ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS lobby_featured BOOLEAN NOT NULL DEFAULT false;

COMMIT;

-- ===========================================================================
-- Verification (COMMIT 후 별도 실행)
-- ===========================================================================

-- 기대: poster_url(text, nullable=YES, default NULL),
--       lobby_featured(boolean, nullable=NO, default false)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'seasons'
  AND column_name IN ('poster_url', 'lobby_featured')
ORDER BY column_name;
