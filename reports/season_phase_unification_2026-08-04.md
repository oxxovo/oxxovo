# getSeasonPhase 통합 — 실측 + 정본 + 단계 이행 계획

**2026-08-04 · 지수 본체 · [본체]④.** 본부 착수 지시(③이 ④에 의존).
1단계(정본 모듈 + 테스트) **완료·미배선**. 2단계 이후는 승인 후.

---

## 1. 실측 — "이 시즌이 지금 어느 단계인가"에 답이 6개다

| # | 어디 | 판정 순서 | 산출 |
|---|---|---|---|
| 1 | `getBannerStage` (`lib/watch.ts:502`) | awards → vote → main → close | 6단계 배너 |
| 2 | `deriveLobbyMode` (`lib/lobby.ts:64`) | status → (mainEnd ?? awards) → open → close | 4모드 |
| 3 | `desiredStatus` (`season-tick/route.ts:72`) | **awards → close → open** | DB status 4종 |
| 4 | `inMainRound` (`ArenaWatch.tsx:73`, `api/watch/stats/route.ts:30`) | `now >= mainStart`, **상한 없음** | 라운드 라벨 |
| 5 | `resolveSeasonCta` (`lib/seasons.ts:352`) | open/close | CTA 3종 |
| 6 | `isApplicationClosed` / `isBeforeApplicationOpen` (`lib/seasons.ts:341,370`) | close / open, **null=열림** | 서버 게이트 |

(추가로 `lib/studio-round-bounds.ts`·`lib/studio-lease.ts`는 이미 주석으로
"getSeasonPhase 가 단계를 소유한다"고 선언하고 자기는 타임스탬프만 본다 — 이미 정합.)

### 실제로 어긋나는 지점 3가지

1. **순서가 다르다.** #3 은 awards 를 **가장 먼저** 본다. open/close 가 NULL 이고
   awards 만 있는 행이 `completed`(rank 4)로 전이되고 forward-only 가 못 막는다.
   → `season_1` 이 2026-10-13 에 그럴 예정이었다(season_0 접수 한복판).
2. **상한이 없다.** #4 는 `now >= mainStart` 뿐이라 투표·결과 단계에서도 계속
   "Main Round" 다. 배너(#1)는 이미 voting/results 로 넘어가 있어 **한 화면에서
   두 말이 나온다.** `ArenaWatch.tsx:149~162` 에 이걸 가리는 stopgap 이 있고,
   주석에 *"canonical getSeasonPhase() 가 나오면 흡수된다"* 고 적혀 있다.
3. **null 정책이 셋이다.** 같은 `application_close_at` 을 두고 —
   로비(#2)는 "아직 접수 중", `isApplicationClosed`(#6)는 "열림",
   채점 게이트(`oxxovo-scoring src/gate.ts`)는 **차단**.

### 증거 게이트는 이미 부분적으로 존재한다 (살려야 할 것)

`getBannerStage` 는 **날짜만으로 결과를 선언하지 않는다** — `winnerCount > 0`
(award_rank 는 `approveTop3Awards` 수동 승인)과 `finalistFilmCount` 를 같이 본다.
이 정직성 규칙이 이번 통합에서 **가장 지키고 싶은 것**이고, 정본에 그대로 옮겼다.
반대로 #3 은 날짜만 보고 `completed` 로 간다 — 그래서 둘이 어긋난다.

---

## 2. 정본 — `lib/season-phase.ts` (완료, 순수 함수, 미배선)

```
draft → upcoming → accepting → judging → finalists_pending
      → main_live → voting → awaiting_results → results
```

- **순서가 있다.** `phaseIndex` / `phaseAtLeast` 가 성립한다.
  ★"시계가 흐를 때 단계는 절대 뒤로 안 간다"를 **속성 테스트**로 박았다
  (5개월치를 6시간 간격으로 훑는다).
- **`awaiting_results` 는 이번 통합이 드러낸 신규 단계다.** 투표는 끝났는데
  순위는 아직 승인 안 된 구간. 실재하는 상태인데 기존 6단계 배너 enum 에 자리가
  없었다. 처음엔 `ended` 로 뒀다가 **속성 테스트가 잡았다** — 시계상 `results`
  보다 먼저 도달하는데 뒤에 정렬돼 순서가 거짓이 됐다. 테스트를 고치지 않고
  단계 집합을 고쳤다.
- **★NULL 정책 한 곳**: *비어 있는 경계는 "미정"이고, 미정 경계는 절대 단계를
  전진시키지 않는다.* 예외는 `application_open_at` 하나 — 없으면 "영원히 열림"이
  아니라 `draft`(일정 미정 티저)다. **이게 season_1 을 구조적으로 막는다.**
- **증거 게이트**: `results` 는 `winnerCount > 0`, `finalists_pending` 은
  `finalistCount > 0` 이 있어야 한다. 달력이 앞서 있어도 관객에게 거짓말하지 않는다.
- **`isProcessingBuffer`** 서브플래그 — 마감~`scoring_start_at` 구간. 관객에겐
  같은 'judging' 이지만 운영자는 구분해야 한다. 채점 워커 `src/gate.ts` 와 같은
  컬럼을 본다(둘이 어긋나면 이쪽이 틀린 것).

### 투영 (각 화면은 판정하지 않고 **매핑만** 한다)

| 함수 | 대체 대상 |
|---|---|
| `toLobbyMode` | #2 `deriveLobbyMode` |
| `toDbStatus` | #3 `desiredStatus` |
| `toBannerStage` | #1 `getBannerStage` 의 단계 판정부 |
| `toRoundName` | #4 `inMainRound` 2곳 + `cardRoundName` stopgap |
| `canApply` | #6 서버 게이트 |
| `scoringRoundFor` | `api/watch/stats` 의 라운드 선택 |

### 이 통합이 바꾸는 동작 2가지 (★승인 필요)

1. **`toDbStatus('awaiting_results') = 'closed'`** — 지금은 awards 날짜가 지나면
   순위가 0건이어도 `completed` 로 간다. 정본은 **우승자가 기록돼야** `completed`.
   DB status 와 화면이 같은 말을 하게 된다. forward-only 라 역행 위험은 없다.
2. **`toBannerStage('awaiting_results') = 'judging'` (★손실 매핑)** — 6단계 enum 에
   "투표 종료·발표 전"이 없다. 여섯 중 *일어나지 않은 일을 주장하지 않는* 유일한
   값이라 보수적으로 착지시켰다. **배너 이행 때 단계를 하나 늘리는 게 정답**이고,
   그건 문구 작업이라 지수2/제니2 영역이다.

### 검증 (크레딧 0, DB 0)

```
node --import ./scripts/test-register.mjs --test lib/season-phase.test.ts   18/18 PASS
npm test                                                                    148/148 PASS
npx tsc --noEmit                                                            0
```

픽스처는 **실측 행**이다 — season_0 의 실제 8컬럼, season_1 의 수정 전 스테일 5컬럼.

---

## 3. 단계 이행 (아직 안 함 — 배선 순서)

★**지금 배선하지 않은 이유**: 랜딩 카운트다운을 /watch 6단계 기계로 재사용하는
작업이 다른 레인에서 진행 중이다. 정본만 먼저 세워 두면 그쪽이 착지한 뒤
**한 번에** 갈아끼울 수 있고, 그 사이 충돌이 없다.

| 단계 | 대상 | 위험 | 비고 |
|---|---|---|---|
| A | `api/watch/stats` + `ArenaWatch` 의 `inMainRound` → `toRoundName` | 낮음 | **stopgap 삭제**가 결과물 |
| B | `season-tick` `desiredStatus` → `toDbStatus` | ★중간 | 위 변경 1번 포함. season_1 류 구조적 차단 |
| C | `lib/lobby.ts` `deriveLobbyMode` → `toLobbyMode` | 낮음 | 랜딩 레인 착지 후 |
| D | `getBannerStage` 단계 판정부 → `toBannerStage` (문구는 그대로) | 중간 | 배너 enum 에 단계 추가 검토 |
| E | `/api/apply` · studio 게이트 → `canApply` | 낮음 | 외부 URL 차단 배선과 같은 파일 → **지수2A 와 순서 조율** |

각 단계마다 기존 함수를 지우지 않고 **정본 위임(delegate)** 으로 먼저 바꾼 뒤,
회귀가 없으면 다음 커밋에서 제거한다.

### ③ 어워드 3겹 게이트와의 관계

본부 판단대로 ③은 ④에 의존한다. 정본이 서면 어워드 게이트의 세 겹이
`phase === 'results'` · `winnerCount > 0` · 관리자 승인으로 **자동 정합**한다 —
`awaiting_results` 가 별도 단계로 존재하는 덕분에 "발표일은 지났는데 순위는 없다"가
게이트에서 표현 가능해진다. ③ 착수 시 이 파일을 전제로 쓴다.

관련: [[project-jisoo-resume-2026-08-04]] · [[feedback-no-hardcode]] ·
[[project-prelim-load-structure]]
