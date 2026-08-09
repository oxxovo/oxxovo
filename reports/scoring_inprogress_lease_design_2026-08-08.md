# 채점 `in_progress` 영구 제외 — lease 설계

**2026-08-08 · 지수 본체 · 본부 지시(별건 신규).**
대상 = `oxxovo-scoring` `scoring_results`. 렌더 워커 claim_token 과 같은 계열이되,
**필요한 컬럼이 이미 다 있다** — 마이그레이션 0건이다.

---

## 0. 병리 — 다시 한 줄로

`pickPending`(`batch.ts:131-136`)의 제외 집합:

```ts
done      = judged_status IN ('completed','in_progress')   // <- 여기
exhausted = judged_status = 'failed' AND processing_attempts >= MAX_RETRIES
```

`startScoringRow` 가 `in_progress` 를 찍은 뒤 **프로세스가 죽으면**
(OOM · Railway 재시작 · 컨테이너 교체 · 배포) `handleFailure` 가 안 돈다.
행은 `in_progress` 로 남고, `done` 집합에 들어가 **영원히 skip** 된다.

★조용한 이유가 세 겹이다:
- `failed` 가 아니라 **`countExhaustedFailed` 로도 안 잡힌다**(본부 지적 정확).
- 오늘 승인된 `countBlockingFailed` 로도 **안 잡힌다** — 그것도 `failed` 를 센다.
- `countUnfinished` 는 `status='verifying'` 으로 세므로 **예선은 확정이 영구 보류**된다.
  사람이 언젠가는 알아채지만 **알림이 없다.** 본선은 status 가 안 바뀌므로 그마저 없다.

현재 실측 `in_progress` 0건. 500편 10.6시간 주행에서 워커가 한 번 죽으면 생긴다.

---

## 1. ★실측 — 숫자를 고르지 않고 재서 가져온다

렌더 lease 의 규칙은 "**워커 자신의 마감이 먼저 울리고, lease 는 그 두 배**"다
(`lib/studio-lease.ts`: 35분 마감 → 70분 lease, 15분 ffmpeg → 30분 lease).
그 규칙을 여기에 그대로 쓰려다 **전제가 없다는 걸 발견했다.**

| 호출 | 마감 | 근거 |
|---|---|---|
| yt-dlp 다운로드 | **120초/회**, 최대 2회 + 백오프 | `extractor.ts:59` `YTDLP_TIMEOUT_MS` |
| ffprobe | 30초 | `extractor.ts:173` |
| **Claude / GPT / Gemini** | ★**없다** | `scorer.ts:506,576,638` — SDK 기본값에 맡겨져 있다 |

★**즉 채점 워커에는 "자신의 마감"이 없다.** SDK 기본값(Anthropic·OpenAI 10분 × 재시도)
은 우리가 정한 값이 아니고 Gemini 쪽은 사실상 무제한이다. **없는 마감의 두 배는 못 낸다.**

그래서 근거를 실측에서 가져온다. `scoring_results` 완료행 51건(season_test):

```
예선(n=41)  started_at -> judged_at 벽시계   min 25.4s   p50 47.5s   p90 77.0s   max 106.2s
본선(n=10)  같은 값                          min 22.2s   p50 41.2s   p90 72.8s   max  72.8s
```

**한 건의 최장 성공이 106초다.**

---

## 2. 설계 — ★마이그레이션 0건

### 2-1. lease 기준 시각 = `started_at` (이미 있다)

`startScoringRow` 가 잡을 때마다 `started_at` 을 **현재 시각으로 덮어쓴다**
(`batch.ts:188` UPDATE 경로, `:202` INSERT 경로 둘 다). 렌더의 `claimed_at` 과
정확히 같은 역할을 이미 하고 있다. **새 컬럼이 필요 없다.**

★확인함(실측): `scoring_results` 에 `started_at` PRESENT,
`claimed_at` / `claim_token` / `worker_id` 는 ABSENT(42703).

### 2-2. ★attempt 토큰 = `processing_attempts` (이미 있다)

렌더가 `claim_token` 을 넣은 이유는 **되살아난 워커가 끝난 워커를 덮어쓰는 것**을
막기 위해서다. 여기도 같은 위험이 있다 — `UNIQUE(application_id, round)` 라
행이 하나뿐이고, 좀비 워커의 늦은 write 가 **새로 매긴 점수를 덮는다.**

새 컬럼 없이 CAS 를 만들 수 있다. 워커가 결과를 쓸 때 조건을 두 개 건다:

```ts
.eq('judged_status', 'in_progress')          // (A) 아직 내가 잡고 있는 상태인가
.eq('processing_attempts', myAttempt)        // (B) 그 잡음이 내 잡음인가
```

- sweep 이 상태를 `in_progress` -> `failed` 로 바꾸면 **(A) 가 깨진다.**
- 그 뒤 다른 워커가 다시 잡으면 `processing_attempts` 가 +1 되어 **(B) 가 깨진다.**

**두 창이 둘 다 닫힌다.** `startScoringRow` 는 이미 attempt 번호를 반환하므로
(`return nextAttempts`), 워커 쪽 변경은 write 에 조건 두 줄과 "0행이면 좌초로
기록하고 조용히 넘어간다" 처리뿐이다.

★**sweep 은 `processing_attempts` 를 올리지 않는다.** 죽은 그 시도는 잡을 때
**이미 카운트됐다.** sweep 이 또 올리면 크래시 한 번이 재시도 예산을 두 칸 먹는다.

### 2-3. staleMs = 15분 — 유도 과정을 적는다

```
한 건 최장 성공 벽시계 (실측 51건)                       106초
+ yt-dlp 최악 (120초 x 2회 + 백오프) 이 그 안에 없었을 경우   ~300초
= 현실적 최악의 "정상" 한 건                              ~7분
x 2 (렌더 lease 와 같은 규칙: 마감이 먼저, lease 는 그 두 배)  ~14분
-> 15분 (SCORING_LEASE_STALE_MS, env 로 조정 가능)
```

★**두 배인 이유는 여유가 아니라 순서다.** 워커 자신이 먼저 실패로 마감해야 하고
sweep 은 **정리 못 하고 죽은 것만** 줍는 것이어야 한다. 살아 있는 작업을 회수하면
좀비 두 마리가 같은 행을 쓴다 — 2-2 의 CAS 가 그걸 안전하게 만들지만,
안전한 것과 안 일어나는 것은 다르다.

★그리고 **2-3 은 2-4 가 없으면 근거가 반쪽이다**: LLM 호출에 마감이 없으므로
"정상 한 건"의 상한이 실측 분포일 뿐 보장이 아니다.

### 2-4. ★선행 권고 — 세 LLM 호출에 마감을 건다

lease 를 넣기 전에 `scorer.ts` 의 세 클라이언트에 명시적 timeout 을 준다.
지금은 SDK 기본값에 맡겨져 있고, **그 값은 우리가 고른 적이 없고 벤더가 바꿀 수 있다.**
p90 이 77초이므로 호출당 180초면 정상 건을 자르지 않는다.

이게 들어가면 2-3 의 유도가 "실측 분포"가 아니라 **"우리가 건 마감의 두 배"** 가 되고,
렌더 lease 와 같은 근거 형태가 된다.

---

## 3. 어디에 두나 — ★둘로 나눈다

`lib/studio-lease.ts` 는 sweep 을 **앱**에 둔 이유를 적어 놨다:
"워커 안의 sweep 은 그것이 필요한 바로 그 상황에서 죽어 있다."
돈이 걸린 레인은 워커가 죽어도 **환불은 일어나야** 하기 때문이다.

채점은 돌려줄 돈이 없다. 그래서 이유가 갈린다:

| | 어디 | 무엇을 | 왜 |
|---|---|---|---|
| **회수** | **워커**(`batch.ts` 시작 시 1회) | stale `in_progress` -> `failed` | 회수는 **워커가 살아 있을 때만 의미**가 있다. 재시작 직후가 정확히 그 순간이고, 크론 슬롯도 파일 소유권 충돌도 없다 |
| **경보** | **앱**(`season-tick`) | lease 초과 행이 있으면 어드민 메일 | ★**함대가 계속 죽어 있는 경우**를 잡는다. 그때는 회수해도 소용없지만 **사람은 알아야** 한다. 지금은 아무도 모른다 |

★**경보를 뺄 수 없는 이유**: 회수만 넣으면 "워커가 살아 있는 동안"은 완전해지지만,
워커가 영영 안 올라오는 시나리오는 **여전히 완전히 조용하다.** 그게 본부가 지적한
"어떤 카운터에도 안 잡힌다"의 나머지 절반이다.

앱 쪽 경보는 `sweepStudioLeases` 의 `report.overdue` 와 같은 모양이고,
`sendAdminAlert` 가 이미 있으므로 새 배관이 없다.

---

## 4. 착수 단위 (승인 주시면 이 순서)

1. **`scorer.ts` 세 호출에 timeout 180초** — 단독으로도 이득이고, 2-3 의 근거가 된다.
2. **CAS 두 줄** — 결과 write 에 `(A)(B)` 조건. 0행이면 좌초 로그.
   ★이게 회수보다 먼저다. 회수가 열어 주는 창을 닫는 것이 CAS 이므로,
   순서가 바뀌면 회수를 넣는 순간 덮어쓰기 창이 열린다.
3. **워커 회수** — `batch.ts` 시작 시 stale `in_progress` -> `failed`.
4. **앱 경보** — `season-tick` 에서 lease 초과 행 카운트 + 어드민 메일.

**마이그레이션 없음.** 1·2 는 워커 레포 `src/` 안이고 레인 C 와 겹치지 않는다
(레인 C 의 워커 작업은 `oxxovo-studio` 이지 `oxxovo-scoring` 이 아니다).

**시험은 게이트 함수를 직접 부른다.** `maybeFinalizeSeason` 이나 배치 루프를
부르면 통과 케이스가 **실제 채점을 발주**한다
([[feedback-test-entrypoint-must-not-enqueue]], 오늘 `_test_finalize_gate.ts` 와 같은 형태).
