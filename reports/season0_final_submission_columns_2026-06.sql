-- ===========================================================================
-- OXXOVO 시즌 0 -- 결승(final) studio 제출 컬럼 (2026-06-13)
-- ===========================================================================
-- Run in Supabase SQL Editor (전체 한 블록). 멱등(IF NOT EXISTS), ASCII-only.
-- DO $$ 블록 없음 (Supabase 42601 회피, [[feedback-sql-ascii-only]]).
--
-- 배경: 3단계 결승 제출 경로 연결. final_video_url / final_submitted_at 는 이미
--   season0_3stage 마이그에서 추가됨(라이브). 이 파일은 studio(인앱 생성) 결승
--   제출이 기록할 render/job/signature 컬럼만 추가 -- 준결승(main)의
--   studio_main_render_id / studio_main_job_id / studio_main_signature 미러.
--
--   외부 URL 제출(saveFinalSubmission)은 final_video_url 만 쓰므로 이 마이그
--   불필요. 이 컬럼들은 studio 경로(submitRender/submitGeneration) 전용.
--
-- 타이밍: 결승 라운드가 열리기(final_start_at 설정) 전에 Run하면 됨. 미실행이어도
--   라이브 무해 -- final 경로는 final_start_at=NULL 동안 dormant + session6 OFF로
--   /studio 404. 단 결승 개시 전 필수(코드가 이 컬럼에 기록).
-- ===========================================================================

BEGIN;

ALTER TABLE public.genesis_applications
  -- compose(짜깁기) 결승 제출 -> render id (studio_main_render_id 미러, uuid)
  ADD COLUMN IF NOT EXISTS studio_final_render_id uuid,
  -- 단일 생성 결승 제출 -> job id + CryptoBind signature
  --   (studio_main_job_id / studio_main_signature 미러)
  ADD COLUMN IF NOT EXISTS studio_final_job_id    uuid,
  ADD COLUMN IF NOT EXISTS studio_final_signature text;

COMMIT;

-- ===========================================================================
-- Verification (COMMIT 후 별도 실행) -- 결승 studio 컬럼 3개 확인
-- ===========================================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='genesis_applications'
  AND column_name IN ('studio_final_render_id','studio_final_job_id','studio_final_signature')
ORDER BY column_name;
