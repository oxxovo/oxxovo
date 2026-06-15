-- ===========================================================================
-- OXXOVO 멤버십 P4a -- Stripe 구독 스키마 (2026-06-14)
-- ===========================================================================
-- Run in Supabase SQL Editor (전체 한 블록). 멱등(IF NOT EXISTS / ON CONFLICT),
-- ASCII-only, DO $$ 블록 없음(Supabase 42601 회피).
--
-- 범위: 구독 라이프사이클을 받을 스키마만. checkout(P4b) / webhook(P4c) /
--   취소+대시보드(P4d) / 알림(P4e)은 코드 단계. 이 파일은 컬럼/키/멱등테이블만.
--
-- 구독 진실원천 = webhook. expires_at = current_period_end (P1 단일 진실원 재사용).
-- 가격은 여기 없음 -> platform_config membership_creator_price_usd(P0, 변동값).
-- ===========================================================================

BEGIN;

-- ===========================================================================
-- 1. platform_config -- 구독 키 3종 (P0에서 미룬 2개 + Stripe Product)
-- ===========================================================================
INSERT INTO public.platform_config (key, value, value_type, description)
VALUES
  ('membership_billing_interval', 'month', 'text',
   'Stripe recurring interval for the creator membership (month/year). Injected into the subscription price_data.'),
  ('membership_renewal_notice_days', '7', 'int',
   'Lead time (days) for the pre-renewal / founding-expiry email. Scanned by email-tick.'),
  ('membership_stripe_product_id', '', 'text',
   'Stripe Product id (prod_...) the creator membership subscription rolls up under. TK fills after creating the Product. Empty = checkout refuses (fail closed).')
ON CONFLICT (key) DO NOTHING;

-- ===========================================================================
-- 2. profiles -- 구독 UI/알림 컬럼 2종 (ADD-only)
-- ===========================================================================
ALTER TABLE public.profiles
  -- Pre-renewal email dedupe: set when a notice is sent for the current cycle,
  -- cleared on renewal. Prevents email-tick from resending every 15 min.
  ADD COLUMN IF NOT EXISTS membership_renewal_notified_at TIMESTAMPTZ,
  -- Mirror of Stripe cancel_at_period_end (UI shows "cancels on <expires_at>").
  -- Access still granted until expires_at; status stays 'active' until deleted.
  ADD COLUMN IF NOT EXISTS membership_cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;

-- ===========================================================================
-- 3. membership_events -- webhook 멱등 + 감사 로그
-- ===========================================================================
-- credit_transactions.stripe_session_id 멱등 패턴 복제: Stripe event.id 를 PK 로
-- 두어 재전송이 중복 처리되지 않게 한다. webhook 은 처리 전 이 행을 INSERT(23505 =
-- 이미 처리됨 -> 조용히 200). user_id 는 FK 없이 평문 UUID(이벤트가 edge case 로
-- 프로필보다 먼저 와도 견고).
CREATE TABLE IF NOT EXISTS public.membership_events (
  id              TEXT PRIMARY KEY,                 -- Stripe event.id
  type            TEXT NOT NULL,                    -- e.g. customer.subscription.updated
  subscription_id TEXT,
  user_id         UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3a. server-only: RLS ENABLE + REVOKE + service_role 전용 GRANT (카운터 패턴)
ALTER TABLE public.membership_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.membership_events FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.membership_events TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ===========================================================================
-- Verification (COMMIT 후 별도 실행)
-- ===========================================================================
-- 1) platform_config 구독 키 3종 (interval/notice_days/product_id)
SELECT key, value, value_type
FROM public.platform_config
WHERE key IN (
  'membership_billing_interval',
  'membership_renewal_notice_days',
  'membership_stripe_product_id'
)
ORDER BY key;

-- 2) profiles 신규 컬럼 2종
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='profiles'
  AND column_name IN ('membership_renewal_notified_at', 'membership_cancel_at_period_end')
ORDER BY column_name;

-- 3) membership_events 컬럼
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='membership_events'
ORDER BY ordinal_position;

-- 4) membership_events GRANT -- service_role 만 (anon/authenticated 없어야 함)
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name='membership_events'
ORDER BY grantee, privilege_type;
