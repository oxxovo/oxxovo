-- OXXOVO Member Hosted Tournament — partner_tier + GRANT/RLS 보정 (2026-06-05)
-- ===========================================================================
-- Run in Supabase SQL Editor (전체 파일을 한 블록으로 실행).
--
-- 배경 (실측 inspect-partner-schema.mjs 결과):
--   TK 대표님이 파트너 인프라를 Supabase에 반영했으나 service-role 실측에서
--   2가지가 드러남:
--     1) profiles +9컬럼 중 partner_tier 만 누락 (8개는 존재).
--     2) platform_config / member_tier_config / partner_tournaments 3개 테이블이
--        service_role 에게도 "permission denied" — 테이블 GRANT 가 없음.
--        (service_role 은 RLS 를 bypass 하지만 테이블 레벨 권한은 별도로 필요.)
--
-- 이 마이그레이션이 하는 것:
--   1. profiles.partner_tier TEXT -> member_tier_config(tier) FK, ON DELETE SET NULL
--   2. 3개 테이블: RLS ENABLE + anon/authenticated/public 권한 REVOKE +
--      service_role 에만 GRANT ALL + (public/사용자) 정책 0개.
--
-- 왜 partner_tier 를 CHECK 가 아니라 FK 로:
--   하드코딩 금지 원칙. 등급 이름(bronze/silver/gold)을 CHECK 제약에 박으면
--   향후 등급 추가 시 마이그레이션이 또 필요. member_tier_config 가 등급의
--   단일 출처이므로 FK 로 참조. (FK 검증은 RLS 를 bypass 하므로 RLS ENABLE 과 무관.)
--   nullable: partner 가 아닌 일반 사용자는 NULL. tier row 삭제 시 SET NULL.
--
-- 왜 service_role 전용:
--   파트너 설정/정산 테이블은 운영 데이터. 모든 접근은 서버에서
--   createSupabaseAdmin(service_role) 으로만. anon/authenticated 는 클라이언트와
--   동일 권한이므로(server_side_anon_rls_trap) 절대 노출 금지. 정책을 두지 않고
--   RLS 만 켜면 service_role 외 모든 역할은 0 row.
--
-- 옥소보 supabase_column_policy: ADD-only, 멱등(IF EXISTS/IF NOT EXISTS).
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. profiles.partner_tier (member_tier_config FK, nullable)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS partner_tier TEXT;

-- 멱등 FK (DROP IF EXISTS + ADD). member_tier_config.tier 는 PK 이므로 참조 가능.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_partner_tier_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_partner_tier_fkey
    FOREIGN KEY (partner_tier)
    REFERENCES public.member_tier_config(tier)
    ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 2. 파트너 테이블 3종 — RLS ENABLE + service_role 전용 GRANT
--    REVOKE 를 먼저 (멱등: 권한 없으면 no-op), 그 다음 service_role 에 GRANT.
-- ---------------------------------------------------------------------------

-- 2a. platform_config (key-value 운영 파라미터)
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_config FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.platform_config TO service_role;

-- 2b. member_tier_config (등급별 정원/개설 cap)
ALTER TABLE public.member_tier_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_tier_config FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.member_tier_config TO service_role;

-- 2c. partner_tournaments (정산 추적)
ALTER TABLE public.partner_tournaments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.partner_tournaments FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.partner_tournaments TO service_role;

-- ---------------------------------------------------------------------------
-- 3. seasons.prize_pool_escrow_status 값 체계 정규화 (2026-06-05 TK 확정)
--    'none' 폐기 -> 4값 확정: not_required / pending / paid / refunded.
--    official 시즌 = not_required(escrow 불필요), partner 시즌 = pending->paid.
--    공개 가드: host_type='partner' AND escrow='paid' 일 때만 공개.
--
--    제약명을 추측하지 않음: PostgREST 로는 pg_catalog 를 못 읽어 실측 불가.
--    -> DO 블록이 DB 안에서 prize_pool_escrow_status 를 참조하는 CHECK 제약을
--       이름과 무관하게 찾아 DROP (seasons_escrow_status_check /
--       seasons_prize_pool_escrow_status_check 등 어떤 이름이든 커버).
-- ---------------------------------------------------------------------------

-- 3a. 기존 CHECK 제약 동적 DROP (이름 무관, 멱등 — 없으면 no-op)
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE ns.nspname = 'public'
      AND rel.relname = 'seasons'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%prize_pool_escrow_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.seasons DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- 3b. 레거시 'none' -> 'not_required' (현재 0건이지만 방어적/멱등)
UPDATE public.seasons
SET prize_pool_escrow_status = 'not_required'
WHERE prize_pool_escrow_status = 'none';

-- 3c. default 를 'not_required' 로 (official 시즌 기본값)
ALTER TABLE public.seasons
  ALTER COLUMN prize_pool_escrow_status SET DEFAULT 'not_required';

-- 3d. 4값 CHECK 추가 (3b 이후라 기존 행은 전부 통과)
ALTER TABLE public.seasons
  ADD CONSTRAINT seasons_prize_pool_escrow_status_check
    CHECK (prize_pool_escrow_status IN ('not_required', 'pending', 'paid', 'refunded'));

COMMIT;

-- ===========================================================================
-- Verification (COMMIT 후 별도 실행)
-- ===========================================================================

-- 1) partner_tier 컬럼 메타 — 기대: 1 row, text, nullable=YES
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'partner_tier';

-- 2) partner_tier FK 확인 — 기대: 1 row, member_tier_config 참조 + ON DELETE SET NULL
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND conname = 'profiles_partner_tier_fkey';

-- 3) RLS 상태 — 기대: 3개 테이블 모두 relrowsecurity = true
SELECT relname, relrowsecurity
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('platform_config', 'member_tier_config', 'partner_tournaments')
ORDER BY relname;

-- 4) 정책 개수 — 기대: 3개 테이블 모두 0 (public 정책 없음)
SELECT tablename, COUNT(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('platform_config', 'member_tier_config', 'partner_tournaments')
GROUP BY tablename
ORDER BY tablename;

-- 5) 테이블 권한 — 기대: grantee 가 service_role 만 (anon/authenticated 없음)
SELECT table_name, grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privs
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('platform_config', 'member_tier_config', 'partner_tournaments')
  AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;

-- 6) escrow CHECK + default — 기대: CHECK 정의에 4값, default 'not_required'
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.seasons'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) ILIKE '%prize_pool_escrow_status%';

SELECT column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'seasons'
  AND column_name = 'prize_pool_escrow_status';

-- 7) escrow 값 분포 — 기대: 'none' 0건, 나머지 4값 내에서만
SELECT prize_pool_escrow_status, COUNT(*) AS n
FROM public.seasons
GROUP BY prize_pool_escrow_status
ORDER BY prize_pool_escrow_status;

-- 6) (실행 후) service_role 실측 재확인:
--    node --env-file=.env.local scripts/inspect-partner-schema.mjs
--    -> 1~3번 테이블이 permission denied 없이 rows/columns 출력되어야 함.
