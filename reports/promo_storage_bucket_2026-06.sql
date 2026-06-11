-- OXXOVO admin 홍보영상 -- Supabase Storage 공개 버킷 (2026-06-10)
-- ===========================================================================
-- Run in Supabase SQL Editor (전체 한 블록).
--
-- 수동 업로드 v1 저장소. 브라우저가 service_role signed upload URL 로 직행 업로드
-- (Vercel 4.5MB 우회). 버킷은 public read -> Postiz 가 공개 URL 로 영상 fetch.
-- 쓰기는 signed URL(서버 발급)만. 멱등(ON CONFLICT), ASCII-only.
--
-- 규모 커지면 P1 에서 R2 이행 (이 버킷 유지보수 종료).
-- ===========================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'promo-videos',
  'promo-videos',
  true,                                   -- public read (Postiz fetch 용)
  524288000,                              -- 500 MB 상한 (워밍업 짧은 클립 충분)
  ARRAY['video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 쓰기 정책은 만들지 않음: anon/authenticated 직접 INSERT 차단.
-- 업로드는 서버액션이 발급한 signed upload URL(service_role) 로만 이뤄짐.
-- public=true 라 읽기는 /storage/v1/object/public/promo-videos/<path> 로 무인증 가능.

-- ===========================================================================
-- Verification
-- ===========================================================================
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id = 'promo-videos';
