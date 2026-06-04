-- OXXOVO 신원 통합 Phase 6 — 시즌0 기존 신청 user_id backfill (2026-06-04)
-- ===========================================================================
-- 기존 genesis_applications는 email만 있고 user_id=NULL. auth.users와 email로
-- 매칭해 user_id를 채운다. 두 경로:
--   1. link_user_applications() 함수 — 매직링크 로그인 직후 콜백이 호출(자동,
--      앞으로의 첫 로그인마다). app/auth/callback/route.ts에서 rpc 호출.
--   2. 벌크 backfill — 이미 auth 계정이 있는 사용자(예: admin/테스트) 일괄.
--
-- 중복 안전성: UNIQUE(season_id, user_id) (Phase 1) 때문에 한 (시즌, user)에
--   여러 row가 있으면(시즌0 동일 email 중복 — Phase 1 verification #5) 그중
--   가장 이른 1건만 link, 나머지는 NULL 유지(수동 검토 대상). 그래서 unique
--   위반 없이 멱등.
--
-- 의존: Phase 1(user_id 컬럼) 적용 후. Phase 5(RLS)와 순서 무관(둘 다 bypass).
-- ===========================================================================

-- ===========================================================================
-- STEP 0 — 사전 점검 (실행해 결과 확인)
-- ===========================================================================
-- 0a) 아직 link 안 된 row 수
SELECT COUNT(*) AS unlinked_rows
FROM public.genesis_applications WHERE user_id IS NULL;

-- 0b) email 매칭되는 auth 계정이 있어 link 가능한 row 수
SELECT COUNT(*) AS linkable_rows
FROM public.genesis_applications g
JOIN auth.users u ON lower(u.email) = lower(g.email)
WHERE g.user_id IS NULL;

-- 0c) 같은 (시즌, user)에 중복 row — link 시 1건만 채워지고 나머지는 남음
SELECT g.season_id, lower(g.email) AS email, COUNT(*) AS rows_for_user
FROM public.genesis_applications g
JOIN auth.users u ON lower(u.email) = lower(g.email)
WHERE g.user_id IS NULL
GROUP BY g.season_id, lower(g.email)
HAVING COUNT(*) > 1
ORDER BY rows_for_user DESC;

-- ===========================================================================
-- STEP 1 — link_user_applications() : 로그인한 본인 신청 자동 연결
-- ===========================================================================
-- 콜백(app/auth/callback)에서 로그인 직후 호출. auth.uid()/auth 이메일 기준.
-- SECURITY DEFINER: RLS(Phase 5) 무관하게 update. 멱등(user_id IS NULL만).
-- 중복 시즌은 가장 이른 1건만 연결(UNIQUE 위반 회피).
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

-- authenticated 역할이 호출 가능하게 (콜백은 사용자 세션으로 rpc 호출).
GRANT EXECUTE ON FUNCTION public.link_user_applications() TO authenticated;

-- ===========================================================================
-- STEP 2 — 벌크 backfill : 이미 auth 계정이 있는 사용자 일괄 연결
-- ===========================================================================
-- 중복 (시즌, user)는 가장 이른 1건만. 멱등(user_id IS NULL만 대상).
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
-- Verification (STEP 2 후 실행)
-- ===========================================================================
-- 1) 남은 unlinked 수 (auth 계정 없는 사용자 + 중복으로 보류된 row)
SELECT COUNT(*) AS still_unlinked
FROM public.genesis_applications WHERE user_id IS NULL;

-- 2) 시즌별 link 현황
SELECT season_id, COUNT(*) AS n, COUNT(user_id) AS linked
FROM public.genesis_applications
GROUP BY season_id ORDER BY season_id;

-- 3) UNIQUE(season_id,user_id) 위반 없음 재확인 — 기대: 0 rows
SELECT season_id, user_id, COUNT(*)
FROM public.genesis_applications
WHERE user_id IS NOT NULL
GROUP BY season_id, user_id
HAVING COUNT(*) > 1;
