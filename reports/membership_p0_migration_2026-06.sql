-- ===========================================================================
-- OXXOVO 멤버십 P0 -- 스키마 마이그레이션 (2026-06-14)
-- ===========================================================================
-- Run in Supabase SQL Editor (전체 한 블록). 멱등(IF NOT EXISTS / DROP+ADD), ASCII-only.
-- DO $$ 블록 없음 (Supabase 42601 dollar-quote 함정 회피).
--
-- 범위: 멤버십 "참가권" 축의 스키마만. lib/membership.ts(P1) / founding 청구(P2) /
--   /apply 게이트(P3) / Stripe 구독(P4)은 별도 단계. 이 파일은 컬럼+카운터+config 키만.
--
-- *** 직교 2축 (섞지 말 것) ***
--   membership_tier = 참가권(결제). 이 마이그가 신설. general / creator.
--   partner_tier    = 개설권(실적). 기존(member_tier_config FK). 무관, 동시 보유 가능.
--
-- *** 단일 진실원 ***
--   is_founding_creator 컬럼 안 둠 -> founding_creator_number IS NOT NULL 로 파생.
--   게이트 만료 판정 = membership_status='active' AND (expires_at IS NULL OR now<expires_at).
--
-- *** 하드코딩 금지 ***
--   가격/무료정원/무료개월/게이트는 전부 platform_config 값. 코드/스키마에 숫자 박지 않음.
--   참가비는 platform_config 아님 -> seasons.entry_fee(시즌별, 시즌0=0).
-- ===========================================================================

BEGIN;

-- ===========================================================================
-- 1. profiles -- 멤버십 컬럼 8종 (ADD-only, 멱등)
-- ===========================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS membership_tier         TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS membership_status       TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS membership_source       TEXT,
  ADD COLUMN IF NOT EXISTS membership_started_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS membership_expires_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS founding_creator_number INTEGER,
  ADD COLUMN IF NOT EXISTS stripe_customer_id      TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT;

-- 1a. membership_tier 값 체계: general(로그인=일반) / creator(참가권 보유)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_membership_tier_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_membership_tier_chk
    CHECK (membership_tier IN ('general', 'creator'));

-- 1b. membership_status 값 체계: none/active/past_due/canceled
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_membership_status_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_membership_status_chk
    CHECK (membership_status IN ('none', 'active', 'past_due', 'canceled'));

-- 1c. membership_source: founding_free / paid (NULL 허용 = 멤버십 없음)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_membership_source_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_membership_source_chk
    CHECK (membership_source IS NULL OR membership_source IN ('founding_free', 'paid'));

-- 1d. founding_creator_number: 선착순 서수. UNIQUE(중복 서수 금지) + 양수.
--     NULL = 비파운딩(유료/일반). UNIQUE 는 NULL 다중 허용이라 비파운딩 다수 OK.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_founding_creator_number_key;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_founding_creator_number_key UNIQUE (founding_creator_number);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_founding_creator_number_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_founding_creator_number_chk
    CHECK (founding_creator_number IS NULL OR founding_creator_number >= 1);

-- ===========================================================================
-- 2. membership_founding_counter -- 선착순 100 동시성 안전 카운터
-- ===========================================================================
-- 선착순 = race. sequence 는 cap 을 원자적으로 못 막음 -> 단일 행 + 조건부 UPDATE.
-- 청구(서버, P2): UPDATE ... SET claimed=claimed+1 WHERE id=1 AND claimed<$cap RETURNING claimed
--   단일 statement = 행잠금으로 동시청구 직렬화. race-safe + gap-free + cap 원자보장.
--   0행 반환(NULL) = 정원 마감 -> 유료 경로. cap 은 platform_config 에서 주입(하드코딩 X).
CREATE TABLE IF NOT EXISTS public.membership_founding_counter (
  id      INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  claimed INTEGER NOT NULL DEFAULT 0 CHECK (claimed >= 0)
);

INSERT INTO public.membership_founding_counter (id, claimed)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- 2a. server-only: RLS ENABLE + REVOKE + service_role 전용 GRANT
--     청구는 createSupabaseAdmin(service_role)로만. anon/authenticated 접근 0.
ALTER TABLE public.membership_founding_counter ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.membership_founding_counter FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.membership_founding_counter TO service_role;

-- ===========================================================================
-- 3. platform_config -- 멤버십 키 5종 (전부 변동값, ON CONFLICT DO NOTHING)
-- ===========================================================================
-- 갱신/구독 관련 키(billing_interval, renewal_notice_days)는 P4(Stripe 구독)에서 추가.
-- P0 는 분류/게이트/founding 에 필요한 5개만. 기존 값 안 덮음(DO NOTHING).
INSERT INTO public.platform_config (key, value, value_type, description)
VALUES
  ('membership_enabled', 'false', 'bool',
   'Master switch for membership surfaces. false = dark launch (no /membership, apply gate off, claims refused).'),
  ('membership_creator_price_usd', '19.99', 'decimal',
   'Creator membership monthly subscription price (USD). Variable; billed via Stripe subscription (P4).'),
  ('membership_founding_free_count', '100', 'int',
   'Founding Creator quota. First N creator signups get founding_free membership. Atomic cap in membership_founding_counter.'),
  ('membership_founding_free_months', '12', 'int',
   'Founding Creator free period in months. expires_at = started_at + this. After expiry: auto-renew (if card) or downgrade to general.'),
  ('membership_required_for_apply', 'true', 'bool',
   'If true, /apply requires an active creator membership (plus the season entry_fee, which is 0 for season 0).')
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ===========================================================================
-- Verification (COMMIT 후 별도 실행)
-- ===========================================================================
-- 1) profiles 멤버십 컬럼 8종
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='profiles'
  AND column_name IN (
    'membership_tier','membership_status','membership_source',
    'membership_started_at','membership_expires_at',
    'founding_creator_number','stripe_customer_id','stripe_subscription_id'
  )
ORDER BY column_name;

-- 2) profiles 멤버십 제약 (tier/status/source CHECK + founding UNIQUE+CHECK)
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND conname IN (
    'profiles_membership_tier_chk','profiles_membership_status_chk',
    'profiles_membership_source_chk','profiles_founding_creator_number_key',
    'profiles_founding_creator_number_chk'
  )
ORDER BY conname;

-- 3) 카운터 테이블 + 시드 행 (claimed=0)
SELECT id, claimed FROM public.membership_founding_counter;

-- 4) 카운터 GRANT -- service_role 만 (anon/authenticated 없어야 함)
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name='membership_founding_counter'
ORDER BY grantee, privilege_type;

-- 5) platform_config 멤버십 키 5종
SELECT key, value, value_type
FROM public.platform_config
WHERE key LIKE 'membership_%'
ORDER BY key;
