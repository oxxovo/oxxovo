-- OXXOVO Member Hosted Tournament — 상금 재원 방식 + 결제 실비 (2026-06-06)
-- ===========================================================================
-- Run in Supabase SQL Editor (전체 파일을 한 블록으로 실행).
-- PR #3 후속 수정 2건의 스키마 변경.
--
-- 1. seasons.prize_funding_mode  (상금 재원 방식)
--    'entry_pool'         = 참가비 풀 기반. 파트너 입금 0, escrow not_required.
--    'partner_guaranteed' = 파트너 보장 상금. 해당 금액 escrow pending -> paid 필수.
--    기본값은 platform_config.partner_default_prize_funding_mode 로 동적 제어
--    (컬럼 DB default 는 안전 fallback). 공개 가드는 escrow 상태로 판정하므로
--    (not_required/paid 면 공개) 모드별 분기 없이 자동으로 보장 상금만 paid 요구.
--
-- 2. partner_tournaments.processing_fees  (결제 처리 실비)
--    카드/ACH/출금 수수료 등. 정산 시점 실측값을 기록(하드코딩 금지).
--    정산: host_payout = total_revenue - commission - processing_fees - prize_paid.
--
-- 옥소보 정책: ADD-only, 멱등(IF NOT EXISTS / ON CONFLICT). ASCII-only.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. seasons.prize_funding_mode
-- ---------------------------------------------------------------------------
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS prize_funding_mode TEXT NOT NULL DEFAULT 'entry_pool';

-- 멱등 CHECK (이름 고정 DROP + ADD)
ALTER TABLE public.seasons
  DROP CONSTRAINT IF EXISTS seasons_prize_funding_mode_check;
ALTER TABLE public.seasons
  ADD CONSTRAINT seasons_prize_funding_mode_check
    CHECK (prize_funding_mode IN ('entry_pool', 'partner_guaranteed'));

-- 플랫폼 기본 재원 방식 (앱이 /host/new 기본 선택값으로 동적 조회).
INSERT INTO public.platform_config (key, value, value_type, description)
VALUES (
  'partner_default_prize_funding_mode',
  'entry_pool',
  'text',
  '파트너 토너먼트 기본 상금 재원 방식 (entry_pool / partner_guaranteed)'
)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. partner_tournaments.processing_fees
-- ---------------------------------------------------------------------------
ALTER TABLE public.partner_tournaments
  ADD COLUMN IF NOT EXISTS processing_fees NUMERIC NOT NULL DEFAULT 0;

COMMIT;

-- ===========================================================================
-- Verification (COMMIT 후 별도 실행)
-- ===========================================================================

-- 1) prize_funding_mode 컬럼 + default — 기대: text, NOT NULL, default 'entry_pool'
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'seasons'
  AND column_name = 'prize_funding_mode';

-- 2) prize_funding_mode CHECK — 기대: 2값
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.seasons'::regclass
  AND conname = 'seasons_prize_funding_mode_check';

-- 3) 기존 시즌 분포 — 기대: 전부 entry_pool (season_0 official 포함)
SELECT prize_funding_mode, COUNT(*) AS n
FROM public.seasons GROUP BY prize_funding_mode ORDER BY prize_funding_mode;

-- 4) platform_config 신규 키 — 기대: 1 row, entry_pool
SELECT key, value, value_type FROM public.platform_config
WHERE key = 'partner_default_prize_funding_mode';

-- 5) processing_fees 컬럼 — 기대: numeric, NOT NULL, default 0
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'partner_tournaments'
  AND column_name = 'processing_fees';
