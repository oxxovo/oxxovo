-- ===========================================================================
-- OXXOVO SMS opt-in (A2P 10DLC) -- profiles 스키마 마이그레이션 (2026-06-23)
-- ===========================================================================
-- Run in Supabase SQL Editor (전체 한 블록). 멱등(ADD COLUMN IF NOT EXISTS).
-- DO $$ 블록 없음. ASCII-only (=== 구분선만).
--
-- 목적: Twilio A2P Campaign 등록에 필요한 SMS 수신 동의(opt-in)를 /profile 에서
--   수집하고, TCPA 가 요구하는 "동의 증거"를 보관한다.
--     phone           : 사용자 전화번호 (선택. 동의 시 필수).
--     sms_opt_in       : 현재 수신 동의 여부 (STOP 시 false).
--     sms_consent_at   : 마지막 opt-in 시각 (동의 증거).
--     sms_consent_ip   : opt-in 당시 IP (동의 증거).
--     sms_consent_text : opt-in 당시 화면에 표시된 고지 문구 스냅샷 (감사).
--     sms_opt_out_at   : 마지막 opt-out(STOP) 시각.
--
-- TCPA 원칙: 동의는 서비스 이용 조건이 될 수 없다 -> 전화번호/동의는 전부 선택.
-- 발신 파이프라인(Twilio)은 별개 후속 단계. 이 마이그는 동의 수집/보관만.
-- ===========================================================================

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone            TEXT,
  ADD COLUMN IF NOT EXISTS sms_opt_in       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_consent_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sms_consent_ip   TEXT,
  ADD COLUMN IF NOT EXISTS sms_consent_text TEXT,
  ADD COLUMN IF NOT EXISTS sms_opt_out_at   TIMESTAMPTZ;

COMMIT;

-- ===========================================================================
-- 검증 (COMMIT 후 개별 실행)
-- ===========================================================================
-- 6a) 컬럼 6종 존재 확인 -- 기대: phone/sms_opt_in/sms_consent_at/sms_consent_ip/
--     sms_consent_text/sms_opt_out_at
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='profiles'
--     AND column_name LIKE 'sms\_%' ESCAPE '\' OR column_name='phone'
--   ORDER BY column_name;

-- 6b) 현재 opt-in 분포 -- 등록 전 기대: 전부 false
-- SELECT sms_opt_in, count(*) FROM public.profiles GROUP BY sms_opt_in;

-- ===========================================================================
-- 롤백 (필요 시) -- 동의 증거를 지우므로 신중히.
-- ===========================================================================
-- ALTER TABLE public.profiles
--   DROP COLUMN IF EXISTS phone,
--   DROP COLUMN IF EXISTS sms_opt_in,
--   DROP COLUMN IF EXISTS sms_consent_at,
--   DROP COLUMN IF EXISTS sms_consent_ip,
--   DROP COLUMN IF EXISTS sms_consent_text,
--   DROP COLUMN IF EXISTS sms_opt_out_at;
