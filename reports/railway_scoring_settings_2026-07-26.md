# 채점 워커 Railway 설정 변경 — TK 실행용 (2026-07-26)

근거 = `reports/scoring_500_throughput_2026-07-26.md`.
**이 변경을 안 하면 500편 채점에 약 250h가 걸려 72h 창을 178h 초과한다.**
엔진은 충분히 빠르다(500편 10.6h). 바꾸는 건 **처리량 설정 2개**뿐이다.

## 어디를 바꾸나 — 서비스 특정

Railway 프로젝트 안에 `oxxovo-scoring` 레포로 만든 서비스가 **2개** 있다
(둘 다 `railway.json`: Dockerfile 빌드 + `restartPolicyType: NEVER` = 1회 실행 후 종료하는 scheduled job).

| 구분 | 어떻게 알아보나 | 이번에 바꿀 대상 |
|---|---|---|
| **예선 잡** | Variables에 `ROUND` 가 **없음**(기본값 = `application`). Start Command = `node dist/batch.js` | **★이것** |
| 본선 잡 | Variables에 `ROUND=main` 있음, 또는 Start Command = `ROUND=main node dist/batch.js` | 지금은 그대로 |

예선 잡이 9/3~9/5 예선심사 창에서 500편을 도는 잡이다. 본선은 50편이라 현재 설정으로도 충분하다.

## 바꿀 값 2개 (예선 잡)

### 1. Variables 탭 → `BATCH_SIZE`

```
BATCH_SIZE = 30
```

현재 값은 `1`(코드 기본값도 `1`). 이 값 = **cron 1회 실행당 처리할 영상 편수**.
`batch.ts`는 한 번 깨어나 BATCH_SIZE개를 **직렬로** 채점하고 종료한다.

### 2. Settings 탭 → Deploy → **Cron Schedule**

```
0 * * * *
```

현재(문서 권장치) `*/30 * * * *`. 매시 정각 1회로 바꾼다.

### 왜 이 조합인가

| cron | BATCH_SIZE | 1회 소요 | 500편 총 | 판정 |
|---|---|---|---|---|
| `*/30` | 1 | 1분 | **250h** | 72h를 178h 초과 |
| `*/5` | 1 | 1분 | 42h | OK |
| **`0 * * * *`** | **30** | **38분** | **17h** | **OK (여유 4.2배) ← 권장** |
| `0 * * * *` | 40 | 51분 | 13h | OK |

1회 38분 < 주기 60분이라 실행이 겹치지 않는다(전 편이 p90 100s/편인 최악에도 50분).
1,000편으로 늘려도 34h로 72h 안에 들어간다.

## 같이 확인할 것 (예선 잡 Variables)

| 변수 | 있어야 할 값 | 안 맞으면 |
|---|---|---|
| `SEASON_REQUIRED_STATUS` | **빈 문자열** (`SEASON_REQUIRED_STATUS=`) | 기본값이 `'scoring'`인데 season-tick에 그런 상태가 없어 **0건으로 조용히 종료**. 채점이 아예 안 돈다 |
| `SEASON_ID` | `season_0` | 미설정이어도 코드 기본값이 `season_0`이라 동작은 함. 명시 권장 |
| `ROUND` | (없음 = application) | `main`이 들어가 있으면 예선을 안 돈다 |
| `MAX_RETRIES` | 3 (기본) | 그대로 |

## 하지 말 것

- **예선 잡을 2개로 늘려 병렬 처리하지 말 것.** `pickPending`이 항상 50행 윈도의 첫 행을 집어
  두 잡이 같은 행에서 충돌하고, 진 쪽이 배치 전체를 조기 종료한다(데이터 손상은 없고 처리량만 손실).
  여유가 6.8배라 병렬화 자체가 불필요하다.
- 채점이 다 끝난 뒤 cron을 굳이 끌 필요는 없다 — 대상이 없으면 0건으로 종료한다(무비용).

## 변경 후 확인

1. Railway 예선 잡 → Deployments 로그에서 다음 정각 실행이 `BATCH_SIZE=30`으로 돌았는지.
2. `scoring_results`에서 해당 시각 `started_at` 행 수가 늘어나는지.
3. 리허설로 미리 검증하려면 `SEASON_ID=season_test`로 동일 조합을 한 번 돌려본다.
