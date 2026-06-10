-- OXXOVO 머지 트레인 배포 통합 마이그레이션 (2026-06-10)
-- ===========================================================================
-- Run in Supabase SQL Editor (전체 파일을 한 블록으로 실행).
--
-- 이 파일 하나만 실행하면 됨. 2026-05 작업(status/scoring/뷰)은 이미 라이브로
-- 확인되어 제외. 멱등(IF NOT EXISTS / ON CONFLICT / CREATE OR REPLACE / DROP+ADD)
-- 이라 이미 적용된 부분은 자동 skip. ASCII-only.
--
-- 포함:
--   A. 컬럼 추가 (멱등): genesis_applications.award_override_reason,
--      seasons.prize_funding_mode (+CHECK +platform_config 기본값)
--   B. 인증 1: email 전역 유일 인덱스 -> 시즌별 유일 (매주 재신청 블로커 제거)
--   C. 인증 2: user_id backfill (link 함수 + 벌크 연결)
--   D. 인증 3: genesis_applications RLS (is_admin + 정책 + 정원함수 definer + ENABLE)
--
-- 제외(의존/스위치):
--   - partner_tournaments.processing_fees (테이블이 member_hosted 그룹 의존)
--   - seasons_public 뷰 host_type 노출 (member_hosted host_type 컬럼 의존 -> 후속)
--   - studio / partner 로직 마이그 (스위치 OFF, 스위치 ON 시점 실행)
--
-- RLS 안전장치: get_active_application_count 를 무조건 SECURITY DEFINER 로 설정
--   (STEP 4 자동 적용). 따라서 STEP 0a 결과와 무관하게 RLS ENABLE 후에도 정원
--   카운터가 0으로 깨지지 않음. STEP 0a 결과는 아래 참고용으로 같이 출력됨.
-- ===========================================================================

-- ===========================================================================
-- STEP 0a (참고 출력) -- 정원함수가 원래 SECURITY DEFINER였는지 기록용.
--   아래 트랜잭션이 무조건 definer 로 만들므로 결과와 무관하게 안전.
-- ===========================================================================
SELECT p.proname, p.prosecdef AS is_security_definer,
       pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('get_active_application_count', 'apply_season_recommendations')
ORDER BY p.proname;

BEGIN;

-- ===========================================================================
-- A. 컬럼 추가 (멱등)
-- ===========================================================================

-- A-1. genesis_applications.award_override_reason
--   본선 수상 admin override 사유 기록 (score 불변, 결정 근거만). nullable.
ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS award_override_reason TEXT;

-- A-2. seasons.prize_funding_mode (entry_pool / partner_guaranteed)
--   member_hosted 대비 컬럼. 기본 entry_pool. CHECK 멱등(이름 고정 DROP+ADD).
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS prize_funding_mode TEXT NOT NULL DEFAULT 'entry_pool';

ALTER TABLE public.seasons
  DROP CONSTRAINT IF EXISTS seasons_prize_funding_mode_check;
ALTER TABLE public.seasons
  ADD CONSTRAINT seasons_prize_funding_mode_check
    CHECK (prize_funding_mode IN ('entry_pool', 'partner_guaranteed'));

INSERT INTO public.platform_config (key, value, value_type, description)
VALUES (
  'partner_default_prize_funding_mode',
  'entry_pool',
  'text',
  '파트너 토너먼트 기본 상금 재원 방식 (entry_pool / partner_guaranteed)'
)
ON CONFLICT (key) DO NOTHING;

-- ===========================================================================
-- B. 인증 1 -- email 유일성 교체 (매주 시즌 재신청 블로커 제거)
-- ===========================================================================
DROP INDEX IF EXISTS public.genesis_applications_email_unique;

CREATE UNIQUE INDEX IF NOT EXISTS genesis_applications_season_email_uniq
  ON public.genesis_applications (season_id, lower(email));

-- ===========================================================================
-- C. 인증 2 -- user_id backfill
-- ===========================================================================

-- C-1. link 함수 (매직링크 로그인 콜백이 rpc 호출). SECURITY DEFINER, 멱등.
CREATE OR REPLACE FUNCTION public.link_user_applications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_email text;
  v_linked integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 0;
  END IF;

  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_uid;
  IF v_email IS NULL THEN
    RETURN 0;
  END IF;

  WITH ranked AS (
    SELECT g.id,
           row_number() OVER (PARTITION BY g.season_id ORDER BY g.created_at) AS rn
    FROM public.genesis_applications g
    WHERE g.user_id IS NULL
      AND lower(g.email) = v_email
  )
  UPDATE public.genesis_applications g
  SET user_id = v_uid
  FROM ranked r
  WHERE g.id = r.id AND r.rn = 1;

  GET DIAGNOSTICS v_linked = ROW_COUNT;
  RETURN v_linked;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_user_applications() TO authenticated;

-- C-2. 벌크 backfill -- 이미 auth 계정이 있는 사용자 일괄 연결 (멱등, NULL만).
WITH ranked AS (
  SELECT g.id, u.id AS uid,
         row_number() OVER (PARTITION BY g.season_id, u.id ORDER BY g.created_at) AS rn
  FROM public.genesis_applications g
  JOIN auth.users u ON lower(u.email) = lower(g.email)
  WHERE g.user_id IS NULL
)
UPDATE public.genesis_applications g
SET user_id = r.uid
FROM ranked r
WHERE g.id = r.id AND r.rn = 1;

-- ===========================================================================
-- D. 인증 3 -- genesis_applications RLS
-- ===========================================================================

-- D-1. is_admin() 헬퍼 (SECURITY DEFINER, profiles 기준, search_path 고정).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- D-2. 정책 (멱등: DROP IF EXISTS + CREATE). service_role 은 자동 bypass.
DROP POLICY IF EXISTS genesis_admin_all ON public.genesis_applications;
CREATE POLICY genesis_admin_all ON public.genesis_applications
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS genesis_owner_select ON public.genesis_applications;
CREATE POLICY genesis_owner_select ON public.genesis_applications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- D-3. (STEP 4 자동) 정원 RPC를 무조건 SECURITY DEFINER 로. 시그니처는 동적
--   조회 -> 함수가 없으면 루프 0회(no-op), 있으면 모든 오버로드에 적용. 멱등.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_active_application_count'
  LOOP
    EXECUTE 'ALTER FUNCTION ' || r.sig || ' SECURITY DEFINER';
    EXECUTE 'ALTER FUNCTION ' || r.sig || ' SET search_path = public';
  END LOOP;
END $$;

-- D-4. RLS ENABLE (정원함수 definer 보장 후라 안전).
ALTER TABLE public.genesis_applications ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ===========================================================================
-- Verification (COMMIT 후 자동 실행 -- 결과 확인)
-- ===========================================================================

-- V1) 컬럼 -- award_override_reason / prize_funding_mode
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ( (table_name = 'genesis_applications' AND column_name = 'award_override_reason')
     OR (table_name = 'seasons'              AND column_name = 'prize_funding_mode') )
ORDER BY table_name, column_name;

-- V2) email 인덱스 -- email_unique 없음, season_email_uniq 있음
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'genesis_applications'
  AND indexname IN ('genesis_applications_email_unique',
                    'genesis_applications_season_email_uniq')
ORDER BY indexname;

-- V3) backfill -- 남은 unlinked 수 + 시즌별 link 현황
SELECT COUNT(*) AS still_unlinked
FROM public.genesis_applications WHERE user_id IS NULL;
SELECT season_id, COUNT(*) AS n, COUNT(user_id) AS linked
FROM public.genesis_applications
GROUP BY season_id ORDER BY season_id;

-- V4) 정원함수가 SECURITY DEFINER 가 됐는지 (true 여야 RLS 후 카운트 정상)
SELECT p.proname, p.prosecdef AS is_security_definer
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'get_active_application_count';

-- V5) RLS on + 정책 2개
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'genesis_applications';
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'genesis_applications'
ORDER BY policyname;

-- V6) 정원 카운터 무결성 -- RLS 후에도 실제 수 반환해야 (0이면 문제)
SELECT public.get_active_application_count('season_0') AS active_count;

-- ===========================================================================
-- ROLLBACK (admin/apply 가 깨질 경우 즉시)
-- ===========================================================================
-- ALTER TABLE public.genesis_applications DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS genesis_admin_all    ON public.genesis_applications;
-- DROP POLICY IF EXISTS genesis_owner_select ON public.genesis_applications;
