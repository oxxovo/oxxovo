-- ===========================================================================
-- OXXOVO 멀티 admin (매니저) -- 권한 스키마 마이그레이션 (2026-06-23)
-- ===========================================================================
-- Run in Supabase SQL Editor (전체 한 블록). 멱등(DROP+ADD / CREATE OR REPLACE /
-- DROP POLICY IF EXISTS). DO $$ 블록 없음 (Supabase 42601 dollar-quote 함정 회피).
-- ASCII-only (박스 문자 금지, === 구분선만).
--
-- 범위: profiles.role 값 체계를 user/manager/admin 3단계로 확정하고, 매니저가
--   "조회" 가능한 테이블에 is_staff() 기반 SELECT 정책을 추가한다. 앱 레이어
--   가드(requireStaff/requireSuperAdmin)는 별도 단계(lib/admin-auth.ts).
--
-- *** 2축 권한 모델 (섞지 말 것) ***
--   role        = 운영진 권한. user(기본) / manager(조회·메시지·promo) /
--                 admin(슈퍼=TK, 전권). is_admin()=admin만, is_staff()=admin OR manager.
--   partner_tier / membership_tier = 무관(참가권·개설권). 이 마이그가 안 건드림.
--
-- *** 방어선 2중 ***
--   매니저는 개인정보(신청자 contacts)를 다룬다. 앱 가드 버그 시 노출을 막기 위해
--   RLS 백스톱을 유지한다. 매니저 read 도 service-role 우회 대신 is_staff() RLS
--   정책으로 인가한다. 쓰기는 super 전용 + service-role 액션(앱 게이트)이 담당.
--
-- *** 매니저 read 가 필요한 테이블 (cookie 클라이언트로 읽음) ***
--   genesis_applications : 신청 조회 (admin: FOR ALL is_admin 유지 + staff SELECT 추가)
--   scoring_results      : 신청 점수 동반 표시 (admin_read -> staff_read 교체)
--   promo_videos         : promo 조회 (admin_read -> staff_read 교체)
--   seasons              : authenticated GRANT SELECT (RLS 무관) -> 변경 불필요
--   email_inbound_log / email_logs / messages : service-role 전용 -> 변경 불필요
-- ===========================================================================

BEGIN;

-- ===========================================================================
-- 1. profiles.role -- 값 체계 user/manager/admin 확정 (CHECK 제약)
-- ===========================================================================
-- role 컬럼은 초기 스키마부터 존재(이 파일이 신설하지 않음). 기존 일반 유저는
-- role NULL 또는 'user'. NULL 은 CHECK 를 통과하므로 기존 행을 깨지 않는다.
-- 'admin' 행(TK)도 통과. 오타 값(mgr 등)만 차단하는 방어 제약.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_chk
    CHECK (role IS NULL OR role IN ('user', 'manager', 'admin'));

-- ===========================================================================
-- 2. is_staff() 헬퍼 (SECURITY DEFINER, profiles 기준) -- admin OR manager
-- ===========================================================================
-- is_admin() 과 같은 패턴. SECURITY DEFINER + search_path 고정으로 profiles RLS
-- 재귀를 피한다. is_admin() 은 그대로 두고(슈퍼 전용 정책에서 계속 사용), 매니저
-- 포함 read 정책에서만 is_staff() 를 쓴다.
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  );
$$;

-- ===========================================================================
-- 3. genesis_applications -- 매니저 SELECT 추가 (admin FOR ALL 정책은 유지)
-- ===========================================================================
-- 기존 genesis_admin_all(FOR ALL, is_admin) = 슈퍼의 cookie 쓰기 백스톱 유지.
-- 매니저는 read 만 -> SELECT 전용 정책 추가. permissive(OR) 라 공존 OK.
DROP POLICY IF EXISTS genesis_staff_select ON public.genesis_applications;
CREATE POLICY genesis_staff_select ON public.genesis_applications
  FOR SELECT TO authenticated
  USING (public.is_staff());

-- ===========================================================================
-- 4. scoring_results -- admin_read -> staff_read (SELECT, is_staff)
-- ===========================================================================
-- is_staff() 는 admin 도 포함하므로 admin 접근 손실 없음. 쓰기 정책은 추가 금지
-- ([[project-scoring-integrity-rules]]: score 는 자동, admin 변경 불가).
DROP POLICY IF EXISTS scoring_results_admin_read ON public.scoring_results;
DROP POLICY IF EXISTS scoring_results_staff_read ON public.scoring_results;
CREATE POLICY scoring_results_staff_read ON public.scoring_results
  FOR SELECT TO authenticated
  USING (public.is_staff());

-- ===========================================================================
-- 5. promo_videos -- admin_read -> staff_read (SELECT, is_staff)
-- ===========================================================================
-- 매니저 허용 작업에 promo 포함. 생성/아카이브 쓰기는 service-role 액션 +
-- 앱 게이트(requireStaff) 담당이라 read 정책만 is_staff 로 넓힌다.
DROP POLICY IF EXISTS promo_videos_admin_read ON public.promo_videos;
DROP POLICY IF EXISTS promo_videos_staff_read ON public.promo_videos;
CREATE POLICY promo_videos_staff_read ON public.promo_videos
  FOR SELECT TO authenticated
  USING (public.is_staff());

COMMIT;

-- ===========================================================================
-- 검증 (COMMIT 후 개별 실행) -- 기대값 주석 참고
-- ===========================================================================

-- 5a) role CHECK 제약 존재 확인 -- 기대: profiles_role_chk 1행
-- SELECT conname FROM pg_constraint WHERE conname = 'profiles_role_chk';

-- 5b) is_staff() 함수 존재 + SECURITY DEFINER -- 기대: is_staff, prosecdef=true
-- SELECT proname, prosecdef FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname IN ('is_admin', 'is_staff');

-- 5c) 정책 확인 -- 기대: genesis_staff_select / scoring_results_staff_read /
--     promo_videos_staff_read 존재, scoring_results_admin_read / promo_videos_admin_read 부재
-- SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('genesis_applications', 'scoring_results', 'promo_videos')
--   ORDER BY tablename, policyname;

-- 5d) 현재 role 분포 -- 매니저 승격 전 기대: admin 1(TK), 나머지 NULL/user
-- SELECT role, count(*) FROM public.profiles GROUP BY role ORDER BY role;

-- ===========================================================================
-- 롤백 (필요 시)
-- ===========================================================================
-- BEGIN;
--   DROP POLICY IF EXISTS genesis_staff_select   ON public.genesis_applications;
--   DROP POLICY IF EXISTS scoring_results_staff_read ON public.scoring_results;
--   DROP POLICY IF EXISTS promo_videos_staff_read    ON public.promo_videos;
--   -- admin_read 정책 원복(매니저 도입 전 상태):
--   CREATE POLICY scoring_results_admin_read ON public.scoring_results
--     FOR SELECT TO authenticated USING (public.is_admin());
--   CREATE POLICY promo_videos_admin_read ON public.promo_videos
--     FOR SELECT TO authenticated USING (public.is_admin());
--   DROP FUNCTION IF EXISTS public.is_staff();
--   ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_chk;
-- COMMIT;
