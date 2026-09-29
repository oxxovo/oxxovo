# 지수 본체 인계서 -- 2026-08-27 EOD

TK 지시: "내일 이어간다, 기록만 남긴다. 고치지 마라, 커밋하지 마라, 배포하지 마라." 이 문서는 그 기록.

## 규율 -- git log -1

세션 시작 `a2660307f16a2fe6028d0855c4941d17b88f201b` -> 종료 `cfcba3f6e54fb4106470634ad415eeda802ee264`.
워킹트리: `lib/watch.ts` 수정, 미커밋(③ 참조). 다른 세션 잔존 파일 15개(`outputs/` 10 + `reports/` 7 + `scripts/zz_probe_*` 7, `public/` 밑 없음) 그대로 untracked -- 손 안 댐.

## ① 오늘 배포한 것

**`9d43884` (커뮤니티 투표 2건) 하나뿐.**

- `app/watch/actions.ts`/`lib/watch.ts`: `toggleWatchVote`에 자기투표 차단(`app.user_id === user.id` -> `self_vote`, 가입 시점 조건 없음) + cap 폴백 `?? 3` -> `?? 1`.
- SQL(별도, TK Run): `seasons.community_vote_max_per_user` 전 시즌 3 -> 1, DEFAULT도 1로.
- 배포 후 sha 대조: `curl https://www.oxxovo.ai/api/version` -> `{"sha":"9d43884","dirty":false}` 일치 확인.
- 라이브 대조군(zz_ 픽스처 + 진짜 쿠키세션 + `www.oxxovo.ai` 직접 타격, 정리 완료): 본인 작품 거부 / 남의 작품 통과 / 2표째(cap=1) 거부 -- 7/7 PASS.
- 이 외 코드 커밋 0건 (Founding 설계·백로그 문서화·`/watch` 필터 설계는 전부 문서/미커밋 코드로만 존재, 아래 참조).

## ② ⛔ 지금 새고 있는 것 -- 내일 최우선

**season_test 예선 영상 41편 중 20편이 지금 이 순간 라이브 `/watch` 노출 조건을 충족한다** (`watch_hidden=false` + `moderation_status='approved'` + `status≠'flagged'`, `isRowPublic()` 그대로 재현해서 실측).

정체: **`/promo/content_video/`(홍보영상 B-roll) 92편 풀을 2026-06-04에 예선 필러로 재사용한 사본** -- `studio_application_render_id`/`studio_application_submitted_at` 전부 null, 실제 참가작이 아님. 재렌더본도 7월 것도 아니었다(질문에 대한 답).

부수 발견: 이 92편 전부(7개 표본, B-roll형+정보영상형 두 계열 다) **OXXOVO 엔드카드가 균일하게 붙어 있음**(ffmpeg로 마지막 프레임 실측, `WHERE DO YOU RANK?`/`지금, 당신의 순위는?` 카피). ④의 리허설 출품 판정과 연결됨.

**막는 법 둘, 둘 다 대표님 Run 대기:**
1. season_test 초기화 SQL STEP 2 (`watch_hidden=true`로 41행 전부 재잠금) -- ③의 SQL에 포함.
2. `/watch` 필터 배포 (③).

둘 중 하나만 돌아도 지금 노출은 닫힌다. 배포 전이라 아직 열려 있음.

## ③ 내일 첫 작업

**1. `watch_fixture_visible` 컬럼 + `loadWatchVideos` -- 설계는 끝, 배포만 남음.**

SQL (STEP 분리, 미실행):
```sql
-- STEP 0: guard
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='seasons' AND column_name='watch_fixture_visible';
```
```sql
-- STEP 1: 컬럼 추가, 기본 false (fail-closed -- 명시적으로 켜기 전엔 아무것도 예외 안 됨)
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS watch_fixture_visible BOOLEAN NOT NULL DEFAULT false;
```
```sql
-- STEP 2: verify
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='seasons' AND column_name='watch_fixture_visible';
```

코드(`lib/watch.ts`, 미커밋, tsc clean, 566/566 통과 확인됨): `loadWatchVideos()`가 `seasons.watch_fixture_visible`을 같이 읽어 `true`인 시즌만 fixture 배제 예외 처리. 겸사겸사 fail-open 구멍도 고침 -- `seasons` 조회 자체가 에러나면 예전엔 조용히 무필터로 새던 것을 이제 빈 리스트로 fail-closed.

순서: STEP 0~2 Run -> `UPDATE seasons SET watch_fixture_visible = true WHERE id='season_test'` (리허설 열 때) -> 코드 커밋+배포(보고 후) -> 리허설 끝나면 STEP 3(아래)가 다시 false로 닫음.

**2. season_test 초기화 SQL -- STEP 0~3, 대표님 Run 대기.**

```sql
-- STEP 0: guard -- 현재 상태 (읽기전용)
SELECT id, status, application_open_at, application_close_at, scoring_start_at,
       scoring_complete_at, main_round_start_at, main_round_end_at,
       community_vote_start_at, community_vote_end_at, awards_announcement_at,
       min_participants, updated_at
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
)
SELECT
  (SELECT count(*) FROM del_scoring) AS scoring_results_deleted,
  (SELECT count(*) FROM del_votes) AS watch_votes_deleted,
  (SELECT count(*) FROM del_likes) AS watch_likes_deleted,
  (SELECT count(*) FROM del_views) AS watch_views_deleted,
  (SELECT count(*) FROM del_comments) AS watch_comments_deleted,
  (SELECT count(*) FROM del_reports) AS watch_video_reports_deleted;
```
기대값: scoring_results_deleted=51, watch_votes_deleted=1, 나머지 0.

```sql
-- STEP 2: genesis_applications 리셋 (41행 -> pending) + watch_hidden 재잠금 (②의 20건도 여기서 닫힘)
WITH upd AS (
  UPDATE genesis_applications
  SET status = 'pending',
      award_rank = NULL,
      main_round_video_url = NULL,
      main_round_submitted_at = NULL,
      ai_score = NULL,
      watch_hidden = true
  WHERE season_id = 'season_test'
  RETURNING id, status, watch_hidden
)
SELECT count(*) AS apps_reset, bool_and(status = 'pending') AS all_pending, bool_and(watch_hidden) AS all_hidden FROM upd;
```
기대값: apps_reset=41, all_pending=true, all_hidden=true.

```sql
-- STEP 3: seasons 날짜/status 리셋 (#12 scoring_start_at 스테일도 여기서 해소) + watch_fixture_visible 원복
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
      watch_fixture_visible = false,
      updated_at = now()
  WHERE id = 'season_test'
  RETURNING id, status, application_open_at, scoring_start_at, main_round_start_at, community_vote_start_at, awards_announcement_at, watch_fixture_visible
)
SELECT * FROM upd;
```
기대값: 정확히 1행, status='draft', 날짜 전부 NULL, watch_fixture_visible=false.

주의: STEP 3의 `watch_fixture_visible = false`는 위 컬럼이 실제로 생성된 뒤에만 유효한 줄이다 -- 컬럼 추가(위 1번) 전에 이 STEP 3를 돌리면 에러난다. 순서: 컬럼 추가 -> season_test 초기화.

`application_open_at`은 의도적으로 NULL로 남겨둠(리셋과 "시작"을 분리) -- 실제로 여는 건 `rehearsal-stage.mjs open`을 별도로, `/watch` 필터 배포 확인 후에.

## ④ 확정된 것

- **공식 배우 경로 = C안.** 코드 변경 0. `official_actors`의 `canonical_frontal_url`/`reference_urls`가 이미 공개 R2 CDN이라, 참가자가 그 URL을 받아 기존 Studio 업로드 UI로 본인 캐릭터 등록하면 끝. A안(서버가 official_actors를 직접 characterId로 받아줌)은 발사 후 새는 문이 될 위험이 있어 기각, B안(서비스롤로 studio_characters 대리 생성)은 사전 준비가 C보다 커서 기각.
- **리허설 출품 = 엔드카드 붙은 채로 그대로 쓴다.** 근거: 리허설 목적은 파이프라인 검증이지 채점 정확도가 아님 / 51편 전부 같은 엔드카드면 조건 균등 / 새로 만들면 시간·비용. **각주 확정: "리허설 채점 결과를 실전 기준으로 읽지 않는다."**
- **새 앵커 = SONYA / 소냐. RIN은 앵커에서 빠진다.**
- **리허설 기준 이미지 두 벌**: ①정장·스튜디오(앵커용) ②스키복·모자 없음·고글은 머리 위(리허설용). 베이스 얼굴은 1회 생성해 두 시트가 공유(얼굴 동일성의 구조적 보장).
- **필수조건(Twist) 4요소**: ①스키복 ②멈춘 뒤 고글 올림 ③카메라 정면 ④브리핑 입모양.

## ⑤ 미해결 -- 내일 판정 사안

- **얼굴 일관성이 채점 축에 없다.** `oxxovo-scoring` 레포가 로컬에 실제로 있었다(전전 턴에 "없다"고 답한 게 내 오답, 정정함) -- HEAD `472e519`(2026-08-20) `src/scorer.ts` 직접 확인: **08-05 처방 A(루브릭에 인물일관성 명시+3모델 보고 강제)도 B(Creator Statement -> Competition Brief 슬롯분리)도 안 들어갔다.** `Creator Statement:` 문구가 604/674/741행 그대로, criterion 2(Execution)엔 인물동일성 하위항목 없음. "리허설 필수조건=같은 얼굴"인데 그걸 재는 축이 없다는 뜻 -- 내일 판정 필요.
- **실격 게이트 심사 로직도 같은 레포(`oxxovo-scoring`)에 있다** -- 이번 세션에서 이 부분은 안 열어봤음, 내일 같이 열 창.
- SONYA 온보딩(5단계 x 2벌: 베이스 1회 + 시트 2회 + 모션체크 1회) -- 착수 전 보고 확정. 확인된 단가: `kling-v3-pro-i2v` $0.168/초(모션체크용, `model_catalog`) -> 클립 1개(5~8초 추정) 약 $0.84~$1.34. `flux/dev`(베이스)·`ideogram/character`(시트, 8장) 단가는 이 레포/DB 어디에도 없음(RIN 온보딩이 스크립트 직접호출이라 `generation_jobs` 미경유) -- fal.ai 대시보드에서 실제 단가 확인 필요.
- 금지어 SQL (SONYA·소냐 추가, 미실행):
```sql
-- STEP 0: guard
SELECT value FROM platform_config WHERE key = 'nickname_banned_words_impersonation';
```
```sql
-- STEP 1: append
WITH upd AS (
  UPDATE platform_config
  SET value = (value::jsonb || '["SONYA","소냐"]'::jsonb)::text,
      updated_at = now()
  WHERE key = 'nickname_banned_words_impersonation'
  RETURNING key, value
)
SELECT * FROM upd;
```
기대값: 1행, 기존 34개 + 2개 = 36개.

## ⑥ 오늘 배운 것

- "내 목록이 비었다고 일이 없는 게 아니다" -- backlog 44건 존재(번호 매김 40 + `c-` 4, 그중 4건은 CLOSED 섹션 표에 물리적으로 잘못 끼어 있음, 정리 필요). 9/9 전 필수 태그 명시 7건: #51·#52·#56·#59·#63·#64·#31.
- "~라서 못 한다"를 쓰기 전에 그 근거가 언제 확인된 것인지 먼저 본다 -- 오늘 두 번 스스로 정정: ①"216커밋 게이트"가 낡은 기록이었음(실제 라이브는 1커밋 차) ②"oxxovo-scoring 레포 없음"이 틀렸음(실제로 로컬에 있었음, 안 열어본 것뿐).

## 참고 -- 이번 세션에서 만든 산출물 (전부 미커밋/미실행)

- `lib/watch.ts` -- `watch_fixture_visible` 반영 + fail-open 수정, 미커밋
- `reports/founding_membership_per_season_design_2026-08-27.md` -- Founding 시즌별 구조 정밀화(옵션B 재검토, 실측 1행 정정), 착수는 발사 후
- `reports/backlog_honcho.md` -- `c-sharedworkfolder` 항목 추가, 커밋됨(`cfcba3f`)
- `scripts/zz_probe_vote_selfblock_2026-08-27.mjs` / `..._LIVE_2026-08-27.mjs` / `zz_probe_vote_state_2026-08-27.mjs` -- 투표 건 대조군 스크립트, 미커밋(다른 zz_probe들과 같은 취급)

관련: [[project-jisoo-resume-2026-08-24]] [[project-season0-rehearsal-design-2026-08-23]] [[feedback-stale-record-as-gate]]
