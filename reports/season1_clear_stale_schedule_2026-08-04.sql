-- =============================================================================
-- season_1: 남은 스테일 일정 컬럼 전부 NULL  (season_2/3/4 와 동일 상태로)
-- 2026-08-04  TK Run
-- =============================================================================
-- 왜 필요한가 (실측 + 코드 판정):
--
--   season_1 = status 'upcoming', open/close 는 NULL 인데 아래가 남아 있다.
--     scoring_start_at     2026-10-05T06:59Z
--     scoring_complete_at  2026-10-05T07:00Z
--     main_round_start_at  2026-10-08T04:00Z
--     main_round_end_at    2026-10-10T04:00Z
--     awards_announcement_at 2026-10-13T04:00Z  (= 10/12 21:00 PT)
--
--   app/api/cron/season-tick/route.ts:72 desiredStatus() 는 awards 를 가장
--   먼저 본다:
--       if (awards !== null && now >= awards) return 'completed'
--   open/close 가 NULL 이어도 awards 만으로 'completed' 가 나온다.
--   STATUS_RANK completed=4 > upcoming=1 이므로 forward-only 가드가 못 막고,
--   compare-and-swap 도 통과한다. 2026-10-13 04:00Z 에 season_1 이
--   upcoming -> completed 로 전이된다.
--
--   그 시점은 season_0 접수 한복판이다 (close 2026-11-04). 그리고
--   lib/lobby.ts:72 가 completed -> 'ended' 로 매핑하므로, 홈 TOURNAMENTS 에
--   "끝난 시즌 1" 카드가 뜬다. forward-only 라 tick 이 되돌리지 못한다.
--
--   더 이른 것이 하나 더 있다: scoring_complete_at 2026-10-05T07:00Z 부터
--   season-tick 2.5 가 advance_season_finalists('season_1') 을 매시간 호출한다.
--   신청 0건이라 RPC 는 'no_eligible' 로 self-gate 되어 무해하지만, 로그가
--   매시간 더러워진다. 같이 지운다.
--
-- 조치: season_2/3/4 와 같은 상태(일정 컬럼 전부 NULL)로 맞춘다.
--       상태 enum('upcoming')은 건드리지 않는다. 로비의 COMING SOON 유지.
--
-- 도구 함정 반영:
--   1) 쓰기는 CTE + RETURNING. 최상위가 SELECT 라 영향 행 수가 화면에 보인다.
--   2) WHERE 절 스칼라 서브쿼리 없음.
--
-- 실행 규칙: 블록 1개씩 Run. STEP 0 을 보고 나서 STEP 1.
-- =============================================================================


-- =============================================================================
-- STEP 0 (읽기 전용) -- 현재 상태. season_1 만 값이 남아 있어야 한다.
-- =============================================================================
SELECT id,
       status,
       application_open_at,
       application_close_at,
       scoring_start_at,
       scoring_complete_at,
       main_round_start_at,
       main_round_end_at,
       community_vote_start_at,
       community_vote_end_at,
       awards_announcement_at
FROM seasons
WHERE season_number BETWEEN 1 AND 4
ORDER BY season_number;


-- =============================================================================
-- STEP 1 (쓰기) -- season_1 의 남은 일정 컬럼 전부 NULL.
--
-- WHERE 에 open/close IS NULL 가드를 둔다: 나중에 season_1 에 진짜 일정이
-- 잡힌 뒤 이 블록이 잘못 재실행돼도 0행으로 끝나고 일정을 날리지 않는다.
--
-- 기대 출력: 정확히 1행, all_cleared = true.
-- 0행이면 아무것도 안 바뀐 것이다 (이미 NULL 이거나 open/close 에 값이 생겼다).
-- =============================================================================
WITH upd AS (
  UPDATE seasons
     SET scoring_start_at       = NULL,
         scoring_complete_at    = NULL,
         main_round_start_at    = NULL,
         main_round_end_at      = NULL,
         community_vote_start_at = NULL,
         community_vote_end_at   = NULL,
         awards_announcement_at = NULL,
         updated_at             = now()
   WHERE id = 'season_1'
     AND application_open_at IS NULL
     AND application_close_at IS NULL
  RETURNING id, status, scoring_start_at, scoring_complete_at,
            main_round_start_at, main_round_end_at,
            community_vote_start_at, community_vote_end_at,
            awards_announcement_at, updated_at
)
SELECT id,
       status,
       updated_at,
       (scoring_start_at IS NULL
        AND scoring_complete_at IS NULL
        AND main_round_start_at IS NULL
        AND main_round_end_at IS NULL
        AND community_vote_start_at IS NULL
        AND community_vote_end_at IS NULL
        AND awards_announcement_at IS NULL) AS all_cleared
FROM upd;


-- =============================================================================
-- STEP 2 (읽기 전용) -- 단정 검증. season_1~4 네 행 전부 same_as_2to4 = true.
-- =============================================================================
SELECT id,
       status,
       (application_open_at IS NULL
        AND application_close_at IS NULL
        AND scoring_start_at IS NULL
        AND scoring_complete_at IS NULL
        AND main_round_start_at IS NULL
        AND main_round_end_at IS NULL
        AND community_vote_start_at IS NULL
        AND community_vote_end_at IS NULL
        AND awards_announcement_at IS NULL) AS all_dates_null
FROM seasons
WHERE season_number BETWEEN 1 AND 4
ORDER BY season_number;


-- =============================================================================
-- STEP 3 (읽기 전용) -- season_0 무손상 확인. 5개 값 전부 그대로여야 한다.
-- =============================================================================
SELECT id,
       status,
       application_close_at,
       scoring_start_at,
       scoring_complete_at,
       main_round_start_at,
       main_round_end_at,
       awards_announcement_at
FROM seasons
WHERE id = 'season_0';


-- =============================================================================
-- 되돌리기에 대하여
--
-- 되돌리기 블록을 이 파일에 넣지 않는다. 2026-08-04 사고가 정확히
-- "되돌리기 블록이 순서대로 붙여넣어져 실행된" 사고였다.
-- 원복이 필요하면 그때 별도 파일로 만든다. 원래 값은 이 파일 상단 주석에
-- 전부 적혀 있으므로 복원 근거는 남아 있다.
-- =============================================================================
