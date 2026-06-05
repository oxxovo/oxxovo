-- OXXOVO Auth Phase 6 — genesis_applications.user_id backfill (2026-06-06)
-- ===========================================================================
-- Run in Supabase SQL Editor. 발사(7/26 동결) 전 필수.
--
-- 배경:
--   Phase 1 에서 genesis_applications.user_id (auth.users FK) 를 추가했으나
--   기존 신청 데이터는 user_id=NULL (email 문자열로만 신원 연결). 이 때문에
--   파트너 자격 통계(cumulative_top50/wins) 가 실효 0. 이 마이그레이션이 email
--   기준으로 auth.users.id 를 매칭해 user_id 를 채운다.
--
--   매칭 안 되는 email(미가입자)은 NULL 유지 — 첫 매직링크 로그인 시 자동 연결.
--
-- 실측 (inspect-user-id-backfill.mjs, 2026-06-06):
--   total 1, NULL 1(100%), 매칭 1, 미가입 0, 충돌 0. (발사 전 dev 데이터)
--   ->아래 로직은 대량 실데이터에도 안전(충돌 시 자동 abort).
--
-- 안전장치:
--   * Step 0 백업 테이블(멱등, 최초 1회 스냅샷) — 롤백 근거.
--   * Step 1 충돌 사전 검증 SELECT (검토용).
--   * Step 2 DO 가드가 충돌 시 RAISE EXCEPTION 으로 UPDATE 전 abort.
--   * UPDATE 는 user_id IS NULL 만 -> 멱등(재실행 무해).
--   * 부분 유일 인덱스 genesis_applications_season_user_uniq 가 최종 방어선.
--
-- 옥소보 정책: ASCII-only, 멱등.
-- ===========================================================================


-- ===========================================================================
-- Step 0. 백업 테이블 (멱등 — 이미 있으면 SELECT 재실행 안 함 = 원본 스냅샷 보존)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.backup_genesis_user_id_20260606 AS
SELECT id, season_id, email, user_id
FROM public.genesis_applications;

-- 백업 확인 (기대: 백필 직전 user_id 상태가 그대로 보존)
SELECT count(*) AS backed_up_rows,
       count(user_id) AS had_user_id
FROM public.backup_genesis_user_id_20260606;


-- ===========================================================================
-- Step 1. 충돌 사전 검증 (UPDATE 전 반드시 실행 — 0 rows 여야 진행 가능)
--   최종 user_id = COALESCE(기존 user_id, email 매칭 id) 를 시뮬레이션해
--   (season_id, user_id) 가 2건 이상이면 = 동일 시즌 동일 유저 중복 신청.
--   rows 가 나오면 STOP: 해당 중복 신청을 정리한 뒤 재시도.
-- ===========================================================================
WITH resolved AS (
  SELECT g.id,
         g.season_id,
         g.email,
         COALESCE(g.user_id, u.id) AS final_uid
  FROM public.genesis_applications g
  LEFT JOIN auth.users u
    ON g.user_id IS NULL
   AND lower(g.email) = lower(u.email)
)
SELECT season_id,
       final_uid,
       count(*)            AS dup_count,
       array_agg(email)    AS emails,
       array_agg(id)       AS application_ids
FROM resolved
WHERE final_uid IS NOT NULL
GROUP BY season_id, final_uid
HAVING count(*) > 1
ORDER BY dup_count DESC;


-- ===========================================================================
-- Step 2. Backfill (충돌 자동 가드 + UPDATE). 전체를 한 블록으로 실행.
--   충돌이 있으면 DO 블록이 EXCEPTION 으로 중단(아무 변경 없음).
-- ===========================================================================
BEGIN;

DO $$
DECLARE
  collision_count integer;
BEGIN
  SELECT count(*) INTO collision_count
  FROM (
    WITH resolved AS (
      SELECT g.id,
             g.season_id,
             COALESCE(g.user_id, u.id) AS final_uid
      FROM public.genesis_applications g
      LEFT JOIN auth.users u
        ON g.user_id IS NULL
       AND lower(g.email) = lower(u.email)
    )
    SELECT 1
    FROM resolved
    WHERE final_uid IS NOT NULL
    GROUP BY season_id, final_uid
    HAVING count(*) > 1
  ) x;

  IF collision_count > 0 THEN
    RAISE EXCEPTION
      'Backfill aborted: % season/user collision group(s). Resolve duplicate applications (Step 1) first.',
      collision_count;
  END IF;
END $$;

-- 멱등 backfill: user_id 가 비어있고 email 이 auth.users 와 일치하는 행만.
UPDATE public.genesis_applications g
SET user_id = u.id
FROM auth.users u
WHERE g.user_id IS NULL
  AND lower(g.email) = lower(u.email);

COMMIT;


-- ===========================================================================
-- Verification (COMMIT 후 별도 실행)
-- ===========================================================================

-- 1) NULL 비율 — 기대: 매칭된 만큼 user_id 채워짐, 미가입자만 NULL 잔존
SELECT count(*)                              AS total,
       count(user_id)                        AS with_user_id,
       count(*) - count(user_id)             AS still_null,
       round(100.0 * (count(*) - count(user_id)) / NULLIF(count(*), 0), 1) AS null_pct
FROM public.genesis_applications;

-- 2) NULL 잔존 행 = 미가입(매직링크 가입 시 자동 연결 대상) — email 매칭 0건 확인
SELECT count(*) AS remaining_null_unregistered
FROM public.genesis_applications g
WHERE g.user_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(g.email)
  );

-- 3) 혹시 NULL 인데 email 은 매칭되는 행(=백필 누락)이 있는지 — 기대: 0
SELECT count(*) AS null_but_matchable
FROM public.genesis_applications g
WHERE g.user_id IS NULL
  AND EXISTS (
    SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(g.email)
  );

-- 4) 시즌별 분포
SELECT season_id,
       count(*)        AS n,
       count(user_id)  AS with_user_id
FROM public.genesis_applications
GROUP BY season_id
ORDER BY season_id;


-- ===========================================================================
-- Rollback (필요 시) — 백업 테이블로 user_id 원복
-- ===========================================================================
-- UPDATE public.genesis_applications g
-- SET user_id = b.user_id
-- FROM public.backup_genesis_user_id_20260606 b
-- WHERE g.id = b.id;


-- ===========================================================================
-- Post-backfill: 파트너 통계 재계산 1회 (수동 트리거)
-- ===========================================================================
-- 이 backfill 로 user_id 가 채워져도 profiles.cumulative_top50/wins 는 자동
-- 갱신되지 않는다. 재계산은 파트너 시스템의 recomputeAllPartnerStats 가 담당하며,
-- 이는 PR #3(브랜치 member-hosted)의 코드다.
--
-- 전제: PR #3 가 main 머지 + 배포되어 /api/cron/partner-stats 가 라이브여야 함.
--       (그 전에는 아래 엔드포인트가 존재하지 않음.)
--
-- backfill 실행 후 아래 중 하나로 통계를 1회 재계산:
--
--   1) 운영 엔드포인트 수동 호출 (CRON_SECRET = Vercel 환경변수):
--        curl -X POST "https://oxxovo.com/api/cron/partner-stats" \
--             -H "Authorization: Bearer $CRON_SECRET"
--      -> 응답 {"ok":true,"processed":N}. N = user_id 링크된 유저 수.
--
--   2) 자동: 주 1회 보정 cron (vercel.json, 매주 일 00:00 UTC)이 다음 주기에 실행.
--
-- recompute 는 source(genesis_applications) 기준 재계산이라 멱등 — 여러 번
-- 호출해도 안전. backfill -> recompute 순서만 지키면 됨.
-- (SQL 파일에서 직접 실행하는 것이 아니라 위 엔드포인트 호출로 수행.)
