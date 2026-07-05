# 발사 전 리허설 — 시간압축 전 과정 실주행 (season_test)

**목적:** 발사(7/25)와 똑같은 자동화 파이프라인이 실제로 도는지 한 세션에 완주 검증.
접수 → 예선마감(자동) → Triple-AI 예선심사 → 본선진출 상위N(자동) → 본선제출 → 본선심사 → 관객투표 → 시상(1·2·3등).

**★안전 전제 (반드시 지킬 것):**
- 반드시 **7/25(season_0 접수오픈) 전**에. 지금 season_0 pending=0이라 안전.
- 채점 워커 후보 쿼리가 **season-blind**(season_id 필터 없음). → season_test 외 어느 시즌에도 `pending`/`main_round_submitted` 행이 없어야 함. season_0가 pending 0인 지금만 안전.
- 실제 **season_0는 절대 안 건드림**. 모든 스크립트는 `season_test`에만 키.

---

## 자동 vs 수동 (이 리허설로 검증되는 경계)

| 구동 주체 | 담당 | 리허설 |
|---|---|---|
| 🟢 Vercel Cron `season-tick` (매시각, 수동 핑 가능) | 상태전환·연기·**Finalist 진출**(advance RPC) | 스크립트가 날짜 세팅 후 실제 cron 핑 |
| 🔴 **채점 워커** (oxxovo-scoring, Railway scheduled job) | Triple-AI 예선·본선 채점 | **운영자가 수동 실행** (2회) |
| 🔴 **admin 시상 승인** (approveTop3Awards) | 1·2·3등 배정 | 스크립트 or /admin UI |
| 🟡 크리에이터 본선 제출 | main 영상 업로드 | submit-main 스크립트로 시뮬 |

**★워커 자동화 판정 (발사 런북 체크):**
- 워커는 **Railway scheduled job** (배치 1회 실행 후 종료; `railway.json` restartPolicy=NEVER).
- **발사 때 "자동"이려면:** (a) Railway 대시보드에 **cron 스케줄 2개 등록**(예선 `ROUND=application` / 본선 `ROUND=main`) + (b) `SEASON_REQUIRED_STATUS=''` 환경변수 + (c) `SEASON_ID` 대상 시즌. railway.json에 스케줄이 없어 **대시보드 등록 여부는 별도 확인 필요**.
- **함정1:** `SEASON_REQUIRED_STATUS` 기본값 `'scoring'`인데 season-tick엔 'scoring' 상태가 없음 → 예선 워커가 안 물음. 리허설/발사 모두 **`SEASON_REQUIRED_STATUS=''` 필수**.
- **함정2 (후속):** season-blind 후보 쿼리 → 시즌1+ 전 "워커 시즌 필터" 수정 필요.

---

## 준비물
- `oxxovo` 레포에서 스크립트 실행: `node --env-file=.env.local scripts/rehearsal-*.mjs`
- cron 핑 대상: 기본 `https://www.oxxovo.ai` (프로덕션 실 cron). 로컬 dev 서버로 하려면 `REHEARSAL_CRON_BASE=http://localhost:3000`.
- 창 길이 조절: `REHEARSAL_WINDOW=10` (분, 카운트다운/투표창 기본 10분).
- 워커: `C:\Users\Tom\oxxovo-scoring`에서 실행.

---

## 순서 (각 단계 후 `/watch` 눈으로 + `rehearsal-status.mjs`로 확인)

대시보드(아무 때나): `node --env-file=.env.local scripts/rehearsal-status.mjs`

### 0) 리셋 — 갓 제출된 상태로 초기화
```
node --env-file=.env.local scripts/rehearsal-reset.mjs
```
→ 20편 status=pending, 점수/수상/투표/본선영상 제거, season_test 날짜 초기화. 본선영상 URL 풀은 스태시(나중에 재적용).

### 1) 접수 오픈 (🔴 LIVE)
```
node --env-file=.env.local scripts/rehearsal-stage.mjs open
```
→ cron 핑으로 draft→active. **확인:** `/watch` Hero가 season_test, LIVE 점 + 실시간 스탯 + "예선 마감까지 …" 카운트다운. (LiveStatus UI 배포 후)

### 2) 접수 마감 (자동)
```
node --env-file=.env.local scripts/rehearsal-stage.mjs close
```
→ active→closed (cron이 날짜 보고 자동).

### 3) Triple-AI 예선 채점 — ★워커 수동 실행
`oxxovo-scoring`에서 (예선 20편, `BATCH_SIZE`는 1잡당 처리량; 20편이면 여러 번 or 크게):
```
SEASON_REQUIRED_STATUS="" SEASON_ID=season_test ROUND=application BATCH_SIZE=20 node dist/batch.js
```
→ 20편 채점, status eligible/flagged, scoring_results(application) 생성.
**확인:** `rehearsal-status.mjs`에서 prelim 점수 채워짐. flagged 있으면 4)가 blocked → /admin/applications에서 eligible/rejected로 해소.

### 4) 본선 진출 (자동, 상위 N Finalist)
```
node --env-file=.env.local scripts/rehearsal-stage.mjs advance
```
→ `scoring_complete_at` 과거 세팅 + cron 핑 → `advance_season_finalists` RPC: 상위 N='selected', 나머지 'rejected'. (20편 기준 N=10: pct 0.1→2, min 10으로 clamp)
**확인:** advancements 리포트 + status 'selected'/'rejected' 분포.

### 5) 본선 제출 (시뮬)
```
node --env-file=.env.local scripts/rehearsal-submit-main.mjs
```
→ finalists(selected)에 본선영상 부여 + status=main_round_submitted.

### 6) 본선 창 열고 닫기 (자동)
```
node --env-file=.env.local scripts/rehearsal-stage.mjs main-open
node --env-file=.env.local scripts/rehearsal-stage.mjs main-close
```
→ main_round_end_at 과거 = 본선 워커 게이트 오픈.

### 7) Triple-AI 본선 채점 — ★워커 수동 실행 (ROUND=main)
```
SEASON_ID=season_test ROUND=main BATCH_SIZE=10 node dist/batch.js
```
→ 본선 10편 채점, scoring_results(main) 생성. status 불변(본체가 진실원천).
**확인:** main 점수 채워짐.

### 8) 관객 투표 (수집·집계)
```
node --env-file=.env.local scripts/rehearsal-stage.mjs vote
node --env-file=.env.local scripts/rehearsal-seed-votes.mjs 12
```
→ 투표창 오픈 + 실 auth 유저로 12표 시드. **확인:** `/watch/<id>?round=main`에서 투표수. (※ 시즌0=Soak, 투표는 최종순위 미반영 — 수집/표시만 검증)

### 9) 시상 (완료 전이 자동 + 1·2·3 승인)
```
node --env-file=.env.local scripts/rehearsal-stage.mjs awards
node --env-file=.env.local scripts/rehearsal-approve-awards.mjs
```
→ closed→completed(cron) + 상위3 award_rank 1/2/3 + status=awarded.
**확인:** `/watch`에 🥇🥈🥉. (실발사 시상은 /admin/seasons/season_test/main-results에서 승인하면 상금 이메일도 발사 — 리허설은 이메일 생략)

---

## 완료 후 정리 (리허설 종료 시)
- 다시 리셋하거나(`rehearsal-reset.mjs`) season_test를 원 상태로. season_test 날짜/`min_participants`(리허설에 5로 낮춤)는 리허설 전용 값.
- `scripts/.rehearsal-stash.json` 삭제 가능.
- **발사 전 복귀 목록(별도):** ① 테스트 시즌(1000~1006) open/close는 NULL 처리됨 — 유지 or 삭제. ② season_0 draft 해제 + 7/25 오픈(발사 시퀀싱). ③ 워커 `SEASON_REQUIRED_STATUS=''` + Railway 스케줄 등록 확인. ④ (후속) 워커 season 필터.

## 발사 시 "수동 개입" 필수 4곳 (이 리허설이 드러낸 것)
1. 🔴 채점 워커 실행 — Railway 스케줄 등록돼 있으면 자동, 아니면 수동 (발사 전 확인).
2. 🔴 1·2·3등 시상 승인 (admin).
3. 🟡 flagged 무결성 리뷰 해소 (있을 때만, admin).
4. 🟡 본선 제출 (실사용자 행동).
