# 레인 A 상태 — 2026-08-07 (지수2-A)

직전은 `reports/lane_a_state_2026-08-03.md`. 레인 C는 별도(`lane_c_*`).

## 1. 브랜치 / HEAD

| 레포 | 경로 | 브랜치 | HEAD |
|---|---|---|---|
| 앱 | `C:\Users\Tom\oxxovo` | `feat/studio-budget-guard` | **`605bdd8`** |
| 워커 | `C:\Users\Tom\oxxovo-studio` | `main` | `2069b8d` (오늘 변경 0, 클린) |

앱 미커밋 0 / 미푸시 0.

| 커밋 | 내용 |
|---|---|
| `7c5e1c9` | **/api/apply 외부 URL 차단 배선** + `/apply`·`MainRoundCard` 화면분 + `acceptsExternalUrl` |
| `605bdd8` | **DST 전환일 못질**(9건) + ★`npm test` 목록 누락 정정 |

## 2. 오늘 한 것

### 2-1. 외부 URL 배선 (`7c5e1c9`) — 인계문 §1 그대로 + 화면 판단분

서버 게이트는 `reports/apply_external_url_wiring_handoff_2026-08-06.md` 원문대로
(`duration_range` 직후, 정원 조회 직전, `?? []` fail-closed).

**본체가 넘긴 판단분에서 실제로 값이 나온 건 화면 쪽이다.**
`/apply`가 자기 `APPLICATION_ALLOWED_PLATFORMS = ['youtube','vimeo']`를 들고 있어서
"예선에 무엇이 허용되는가"에 답이 둘이었다 — 시즌 행과 코드. 컬럼이 `['studio']`가 된
날 둘이 갈라졌고, **화면은 초록불을 켜고 서버는 403** 하는 상태였다.

- 상수를 **지웠다**(`['studio']`로 바꾸는 게 아니라). 값을 바꿔 두면 외부 URL을 다시
  여는 시즌에서 같은 덫이 **반대 방향으로** 걸린다.
- 라벨·placeholder·경고·에러 문구 전부 컬럼 파생. ★**문구가 허용목록을 인자로 받는다**
  (`apply_err_video_platform_not_allowed(allowed)`) — 컬럼에 없는 플랫폼을 문구가
  지어낼 수 없다.
- `acceptsExternalUrl()`는 **fail-closed**. 컬럼 타입은 `string[]`이지만 값은
  `seasons_public`의 `select('*')`에서 온다 — "뷰가 안 내줬다"는 실재하는 런타임
  상태이고 그게 "전부 허용"으로 읽히면 안 된다.
- 링크 접수가 없는 시즌에는 URL 입력란 자체가 없다. `/apply`는 사실만 적은 화면
  (날짜 X, "곧" X, /studio 링크 X — session6 OFF면 그쪽도 닫혀 있어서 닫힌 문
  두 개는 하나보다 나쁘다), `MainRoundCard`는 죽은 입력란과 영원히 disabled인
  제출 버튼을 렌더하지 않는다.

**하드코딩이 아님의 증거**(`lib/video-url.test.ts` 13건)는 "studio 시즌이 유튜브를
거부한다"가 아니라 **같은 URL이 한 시즌 컬럼에선 거부되고 다른 시즌 컬럼에선 통과**
한다는 것이다. 고정 게이트는 둘 다 통과할 수 없다.

### 2-2. DST 전환일 (`605bdd8`) — 게이트는 안전, 위험은 표시에 있었다

| 대상 | 판정 |
|---|---|
| `resolveEffectiveRound`·`isInEffectiveRound` (`lib/studio.ts:193,211`) | **DST 무관** — 절대시각 비교뿐 |
| `lib/studio-round-bounds.ts` 전체 | **DST 무관** — epoch ms |
| 리스 임계(`RENDER_/MONEY_LEASE_STALE_MS`) | **DST 무관** |
| `ROUND_GRACE_MS` = 24h | **정상, 못질함**(아래) |

**실측(라이브 행)**: `application_close_at` = **Nov 4 00:00 PST**,
`main_round_*` = Nov 9 → Nov 12 (둘 다 PST, **정확히 72h**, 전환 안 밟음).
예선 창만 전환을 넘는다.

★**24h 그레이스는 "달력 하루"가 아니라 "실경과 24시간"이다.** 11/1 00:00 PDT + 24h =
**11/1 23:00 PST**. 이게 맞다 — 그레이스는 처리 중인 작업을 덮고 처리는 실시간으로
흐른다. 다만 이걸 버그로 보고 달력 연산으로 "고치면" **1년에 하루, 환불 안 된
크레딧을 한 시간치 더 준다.** 그래서 테스트가 이 값을 붙들고 있다.

## 3. ★다른 레인이 알아야 할 것 3가지

### 3-1. ★`npm test`는 glob이 아니라 파일 명시 목록이다

`package.json`의 `test` 스크립트에 **파일 이름이 하나씩 적혀 있다.** 새 `*.test.ts`를
만들어도 **목록에 넣지 않으면 `npm test`에 안 들어간다.** 직접 파일명을 쳐서 돌리면
초록이 나오므로 **통과했다고 착각하기 쉽다.**

오늘 내가 그렇게 틀렸다: `7c5e1c9` 커밋 메시지에 "167 units, 13 new"라고 썼는데
167은 13을 **뺀** 수였다. 목록 밖의 테스트는 **아무도 파일명을 기억 못 하는 날
조용히 멈추는 테스트**다. 두 파일 추가 후 **189**.

→ 새 테스트 파일을 만드는 레인은 `package.json` 목록을 같이 고쳐라.

### 3-2. ★반증 가능한 형태로 테스트를 써라 (본부 지시: 다른 하니스에도 퍼뜨릴 것)

"DST를 처리한다"는 **반증 불가**라 아무것도 못 잡는다. 대신 **같은 벽시계 값을 갖는
서로 다른 두 순간**을 넣고 **다른 답을 요구**한다:

```
FIRST_0130_PDT  = 2026-11-01T08:30:00.000Z   \  둘 다 Pacific 01:30
SECOND_0130_PST = 2026-11-01T09:30:00.000Z   /  한 시간 차이
```

로컬 달력 연산(`getHours`/`setDate`/날짜 문자열)으로 다시 쓰면 **통과할 수 없다.**
같은 형태의 다른 축: 대조군 없는 음성은 통과한다(⑤D), 반환값과 기록된 행은 다른
주장이다(2026-08-03).

### 3-3. ★C-4 문구 전제 — 제니3께 넘길 때 같이 갈 것

C단계 후 `LobbyMode`의 **`live` 하나가 세 단계**(`main_live` / `voting` /
`awaiting_results`)를 덮는다. 그래서 홈 카드는 **투표 중인지 발표 대기인지 구분하지
못한다.** 제니3의 문구 2종이 그 구분을 전제로 만들어졌다면, 전제를 세우는 건 배선
쪽이다 — 내가 **카드에 단계를 실어 보내는 배선까지** 하고 라벨 문구는 제니3 소관이다
(C-4). 현재 `MODE_BADGE.live='LIVE'`, `CD_LABEL.live='Ends in'`이고 둘 다 투표
구간에서 틀린다.

## 4. ★C단계 계획 — 제니2 승인 대기 (착수 안 함)

### 정합 정리가 아니라 라이브 결함이다

`deriveLobbyMode`(`lib/lobby.ts:64`)는 `endish = main_round_end_at ?? awards`,
`t >= endish` → `'ended'`. season_0 실측값을 넣으면:

| 구간 | 현재 카드 | 정본(`toLobbyMode`) | |
|---|---|---|---|
| ~11/4 | accepting | accepting | ✓ |
| 11/4~11/12 | live | live | ✓ |
| **11/12~11/13** | **ENDED** | main_live → live | ★ |
| **11/13~11/16** (커뮤니티 투표 중) | **ENDED** | voting → live | ★ |
| **11/16 00:00~20:00** | **ENDED** | awaiting_results → live | ★ |
| 11/16 20:00+ 우승자 有 | ended | results → ended | ✓ |
| 11/16 20:00+ **우승자 0** | ended | awaiting_results → **live** | ★ |

★**4일 20시간 동안 홈 카드가 "ENDED" + 60% 흐림**으로 뜬다 — 본선 상영과 커뮤니티
투표가 열려 있는 내내. 우승자 0이면 그 뒤로 **무한**이다. 랜딩 44시간(지수2C)과 같은
계열이고 이쪽이 더 길다.

### 단계

- **C-0 · 실패하는 테스트 먼저.** 위 표를 현행 함수에 대고 못질. 고치기 전에 결함을
  기록으로 남긴다(지수2C가 `landing-stage.test.ts:147`에서 한 방식).
- **C-1 · `winnerCount` 조달.** `results`는 증거 게이트라 이 값이 필요하다.
  ★`finalistCount`는 **불필요** — `finalists_pending`·`judging`·`main_live`가 전부
  `'live'`로 접힌다(`season-phase.ts:193` 미충족 시 `:197` `judging`). 로비가
  렌더하는 시즌은 **14개**라 N+1 금지, `award_rank IS NOT NULL`을 season_id로 한 번에.
  이 조회만 `createSupabaseAdmin()`, 시즌은 지금처럼 `seasons_public` anon 유지
  (★`seasons_public`을 service_role로 읽으면 42501).
  `community_vote_start_at`/`end_at`을 select에 추가(뷰에 있음, anon 200 확인).
- **C-2 · 위임 후 삭제.** `deriveLobbyMode`를 지우지 않고 정본 위임으로 먼저 바꾸고,
  회귀 없으면 다음 커밋에서 제거.
- **C-3 · ★카운트다운 타깃.** 지금 `countdownTarget`은 **모드**로 분기하고
  `live → main_round_end_at`이다. `live`가 투표·발표대기까지 늘어나면 **이미 지난
  시각으로 카운트다운**해서 `—`가 뜬다. **모드가 아니라 단계**로 키잉하고, **지난
  타깃은 null**.
- **C-4 · 배지/문구** = 3-3 참조. 배선까지만.

**소비처 2곳**: `app/_components/LobbySection.tsx`(홈),
`app/tournament/page.tsx`(갤러리 — draft인 현 시즌을 `seasonToLobbyCard`로 앞에 끼우므로
여기도 winnerCount 필요).

**충돌 0**: lane-c는 `lib/lobby.ts`·`LobbySection.tsx`를 건드리지 않았다
(`git log HEAD..origin/feat/studio-lane-c -- …` 공집합).

### ★D는 lane-c

`awaiting_results` 배너 단계는 `dc3f19b`/`c4d71b6`/`2b0a95f`와
`lib/landing-stage.test.ts`를 보는 레인이 해야 한다. **그 코드는 내 브랜치에 없다.**
(제니2 판정 2026-08-07)

## 5. ★모르는 것 / 남은 것

1. **★C8 — 좀비 방어가 실측된 적이 없다.** `render_jobs` 실측 = 전체 20행, 최신
   2026-07-15, 이후 활동 0. CAS는 8/02에 들어갔다 → **CAS 빌드는 프로덕션 렌더를 한
   건도 처리한 적이 없다.** "방어가 들어갔다"는 빌드 얘기지 작동 얘기가 아니다.
   go-live 체크리스트 **C8** + 리허설 런북에 넣었다. 발사 전 필수.
2. **중복 워커의 오늘 흔적은 행으로 판정 불가.** 오늘 실제로 돈 것은 렌더가 아니라
   **생성 2건**(`85fdc305`, `88a8e86e`, 둘 다 season_test·studio-demo 계정).
   `generation_jobs.claim_token`은 **53행 전부 NULL** — 두 배포 빌드 다 안 쓴다
   (생성 레인 토큰은 미배포 `40fca7f`). `r2_key`도 구분 불가(`attemptToken`이 렌더
   업로드에만 배선). **워커 로그만 남은 증거다.**
3. **`lease lost` 로그 = 내 하니스일 가능성이 높다.** 그 메시지는 `LeaseLost`
   (worker.ts:172) 렌더 경로 전용인데 렌더 행은 7/15 이후 0건이고 `season_e2e`/`zz_`
   잔존 0이다. `e2e/requeue-recovery.mjs`가 **의도적으로 stale claim을 만들어 워커가
   경주에서 지는 것을 검증하고 스스로 치운다.** 로그의 render id가 `season_e2e`/`zz_`면
   **사고가 아니라 PASS 신호**다. 지수2C에 id 조회 요청됨(제니2 경유).
4. **앱 +267 미배포**(prod는 7/13). `deploy:prod`는 ⑩ 전 실행 금지 그대로.
5. **런타임 `maxDuration`** — 8/03과 동일. ⑩ C3 이후에만 알 수 있다.
6. **Vercel↔R2 처리량** — 8/03과 동일, 여전히 측정 못 했다.
7. **부수 사실 2건은 본부로 갔다**(내가 손대지 않음): ① 파트너 대회가 season_0의
   `['studio']`를 상속한다(`app/host/new/actions.ts:171`) ② `lib/seasons.ts:255~258`
   주석 스테일.

## 6. 오늘 규율에 추가된 것

1. **테스트가 스위트에 들어 있는지 확인하는 것까지가 테스트를 쓴 것이다.** 파일명을
   직접 쳐서 나온 초록은 CI가 볼 초록이 아니다.
2. **반증 가능한 형태로 단언해라.** "X를 처리한다"가 아니라, X가 만드는 **두 개의
   구별되는 입력**을 넣고 **다른 답을 요구**한다.
3. **판별자가 없으면 0을 세지 마라.** `claim_token IS NULL` 0건은 그 컬럼을 아무도
   안 쓸 때 아무 뜻도 없다. 대조군을 같이 찍고, 못 하는 구간은 **못 한다고 말한다.**
4. **화면에서 지우는 것과 서버에서 막는 것은 둘 다 필요하다.** 하나만 하면, 서버만은
   다 써 넣고 거절당하는 UX이고 화면만은 게이트가 아니다.

관련: [[project-studio-realtest-resume]] · [[feedback-no-hardcode]] ·
[[feedback-seasons-public-view]] · [[project-lobby-v1]] · [[project-launch-rehearsal]]
