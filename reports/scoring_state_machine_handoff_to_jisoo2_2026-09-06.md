# 인계 — 채점 상태기계(3 Valid Judgments) — 지수 본체 → 지수2 (2026-09-06)

본부 지시: 9/13까지 AI 심사 확정. 두 트랙 동시 진행 — 채점(모델/rubric)은 지수 본체가,
**이 상태기계는 지수2가** 맡는다. 아래는 9/5에 이미 끝낸 설계 문서 2개를 그대로 옮긴
요약이다 — **설계만, 코드 미변경.** 원본은 각각:
- `reports/scoring_redesign_1_state_machine_2026-09-05.md` (상태기계 본설계)
- `reports/scoring_redesign_1b_holes_and_rpc_2026-09-05.md` (RPC 확인 + 구멍 2개 보완)

이 인계 문서만 읽고 바로 착수 가능하도록 8단계로 펼쳐놓았다 — 새 설계 아님, 위 두 문서를
파이프라인 순서로 재배열한 것.

## 왜 이 설계가 필요한가 (실측 근거, 추측 아님)

- `scorer.ts:780` `scoreWithAllAIs`가 `Promise.all([claude, gpt, gemini])` — 셋 중 하나만
  던져도 전체가 던진다. `batch.ts:453`가 이걸 잡아 행 전체를 `failed` 처리 → 다음 재시도 때
  **이미 성공한 슬롯까지 다시 호출**(비용 낭비).
- 9/5 모의예선 43편 실측: cf_novya가 Gemini `PROHIBITED_CONTENT`로 **동일하게 두 번** 거부
  (정상 콘텐츠), demo_artisan이 Gemini `503`(벤더 메시지: "temporary") 1회. 성격이 다른 두
  실패 유형 — 이 설계는 둘을 다르게 처리한다.
- 43편 중 2편(cf_novya, demo_artisan)이 3사 전원 정상 확보 실패 = **4.65%**, 500편 스케일
  ≈ **23.3편**(슬롯 단위로도 1.55%/23.3슬롯, 편 단위와 우연히 일치 — 표본 43뿐이라 "한 편에서
  2사 동시 실패" 케이스는 관측 못 함, 리스크로만 기록).

## 8단계 파이프라인

1. **요청 발주** — 행 하나당 슬롯 3개(`claude_judge_status`/`gpt_judge_status`/
   `gemini_judge_status`) 중 `ok`가 아닌 것만 호출한다. 이미 `ok`인 슬롯은 다시 안 부른다
   (오늘의 핵심 낭비 지점 제거).
2. **응답 분류** — 각 슬롯 응답을 `error_transient`(503/429/타임아웃/connection reset) 또는
   `error_permanent`(safety/content-policy 거부, 스키마 파싱 실패)로 가른다. 재시도 여부가
   이 분류 하나로 갈린다.
3. **에러 슬롯 처리** —
   - `error_permanent` → **재시도 0회**, 즉시 Reserve Judge(②, 아직 후보 미정)로.
     근거: cf_novya가 temp 0에서 동일 거부를 2회 연속 냈다 — 재시도가 확률을 안 바꾼다는 게
     이미 실증됨.
   - `error_transient` → 벤더별 상한·backoff 표대로 재시도(아래). SDK 자체 재시도
     (`maxRetries:1`)는 그대로 두고, 이 표의 "시도"는 그 SDK 재시도까지 포함한 호출 1묶음을
     1회로 센다. 배치 내부 sleep 재시도 없음 — 다음 cron tick이 곧 backoff
     ([[feedback_retry_policy_single_owner]] 준수).
4. **재시도 소진** — 상한을 다 쓰면 그 슬롯만 Reserve Judge로. **Reserve Judge가 아직 없으면
   (지금 상태) 오늘과 완전히 같은 경로로 `judged_status='failed'`** — 새 UI/로직 없이 그대로
   admin 검토 경로(`recommendations.ts`/`RecommendationsPanel.tsx`)로 간다. 즉 이 설계는 ②가
   정해지기 전에도 **그대로 배포 가능**(실패율만 먼저 낮춤: 불필요한 3사 재시도 제거).
5. **3슬롯 전부 ok → JUDGING_COMPLETE** — 아직 신뢰 확정 아님, 다음 단계 통과 필요.
6. **이상탐지** — 슬롯 중 하나 이상이 Reserve Judge로 대체됐거나, 3사 개별 점수의 Consensus
   등급이 Low(쌍별 순위차 전부 안 가까움 — 지난 회차 정의 재사용)면 JUDGING_RECHECK.
7. **RECHECK 처리(자동 1회 한정)** — odd 벤더(3사 자체가중점수 중 나머지 둘 평균과 절대편차가
   가장 큰 쪽)를 프레임 재추출 없이 같은 프롬프트·temp 0로 1회만 재호출.
   - 나머지 둘에 가까워짐 → 노이즈, 새 값으로 교체 → 등급 재계산 → **JUDGING_FINAL 승격**
     (원래 값·새 값 둘 다 감사 로그에 남김).
   - 여전히 벌어짐 → 진짜 3사 불일치 확정, 자동 재시도 여기서 멈춤(무한 recheck 금지) →
     사람 경로(admin 3택: 평균값 승인 / 점수 override / 3사 전체 재롤). **override가
     [[project_scoring_integrity_rules]](score 자동, admin 변경 불가)와 충돌하는지는
     미정 — 임의로 정하지 않았음, 판단 필요.**
8. **JUDGING_FINAL만 최종 랭킹/advance 계산이 읽는다** — `judged_status='completed'`는
   기존 코드 무변경 원칙대로 유지하되, **오직 JUDGING_FINAL일 때만** 그 값으로 바꾼다. 다만
   ⚠️아래 "게이트 구멍" 때문에 이것만으론 안 끝난다.

## ⚠️ route.ts:438 게이트 — 반드시 같이 고쳐야 함 (최우선 확인 이미 끝남)

9/5 최초 설계는 "`judged_status='completed'` 조건을 엄격화하면 게이트가 자동으로 고쳐진다"고
가정했는데 **틀렸다** — 9/5 보완에서 직접 읽고 확인:

```
app/api/cron/season-tick/route.ts:438
if (!s.scoring_complete_at || nowMs < new Date(s.scoring_complete_at).getTime()) continue
```

이 한 줄이 게이트 전부다 — **`scoring_results`/`judged_status` 참조가 코드에 0건**, 날짜
비교만 본다. 실측 재현도 있음(`reports/jisu_hq_2026-08-31_eod.md` ④: TEST-01이 채점 중인데
나머지 15편으로 결과가 확정·발송됨, season-tick 재실행해도 재계산 안 됨).

`advance_season_finalists` RPC 본체는 이 세션들 다 `pg_get_functiondef` 접근 수단이 없어
못 열어봄(PostgREST엔 그 헬퍼가 없고, `DATABASE_URL` 직결 커넥션 문자열도 두 레포 어디에도
없음 — 값 아니라 변수명만 확인됨). RPC 안에 추가 검사가 있는지는 여전히 모른다. **그래도
코드로도(위 한 줄) 실측으로도(08-31 재현) 답은 나와 있다: 안 막는다.**

**착수 시 최우선 항목**: `route.ts:438` 조건에 "이 시즌·라운드 scorable 대상 전원이
JUDGING_FINAL"을 **AND로 추가**한다. 날짜는 트리거로 남기고 완료의 증거로는 안 쓴다.

## 확인·판단 필요(임의로 정하지 않은 것 — 착수 순서상 위에서부터)

1. **Reserve Judge 후보(②)** — 아직 조사 안 됨. 이게 없어도 4단계 임시규칙으로 배포 가능하니
   병행 조사 가능.
2. **이상탐지 임계값**(쌍별 순위차 ≤5 = "가깝다")이 43편 표본 값 — 500편 스케일에서도 맞는지
   재검증 필요.
3. **RECHECK odd 판정의 절대편차 임계치** — "가장 편차가 큰 하나"라는 상대 규칙만 확정,
   절대 수치는 시즌 실주행 초기 데이터로 캘리브레이션 필요.
4. **admin override가 채점 무결성 원칙과 충돌하는지** — 7단계 사람 경로 (b) 항목, 임의로
   못 정함.
5. **Reserve 승격/강등 정책**(한 번 대체되면 영구 reserve인지 다음 시즌 원래 3사 복귀 시도인지)
   — ②가 정해진 뒤 판단.

## 벤더별 재시도 표 (감이 아니라 근거 명시)

| 벤더 | 상한(일시적) | backoff | 근거 |
|---|---|---|---|
| Claude | 2회(최초+1) | 다음 tick(≥60s) | 43편 중 실패 0건(100% 안정) — 재시도 예산 최소 |
| GPT | 3회(최초+2) | 90s→180s | 09-01 실측: GPT-4o 조직 TPM=30,000 구조적 상한, 분당 쿼터라 90s부터 시작해야 창을 확실히 넘김 |
| Gemini(일시적) | 2회(최초+1) | 90s | 구글은 문서화된 쿼터 수치 없음(미확인) — GPT와 같은 보수적 창 재사용. 재시도가 실제로 통하는지는 미검증(43편 표본엔 503 1건뿐, 하니스가 2/3으로 만족하고 재시도 안 돌림) |
| Gemini(영구적) | 0회 | — | cf_novya 실증(동일 거부 2회) |

## 지수2에게

- 스키마 초안(`claude_judge_status`/`attempts`/`slot`, gpt_*, gemini_*, `judgment_state` enum)은
  9/5 문서에 스케치만 있고 적용 안 됨 — 실제 마이그레이션 작성은 지수2 소관.
  ★[[feedback_sql_ascii_only]]·[[feedback_migration_before_code_push]] 그대로 적용.
- 이 문서와 원본 두 문서 사이에 충돌 나는 부분을 발견하면 원본(9/5, 위 두 파일)이 우선 —
  이 인계 문서는 요약/재배열이지 새 결정이 아니다.
- 진행 상황은 이 파일 하단에 이어서 기록하거나 새 `reports/scoring_state_machine_progress_*.md`로.

관련: [[project_jisoo_resume_2026-09-05]] · [[feedback_retry_policy_single_owner]] ·
[[project_scoring_integrity_rules]] · [[feedback_db_object_absence_unprovable_by_repo]]
