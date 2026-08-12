# Defect 1 ↔ Finalist 진출 게이트 — 실측 인계 (지수2 → 지수 본체, 2026-07-26)

500편 채점 실측(`reports/scoring_500_throughput_2026-07-26.md`) 중 확인한 것.
**결론 먼저: Defect 1은 일정 리스크가 아니다. 순위/상금 공정성 문제로만 다루면 된다.**

## 1. 무엇을 확인했나

`advance_season_finalists` RPC는 **flagged 0건**을 self-gate로 요구한다(season-tick 2.5,
`blocked='flagged_pending'` → 어드민이 /admin/applications에서 해소해야 진출 확정).
Defect 1(사실성이 높을수록 Integrity가 낮아짐)이 살아 있으면 **잘 만든 작품일수록 flag되어
72h 창 안에 수동 해소가 대량 발생하는가?** 를 확인했다.

## 2. 답: 아니다 — flag 문턱이 훨씬 낮다

| 무엇 | 값 | 출처 |
|---|---|---|
| `scorer.ts` `INTEGRITY_REVIEW_THRESHOLD` | 50 | **콘솔 로그용**(`integrityReview.flagged`). DB status와 무관 |
| **status='flagged' 실제 게이트** | **`seasons.flag_integrity_high_threshold` = 15** | `batch.ts:288-292` → `deriveConfidence` |
| (참고) medium / low 경고 문턱 | 30 / 50 | season_0·season_test 동일 |

즉 `integrity < 15`여야 status가 'flagged'로 가고 진출이 막힌다. 시즌 파라미터라 시즌별 변경 가능
([[feedback-no-hardcode]]).

## 3. 실주행 분포 (season_test, judged_status='completed' 51행)

| 지표 | min | p10 | p50 | max |
|---|---|---|---|---|
| consensus integrity | **35** | 70 | 85 | 92 |
| claude integrity | 35 | 70 | 85 | 92 |

- `integrity_flag = true`: **0건**
- confidence 분포: none 48 · low 3 · medium 0 · high 0
- `< 15`: 0건 · `< 30`: 0건 · `< 50`: 3건

Defect 1의 대표 피해작(Seedance "Her Gaze", Claude integrity **35**)조차 flag되지 않고
confidence='low' 경고에 그친다. **500편으로 늘려도 flag 게이트가 72h 창을 막을 근거는 없다.**

재현: `oxxovo-scoring/_probe_flag_threshold.ts` (읽기 전용).

## 4. 그래서 Defect 1은 왜 여전히 최우선인가

일정이 아니라 **상금 배분의 공정성**이다. 실측된 본선 결과:

| | verified | Claude integrity | 순위 |
|---|---|---|---|
| Seedance "Her Gaze" (사실적 물리·피부) | 72.48 | **35** ("실제 촬영 같다") | #7 |
| Kling "Zero-G" (얼굴 드리프트) | 81.12 | **85** ("AI 티가 난다") | **#1** |

Integrity 10% 축이 사실성을 역으로 처벌해 **더 잘 만든 작품이 밀린다**. $3,000 상금 사다리에서
이건 그 자체로 결함이고, **예선 점수 공개의 선결조건**이기도 하다(공개하는 순간 이 역전이 외부에 드러난다).

프롬프트 원문은 `oxxovo-scoring/src/scorer.ts:92` — "depth of field, real shadows, physical hand
interactions — these are STRONG signals the video is NOT AI-generated". src 마지막 커밋은 7/14,
**7/15 진단 이후 수정 없음**.

방향은 이미 7/14 인계서에 있음: 화면상 "AI인가 실사인가" 판정을 폐기하고 CryptoBind 생성 증명으로
대체 → Integrity는 표절/외부URL/규정위반만 판정. (reports/scoring_track_handoff_2026-07-14.md §DEFECT 1)

## 5. 지수2의 이전 진술 정정

같은 리포트 초판에서 "flag 조건 = claude integrity < 50이라 500편에서 수동 해소가 72h 병목이 될 수
있다"고 썼는데 **틀렸다**. 게이트는 15이고 실측 flag는 0건이다. 리포트 §6과 메모리는 정정했다.
