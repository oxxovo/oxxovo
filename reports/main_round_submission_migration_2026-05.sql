-- ─────────────────────────────────────────────────────────────────────────
-- OXXOVO 본선 영상 제출 시스템 마이그레이션 (2026-05-28)
-- 시즌 0 본선 발사 전 동적 파라미터 + status 흐름 확장.
--
-- 3가지 변경:
--   1. seasons — 본선 운영 동적 파라미터 3컬럼 (theme/platforms/editable)
--   2. genesis_applications.status — 'main_round_submitted' 추가 (9 values)
--   3. seasons.main_round_theme 인덱스 불필요 (single-row 조회만)
--
-- TK 대표님 결정 (2026-05-28):
--   - theme_announcement_minutes_before 기존 컬럼 재사용 (사양의 theme_reveal_*과 동의)
--   - main_round_video_url / main_round_submitted_at — 5c에서 이미 추가, 손대지 않음
--   - status 흐름: pending → verifying → eligible → selected
--                    → main_round_submitted → awarded
--     병행 분기: flagged (검토 대기), rejected (탈락) 유지
--
-- 컬럼 명명 참고 (사양 ↔ 실제 DB):
--   사양 main_round_started_at → 실제 main_round_start_at
--   사양 main_round_close_at   → 실제 main_round_end_at
--   사양 theme_reveal_minutes_before → 실제 theme_announcement_minutes_before
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─── 1. seasons 본선 운영 동적 파라미터 3컬럼 ──────────────────────────
-- main_round_theme:
--   본선 시작 직전 admin이 채움. 그 전까지 NULL.
--   UI는 (현재시각 < main_round_start_at - theme_announcement_minutes_before*60s)이면
--   "주제 공개 대기 중" + 카운트다운, 도달 후 main_round_theme 표시.
--
-- allowed_video_platforms:
--   서버/클라이언트 양쪽에서 URL 도메인 화이트리스트로 사용.
--   시즌별 변동 가능 (예: 시즌 1에서 'youtube_shorts'만 허용 등).
--
-- submission_editable_until_close:
--   TRUE면 main_round_end_at까지 본선 제출 수정 가능.
--   FALSE면 첫 제출 이후 잠금 (시즌별 운영 정책 가변).

ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS main_round_theme TEXT,
  ADD COLUMN IF NOT EXISTS allowed_video_platforms TEXT[]
    NOT NULL DEFAULT ARRAY['youtube', 'vimeo', 'instagram', 'tiktok'],
  ADD COLUMN IF NOT EXISTS submission_editable_until_close BOOLEAN
    NOT NULL DEFAULT TRUE;

-- allowed_video_platforms 유효성 — 빈 배열 금지 (적어도 1개는 허용해야 제출 가능)
-- cardinality() 사용: array_length(empty, 1)=NULL 함정 회피 (CHECK가 NULL을 통과로 봄).
-- 컬럼은 NOT NULL이라 cardinality(NULL) 경로도 차단됨.
ALTER TABLE public.seasons
  DROP CONSTRAINT IF EXISTS allowed_video_platforms_nonempty_chk;

ALTER TABLE public.seasons
  ADD CONSTRAINT allowed_video_platforms_nonempty_chk
    CHECK (cardinality(allowed_video_platforms) >= 1);

-- 시즌 0 명시 적용 (default와 동일하지만 문서화 차원)
UPDATE public.seasons
SET allowed_video_platforms = ARRAY['youtube', 'vimeo', 'instagram', 'tiktok'],
    submission_editable_until_close = TRUE
WHERE id = 'season_0';

-- ─── 2. genesis_applications.status — 9개로 확장 ──────────────────────
-- 현재 8개 (scoring_results 마이그레이션에서 확정):
--   pending / waitlist / verifying / flagged / eligible / selected / awarded / rejected
-- 추가:
--   'main_round_submitted' — selected 사용자가 본선 영상 제출 완료한 상태.
--   결과 발표 cron에서 main_round_submitted → awarded/rejected로 전이.
--
-- IDEMPOTENT — DROP + ADD 패턴.

ALTER TABLE public.genesis_applications
  DROP CONSTRAINT IF EXISTS genesis_applications_status_check;

ALTER TABLE public.genesis_applications
  ADD CONSTRAINT genesis_applications_status_check
    CHECK (status IN (
      'pending',                -- 신청 직후
      'waitlist',               -- 정원 초과
      'verifying',              -- oxxovo-scoring가 채점 중
      'flagged',                -- integrity high — admin 검토 대기
      'eligible',               -- 채점 통과, Top N 후보
      'selected',               -- Top N 선정 (본선 진출 대기)
      'main_round_submitted',   -- 본선 영상 제출 완료 (신규)
      'awarded',                -- 수상자
      'rejected'                -- 탈락
    ));

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────
-- Verification (COMMIT 후 별도 실행)
-- ─────────────────────────────────────────────────────────────────────────

-- 1) seasons 새 3컬럼 + 시즌 0 값
SELECT id,
       main_round_theme,
       allowed_video_platforms,
       submission_editable_until_close,
       theme_announcement_minutes_before  -- 기존 컬럼 재사용 확인
FROM public.seasons
WHERE id = 'season_0';

-- 2) seasons 컬럼 메타 (data_type/default/nullable)
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'seasons'
  AND column_name IN (
    'main_round_theme',
    'allowed_video_platforms',
    'submission_editable_until_close'
  )
ORDER BY column_name;

-- 3) status CHECK 제약 — 9개 확인
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.genesis_applications'::regclass
  AND conname = 'genesis_applications_status_check';

-- 4) 시즌 0 application status 분포 (현재 상태 확인용)
SELECT status, COUNT(*) AS n
FROM public.genesis_applications
WHERE season_id = 'season_0'
GROUP BY status
ORDER BY n DESC;

-- 5) main-round 컬럼 5c에서 정상 추가됐는지 재확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'genesis_applications'
  AND column_name IN ('main_round_video_url', 'main_round_submitted_at')
ORDER BY column_name;
