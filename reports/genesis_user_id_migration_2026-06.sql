-- OXXOVO 신원 통합 Phase 1 — genesis_applications.user_id + 중복 신청 방지 (2026-06-03)
-- ===========================================================================
-- Run in Supabase SQL Editor (전체 파일을 한 블록으로 실행).
--
-- 배경 (feedback-auth-pattern, project-weekly-season-system):
--   매주 시즌 + 커뮤니티 투표(1인 1표) 기반을 위해 일반 사용자도 Supabase Auth
--   쿠키 세션으로 통합. 그 1단계로 genesis_applications를 auth.users에 FK로 연결.
--   현재는 user_id 없이 email 문자열 ilike 매칭으로만 신원을 연결하고 있음.
--
-- 이 마이그레이션이 하는 것 (RLS는 포함 안 함 — Phase 5에서 별도, 아래 주의):
--   1. user_id uuid (nullable) -> auth.users(id) FK, ON DELETE SET NULL
--   2. user_id 조회 인덱스
--   3. 중복 신청 방지: 한 시즌에 한 user는 1신청 (부분 유일 인덱스)
--
-- 왜 nullable + 부분 유일 인덱스인가:
--   * 시즌 0 기존 row는 auth 계정이 없어 user_id=NULL. 첫 매직링크 로그인 시
--     email 매칭으로 backfill (Phase 6). 그때까지 NULL 허용 필요.
--   * UNIQUE(season_id, user_id)를 WHERE user_id IS NOT NULL 부분 인덱스로 만들어
--     레거시 NULL row끼리 충돌 없음. 신규 신청(auth 필수, Phase 3)은 항상 user_id
--     세팅 -> 1인 1시즌 1신청 강제.
--
-- 의도적으로 하지 않는 것:
--   * UNIQUE(season_id, email) — 시즌 0에 동일 email 중복 row가 이미 있을 수 있어
--     (apply에 email 유일성 없었음) 추가 시 실패 위험. 중복 점검 후 별도 결정.
--   * RLS ENABLE — admin은 createSupabaseServer(쿠키), apply/cron/profile은
--     service-role, 일부 anon 경로 혼재. 정책 없이 켜면 admin/apply가 깨짐.
--     Phase 5에서 reader 전수감사 후 정책과 함께 ENABLE.
--
-- 옥소보 supabase_column_policy: ADD-only, 멱등(IF EXISTS/IF NOT EXISTS).
-- ===========================================================================

BEGIN;

-- 1. user_id 컬럼 (nullable)
ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- 2. auth.users FK — 멱등(DROP IF EXISTS + ADD, 기존 status_check 패턴과 동일).
--    ON DELETE SET NULL: auth 계정이 삭제돼도 신청 이력 row는 보존, 링크만 해제.
ALTER TABLE public.genesis_applications
  DROP CONSTRAINT IF EXISTS genesis_applications_user_id_fkey;

ALTER TABLE public.genesis_applications
  ADD CONSTRAINT genesis_applications_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. user_id 조회 인덱스 (profile/RLS에서 user_id로 자기 신청 조회)
CREATE INDEX IF NOT EXISTS genesis_applications_user_id_idx
  ON public.genesis_applications(user_id);

-- 4. 중복 신청 방지 — 한 시즌에 한 user는 1신청만 (user_id 있는 경우)
CREATE UNIQUE INDEX IF NOT EXISTS genesis_applications_season_user_uniq
  ON public.genesis_applications(season_id, user_id)
  WHERE user_id IS NOT NULL;

COMMIT;

-- ===========================================================================
-- Verification (COMMIT 후 별도 실행)
-- ===========================================================================

-- 1) user_id 컬럼 메타 — 기대: 1 row, uuid, nullable=YES
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'genesis_applications'
  AND column_name = 'user_id';

-- 2) FK 확인 — 기대: 1 row, auth.users 참조 + ON DELETE SET NULL
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.genesis_applications'::regclass
  AND conname = 'genesis_applications_user_id_fkey';

-- 3) 인덱스 확인 — 기대: 조회 인덱스 + 부분 유일 인덱스 (+ 기존 인덱스/PK)
--    * 이 쿼리가 '23505 핸들러' 미스터리의 정답: email 유일 인덱스가 여기
--      보이면 라이브, 안 보이면 23505는 방어/비활성 코드.
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'genesis_applications'
ORDER BY indexname;

-- 4) 시즌 0 user_id 분포 — 기대: 전부 NULL (Phase 6 backfill 전)
SELECT season_id, COUNT(*) AS n, COUNT(user_id) AS with_user_id
FROM public.genesis_applications
GROUP BY season_id
ORDER BY season_id;

-- 5) (참고) 시즌별 중복 email 점검 — UNIQUE(season_id, email) 추가 가능 여부 판단용.
--    0 rows면 안전하게 추가 가능, 있으면 정리 후 결정.
SELECT season_id, lower(email) AS email_norm, COUNT(*) AS dup
FROM public.genesis_applications
GROUP BY season_id, lower(email)
HAVING COUNT(*) > 1
ORDER BY dup DESC;
