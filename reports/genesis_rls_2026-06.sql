-- OXXOVO 신원 통합 Phase 5 — genesis_applications RLS (2026-06-04)
-- ===========================================================================
-- ⚠️ 가장 민감한 마이그레이션. 잘못 켜면 admin/apply/정원 카운터가 깨짐.
--    반드시 STEP 0 pre-flight를 먼저 실행해 결과를 확인한 뒤 STEP 1~로 진행.
--    리허설/스테이징에서 먼저 검증 권장. 롤백은 파일 맨 끝.
--
-- 배경: 현재 genesis_applications는 RLS가 꺼져 있어 publishable(anon) 키로
--   PostgREST 직접 조회가 가능 — 데이터 노출. RLS를 켜서 닫되, 기존 reader를
--   깨지 않도록 정책을 함께 건다.
--
-- 현재 reader 맵 (코드 audit):
--   * apply route / profile actions / email cron → createSupabaseAdmin
--     (service_role) → RLS 자동 bypass. 영향 없음.
--   * admin 페이지/액션 → createSupabaseServer (쿠키, role=authenticated,
--     admin 유저) → is_admin() 정책 필요.
--   * getActiveApplicationCount → anon 클라이언트로 rpc('get_active_application_count')
--     → 이 함수가 SECURITY DEFINER가 아니면 RLS 후 0 반환 = 정원 로직 붕괴.
--     STEP 0에서 반드시 확인.
-- ===========================================================================

-- ===========================================================================
-- STEP 0 — PRE-FLIGHT (먼저 실행, 결과 확인 후에만 STEP 1~ 진행)
-- ===========================================================================

-- 0a) genesis_applications를 읽는 함수가 SECURITY DEFINER인지 확인.
--     get_active_application_count, get_*  등. prosecdef=true 여야 anon RPC가
--     RLS를 우회해 정상 카운트. false면 STEP 4에서 SECURITY DEFINER로 전환 필요.
SELECT p.proname, p.prosecdef AS is_security_definer,
       pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('get_active_application_count', 'apply_season_recommendations')
ORDER BY p.proname;

-- 0b) is_admin() 존재 여부 (STEP 1에서 CREATE OR REPLACE 하므로 참고용).
SELECT proname, prosecdef
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'is_admin';

-- 0c) profiles 테이블/컬럼 확인 (is_admin 의존). 기대: id, role 존재.
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='profiles' AND column_name IN ('id','role');

-- 0d) 현재 RLS 상태 — 기대: relrowsecurity=false (아직 꺼짐)
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class WHERE relname = 'genesis_applications';

-- ===========================================================================
-- STEP 1 — is_admin() 헬퍼 (SECURITY DEFINER, profiles 기준)
-- ===========================================================================
-- SECURITY DEFINER로 두어 정책이 profiles의 RLS를 재귀 트리거하지 않게 함.
-- search_path 고정은 SECURITY DEFINER 함수의 보안 표준.
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

-- ===========================================================================
-- STEP 2 — 정책 (멱등: DROP IF EXISTS + CREATE)
-- ===========================================================================
-- service_role은 모든 정책을 bypass하므로 별도 정책 불필요(apply/profile/cron).

-- admin: 전체 권한 (admin 페이지/액션의 createSupabaseServer 읽기·쓰기).
DROP POLICY IF EXISTS genesis_admin_all ON public.genesis_applications;
CREATE POLICY genesis_admin_all ON public.genesis_applications
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- owner: 본인 신청 row 읽기 (Phase 4b/커뮤니티 투표 대비 + 방어).
--   쓰기는 현재 service_role 액션이 담당하므로 SELECT만 부여.
DROP POLICY IF EXISTS genesis_owner_select ON public.genesis_applications;
CREATE POLICY genesis_owner_select ON public.genesis_applications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- anon: 정책 없음 = 직접 접근 차단(노출 닫힘). SECURITY DEFINER RPC만 허용.

-- ===========================================================================
-- STEP 3 — RLS ENABLE
-- ===========================================================================
-- ⚠️ STEP 0a에서 get_active_application_count.prosecdef=true 확인 후 진행.
--    false였다면 STEP 4를 먼저 실행.
ALTER TABLE public.genesis_applications ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- STEP 4 — (조건부) anon RPC를 SECURITY DEFINER로 — STEP 0a가 false일 때만
-- ===========================================================================
-- get_active_application_count가 SECURITY DEFINER가 아니면 RLS 후 0을 반환함.
-- 아래를 STEP 0a의 실제 args로 맞춰 주석 해제 후 실행. (서명 확인 필수)
--
-- ALTER FUNCTION public.get_active_application_count(text) SECURITY DEFINER;
-- ALTER FUNCTION public.get_active_application_count(text) SET search_path = public;

-- ===========================================================================
-- Verification (ENABLE 후 실행)
-- ===========================================================================

-- 1) RLS on + 정책 2개 확인
SELECT relname, relrowsecurity FROM pg_class WHERE relname='genesis_applications';
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname='public' AND tablename='genesis_applications'
ORDER BY policyname;

-- 2) 정원 카운터 무결성 — anon RPC가 여전히 실제 수를 반환하는지 (0 함정 점검).
--    기대: 시즌0 실제 신청 수와 일치 (RLS 후 0이면 STEP 4 필요).
SELECT public.get_active_application_count('season_0') AS active_count;

-- 3) (선택) admin 세션으로 admin 페이지가 row를 보는지는 실제 /admin에서 확인.

-- ===========================================================================
-- ROLLBACK (admin/apply가 깨질 경우 즉시)
-- ===========================================================================
-- ALTER TABLE public.genesis_applications DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS genesis_admin_all  ON public.genesis_applications;
-- DROP POLICY IF EXISTS genesis_owner_select ON public.genesis_applications;
