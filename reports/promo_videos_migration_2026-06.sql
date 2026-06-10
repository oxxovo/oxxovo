-- OXXOVO admin 홍보영상 시스템 -- promo_videos 테이블 (2026-06-10)
-- ===========================================================================
-- Run in Supabase SQL Editor (전체 파일 한 블록).
--
-- admin-promo (P2) 기반 테이블. 영상 생성(fal.ai) -> R2 저장 -> Postiz 4채널
-- 자동게시. RLS: service_role 전담, admin SELECT (is_admin()).
--
-- 옥소보 정책: 멱등(CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS), ASCII-only.
-- ===========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.promo_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 생성 입력
  prompt TEXT,
  theme_note TEXT,
  duration_seconds INT,
  aspect_ratio TEXT,
  tier TEXT,
  resolution TEXT,

  -- 진행 상태
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'generating', 'ready', 'failed', 'posted')),
  fal_request_id TEXT,
  error_message TEXT,

  -- 산출물 (R2). fal 함정: 9:16 요청이 16:9 로 나올 수 있어 실측 해상도 기록.
  video_url TEXT,            -- R2 path/URL
  actual_width INT,
  actual_height INT,
  cost_usd NUMERIC,
  source TEXT NOT NULL DEFAULT 'generated'
    CHECK (source IN ('generated', 'uploaded')),

  -- YouTube 직접 업로드 (Data API v3)
  youtube_video_id TEXT,
  youtube_posted_at TIMESTAMPTZ,

  -- Postiz 자동게시 (IG/TikTok/YouTube/X)
  postiz_post_id TEXT,
  posted_channels TEXT[],
  posted_at TIMESTAMPTZ
);

-- 신규 컬럼 멱등 보강 (테이블이 이미 있던 경우 대비)
ALTER TABLE public.promo_videos ADD COLUMN IF NOT EXISTS postiz_post_id  TEXT;
ALTER TABLE public.promo_videos ADD COLUMN IF NOT EXISTS posted_channels TEXT[];
ALTER TABLE public.promo_videos ADD COLUMN IF NOT EXISTS posted_at       TIMESTAMPTZ;

-- 아카이브 목록용 인덱스 (최신순)
CREATE INDEX IF NOT EXISTS promo_videos_created_idx
  ON public.promo_videos (created_at DESC);

-- RLS: service_role 전담(생성/업데이트), admin SELECT (is_admin()).
ALTER TABLE public.promo_videos ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.promo_videos TO authenticated;
GRANT ALL    ON public.promo_videos TO service_role;

DROP POLICY IF EXISTS promo_videos_admin_read ON public.promo_videos;
CREATE POLICY promo_videos_admin_read ON public.promo_videos
  FOR SELECT TO authenticated
  USING (public.is_admin());

COMMIT;

-- ===========================================================================
-- 채널 id placeholder (TK 가 가입 후 GET /integrations 로 확인한 id 로 UPDATE).
--   값이 비어 있으면 lib/postiz.getPostizChannelIds 가 명시적 에러를 던짐.
--   ON CONFLICT DO NOTHING -- 이미 채워둔 값 보호.
-- ===========================================================================
INSERT INTO public.platform_config (key, value, value_type, description) VALUES
  ('postiz_channel_instagram', '', 'text', 'Postiz integration id (Instagram). GET /integrations 로 확인'),
  ('postiz_channel_tiktok',    '', 'text', 'Postiz integration id (TikTok)'),
  ('postiz_channel_youtube',   '', 'text', 'Postiz integration id (YouTube)'),
  ('postiz_channel_x',         '', 'text', 'Postiz integration id (X)')
ON CONFLICT (key) DO NOTHING;

-- ===========================================================================
-- Verification (COMMIT 후 별도 실행)
-- ===========================================================================
-- 1) 테이블 + RLS
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'promo_videos';
-- 2) Postiz 컬럼 3개
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='promo_videos'
  AND column_name IN ('postiz_post_id','posted_channels','posted_at')
ORDER BY column_name;
-- 3) 채널 placeholder 4개
SELECT key, value FROM public.platform_config
WHERE key LIKE 'postiz_channel_%' ORDER BY key;
