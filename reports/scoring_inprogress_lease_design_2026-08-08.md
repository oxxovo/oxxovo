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

### 2-3. staleMs — ★착수하며 15분에서 46분으로 정정됐다

설계 단계에서 실측 분포(최장 성공 106초)만 보고 **15분**을 냈다. 그건 틀렸다.
①에서 마감을 실제로 걸고 나니 **선언된 상한의 합**이 나왔고, lease 는
분포가 아니라 **그 상한 위**에 있어야 한다 — 안 그러면 sweep 이 살아 있는
작업을 회수한다. 유도는 `scorer.ts` 의 `ITEM_DEADLINE_MS` 가 계산한다:

```
yt-dlp     3회 x 120s + 3s/6s 선형 backoff        369s
ffprobe    30s (이번에 추가 — 유일하게 무제한이었다)  30s
ffmpeg     프레임 21장 x 30s (interval=max(2,dur/20)) 630s
LLM 3아암  180s x 2회, ★세 아암은 Promise.all 병렬    360s
                                                    -----
                                        ITEM_DEADLINE  1389s = 23.1분
                                        LEASE_STALE x2 2778s = 46.3분
```

★**합인 이유가 있다: `spawnSync` 가 이벤트 루프를 막는다.** yt-dlp·ffprobe·ffmpeg
는 Promise.race 로 감쌀 수 없어서 각 호출의 `timeout:` 이 유일한 상한이다.
"항목 전체에 마감 하나"는 **여기서 구현이 불가능**하고, 그런 척하면 lease 가
아무도 강제하지 않는 숫자를 근거로 삼게 된다.

★**ffmpeg 항(630s)이 지배적이고, 46분이 길면 그게 레버다.** 정상 프레임 추출은
1초 미만이라 장당 30초는 엄청난 여유다. 다만 **느린 경우를 아무도 안 재봤으므로**
낮추지 않았다 — 추측으로 낮추면 긴 영상이 추출에서 실패하기 시작한다.

`SCORING_LEASE_STALE_MS` 로 덮어쓸 수 있다.

### 2-4. 세 LLM 호출에 마감 — 무엇을 걸었나

`SCORING_LLM_TIMEOUT_MS=180000`, `SCORING_LLM_MAX_RETRIES=1`.

★**재시도를 1로 내린 것이 timeout 만큼 중요하다.** Anthropic/OpenAI SDK 기본은 2회이고,
Anthropic 문서가 직접 적어 놨다 — *"request timeouts are retried by default, so in a
worst-case scenario you may wait much longer than this timeout"*.
즉 **바깥 층이 1회라고 믿는 시도 안에서 벽시계와 토큰 지출이 3배**가 된다.
재시도 정책은 `batch.ts` 의 `MAX_RETRIES`(틱 간, DB 에 영속)가 소유해야 하고
SDK 는 일시적 딸꾹질 한 번만 흡수하면 된다.

★Gemini 는 `getGenerativeModel(modelParams, **requestOptions**)` 의 **둘째 인자**다.
modelParams 안에 넣으면 **조용히 무시되고, 아암은 무제한인 채로 제한된 것처럼 보인다.**
이 SDK 는 자체 재시도가 없어 180초가 곧 전체 벽시계다.

★그리고 `extractor.ts:144` 의 ffprobe 가 **이 파일에서 유일하게 timeout 이 없는
spawn** 이었다 — 즉 틱을 무한정 매달 수 있는 유일한 호출. 30초를 걸었다.

180초 근거: 완료 51건에서 **전체 실행** 최장이 106.2초(p90 77.0초)다. 한 아암 하나에
180초면 정상 호출을 자를 수 없다.

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

## 4. 착수 — ✅네 단계 전부 완료 (2026-08-08, 본부 승인)

| | 무엇 | 어디 |
|---|---|---|
| ① | LLM 180초 x 재시도 1 + ffprobe 30초 | `oxxovo-scoring/src/scorer.ts`, `extractor.ts` |
| ② | CAS 두 줄 — 성공 write **와** `handleFailure` 둘 다 | `src/batch.ts` |
| ③ | `reclaimStaleLeases` — 배치 시작 시 1회 | `src/batch.ts` |
| ④ | `watchScoringLeases` + 어드민 메일 | `oxxovo/lib/scoring-lease-watch.ts` → `season-tick` |

★**②가 ③보다 먼저인 이유가 실제로 있었다**: `handleFailure` 에도 같은 CAS 를 걸어야 했다.
안 걸면 되살아난 워커가 **회수 후 다시 잡아 정상 채점 중인 시도를 남의 실패로 죽인다.**
결과 write 만 보호하면 절반만 닫힌다.

★**③ 은 예선에서 `genesis_applications.status` 도 되돌린다.** `handleFailure` 가 하던 일인데
그게 못 돌아서 행이 남은 것이므로, 안 하면 회수해도 `pickPending` 의 후보 쿼리
(`status='pending'`)에 다시 안 들어온다. **회수했는데 아무도 안 집는 상태**가 된다.

★**④ 는 회수하지 않는다.** 앱이 워커의 행에 쓰면 한 메커니즘에 저자가 둘이 되고,
CAS 는 애초에 한 번에 한 소유자만 쓰라고 있는 것이다. 앱의 역할은 **말하는 것**이다.
임계는 60분(워커 46.3분 회수보다 위 — 워커가 스스로 고칠 행을 메일로 보내지 않기 위해).
두 레포가 상수를 공유할 수 없으므로 **틱 리포트에 자기가 쓴 임계를 같이 싣는다** —
값이 어긋나면 조용히 흘러가지 않고 출력에서 부딪힌다.

검증: `lib/scoring-lease-watch.test.ts` 7개(경계 포함 · NULL `started_at` = 만료 처리).

**마이그레이션 없음.** 1·2 는 워커 레포 `src/` 안이고 레인 C 와 겹치지 않는다
(레인 C 의 워커 작업은 `oxxovo-studio` 이지 `oxxovo-scoring` 이 아니다).

**시험은 게이트 함수를 직접 부른다.** `maybeFinalizeSeason` 이나 배치 루프를
부르면 통과 케이스가 **실제 채점을 발주**한다
([[feedback-test-entrypoint-must-not-enqueue]], 오늘 `_test_finalize_gate.ts` 와 같은 형태).
