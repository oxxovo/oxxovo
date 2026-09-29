# 채점 재설계 ① — 3 Valid Judgments 상태 기계 (설계만, 코드 미변경)

전제: 오늘 모의예선에서 실측된 두 개의 실제 실패 사례를 근거로 쓴다(추측 아님).
- **cf_novya**: Gemini가 `PROHIBITED_CONTENT`로 **동일하게 두 번** 거부(temp 0, 결정적) — 정상 홍보영상.
- **The Potter's Hands(demo_artisan)**: Gemini가 `503 Service Unavailable`(vendor 문구: "temporary, try again later") 1회 — 일시적 과부하.

이 둘은 서로 다른 종류의 실패이고, 아래 설계는 이 둘을 다르게 취급한다.

## 0. 지금 구조의 정확한 문제 지점 (실측, `oxxovo-scoring/src/batch.ts`/`scorer.ts`)

`scorer.ts:780` `scoreWithAllAIs`는 **`Promise.all([claude, gpt, gemini])`** — 셋 중 하나라도
던지면 **전체가 던진다.** `batch.ts:453` `processOne`이 이걸 잡아 `handleFailure`를 부르고,
`scoring_results.judged_status='failed'`, `processing_attempts++`를 **행 전체**에 매긴다. 다음
배치가 재시도할 때도 **3사를 전부 다시 부른다** — 이미 성공한 2사분 비용을 매번 다시 낸다.

오늘 cf_novya가 정확히 이 경로를 탔다: Gemini 거부 한 번마다 Claude+GPT도 같이 버려지고 다시
호출됐다(모의예선 하니스에서는 내가 개별 try/catch로 우회했지만, **프로덕션 워커는 지금 그
우회가 없다**). 이게 오늘 재설계를 촉발한 근본 원인 중 하나다.

또한 `scoring_results`는 (application_id, round) 당 **행 1개, `judged_status` 필드 1개**로
3사를 한 덩어리로 취급한다 — 어느 사가 성공/실패했는지 행 단위로는 안 남는다(`ai_outputs` JSONB에
결과는 남지만, 그건 성공 후에만 채워짐).

## 1. 단위를 바꾼다 — "행 1개 = 시도 1개"에서 "행 1개 = 독립된 슬롯 3개"로

새 개념(스키마 설계는 스케치, 적용 안 함):

```
scoring_results
  claude_judge_status   enum('pending','ok','error_transient','error_permanent')
  claude_judge_attempts int
  claude_judge_slot     text  -- 'claude' 또는 대체 시 'reserve:<모델명>'
  gpt_judge_status / gpt_judge_attempts / gpt_judge_slot        (동일 구조)
  gemini_judge_status / gemini_judge_attempts / gemini_judge_slot (동일 구조)
  judgment_state        enum('JUDGING_PENDING','JUDGING_COMPLETE','JUDGING_RECHECK','JUDGING_FINAL')
```

이렇게 하면 **한 사가 실패해도 그 슬롯만 다음 배치에서 재시도**하고, 이미 성공한 슬롯은 안
건드린다 — 오늘 cf_novya처럼 Claude+GPT를 매번 다시 부르는 낭비가 사라진다.

## 2. 상태 4개 정의

| 상태 | 조건 | 의미 |
|---|---|---|
| **JUDGING_PENDING** | 3개 슬롯 중 `ok`가 3개 미만 | 아직 유효 판정 수집 중. 오늘의 "행 없음" + "in_progress" + "일부만 성공한 failed"를 전부 포함 |
| **JUDGING_COMPLETE** | 3개 슬롯이 방금 전부 `ok`가 됨 | 3개 다 모였다 — 그러나 **아직 신뢰 확정 아님**(아래 3.의 이상탐지를 통과해야 함) |
| **JUDGING_RECHECK** | JUDGING_COMPLETE 도달 후 이상탐지 걸림 | 사람(또는 2차 패스)의 확인 없이는 못 씀 |
| **JUDGING_FINAL** | JUDGING_COMPLETE 이고 이상탐지 무사 통과, 또는 RECHECK가 해소됨 | **오직 이 상태만 최종 랭킹/advance 계산이 읽을 수 있다** |

**JUDGING_COMPLETE → JUDGING_RECHECK로 보내는 이상탐지 트리거** (지난 회차 ⑤ Consensus 등급
그대로 재사용, 새로 발명하지 않음):
- 3개 슬롯 중 하나 이상이 Reserve Judge로 대체됨(원래 3사 중 하나가 안 채점함), 또는
- 3사 개별 점수의 Consensus 등급이 **Low**(쌍별 순위차 전부 안 가까움 — 지난 회차 정의 그대로)

## 3. 지금 `judged_status`와의 맞물림 — 기존 코드 무변경 원칙

`judged_status`(오늘 값: `in_progress`/`completed`/`failed`)를 없애지 않는다. `advance_season_finalists`,
admin 대시보드, `scoring-coverage.ts`, `RecommendationsPanel.tsx` 등 **기존 코드가 전부 이 세
값만 보고 있어서, 값을 없애면 그 코드들을 다 고쳐야 한다** — 대신 "completed"가 되는 **조건을
엄격하게** 만든다:

| judged_status(기존, 무변경) | 대응하는 judgment_state |
|---|---|
| (행 없음) | JUDGING_PENDING (0/3) |
| `in_progress` | JUDGING_PENDING 또는 JUDGING_RECHECK — 둘 다 "아직 못 쓴다"는 뜻은 같음 |
| **`completed`** | **오직 JUDGING_FINAL일 때만.** JUDGING_COMPLETE만으론 안 바꾼다 |
| `failed` | 슬롯 중 하나 이상이 Reserve Judge까지 실패해서 genuinely stuck |

★이렇게 두면 `advance_season_finalists`처럼 `judged_status='completed'`를 이미 보고 있는
기존 코드가 **한 글자도 안 바뀌어도** 자동으로 더 엄격해진다 — "3개 다 모였다"가 아니라 "3개
다 모이고 이상탐지까지 통과했다"라야 completed가 된다. **★단, 이건 그 RPC가 실제로
`judged_status='completed'` 기준으로 짜여 있다는 전제다 — 09-01 발견("scoring_complete_at
날짜만 보고 pending/in_progress를 안 본다")과 맞춰보면, 그 RPC의 실제 정의를 `pg_get_functiondef`로
직접 열어서 확인하는 게 ①번 착수 시 최우선 — 이 문서는 설계고, 그 확인은 구현 착수 시 1순위
과제로 남긴다.**

`judgment_state`는 관제용 신규 컬럼으로 추가 제안 — 오늘은 `in_progress`가 PENDING인지
RECHECK인지 admin이 구분 못 한다(둘 다 "안 끝남"으로만 보임). 이 컬럼이 그 구분을 admin
화면에 노출시킨다.

## 4. 실패 처리 경로 — 슬롯 단위, 재시도 정책 근거 포함

**원칙(★[[feedback_retry_policy_single_owner]] 준수)**: SDK 자체 재시도(`maxRetries:1`, 이미
전 하니스에 있음)는 그대로 둔다 — 이 설계의 "시도(attempt)"는 **그 SDK 재시도까지 포함한
호출 1묶음**을 1회로 센다. 배치 내부에서 sleep으로 즉시 재시도하지 않는다 — 다음 cron tick이
곧 backoff다(이미 있는 tick 간격을 재사용, 새 타이머를 안 만든다).

**에러 분류 — 재시도 가치가 있는지부터 가른다:**

| 분류 | 예 | 처리 |
|---|---|---|
| **일시적(transient)** | 503, 429, 타임아웃, connection reset | 같은 벤더로 재시도 (아래 표) |
| **영구적(permanent)** | Safety/content-policy 거부(오늘 cf_novya가 실증), 응답이 스키마와 다른 파싱 실패 | **재시도 안 함** — 즉시 Reserve Judge |

★영구적 분류의 근거: 오늘 cf_novya가 temp 0에서 **동일한 거부를 두 번 연속** 냈다 — 재시도가
확률을 안 바꾼다는 게 이미 실증됐다. 반대로 demo_artisan의 503은 벤더 메시지 자체가
"temporary"라고 명시한다 — 이건 재시도할 가치가 있는 쪽.

**벤더별 재시도 횟수·backoff (감이 아니라 아래 근거로):**

| 벤더 | 시도 상한(일시적 오류) | backoff | 근거 |
|---|---|---|---|
| **Claude** | 2회(최초+1) | 다음 tick(최소 60초 간격) | 오늘 46콜 중 **실패 0건**(100%) — 표본상 가장 안정적이라 재시도 예산을 가장 적게 준다. 실패하면 진짜 드문 일시 장애일 확률이 높고, SDK의 내장 1회 재시도가 이미 있으니 상태기계 레벨 1회 추가면 충분 |
| **GPT** | 3회(최초+2) | 90초 → 180초 | 09-01 실측으로 **GPT-4o 조직 TPM=30,000이 구조적 상한**임이 이미 확인됨(감이 아니라 문서화된 실측 한도) — 분당 단위 쿼터이므로 60초 안에 재시도하면 반드시 또 걸린다. 90초부터 시작해 한 분당 쿼터 창을 확실히 넘긴다 |
| **Gemini(일시적, 503류)** | 2회(최초+1) | 90초 (GPT와 동일 창 재사용) | 구글 쪽은 문서화된 쿼터 수치가 없어(확인 안 됨) GPT와 같은 보수적 창을 그대로 씀. 오늘 표본에 503 1건 있었으나 재시도 결과는 미확인(하니스가 2/3으로 만족하고 안 돌림) — 재시도가 통하는지는 다음 실전 운영에서 처음 검증됨, 이 문서에 "될 것이다"라고 단정하지 않음 |
| **Gemini(영구적, 컨텐츠 거부)** | **0회** | — | 즉시 Reserve Judge. 재시도해도 똑같이 거부한다는 게 오늘 실증됨(cf_novya, 2회 동일) |

**슬롯이 상한을 다 쓰면**: 그 슬롯만 Reserve Judge(②)로 넘어간다. 나머지 2개 정상 슬롯은
그대로 유지 — 처음부터 다시 안 돈다. Reserve Judge도 실패하면 그때 행 전체가 `judged_status='failed'`
(오늘과 동일한 admin 검토 경로, `recommendations.ts`/`RecommendationsPanel.tsx` 무변경).

**정상 작품의 Safety Refusal도 동일 경로**: 명시적으로 — 벤더가 정상 제출작을 거부하는 것은
"이 작품이 문제 있다"는 신호가 **아니다**. 위 표의 "영구적" 분류 그대로 처리(즉시 Reserve
Judge), 채점 자체나 실격 판정에 이 거부를 절대 쓰지 않는다.

## 5. 오늘 발견한 사고와의 직결

09-01 EOD 발견("⛔채점 미완 상태에서 결과가 확정된다 — `advance_season_finalists`가
scoring_complete_at 날짜만 보고 pending/in_progress 잔여를 안 본다")이 이 상태기계로 풀리는
방식: 게이트를 **"오늘 날짜가 지났나"에서 "이 라운드의 채점 대상 전원이 JUDGING_FINAL인가"로
바꾼다.** 날짜는 트리거일 뿐 완료의 증거가 아니었다는 게 오늘 근본 원인이었고, JUDGING_FINAL은
정의상 "3 valid + 이상탐지 통과"라 완료의 증거 자체가 된다.

## 6. 확인/판단이 필요한 것 (제가 임의로 정하지 않음)

1. `advance_season_finalists` RPC의 실제 정의(현재 무엇을 보고 게이트하는지) — `pg_get_functiondef`로 직접 열어봐야 함, 이번 설계는 그 결과를 아직 못 봤다는 전제로 짬.
2. 이상탐지 임계값(쌍별 순위차 ≤5="가깝다")은 지난 회차에서 43편 표본으로 잡은 값 — 실제 시즌 규모(500편)에서도 같은 임계가 맞는지는 재검증 필요.
3. Reserve Judge 승격/강등 정책(한 번 대체되면 그 참가작은 영구히 'reserve' 슬롯인지, 다음 시즌엔 원래 3사로 복귀 시도하는지) — ②에서 후보가 정해진 뒤 판단.

관련: [[project_jisoo_resume_2026-09-01]] · [[feedback_retry_policy_single_owner]] · [[project_scoring_integrity_rules]]
