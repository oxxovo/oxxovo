# 리허설 전 점검 — 2026-08-31 작업분 (내일 아침 가장 먼저 볼 것)

## ⛔⛔ 지금 살아있는 위험 — SEASON_ID (읽고 시작할 것)

**Railway `trustworthy-enchantment/oxxovo-scoring`의 `SEASON_ID`가 지금(이 리허설 도중) `season_test`로 설정돼 있다.** 리허설이 끝나면 반드시 `season_0`으로 되돌려야 한다 — 안 그러면 season_0 실전 신청이 열려도 채점 워커가 season_test만 보느라 아무것도 안 채점하는데, **에러 없이 조용히 그런다**(아래 참고). `rehearsal-reset.mjs`가 리셋 마지막에 이걸 자동으로 되돌리도록 이미 고쳐뒀다(best-effort, railway CLI 실패해도 리셋 자체는 안 죽음) — 그래도 리허설이 진짜로 끝나면 **직접 한 번 더 확인**:
```
railway variable list -s oxxovo-scoring -e production -p trustworthy-enchantment | grep SEASON_ID
```
→ `SEASON_ID=season_0`이어야 한다(삭제/미설정 상태로 기본값에 기대지 말 것 — 확인 자체가 기록이다).

**워커는 "season-blind"가 아니다(이 세션이 전에 그렇게 말한 건 틀렸다, TK 정정 2026-08-31).** `oxxovo-scoring/src/batch.ts:43`: `const SEASON_ID = process.env.SEASON_ID ?? 'season_0'` — 딱 이 하나의 시즌만 본다.

**⛔같은 함정이 `ROUND`에도 있다.** `batch.ts:64`: `process.env.ROUND === 'main' ? 'main' : 'application'`. 배포 상태엔 `ROUND` 자체가 없어 기본값(예선)만 돈다 — **본선 채점은 지금 프로덕션에 자동 트리거가 아예 없다.** 리허설 10단계에서 `ROUND=main`을 수동으로 켜야만 본선 채점이 돌았다. 리셋 시 이것도 `ROUND=application`으로 명시 반드시 되돌릴 것:
```
railway variable list -s oxxovo-scoring -e production -p trustworthy-enchantment | grep -E "SEASON_ID|ROUND"
```
→ `SEASON_ID=season_0`, `ROUND=application`이어야 한다. **그리고 11/10 본선 개시 전까지 이걸 자동으로 켜는 진짜 트리거를 설계해야 한다**(지금은 사람이 수동으로 켜야만 함) — backlog `c-seasonidrevert`에 올려둠.

**배포 완료.** sha `139af67`, `curl https://www.oxxovo.ai/api/version` 대조 확인(`dirty:false`).

## ★★TK 지시 2026-08-31 (마지막) — 지금 처리, 결과 아래

**① `season_test`를 season_0과 똑같이 `['studio']`로 — SQL 준비됨, TK Run 대기:**
```sql
UPDATE seasons
SET allowed_video_platforms = ARRAY['studio']
WHERE id = 'season_test'
RETURNING id, allowed_video_platforms;
```
리셋용 원복 SQL은 지시대로 안 넣음 — 리허설 끝나도 그대로 둔다.

**② 본선 제출 화면이 season_0과 같은가 — 코드로 확인, 결론: ①만으로는 안 된다.**
`app/profile/MainRoundCard.tsx`는 `canSubmitMainRound()`(`lib/seasons.ts:745`)를 먼저 통과해야 제출 폼 자체에 도달한다. 그 함수 766행: `if (!season.main_round_start_at || !season.main_round_end_at) return { ok:false, reason:'season_dates_not_set' }`. **`season_test`는 지금 이 두 컬럼이 둘 다 `null`이다** — 그러니 `allowed_video_platforms`가 뭐든 상관없이 지금은 제출 폼이 아니라 "BlockedCard"(날짜 미설정 안내)만 뜬다. `allowed_video_platforms`는 그 다음 단계(폼이 열린 뒤 URL-붙여넣기 폼을 보여줄지 숨길지)에만 관여한다(`acceptsExternalUrl()`). **정리: 화면을 season_0과 같게 만들려면 ①(`allowed_video_platforms`) + `main_round_start_at`/`main_round_end_at` 설정(리허설 가동 절차, 아마 지금 다른 세션이 편집 중인 `scripts/rehearsal-submit-main.mjs`의 역할로 보임 — 그 파일은 안 건드림) 둘 다 필요하다.**

**③ season_0 vs season_test 전체 컬럼 차이 — 99개 컬럼 중 47개가 다름(라이브 조회, 2026-08-31):**

*인원/규모 관련(TK 원칙과 일치, 기대되는 차이):*
`min_participants`(100→5) · `advance_min`(10→6) · `top_n_advance`(50→10) · `absolute_min_participants`(80→null)

*⚠️ 그 밖에 다른 것 — 인원이 아닌데 다름(전부):*
- **채점/투표 가중치**: `ai_score_weight`(0.5→**1**) · `community_vote_weight`(0.5→**0**) — season_test는 커뮤니티 투표를 아예 반영 안 함, 채점 로직 자체가 다르다
- **영상 길이 게이트**: `main_round_video_min/max_seconds`(35-40→15-30) · `studio_compose_min/max_seconds`(30-40→15-30)
- **제출 창**: `submission_hours`(72→24)
- **테마 공개 시점**: `theme_announcement_minutes_before`(0→60)
- **Studio 공개/보류 스위치**: `studio_prelim_auto_publish`(true→**false**) · `studio_prelim_hold_enabled`(true→**false**)
- **연기 카운트**: `max_defer_count`(3→2) · `application_defer_count`(0→1, 이건 설정이 아니라 과거 리허설에서 이미 1회 연기된 상태값)
- **상금**: `total_prize_pool`(2000→3000) · `prize_first/second/third`(1200/500/300→1800/750/450) · `points_fee_basis_usd`(50→0)
- **`aspect_ratio`**: `9:16`→**null**(설정 자체가 없음 — Studio 캔버스 잠금에 쓰이는 값인데 season_test엔 없음)
- **`allowed_video_platforms`**: (①에서 처리)
- **리마인더**: `registration_reminder_days`([14,7,3,1]→null)
- **일정 전부**: `application_open/close_at`·`registration_close_at`·`main_round_start/end_at`·`scoring_start/complete_at`·`prelim_results_announcement_at`·`community_vote_start/end_at`·`awards_announcement_at`·`prize_delivery_at`·`trophy_delivery_at` — season_test는 **전부 null**(status=`draft`)
- **테마 내용**: `main_round_theme`·`main_round_theme_label`·`main_round_twist` — 당연히 다른 테마(리허설용)

*정체성 필드(다른 게 당연함, 문제 아님):* `id`·`name`·`display_name`·`season_number`·`status`·`is_fixture`·`updated_at`

**요약: "인원만 다르다"는 지금 사실이 아니다.** 채점 가중치(커뮤니티 투표 0%!), 영상 길이, 제출 시간창, Studio 공개 스위치, 상금, aspect_ratio, 일정 전체가 함께 다르다. 이 중 무엇을 season_0과 맞출지는 판단이 필요해 목록만 올린다 — 고치지 않았다.

한 줄씩. 전부 오늘 코드/DB 실측, 짐작 없음.

1. **`allowed_video_platforms`에 studio — season_0은 OK, `season_test`는 아니다.** 라이브 조회(2026-08-31): `season_0.allowed_video_platforms = ["studio"]` ✅. 그런데 **`season_test`(내일 리허설이 실제 쓰는 시즌, `scripts/rehearsal-register-real-2026-08-29.mjs` `SEASON_ID='season_test'`)는 `["youtube","vimeo","instagram","tiktok"]`로, `'studio'`가 없다.** 등록(`registerForSeason`)과 본선 제출 UI 숨김 로직(`acceptsExternalUrl`) 코드를 확인한 결과, 이 컬럼은 (a) `/apply`·`/profile`의 "URL 직접 붙여넣기" 구식 폼을 보여줄지 숨길지만 결정하고, (b) `registerForSeason()` 자체는 이 컬럼을 아예 안 읽는다 — 리허설 스크립트가 UI를 안 거치고 `registerForSeason`을 직접 호출하는 구조라 등록 단계는 이 값과 무관하게 통과할 것으로 보인다. **다만 본선 제출도 스크립트로 직접 하는지, UI(`/profile`)로 하는지는 오늘 확인 못 함** — UI로 한다면 season_test는 season_0과 다르게 "URL 붙여넣기" 폼이 뜬다(Studio 흐름을 그대로 재현하지 못함). 리허설 시작 전에 `season_test.allowed_video_platforms`를 `["studio"]`로 맞출지 판단 필요.
2. **이메일 언어 결정 방식이 오늘 바뀌었다(②locale 착수).** `lib/email/lang.ts`에 `resolveEmailLang(toEmail, country)` 신설 — `profiles.locale`이 있으면 그 값, 없으면 기존 `detectEmailLang(country)`로 폴백. **마이그 SQL(`ALTER TABLE profiles ADD COLUMN locale ...`)은 아직 안 돌았다** — 컬럼이 없는 상태에서도 `resolveEmailLang`의 try/catch가 조회 실패를 흡수하고 country 추정으로 폴백하므로 **리허설 이메일 발송은 SQL 실행 여부와 무관하게 오늘 이전과 동일하게 작동한다**(회귀 없음, 유닛테스트 566/566 통과).
3. **`detectEmailLang(country)` 자체 동작 재확인(본부 질문 ①) — country="KR"이면 정확히 'ko' 반환됨을 실행해서 확인함**(코드 읽기 아니라 실제 실행). "Korea"/"South Korea"/"kr"/"KR" 전부 ko, 그 외 en.
4. **schedule-lines.ts의 "한국 시간" 계산은 이미 삭제돼 있었다**(8/30 다른 작업에서 완료, ZONE이 양쪽 다 PT). 오늘은 그 뒤로 안 고쳐진 테스트 3건(구 KST 기대값)만 정리 — 566개 전체 테스트 통과 확인.
5. **"이종 AI 모델" → "서로 다른 회사의 AI 모델"** 3곳(`lib/chatbot-kb.ts`, `lib/admin-i18n.ts`, `lib/email/messages.ts`) 전수 교체 완료. 리포 전체 grep으로 "이종"/"heterogeneous" 잔여 0건 확인(생성된 `outputs/` 파일 3개엔 옛 문구가 남아있지만 소스가 아니라 다음 재생성 시 자동 반영됨 — 안 건드림).
6. **`/apply` 신청 폼에 "Email Language" 라디오 신설**(국가 필드 옆), 화면 언어로 기본값 채워짐 · 사용자가 바꿀 수 있음 · 값은 `profiles.locale`에 저장. **라벨/부제 문구는 임시 표시**(코드 주석에 TODO로 명시, 제니3 확정본 대기) — 대표님이 실제 화면에서 보시면 그 문구는 최종본이 아님을 미리 알려드린다. `/profile`에도 같은 목적의 "언어 설정" 카드 신설(기존 회원 소급용).
7. **오늘 변경분 검증 범위**: `tsc --noEmit` 클린, `npm test` 566/566 통과, `eslint`로 신규 코드에 새 에러 없음(기존에 있던 무관한 경고 2건·에러 1건은 내가 안 건드린 코드). **못 한 것**: `/apply` 폼의 실제 브라우저 렌더 스크린샷 미확인 — `season_0`이 아직 신청 기간 전(`application_open_at=2026-10-15`)이라 실제 화면 도달이 시간창 우회 없인 안 됨. 오늘 새로 추가한 라디오 UI는 코드 검토로만 확인했고, 눈으로 본 적은 없다 — /rules 사고와 같은 종류의 문제(레이아웃 중복/깨짐)가 여기 있을 가능성을 배제 못 한다.
8. **배포 여부**: 지금까지 전부 로컬 커밋 대상 코드일 뿐, 아직 배포 안 함(sha 대조 전) — 배포는 별도 보고 후 진행 예정.
9. **⛔채점 워커가 0건 처리하고도 조용히 종료한다 — 경고 없음(2026-08-31 리허설 5단계 실측, backlog `c-scoringsilent0`).** `SEASON_ID` 미스매치로 크론이 두 번 돌고도 `scoring_results` 0건이었는데 에러/알림 전혀 없었다. "N회 연속 0건" 감지 알림 장치가 backlog에 올라가 있음, 미착수.
11. **★500편 채점 환산(2026-08-31 실측, 배포된 실설정 그대로).** `BATCH_SIZE=2`(Railway 실제값, 확대 안 함 — TK 지시: 실전 조건 그대로 봐야 함) × 크론 `*/5분` = 시간당 24편 → **500편 ≈ 20.8시간.** 예선 창(11/5~11/8, 72시간)엔 들어가지만 **여유가 크지 않다** — 렌더/네트워크 지연, 재시도, 다른 트래픽과 겹치면 금방 잠식된다. 배점 30/45/25 실제 대조 검증: `consensus_intent×0.30 + execution×0.45 + originality×0.25 = verified_score` 정확히 일치(예: 65×0.30+76×0.45+51.6667×0.25=66.6167, 저장값과 동일) — 이 세션에서 가장 값진 확인이었음.
10. **SEASON_ID 리마인더 재수록** — 위 최상단 ⛔ 섹션 참고. 리허설 종료 후 `season_0` 복귀 확인은 이 파일을 다시 열 때마다 잊지 말 것.
