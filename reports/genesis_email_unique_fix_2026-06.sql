-- OXXOVO 매주 시즌 블로커 제거 — genesis email 유일성 교체 (2026-06-04)
-- ===========================================================================
-- 23505 미스터리 최종 확정 (pg_indexes 결과, 2026-06-04):
--   genesis_applications_email_unique 가 실제로 존재했음 = email 전역 유일 인덱스.
--   * TK의 첫 점검 쿼리는 contype IN ('u','p')로 "제약"만 봤기에 "인덱스"인
--     이 유일 인덱스를 못 잡았던 것 (제약 아님 → pg_constraint에 안 나옴).
--   * 따라서 /api/apply의 23505 핸들러는 dead code가 아니라 LIVE BLOCKER였음.
--     시즌 0 신청자가 시즌 1에 신청 시 email 전역 유일 위반(23505)으로 차단됨
--     = 매주 시즌 모델의 hard blocker. (첫 추측이 옳았음.)
--
-- 이 마이그레이션:
--   1. DROP genesis_applications_email_unique  (매주 재신청 블로커 제거)
--   2. ADD  UNIQUE(season_id, lower(email))    (시즌별 1email 1신청 = 어뷰징 방지)
--
-- 왜 (season_id, lower(email))인가:
--   * 전역 유일을 없애 매주 재신청은 허용하되, "같은 시즌 같은 email 중복"은 차단.
--   * lower(): 기존 row는 입력 대소문자 혼재, 신규는 세션 email(소문자) → 함수
--     인덱스로 둘 다 정규화 비교.
--   * (season_id, user_id) 유일(Phase 1)은 user_id가 NULL인 레거시 row를 못 막지만,
--     (season_id, email)은 email이 NOT NULL이라 레거시 포함 전부 보호 → defense-in-depth.
--   * 구/신 apply 코드 둘 다 email을 insert하므로 코드 버전 무관하게 작동 →
--     브랜치 머지 전 prod에 지금 적용해도 안전.
--
-- 안전성: Phase 1 verification #5 = 0 rows (시즌별 중복 email 없음) → CREATE 안전.
-- 옥소보 supabase_column_policy: 멱등(IF EXISTS / IF NOT EXISTS).
-- ===========================================================================

BEGIN;

-- 1. 전역 email 유일 인덱스 제거 (매주 시즌 블로커)
DROP INDEX IF EXISTS public.genesis_applications_email_unique;

-- 2. 시즌별 email 유일 (대소문자 무시) — 어뷰징 방지
CREATE UNIQUE INDEX IF NOT EXISTS genesis_applications_season_email_uniq
  ON public.genesis_applications (season_id, lower(email));

COMMIT;

-- ===========================================================================
-- Verification (COMMIT 후 실행)
-- ===========================================================================

-- 1) 인덱스 상태 — 기대: email_unique 없음, season_email_uniq 있음,
--    season_user_uniq / user_id_idx / pkey / created_idx 유지
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'genesis_applications'
ORDER BY indexname;

-- 2) 같은 email로 다른 시즌 신청이 가능해졌는지 개념 확인 (전역 유일 없음).
--    기대: email_unique가 사라져 매주 재신청 허용.
SELECT NOT EXISTS (
  SELECT 1 FROM pg_indexes
  WHERE schemaname='public' AND tablename='genesis_applications'
    AND indexname='genesis_applications_email_unique'
) AS weekly_reapply_unblocked;

-- 3) 시즌별 중복 email 재확인 — 기대: 0 rows (유일 인덱스가 보장)
SELECT season_id, lower(email) AS email_norm, COUNT(*) AS dup
FROM public.genesis_applications
GROUP BY season_id, lower(email)
HAVING COUNT(*) > 1;
