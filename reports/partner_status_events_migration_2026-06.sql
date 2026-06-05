-- OXXOVO Member Hosted Tournament — partner_status_events 감사 테이블 (2026-06-05)
-- ===========================================================================
-- Run in Supabase SQL Editor (전체 파일을 한 블록으로 실행).
--
-- 배경 (TK 확정 2026-06-05):
--   파트너 suspend/복구는 "사유 필수"인데 profiles 에 사유 저장 컬럼이 없음
--   (partner_invite_note 는 초대 전용). 단일 note 컬럼은 변경 시 덮어써져 이력이
--   사라지므로, 투명성/자동화 철학에 맞춰 이벤트 소싱 감사 테이블로 결정.
--
--   profiles.partner_status 는 "현재 상태"(denormalized) 로 그대로 유지하고,
--   이 테이블이 상태 전이의 영구 로그가 됨. 사유는 이벤트마다 보존(덮어쓰기 없음).
--
-- 이 테이블이 기록하는 것:
--   invited   : admin 이 초대 (actor_id=admin, reason=초대 사유 필수)
--   eligible  : 누적 임계값 충족 자동 자격 (actor_id=NULL 시스템, reason=NULL)
--   activated : 초대 수락/약관 동의로 active 전이 (actor_id=본인 또는 NULL)
--   suspended : admin 정지 (actor_id=admin, reason 필수)
--   restored  : admin 복구 (actor_id=admin, reason 필수)
--
-- 설계 선택:
--   * user_id FK -> auth.users ON DELETE CASCADE: 계정 완전 삭제 시 이벤트도 제거.
--   * actor_id FK -> auth.users ON DELETE SET NULL, nullable: NULL = 시스템 자동.
--   * tier 는 FK 없이 TEXT 스냅샷: member_tier_config 가 바뀌어도 당시 등급명 보존.
--   * reason nullable: auto(eligible/activated) 이벤트는 사유 없음. 필수 여부는
--     애플리케이션 레이어(actions.ts)에서 이벤트별로 강제.
--   * RLS: 다른 파트너 테이블과 동일하게 service_role 전용. 정책 0개.
--
-- 옥소보 정책: ADD-only, 멱등(IF NOT EXISTS). ASCII-only.
-- ===========================================================================

BEGIN;

-- 1. 감사 테이블
CREATE TABLE IF NOT EXISTS public.partner_status_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL
                REFERENCES auth.users(id) ON DELETE CASCADE,
  event       TEXT NOT NULL
                CHECK (event IN ('invited', 'eligible', 'activated', 'suspended', 'restored')),
  reason      TEXT,
  actor_id    UUID
                REFERENCES auth.users(id) ON DELETE SET NULL,
  tier        TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 사용자별 타임라인 조회 인덱스 (최신순)
CREATE INDEX IF NOT EXISTS partner_status_events_user_idx
  ON public.partner_status_events(user_id, created_at DESC);

-- 3. RLS service_role 전용 + 정책 0개 (다른 파트너 테이블과 동일)
ALTER TABLE public.partner_status_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.partner_status_events FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.partner_status_events TO service_role;

COMMIT;

-- ===========================================================================
-- Verification (COMMIT 후 별도 실행)
-- ===========================================================================

-- 1) 컬럼 메타 — 기대: 8 컬럼
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'partner_status_events'
ORDER BY ordinal_position;

-- 2) FK 2개 — 기대: user_id(CASCADE), actor_id(SET NULL)
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.partner_status_events'::regclass AND contype = 'f';

-- 3) event CHECK — 기대: 5값
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.partner_status_events'::regclass AND contype = 'c';

-- 4) RLS + 정책 — 기대: relrowsecurity=true, 정책 0개
SELECT relrowsecurity FROM pg_class
WHERE relnamespace = 'public'::regnamespace AND relname = 'partner_status_events';
SELECT COUNT(*) AS policy_count FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'partner_status_events';

-- 5) 권한 — 기대: service_role 만
SELECT grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privs
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'partner_status_events'
  AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
GROUP BY grantee
ORDER BY grantee;
