-- =============================================================================
-- season_0: allowed_video_platforms -> ARRAY['studio']  (external URL block, (a))
-- 2026-08-04  TK Run
-- =============================================================================
-- 설계: reports/external_url_block_design_2026-08-04.md
--
-- 무엇을 하나:
--   seasons.allowed_video_platforms 는 이미 "허용 제출 소스" 화이트리스트다.
--   본선 제출(submitMainRound)이 이미 이 컬럼을 집행하고 있으므로, 값만 바꾸면
--   본선 외부 URL 이 코드 0줄로 닫힌다. 예선(/api/apply)은 아직 집행 코드가
--   없으므로 이 UPDATE 만으로는 안 닫힌다 -- 지수2A 배선 후 닫힌다.
--
-- 왜 빈 배열이 아닌가:
--   CHECK allowed_video_platforms_nonempty_chk = cardinality(...) >= 1.
--   빈 배열은 제약에 걸린다. 값 하나('studio')를 넣는 방식이어야 한다.
--   'studio' 는 parseVideoUrl 이 아는 플랫폼이 아니므로 어떤 외부 URL 도
--   매치되지 않는다 = 전부 not_allowed. 이것이 의도된 동작이다.
--
-- 도구 함정 반영 (2026-08-04 본부 실측):
--   1) WHERE 절 스칼라 서브쿼리 금지. Supabase 에디터가 붙이는 limit 100 과
--      충돌해 syntax error at or near "SELECT" 가 난다. CTE + CROSS JOIN 사용.
--   2) 에디터는 UPDATE 영향 행 수를 안 보여준다. 쓰기는 CTE + RETURNING 으로
--      감싸 최상위를 SELECT 로 만든다. 그러면 행 수가 화면에 보인다.
--
-- 실행 규칙: 블록 1개씩 Run. STEP 0 세 블록을 먼저 보고 나서 STEP 1 을 Run.
-- =============================================================================


-- =============================================================================
-- STEP 0a (읽기 전용) -- 현재 값. season_0 이 4개 플랫폼으로 열려 있어야 정상.
-- =============================================================================
SELECT id,
       status,
       allowed_video_platforms,
       cardinality(allowed_video_platforms) AS n
FROM seasons
ORDER BY id;


-- =============================================================================
-- STEP 0b (읽기 전용) -- 이 컬럼에 걸린 제약 전수.
-- nonempty_chk 외에 값 도메인을 제한하는 CHECK 가 있으면 'studio' 가 거부된다.
-- 그런 CHECK 가 나오면 STEP 1 을 Run 하지 말고 보고할 것.
-- =============================================================================
SELECT c.conname,
       c.contype,
       pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t     ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'seasons'
  AND pg_get_constraintdef(c.oid) ILIKE '%allowed_video_platforms%'
ORDER BY c.conname;


-- =============================================================================
-- STEP 0c (읽기 전용) -- 이미 접수된 외부 URL 행. 기대: external_url_rows 전부 0.
-- 0 이 아니면 되돌릴 데이터가 있다는 뜻 -> STEP 1 전에 보고.
-- =============================================================================
SELECT season_id,
       count(*) AS rows_total,
       count(*) FILTER (WHERE free_entry_url IS NULL) AS url_null,
       count(*) FILTER (
         WHERE free_entry_url ILIKE '%youtube%'
            OR free_entry_url ILIKE '%youtu.be%'
            OR free_entry_url ILIKE '%vimeo%'
            OR free_entry_url ILIKE '%instagram%'
            OR free_entry_url ILIKE '%tiktok%'
       ) AS external_url_rows
FROM genesis_applications
GROUP BY season_id
ORDER BY season_id;


-- =============================================================================
-- STEP 1 (쓰기) -- season_0 만. CTE + RETURNING 이라 영향 행 수가 화면에 보인다.
-- 기대 출력: 정확히 1행, platforms = {studio}, n = 1.
-- 0행이면 아무것도 안 바뀐 것이다 (id 불일치). 2행 이상이면 즉시 보고.
-- =============================================================================
WITH upd AS (
  UPDATE seasons
     SET allowed_video_platforms = ARRAY['studio']::TEXT[],
         updated_at = now()
   WHERE id = 'season_0'
  RETURNING id, allowed_video_platforms, updated_at
)
SELECT id,
       allowed_video_platforms AS platforms,
       cardinality(allowed_video_platforms) AS n,
       updated_at
FROM upd;


-- =============================================================================
-- STEP 2 (읽기 전용) -- 단정 검증. 4개 컬럼 전부 true 여야 한다.
-- =============================================================================
WITH s0 AS (
  SELECT allowed_video_platforms AS p
  FROM seasons
  WHERE id = 'season_0'
)
SELECT p                                        AS platforms,
       (p = ARRAY['studio']::TEXT[])            AS is_studio_only,
       (cardinality(p) >= 1)                    AS check_satisfied,
       NOT (p && ARRAY['youtube','vimeo','instagram','tiktok']::TEXT[])
                                                AS no_external_platform,
       (array_position(p, 'studio') IS NOT NULL) AS has_studio
FROM s0;


-- =============================================================================
-- STEP 3 (읽기 전용) -- 옆 시즌 대조. season_0 만 달라야 하고 나머지는 불변.
-- CTE + CROSS JOIN (WHERE 절 서브쿼리 금지 규칙 준수).
-- =============================================================================
WITH s0 AS (
  SELECT allowed_video_platforms AS p
  FROM seasons
  WHERE id = 'season_0'
)
SELECT s.id,
       s.status,
       s.allowed_video_platforms,
       (s.allowed_video_platforms = s0.p) AS same_as_season_0
FROM seasons s
CROSS JOIN s0
ORDER BY s.id;


-- =============================================================================
-- 되돌리기에 대하여
--
-- 되돌리기 쿼리를 이 파일에 넣지 않는다. 주석 처리해도, "실행 순서 밖"이라고
-- 적어도 넣으면 실행된다 -- 2026-08-04 하루에 2회 실증됐다.
-- 원복이 필요하면 요청할 것. 별도 파일로 따로 낸다.
--
-- 복원 근거는 남아 있다: 변경 전 값은 ARRAY['youtube','vimeo','instagram','tiktok'] 이고
-- STEP 0a 출력이 실행 기록으로 남는다.
-- =============================================================================
