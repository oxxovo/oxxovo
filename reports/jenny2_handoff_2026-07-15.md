# 지수2 인수인계 — 2026-07-15

세션 종료 시점 상태 한 장. 브랜치 `feat/studio-budget-guard` @ **06f4a42** (origin 동기, main 미머지).

---

## 1. TK Run 대기 마이그 (순서대로)

프로젝트 = `qrnkovokjmimagrwjebs`. 전부 순수 SQL·주석 없음·`WHERE id` 고정.

| # | 파일 | 상태 | Run 후 확인 |
|---|---|---|---|
| 1 | `reports/season0_compose_length_30_40_2026-07.sql` | **Run 완료 ✅** | min=30 / max=40 |
| 2 | `reports/season0_main_round_theme_2026-07.sql` | **Run 완료 ✅** | theme_chars=901 (CRLF로 910 → #3으로 해소) |
| 3 | `reports/season0_theme_strip_cr_2026-07.sql` | **Run 완료 ✅** | theme_chars=901, cr_count=0 |
| 4 | `reports/season0_main_round_theme_label_2026-07.sql` | **Run 완료 ✅** | 뷰 3컬럼 확인, twist 없음 |
| **5** | **`reports/season_test_theme_label_2026-07.sql`** | **⏳ Run 대기** | `main_round_theme_label='OXXOVO Beauty CF'` → 리허설 테마 패널 복원 |
| — | `reports/season0_clear_video_seconds_2026-07.sql` | **Run 하지 말 것** | (b)를 코드로 해결(06f4a42)해서 불필요. DDL 버전이라 남겨둠 |

**#5를 Run하면** season_test 테마 패널이 복원되고("· 30초"는 의도대로 제거된 채) 라벨 렌더를 끝까지 검증할 수 있음.

---

## 2. 오늘 완료 (커밋 10개, 전부 푸시됨)

**시즌0 30~40초 전면 정렬**
- compose 게이트 min30/max40 (마이그 + E2E 15/15 PASS)
- `scripts/e2e-compose-length.mjs` — 두 단언만이 아니라 **본문 전체** 재정렬(20s→ok 등 4케이스가 30/40에선 거짓이 됨)
- UI 힌트 배선: `SeasonStudioConfig`에 compose min/max 추가 → `StudioState` → `compose_hint(min,max)` 함수화. **하드코딩 제거, 시즌 값 파생** (마이그 즉시 코드 변경 없이 30~40으로 뒤집힘을 실측 확인)
- 챗봇 KB **9곳**(지시는 2곳이었음): 길이 + 예선 경로(양 라운드 Studio) + **돈 오안내**(예선 크레딧 안 든다던 것) + **318줄 가드레일**(봇에게 옛 사실을 말하라 지시하던 줄 — 안 고쳤으면 나머지 수정이 무력화)
- 규정문서 `rules_compose_clauses_handoff` / `regular_season_rules`

**시즌0 본선 주제**
- `main_round_theme` = 901자 브리프 (채점기 전용, `batch.ts:491-494`가 이걸 씀)
- **신규 컬럼 `main_round_theme_label`** = "Cosmetic Commercial Film" (화면 전용). `season_theme`은 **NULL 유지** = 6/20 "예선 자유작" 결정 보존
- 901자가 뜨던 **5곳** 라벨로 교체. 3곳 목록이 놓쳤던 `ArenaWatch:143 → lib/watch.ts:476/486/494`(배너 제목/부제, showTheme 게이트 없음) 포함
- `NON_CLONED_KEYS`에 라벨 추가 — 안 넣으면 **season_1이 시즌0 라벨을 상속**

**Watch 정직성/포스터**
- 배너 results 단계에 `winnerCount` 가드 — 날짜만 보고 "우승자 발표됨" 선언하던 것 차단(season_test가 실제로 그 상태였음: 진출자 10명 / 순위 0건)
- 발표 시각 문구 추가 (`formatDeadlinePT`, PT 고정 + 라벨). results만 날짜가 없던 유일한 단계였음
- `roundThumb` 폴백 — 렌더 포스터가 null이면 채점 백필로. 기존엔 null을 "권위"로 봐서 **백필이 정작 존재 이유인 케이스를 못 잡았음**

**채점 트랙 조사 (지수 본체로 인계 완료)**
- Gemini 얼굴 일관성 **실격** (케이스1 0/3) — `reports/scoring_gemini_face_repeat_2026-07-15.md`
- Claude **재현 실패** (중립·원본 statement 둘 다 0/3) — `reports/scoring_claude_face_neutral_2026-07-15.md`
- 원시 로그 **보존됨**: `oxxovo-scoring/temp/faceconsist/` + `temp/_face_repeat*.ts` + `_extract_cases.ts` (삭제 금지)

---

## 3. TK 확인/결정 대기

| 건 | 내용 |
|---|---|
| **season_0 시상 일시** | `2026-09-09T04:00Z` = **화 9/8 9:00 PM PT**. UTC 오입력 **아님**(원본 마이그 42줄이 `'2026-09-06 21:00' AT TIME ZONE 'America/Los_Angeles'` — 밤 9시는 의도값). 날짜만 9/6→9/8 +2일 이동, 투표 마감(9/7 자정 PT) 이후로 미룬 합리적 변경으로 보임. **단 이 변경을 한 마이그가 레포에 없음**(수동 변경 추정). 9/8 21:00 PT가 맞는지 확인 필요 |
| **랭킹 실행** | season_test 순위 0건 = **아무도 admin "승인"을 안 누름**. 돌 준비는 됨(Soak weight=0, 본선 채점 10/10 completed, 투표 마감). ★"표시 데이터"가 아님 — `approveTop3Awards`가 `status='awarded'` + **상금 지급 이메일 발사**. **지수 본체 트랙**(`app/admin/applications/actions.ts`, requireAdmin) |
| **maxClips=10** | 40초엔 충분(모델 3~20초 클립). 길이가 아니라 **컷 수** 제약 — 빠른 컷 CF 원하면 걸림. 참가자 반응 보고 판단 |
| **e2e/run.mjs:159** | `posters/posters/` 하드코딩 = 리허설 하네스 재사용 모드. **시드 전용, 프로덕션 정상**. 안 고침 |

---

## 4. 배포 순서 제약 (중요)

**★ 이 브랜치를 `platform_config.session6_enabled=true` 보다 먼저 배포하면 안 됨.**
현재 session6=**false** → 프로덕션 `/apply`는 외부 URL 폼을 보여줌. 그런데 오늘 고친 챗봇 KB는 "예선·본선 모두 Studio에서 제출"이라고 답함. 먼저 배포하면 **챗봇과 실제 화면이 어긋나는 창**이 생김.
(현재 프로덕션 `/watch`는 `SITE_PUBLIC_ENABLED` coming-soon 게이트라 노출 0.)

---

## 5. 내일 대기

- **★시즌0 일정 전면 개정** (홍보 7/25~9/16 / 예선 9/17~ / 본선 9/23~ / 우승발표 9/29). 확정되면 `seasons` 날짜 컬럼 전면 마이그. **오늘 착수 안 함** — TK 확정 후.
  - 참고: 현재 값 전부 PT 의도대로 저장돼 있음(자정 경계 7개 = `07:00Z`, close = `06:59Z`, awards = `04:00Z`=21:00 PT). 개정 시 `AT TIME ZONE 'America/Los_Angeles'` 패턴 유지할 것.
- **블로커 ⑤**(시상버튼 조기클릭 차단) = **지수 본체 이관**, 내 트랙 아님
- 미착수 큐: 하네스 경로 b 후속 / Stripe 3건 / 모델 오디오
- **미해결 갭**(보고만 함, 지시 대기): `lib/chatbot-kb.ts` 예선 KB는 session6 ON 전제 / `application_video_*`=15~30은 compose 켜져 있어 무력(compose 끄면 예선이 조용히 15~30으로 회귀)

---

## 6. 정리 상태

- `oxxovo` @ 06f4a42 — 워킹트리 clean, 미푸시 0
- `oxxovo-studio` @ `feat/studio-loadtest` — clean, 미푸시 0 (오늘 변경 없음)
- `oxxovo-scoring` — 검증 스크립트 22개 삭제. 얼굴 트랙 3종 + `faceconsist/` 10개 **보존**. `frames_*` 103개는 내 작업 이전 것이라 미변경
- dev 서버 종료 (:3000 리스너 0)
- 검증용 임시 DB 쓰기 **전부 원복 확인**: season_1000 라벨 → NULL / season_test `award_rank` → NULL(status 불변, 메일 0건) / season_test2 `main_round_video_seconds` → 30
