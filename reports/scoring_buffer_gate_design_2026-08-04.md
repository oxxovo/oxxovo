# 24h 처리버퍼 게이트 (a) + 부분 코호트 확정 (b) — 설계안

**2026-08-04 · 지수 본체 · 코드 이전 단계. 본부 승인 전.**
어제(8/3) 본부 지시분. 수정 하나로 (a)(b) 두 건이 닫힌다.

---

## 0. 병리

### (a) 24h 처리버퍼가 집행되지 않는다

`scoringGateReason` (`oxxovo-scoring/src/batch.ts:140~152`) 은 마감 시각 컬럼
**하나만** 본다.

```ts
const closeAt = season[cfg.gateCloseField];      // 예선 = application_close_at
if (!closeAt) return '... NULL';
if (new Date(closeAt).getTime() > now.getTime()) return '... 아직 마감 전';
if (cfg.applySeasonStatusGate && SEASON_REQUIRED_STATUS && ...) return '...';
return null;                                      // ← 통과
```

`scoring_start_at` 조건이 없다. 확정 구조는 **72h 제작+제출 → 24h 처리버퍼(렌더·
확정·이메일, 비동기) → 채점** 인데([[project-prelim-load-structure]]),
현재는 `application_close_at` 이 지나는 **그 순간** 채점이 시작된다.
렌더가 아직 R2 에 안 내려앉은 제출은 `free_entry_url` 이 NULL 이라
`pickPending` 의 `.not(videoField,'is',null)` 에 걸려 **큐에서 안 보인다.**

### (b) 부분 코호트로 Top N 이 확정될 수 있다

`maybeFinalizeSeason` (`recommendations.ts:85~100`) 은 `countUnfinished` 만 보고
Top N 을 확정하고 `scoring_complete_at` marker 를 박는다. marker 는
`.is('scoring_complete_at', null)` 가드가 있어 **1회성** — 즉 **되돌릴 수 없다.**

`countUnfinished` 는 `status ∈ ('pending','verifying')` 만 센다. 비동기 접수에서
렌더 미착지 행이 이 두 status 밖(예: `studio_submission_state` 기반 중간 상태)에
있으면 **0으로 세어지고**, 큐도 비어 보이므로 그 순간 확정이 발동한다.
아직 도착 중인 제출이 Top N 에서 영구히 빠진다.

### ★실측 확인 (2026-08-04)

```
season_0   close 2026-09-30T07:00Z   scoring_start_at 2026-10-01T07:00Z
           → 간격 정확히 24.0h        (5주 연기 SQL 미적용 상태의 값. 상대 간격은 불변)
```

**컬럼은 이미 있고, 값도 이미 24h 로 들어가 있다. 마이그레이션 불필요.**
집행 코드만 없다.

---

## 1. 설계 — 게이트에 조건 하나를 더한다

`scoringGateReason` 에 예선 전용 3번째 조건을 추가한다.

```ts
interface RoundConfig {
  ...
  /** 처리버퍼 종료 시각 컬럼. null = 이 라운드엔 버퍼 개념 없음(본선). */
  gateStartField: 'scoring_start_at' | null;
}
// 예선: gateStartField: 'scoring_start_at'
// 본선: gateStartField: null
```

```ts
function scoringGateReason(cfg, season, now): string | null {
  const closeAt = season[cfg.gateCloseField];
  if (!closeAt) return `${cfg.gateCloseField} 이 NULL (마감 시각 미설정)`;
  if (new Date(closeAt).getTime() > now.getTime())
    return `${cfg.gateCloseField}(${closeAt}) 이 미래 (아직 마감 전)`;

  // ★(a) 처리버퍼. 마감 후 렌더·확정·이메일이 끝날 때까지 채점을 시작하지 않는다.
  //   NULL 은 통과가 아니라 차단이다 — 버퍼가 언제 끝나는지 모르면
  //   "안 돌린다"가 안전한 쪽이고, 조기 채점은 되돌릴 수 없다(§0-b marker).
  if (cfg.gateStartField) {
    const startAt = season[cfg.gateStartField];
    if (!startAt) return `${cfg.gateStartField} 이 NULL (처리버퍼 종료 시각 미설정)`;
    if (new Date(startAt).getTime() > now.getTime())
      return `${cfg.gateStartField}(${startAt}) 이 미래 (처리버퍼 진행 중)`;
  }

  if (cfg.applySeasonStatusGate && SEASON_REQUIRED_STATUS && season.status !== SEASON_REQUIRED_STATUS)
    return `season.status='${season.status}' (요구='${SEASON_REQUIRED_STATUS}')`;
  return null;
}
```

`fetchSeason` 의 select 에 `scoring_start_at` 추가, `SeasonRow` 에 필드 추가.
**그게 전부다. 마이그레이션 없음, 새 컬럼 없음, 하드코딩 없음** — 버퍼 길이는
`seasons` 두 컬럼의 차이로 시즌마다 정해진다.

### 이것이 (b)를 같이 닫는 이유

`maybeFinalizeSeason` 은 `main()` 안에서 **게이트를 통과한 뒤에만** 호출된다
(`batch.ts:458~463` 에서 차단 시 `return`). 버퍼가 끝나기 전에는 배치가
아예 0건으로 종료되므로 **확정이 발동할 창 자체가 없어진다.**

### 본선은?

`main_round_*` 에는 버퍼 컬럼이 없다. 본선은 `runFinalize: false` 라 (b) 대상도
아니다. **본선 게이트는 지금 그대로 시간 단독으로 둔다** (`gateStartField: null`).
본선에도 버퍼가 필요하다는 판단이 서면 그때 컬럼을 추가한다 — 지금 없는 개념을
미리 만들지 않는다.

---

## 2. 완결성 검사 — 어디에 넣을지

버퍼 게이트는 "너무 일찍 시작"을 막는다. 그러나 버퍼가 끝난 **뒤에도** 렌더가
안 내려앉은 제출이 남아 있을 수 있다(워커 장애·fal 지연). 그 경우
`pickPending` 은 여전히 못 보고, `countUnfinished` 도 status 기준이라 놓칠 수 있다.

**넣을 자리: `maybeFinalizeSeason` 의 `countUnfinished` 검사 바로 옆.**
확정 직전이 유일하게 "빠진 게 있으면 안 되는" 지점이기 때문이다. 게이트에 넣으면
채점 전체가 멈춰 나머지 정상 제출까지 인질이 된다.

```ts
/** 접수됐으나 채점 대상이 될 수 없는 행 — 영상 URL 이 없는 신청. */
async function countUndeliverable(seasonId, videoField): Promise<number> {
  // status 로 세지 않는다. status 는 비동기 제출 설계에 따라 바뀔 수 있고,
  // (b) 의 원인이 바로 status 기준 집계였다. 대신 '채점 불가'라는 사실 자체를 센다.
  const { count } = await sb.from('genesis_applications')
    .select('id', { count: 'exact', head: true })
    .eq('season_id', seasonId)
    .not('status', 'in', '("rejected","withdrawn","waitlist")')
    .is(videoField, null);
  return count ?? 0;
}
```

`maybeFinalizeSeason` 안:

```ts
const undeliverable = await countUndeliverable(seasonId, 'free_entry_url');
if (undeliverable > 0) {
  // 확정하지 않는다. marker 도 안 박는다(1회성이라 되돌릴 수 없다).
  // 사람이 판단할 일이다 — 시스템 오류로 사용자를 탈락시키지 않는다.
  console.log(`  ⚠️ 영상 미착지 ${undeliverable}건 — Top N 확정 보류. 어드민 검토 필요.`);
  await sendAdminEmail(seasonId, 0, 0, { undeliverable });   // 에스컬레이션
  return;
}
```

### 무한 보류를 어떻게 다루나

일부러 무한 보류로 둔다. 자동 타임아웃을 넣으면 "24h 지났으니 빼고 확정" 이 되고,
그건 곧 **시스템 오류로 참가자를 탈락시키는 것**이다
([[project-system-error-not-user-rejection]]). 대신:

- 매 배치마다 로그 + 어드민 이메일(중복 억제는 marker 아닌 로그 기준).
- 해소 경로는 이미 있다: 렌더 재시도, 또는 어드민이 해당 행을 명시적으로
  `rejected`/`withdrawn` 으로 처리 → 위 카운트에서 빠진다.
- **사람이 "이건 빼고 간다"를 눌러야 코호트가 닫힌다.** 자동화 철학의 예외 조항이
  아니라, 애초에 "부정 방지"가 아니라 "오류 처리"라 사람 판단이 맞는 자리다.

---

## 3. 롤아웃 시 주의 — 새 차단 조건이라 기존 시즌을 멈춘다

실측:

| 시즌 | close | scoring_start_at | 새 게이트 판정 |
|---|---|---|---|
| `season_0` | 2026-09-30T07:00Z | 2026-10-01T07:00Z (+24.0h) | 정상 |
| `season_test` | 2026-07-11T06:59Z | **2026-09-07T07:00Z** | 차단 |
| `season_test2` | 2026-07-15T06:59Z | **2026-09-07T07:00Z** | 차단 |

두 테스트 시즌의 `scoring_start_at` 은 스테일이다(`completed`/`closed` 라 실해는
없다). 다만 **리허설 하니스에 영향**이 있다:

- `scripts/rehearsal-*` 가 시계를 압축할 때 `application_close_at` 만 당기면
  이제 채점이 안 돈다. **`scoring_start_at` 도 같이 당겨야 한다.**
- 이건 하니스 수정 1줄이지만, 안 하면 "워커가 조용히 0건" 으로 나타나
  원인을 찾는 데 시간을 쓴다. 롤아웃 체크리스트에 넣는다.

---

## 4. 검증 방법 (크레딧 불필요 — 채점 호출 없음)

게이트는 순수 함수라 AI 호출 없이 검증된다.

1. `scoringGateReason` 단위 테스트 6케이스:
   close NULL / close 미래 / start NULL / start 미래 / 둘 다 과거 / 본선(start 무시).
2. `season_test2` 로 실주행 1회 — 현재 `scoring_start_at`=9/7 이므로
   **"처리버퍼 진행 중" 으로 차단되고 0건 종료** 되어야 한다(현재는 채점을 시작한다).
   그 뒤 `scoring_start_at` 을 과거로 되돌려 통과 확인.
   ★단 이건 `season_test2` 12행을 실제로 채점하게 되므로 **차단 확인까지만** 하고,
   통과 확인은 `BATCH_SIZE=0` 대신 로그로만 본다.
3. `countUndeliverable` 은 season_test2 에서 0 이어야 한다(실측: URL 12/12 존재).

---

## 5. 순서

```
0) 본부 승인 (이 문서)
1) batch.ts: gateStartField + scoringGateReason 조건 + fetchSeason select
2) recommendations.ts: countUndeliverable + 확정 보류 + 어드민 에스컬레이션
3) 단위 테스트 6 + season_test2 차단 실주행
4) 리허설 하니스에 scoring_start_at 동반 이동
5) 배포(Railway 재배포) — season_0 은 값이 이미 맞으므로 TK 작업 없음
```

**Defect1(①)과 파일이 겹치지 않는다** — 이쪽은 `batch.ts`/`recommendations.ts`,
Defect1 은 `scorer.ts`. 병렬 가능.

관련: [[project-prelim-load-structure]] · [[project-jisoo-queue-2026-07-28]] ·
[[project-system-error-not-user-rejection]] · [[feedback-no-hardcode]]
