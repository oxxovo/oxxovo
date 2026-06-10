-- ─────────────────────────────────────────────────────────────────────────
-- OXXOVO 본선 단일 제출 모델 정정 (2026-05-29)
--
-- 사업 본질 정정 (TK 대표님 확정):
--   본선 = 단일 제출. 한 번 제출 후 영구 수정 불가.
--   마감 = main_round_start_at + 48시간.
--
-- 이전 main_round_submission_migration_2026-05.sql에서 추가한
-- submission_editable_until_close BOOLEAN 컬럼은 잘못된 가정 위에 있었음:
--   - 일반 form 패턴(수정 가능)으로 default(TRUE) 추가
--   - 사업 본질(단일 제출) 확인 안 하고 진행
--   - 시즌별로 정책이 다를 수 있다는 가정 자체가 부정확
--
-- 정정:
--   ALTER TABLE seasons DROP COLUMN submission_editable_until_close
--
-- 데이터 손실 영향:
--   - 시즌 0만 존재, default(TRUE)만 들어있음 → 의미 있는 데이터 없음
--   - 다른 컬럼(main_round_theme, allowed_video_platforms 등) 영향 없음
--
-- IDEMPOTENT — DROP COLUMN IF EXISTS.
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.seasons
  DROP COLUMN IF EXISTS submission_editable_until_close;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────
-- Verification (COMMIT 후 별도 실행)
-- ─────────────────────────────────────────────────────────────────────────

-- 1) submission_editable_until_close 컬럼 사라졌는지 — 기대: 0 rows
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'seasons'
  AND column_name = 'submission_editable_until_close';

-- 2) 다른 본선 컬럼은 그대로 — 기대: 5 rows
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'seasons'
  AND column_name IN (
    'main_round_theme',
    'allowed_video_platforms',
    'main_round_start_at',
    'main_round_end_at',
    'theme_announcement_minutes_before'
  )
ORDER BY column_name;

-- 3) 시즌 0 데이터 확인 — 본선 관련 컬럼 정상 유지 확인
SELECT id,
       main_round_theme,
       allowed_video_platforms,
       main_round_start_at,
       main_round_end_at,
       theme_announcement_minutes_before
FROM public.seasons
WHERE id = 'season_0';

-- 4) status CHECK 제약 그대로 9개 유지 확인 (이전 정정으로 추가된 main_round_submitted 포함)
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.genesis_applications'::regclass
  AND conname = 'genesis_applications_status_check';

-- 5) allowed_video_platforms_nonempty_chk 그대로 (cardinality 패치 유지) 확인
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.seasons'::regclass
  AND conname = 'allowed_video_platforms_nonempty_chk';
