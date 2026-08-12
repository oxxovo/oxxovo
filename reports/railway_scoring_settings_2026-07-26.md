# 채점 워커 Railway 설정 — TK 실행용 (2026-07-26, 대시보드 실측 반영)

근거 = `reports/scoring_500_throughput_2026-07-26.md`.
**2026-07-26 Railway CLI로 실제 구성을 읽어 확인했다. 아래는 가정이 아니라 실측값이다.**

## 실측된 현재 상태

| 항목 | 실제 값 |
|---|---|
| 프로젝트 | **`trustworthy-enchantment`** |
| 채점 서비스 | **`oxxovo-scoring`** (repo `oxxovo/oxxovo-scoring`, branch `main`) |
| Cron Schedule | **`*/5 * * * *`** (5분마다) |
| Start Command | `node dist/batch.js` |
| restartPolicy | NEVER (1회 실행 후 종료 = scheduled job) |
| `BATCH_SIZE` | **2** |
| `SEASON_ID` | `season_0` ✅ |
| `MAX_RETRIES` | 3 ✅ |
| `ROUND` | **설정 없음** → 기본값 `application` = 이 서비스가 **예선 잡**이다 ✅ |
| `SEASON_REQUIRED_STATUS` | **설정 없음** → 코드 기본값 `'scoring'` 적용 ← **★문제** |

### ★가정 정정 3건

1. **본선(`ROUND=main`) 서비스는 존재하지 않는다.** Railway 전체 4개 프로젝트를 조회한 결과
   `oxxovo-scoring` 서비스는 **딱 하나**뿐이다. → **예선/본선을 헷갈릴 위험 자체가 없다.**
   (본선 채점이 필요한 9/3~9/5 전에 별도 잡을 만들어야 한다 — 별건, `oxxovo-scoring/reports/main_round_cron_setup_2026-06.md`)
2. **cron은 `*/30`이 아니라 `*/5`였다.** 따라서 "안 바꾸면 500편에 250h" 시나리오는 **성립하지 않는다.**
3. **`BATCH_SIZE`는 1이 아니라 2다.**

### 현재 설정의 실제 처리량

`*/5` × 2편 = 5분당 2편. 1회 실행 소요 약 2.5분(40초 영상 76s/편 기준) < 주기 5분이라 겹치지 않는다.
→ **500편 = 약 20.8h. 72h 안에 3.5배 여유로 이미 들어간다.**

**즉 처리량은 지금도 통과다. 반드시 고쳐야 하는 건 아래 1건뿐이다.**

---

# ★필수 1건 — `SEASON_REQUIRED_STATUS`

`batch.ts:40` 기본값이 `'scoring'`인데 season-tick 상태머신에는 'scoring' 상태가 없다
(draft → upcoming → active → closed → completed). 변수가 없으면 기본값이 걸려
**예선 워커가 후보를 0건으로 보고 조용히 종료한다. 채점이 아예 시작되지 않는다.**

- **Variables 탭 → `+ New Variable`**
- 이름: `SEASON_REQUIRED_STATUS`
- 값: **아무것도 입력하지 않음 (빈 문자열)**
- 저장

이 한 줄이 안 되어 있으면 나머지를 아무리 손봐도 채점은 0건이다.

# 선택(권장) — 여유 확보

지금도 20.8h로 통과하지만, 40초 만편·재시도·마감 몰림을 감안한 여유를 원하면:

| 조합 | 1회 소요 | 500편 | 여유 | 비고 |
|---|---|---|---|---|
| **현재** `*/5` + 2 | 2.5분 | 20.8h | 3.5배 | 그대로 둬도 통과 |
| `*/5` + 3 | 3.8분 | 13.9h | 5.2배 | 변수 1개만 수정. p90(100s/편)이면 5분에 근접 |
| **`0 * * * *` + 30** | 38분 | **17h** | 4.2배 | **가장 안전**. 주기 60분에 38분이라 p90에도 안 겹침. 실행 횟수 288회/일 → 24회/일 |

권장 = **`0 * * * *` + `BATCH_SIZE=30`**. 컨테이너 기동 횟수가 1/12로 줄고 겹침 여유가 가장 크다.

---

# TK님 클릭 순서

## STEP 1 — 서비스 열기

1. https://railway.app 로그인 (GitHub 계정).
2. 프로젝트 목록에서 **`trustworthy-enchantment`** 클릭.
   - 다른 3개(`charming-recreation`, `fulfilling-consideration`, `just-vibrancy`)는 **스튜디오 워커**용이다. 열지 않는다.
3. 캔버스에 서비스 박스 2개가 보인다. **`oxxovo-scoring`** 을 클릭.
   - 옆의 `oxxovo-studio` 는 **건드리지 않는다.**
   - 이름으로 바로 구분된다. `ROUND` 변수를 찾아볼 필요도 없다(본선 잡 자체가 없음).

## STEP 2 — Variables 탭 (필수 1건 + 선택 1건)

상단 탭 **`Variables`** 클릭. 18개 변수가 보인다.

**(필수)** `SEASON_REQUIRED_STATUS` 가 목록에 **없다**. 추가한다:
1. **`+ New Variable`** 버튼.
2. 이름 `SEASON_REQUIRED_STATUS`, 값 **비워둠**.
3. **Add / Save**.

**(선택)** `BATCH_SIZE` 를 찾는다. 현재 `2`:
1. 값 오른쪽 **연필(수정) 아이콘** 또는 행 끝 **⋮**.
2. `30` 으로 수정 → **Save / Update**.

> 저장하면 상단에 **"Apply N changes" / "Deploy"** 배너가 뜬다. **눌러야 반영된다.**
> 스케줄 잡이라 재배포는 컨테이너 이미지만 갱신하고 즉시 실행되지는 않는다 — 다음 정각/주기에 새 값으로 돈다.

## STEP 3 — Settings 탭 (선택, BATCH_SIZE를 30으로 바꾼 경우에만)

1. 상단 **`Settings`** 탭.
2. 아래로 스크롤 → **`Cron Schedule`** 입력칸. 현재 `*/5 * * * *`.
3. 지우고 **`0 * * * *`** 입력 → 저장.
   - 맨 앞이 **0**, 뒤에 별표 4개. (`* 0 * * *` 로 넣으면 자정에 60번 돈다 — 반대로 넣지 말 것.)

> ★`BATCH_SIZE`를 30으로 올리면서 cron을 `*/5`로 두면 **1회 38분 실행이 5분 주기와 겹친다.**
> 둘은 **반드시 같이** 바꾸거나, 둘 다 그대로 두거나 해야 한다.

## STEP 4 — 확인만 (바꾸지 않음)

`Variables` 탭에서 눈으로만:

| 변수 | 있어야 할 값 |
|---|---|
| `SEASON_ID` | `season_0` |
| `MAX_RETRIES` | `3` |
| `ROUND` | **목록에 없어야 정상** (있으면 예선이 안 돈다) |

## STEP 5 — 제대로 됐는지 확인

- **`Deployments`** 탭 → 다음 실행 로그를 연다.
- 지금은 신청이 0건이라 **"처리할 항목 없음"으로 즉시 끝나는 게 정상**이다(비용 0).
  로그에 크래시나 `Invalid supabaseUrl` 같은 에러만 없으면 성공이다.
- 실제 처리량 확인은 9/3 예선심사 시작 후 `scoring_results` 행이 쌓이는 속도로 본다.
- 리허설로 미리 보려면 `SEASON_ID=season_test` 로 한 번 돌린다(끝나면 `season_0` 로 되돌릴 것).

## 하지 말 것

- `oxxovo-studio` 서비스(같은 프로젝트 안, 그리고 다른 3개 프로젝트) 변수/스케줄 변경 금지.
- 채점 서비스를 **복제해 2개로 늘리지 말 것**: `pickPending`이 항상 50행 윈도의 첫 행을 집어
  두 잡이 충돌하고 진 쪽이 배치를 조기 종료한다(데이터 손상 없음, 처리량만 손실).
