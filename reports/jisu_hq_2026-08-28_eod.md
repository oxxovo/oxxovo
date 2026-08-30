# 지수 본체 인계서 -- 2026-08-28 EOD

TK 지시: "내일 리허설한다. 오늘 밤은 SQL과 설계만 올려둔다. Run은 내일." 이 문서는 그 준비물 전부.

## 규율 -- git log -1

세션 시작 `cfcba3f` -> 종료 `2a61ecd`(`fix(watch): exclude fixture seasons from public feed + fail-closed on seasons read`, 1커밋만). 워킹트리: `reports/backlog_honcho.md` 수정 + 다른 세션 잔존 파일(`outputs/` 등) + 오늘 만든 `reports/disqualify_gate_app_design_2026-08-28.md`(★검증 안 됨, 아래 참고) + `scripts/zz_probe_disqualify_gate_schema_2026-08-28.mjs`, 전부 미커밋 그대로.

## ① 오늘 배포/실행 완료된 것

- **`lib/watch.ts` 배포** (`2a61ecd`, `www.oxxovo.ai`) -- season_test 등 픽스처 시즌이 `/watch`에 새는 구멍(#39와 같은 자리) 차단 + `watch_fixture_visible` 컬럼(기본 false)으로 리허설 때만 예외. sha 대조 + anon 404 확인 완료.
- **season_test 초기화 SQL Run 완료** (TK) -- 41편 예선 필러(2026-06-04 promo B-roll 재사용분) `watch_hidden=true`로 재잠금, `status=pending` 리셋, `seasons` 날짜 전부 NULL, `status=draft`.
- **실격 게이트 스키마 Run 완료** (TK) -- `seasons` 4컬럼(`main_round_required_elements`/`main_round_disqualify_missing_votes`,appeal_hours,enabled) + `scoring_results` 6컬럼 + `genesis_applications` 3컬럼 + `main_round_disqualification_events` 테이블(RLS ON, service_role만). `information_schema` 프로브로 14/14 확인. `enabled=false`(dark-launch) 그대로.
- **진출 6명 SQL Run 완료** (TK) -- `seasons.advance_min` 10 -> 6 (season_test만, season_0 무영향).
- **예선 16편 시드 Run 완료** (TK) -- `A05_plating`~`A20_culture` EN 16편, `creator_name=TEST-01`~`TEST-16`, `email=test-NN@oxxovo-demo.local`, `user_id=NULL`(계정 0 소모). 기존 41행은 championship_points_ledger FK 때문에 1차 시도가 막혔고 TK가 ledger부터 지워서 해소 -- 잔량 **16/16** 확인됨.
- **`oxxovo-scoring` 실격 로직 3곳 조사 완료** (설계만, 코드 미변경): ①얼굴일관성 처방 A/B 여전히 미반영(`src/scorer.ts:604/674/741` Creator Statement 그대로, criterion 2에 인물동일성 없음) ②required_elements 삽입 지점 = `buildScoringPrompt` `:264`~`:266` 사이 + 스키마 3곳(`:266-277`/`:400-418`/`:192-198`) ③합의취합 = `processOne`이 아니라 `scoreWithAllAIs`(`:773-824`), 3사 평균/Integrity는 Claude 단독. `main_round_disqualify_missing_votes` 자체는 레포 어디서도 안 읽힘(`fetchSeason` select에 없음) -- 연결하려면 `src/batch.ts:82-99` select 화이트리스트 + `src/supabase.ts:23-27` `SeasonThresholds`에 추가.

## ② ⛔ 오늘 밤 준비 -- SQL만, Run은 내일

### ②-1. `allowed_video_platforms`에 studio 추가 (없으면 Studio 제출 자체가 막힘)

실측: `season_0=["studio"]`(8/4 studio-only 전환), `season_test=["youtube","vimeo","instagram","tiktok"]`(studio 없음, 옛값). CHECK `allowed_video_platforms_nonempty_chk`(cardinality>=1)만 있음.

```sql
-- STEP 0: guard
SELECT id, allowed_video_platforms FROM seasons WHERE id IN ('season_test','season_0');
```
```sql
-- STEP 1: season_test도 studio-only로 (season_0와 동일값)
WITH upd AS (
  UPDATE seasons SET allowed_video_platforms = ARRAY['studio']::TEXT[], updated_at = now()
  WHERE id = 'season_test'
  RETURNING id, allowed_video_platforms
)
SELECT * FROM upd;
```
기대값: `["studio"]`.

### ②-2. 접수 여는 법 -- `rehearsal-stage.mjs open`이 맞다, 단 그것만으론 부족하다

`scripts/rehearsal-stage.mjs:17`: `open` phase가 `application_open_at`(2분 전)/`application_close_at`(기본 10분 뒤)을 세팅하고 `pingCron()`으로 실제 season-tick을 호출 -> draft->active 자동 전환. **날짜/상태는 이 명령 하나로 충분.**

**★그런데 이것만으론 두 분이 `/apply`에 못 들어간다.** `lib/seasons.ts:456` `getCurrentSeason()`이 `:481`에서 `.find((s) => !isFixtureSeason(s))`로 픽스처 시즌을 코드로 제외한다 -- `season_test`는 id 자체가 `season_test`로 시작해 `isFixtureSeason()`이 무조건 true. `application_open_at`을 아무리 과거로 세팅해도 `/apply` 페이지가 부르는 함수가 애초에 `season_test`를 후보에서 빼버린다. **`rehearsal-stage.mjs open`은 여전히 돌려야 하지만(날짜/상태 전환 자체는 필요), `/apply` 화면 진입 문제는 별개로 풀어야 한다 -- ②-3 참조.**

### ②-3. 두 분이 실제로 들어가는 방법

`/apply` UI는 위 이유로 못 씀. 하지만 `registerForSeason()`(`lib/studio.ts:1301`) 자체는 `seasonId`를 인자로 받는 범용 서버 함수 -- 닉네임 게이트·멤버십 게이트·나이 게이트·정원 판정 전부 실제 코드 그대로 통과한다. **제안: 두 분 실계정으로 로그인한 상태에서, 스크립트가 `registerForSeason({seasonId:'season_test', userId, email, applicant})`을 직접 호출.** UI만 건너뛰고 게이트·검증은 100% 실경로 -- "실제 경로로"라는 지시와 어긋나지 않는다고 판단.

★대안(`getCurrentSeason()`에 season_test 예외를 코드로 추가)은 전 방문자에게 영향을 주는 변경이라 **승인 없이 안 함.** 내일 아침 이 방식으로 갈지 확인 부탁.

등록 이후 Studio 진입(제작 단계)은 `checkStudioAccess`가 별도로 게이트하는데, `studio_test_access`(`lib/studio-test-access.ts`)로 특정 계정에 기간부 접근을 줄 수도 있다 -- 등록만 되면 정상 멤버십(Founding 포함)으로 이 게이트도 통과할 가능성이 높아 별도 조치가 필요 없을 수 있음, 내일 실측 확인 필요.

### ②-4. 리셋 SQL 최신판 (원복 2개 포함) -- 8/27판에 advance_min 원복 추가

기존 STEP 0~3(8/27 설계, season_test 초기화)에 **advance_min 10 원복**을 STEP 3에 병합했다. Founding 원복은 배우자 user_id를 몰라서 별도 템플릿(STEP 4~5)으로 뺐다 -- 내일 등록 후 채워서 실행.

```sql
-- STEP 0: guard -- 현재 상태 (읽기전용)
SELECT id, status, application_open_at, application_close_at, scoring_start_at,
       scoring_complete_at, main_round_start_at, main_round_end_at,
       community_vote_start_at, community_vote_end_at, awards_announcement_at,
       min_participants, advance_min, advance_pct, advance_max,
       allowed_video_platforms, watch_fixture_visible, updated_at
FROM seasons WHERE id = 'season_test';
```
```sql
-- STEP 0b: guard -- genesis_applications 상태 분포 (읽기전용)
SELECT status, count(*) FROM genesis_applications WHERE season_id = 'season_test' GROUP BY status;
```
```sql
-- STEP 1: 채점/소셜 흔적 삭제 (season_test 범위만)
WITH season_test_apps AS (
  SELECT id FROM genesis_applications WHERE season_id = 'season_test'
),
del_scoring AS (
  DELETE FROM scoring_results WHERE season_id = 'season_test' RETURNING id
),
del_votes AS (
  DELETE FROM watch_votes WHERE season_id = 'season_test' RETURNING id
),
del_likes AS (
  DELETE FROM watch_likes WHERE application_id IN (SELECT id FROM season_test_apps) RETURNING id
),
del_views AS (
  DELETE FROM watch_views WHERE application_id IN (SELECT id FROM season_test_apps) RETURNING id
),
del_comments AS (
  DELETE FROM watch_comments WHERE application_id IN (SELECT id FROM season_test_apps) RETURNING id
),
del_reports AS (
  DELETE FROM watch_video_reports WHERE application_id IN (SELECT id FROM season_test_apps) RETURNING id
),
del_events AS (
  DELETE FROM main_round_disqualification_events WHERE application_id IN (SELECT id FROM season_test_apps) RETURNING id
),
del_points AS (
  DELETE FROM championship_points_ledger WHERE season_id = 'season_test' RETURNING id
)
SELECT
  (SELECT count(*) FROM del_scoring) AS scoring_results_deleted,
  (SELECT count(*) FROM del_votes) AS watch_votes_deleted,
  (SELECT count(*) FROM del_likes) AS watch_likes_deleted,
  (SELECT count(*) FROM del_views) AS watch_views_deleted,
  (SELECT count(*) FROM del_comments) AS watch_comments_deleted,
  (SELECT count(*) FROM del_reports) AS watch_video_reports_deleted,
  (SELECT count(*) FROM del_events) AS disqualification_events_deleted,
  (SELECT count(*) FROM del_points) AS championship_points_deleted;
```
★`del_events`/`del_points`는 오늘 새로 추가된 두 시스템(실격 게이트·챔피언십 포인트) 때문에 8/27판에서 빠져 있던 것 -- 이번에 같이 넣었다. 8/27 STEP 1엔 없던 두 줄.
```sql
-- STEP 2: genesis_applications 리셋 (24행 -> pending) -- watch_hidden은 안 건드린다
-- ★2026-08-30 본부 확정: 리허설 24편(예선18+본선6)은 9/9~10/14 Watch에 그대로 남긴다.
-- watch_hidden을 true로 재잠금하면 그 결정을 뒤집으므로 이 STEP에서 뺐다.
WITH upd AS (
  UPDATE genesis_applications
  SET status = 'pending',
      award_rank = NULL,
      main_round_video_url = NULL,
      main_round_submitted_at = NULL,
      ai_score = NULL,
      main_round_disqualified = false,
      disqualified_at = NULL,
      disqualification_notified_at = NULL
  WHERE season_id = 'season_test'
  RETURNING id, status, watch_hidden
)
SELECT count(*) AS apps_reset, bool_and(status = 'pending') AS all_pending, bool_and(watch_hidden = false) AS all_still_visible FROM upd;
```
★이 STEP은 24행(예선 18 + 본선 6)을 **삭제가 아니라 pending으로 리셋**한다 -- 8/27 설계 그대로 따름(그때 41행도 리셋이었지 삭제가 아니었음). ★★주의: 이 STEP은 `main_round_video_url`/`ai_score`/`award_rank`를 지운다 -- 즉 **9/9~10/14 전시 기간이 끝나기 전에는 이 STEP 자체를 돌리면 안 된다.** 다음 리허설에서 또 재사용할지, 아니면 그때 가서 삭제할지는 판정 필요 -- 오늘 결정 안 함.
```sql
-- STEP 3: seasons 리셋 -- 날짜/status + advance_min 10 원복. watch_fixture_visible은 안 건드린다
-- ★2026-08-30 본부 확정: false 원복 삭제 -- 리허설 노출을 계속 열어두는 결정과 충돌해서 뺐다.
WITH upd AS (
  UPDATE seasons
  SET status = 'draft',
      application_open_at = NULL,
      application_close_at = NULL,
      scoring_start_at = NULL,
      scoring_complete_at = NULL,
      main_round_start_at = NULL,
      main_round_end_at = NULL,
      community_vote_start_at = NULL,
      community_vote_end_at = NULL,
      awards_announcement_at = NULL,
      min_participants = 5,
      advance_min = 10,
      updated_at = now()
  WHERE id = 'season_test'
  RETURNING id, status, application_open_at, scoring_start_at, main_round_start_at,
            community_vote_start_at, awards_announcement_at, advance_min, watch_fixture_visible
)
SELECT * FROM upd;
```
기대값: 1행, status='draft', 날짜 전부 NULL, advance_min=10, **watch_fixture_visible은 이 STEP 실행 전 값 그대로**(현재 true여야 함 -- STEP 0 가드로 먼저 확인).

```sql
-- STEP 4 (템플릿 -- 배우자 user_id 확정 후 실행): Founding 원복 -- profiles
UPDATE profiles
SET founding_creator_number = NULL,
    membership_tier = 'general',
    membership_status = 'none',
    membership_source = NULL,
    membership_started_at = NULL,
    membership_expires_at = NULL,
    updated_at = now()
WHERE id = '<배우자 user_id>' AND founding_creator_number IS NOT NULL
RETURNING id, founding_creator_number, membership_tier, membership_status;
```
```sql
-- STEP 5 (STEP 4와 세트): Founding 카운터 반환
UPDATE membership_founding_counter SET claimed = claimed - 1 WHERE id = 1 AND claimed > 0
RETURNING claimed;
```
실측 확인: 클레임 메커니즘 = `lib/membership.ts:273-374`, 카운터 `membership_founding_counter`(현재 `claimed=1`), 비클레임 기본값 `membership_tier='general'`/`membership_status='none'`(라이브 표본 3건으로 확인).

## ③ 내일 순서 (TK 지시 그대로, 재확인용)

1. TK·배우자 등록(②-3 방식) -> Studio 제작 -> 제출
2. 예선 18편(16 시드 + 실등록 2) -> AI 채점 -> 진출 6명(advance_min=6)
3. 본선 6편 배정 -- appId 확정되면 `Walk/Morph/Runway/Fusion/Street/Weave` 제목 매핑 SQL(별도 턴에서 이미 템플릿 전달함, `creator_name`은 안 건드림) 실행
4. 투표 창 직전 `UPDATE seasons SET watch_fixture_visible = true WHERE id='season_test'`
5. 투표 + 본선 채점 -> 시상
6. 끝나면 위 리셋 SQL STEP 0~5 전부

## 참고 -- 검증 안 된 산출물

`reports/disqualify_gate_app_design_2026-08-28.md`(185줄) -- 앱 쪽 4개 반영 지점(리더보드 제외/시상 제외/`/watch` 표시/어드민 노출+되돌리기) 조사 초안. **이 문서를 만든 에이전트는 fork 금지 지시 이후 general-purpose로 재시도했다가 작업 중간에 제가 강제 종료(TaskStop)한 것** -- 내용이 끝까지 다 됐는지, 파일:행 인용이 정확한지 이번 세션에서 검토 못 했음. HQ 지시대로 이 작업은 "실격이 안 나면 제외할 대상도 없다"며 뒤로 미뤄져서 당장은 안 급하지만, 다음에 이 파일을 근거로 쓰기 전에 처음부터 다시 검증 필요.

관련: [[project-jisoo-resume-2026-08-27]]
