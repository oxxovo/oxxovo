# 지수 본체 EOD — 2026-09-10 (Gate 1 실행 완료, 내일은 분석 3부터)

**다음 세션은 이 파일 하나만 읽고 재개.**

## ⛔ 지금 절대 하지 말 것 (본부 명시 지시)

- **고치지 마라 · 커밋하지 마라 · 배포하지 마라.**
- **새 유료 호출 금지** — 내일 첫 작업(분석 3)은 이미 저장된 데이터로만 하는
  $0 작업이다. Primary 3 + Reserve 선정도 분석 3 이후에나 진행한다.

## 오늘 한 일 (순서대로)

1. **보충 11쌍 2차 블라인드 검수 마무리** — 지수 자신의 오염 사고(마이닝
   리포트를 먼저 읽고 판단) 자가발견→폐기→재검수. Pair 8(A13_group vs
   demo_duel) 방향 불일치 발견.
2. **Final Contrast Set v1→v2**: 동일원본 통합(POTTER=GT01/demo_artisan,
   SILK=GT02/A02_fabric), 원본당 Core 2회 상한, min() confidence 공식,
   30→24쌍. CD 추가마이닝 1회 실패(방향 불일치)로 포기.
3. **"$500 승인" 정정**: 고문 제안이었지 대표님 승인 아니었음(→
   [[feedback_no_blanket_budget_approval]]).
4. **Gate 1 실행(24쌍×6모델×3라운드=432콜, $10.72)**:
   - **1A(Quality Direction) PASS.**
   - **1B(Position Robustness) = Sol FAIL** — 역전 불일치 10/24 전부(예외
     없음) raw 위치 고정으로 설명됨. High confidence 5쌍은 전부 안전, 실패는
     Medium/Medium-High에만 집중.
   - **Qwen 수치 정정**: 원래 보고(Tier1 100%)가 에러 19건 제외한 착시,
     설정 수정(OpenRouter `reasoning.max_tokens` 분리) 후 전수 재실행하니
     실제 Tier1 81.8%.
   - **1C(3축 독립성) 1차 FAIL** — Originality 자기라벨링 인식률 5모델 중
     4개 0%.
5. **Criterion Evidence Alignment(질문 재정의, $0)**: "축 라벨을 맞히는가"가
   아니라 "근거 내용이 축에 맞는가"로 재측정 → **MISALIGNED 0/84, ALIGNED
   97.6%(정정 후, 독립검수로 1건 조정)**. Originality축 자기라벨링은 나빴지만
   실제 근거 내용은 축 분리가 잘 되고 있었다 — 질문 방식(자유 라벨링 vs 직접
   axis-scoped 질문)의 문제였다.
6. **Gate 1C Full validation(864콜, 24쌍×4모델×3criteria×3라운드,
   NO MATERIAL DIFFERENCE 옵션 도입)**: 중간에 OpenRouter 계정 잔액 $20
   전부 소진(마이너스)으로 Grok 35콜 막힘 → 대표님 충전 후 재개 → 864/864
   에러 0 확정.
   - **전체 역전안정성 79.2%, 반복안정성 88.9%.**
   - **⚠️Grok Execution 역전안정성만 54%(우연 수준)** — Sol과 완전히 동일한
     순수 위치편향 패턴(확인된 사례 전부 raw Clip1/2 위치 고정).
   - 부가: Low confidence 55건 중 54건이 Claude에 몰림. NO MATERIAL
     DIFFERENCE 사용률이 모델별로 극단적으로 다름(Astra Originality 57%,
     Claude Exec/CD 0~3%).

## 본부 최종 판정(오늘)

- **제외**: Sol(위치편향 확정), Qwen(설정문제+실측 낮은 정확도), Grok
  (Execution 축 위치편향).
- **Primary 유력**: Claude Opus 5, Gemini 3.8 Flash.
- **Primary 후보**: GPT-6 Astra.
- Reserve 구성은 미정.

## 내일 첫 작업 — 분석 3 (비용 $0, 저장된 데이터만 사용)

원자료: `oxxovo-scoring/reports/gate1_criterion_v2_full_2026-09-10.json`
(864레코드, pairId/model/axisAsked/round로 인덱싱됨), 참고:
`reports/gate1_criterion_v2_stability_result_2026-09-10.md`.

1. **Astra Originality NMD 57%** — "정직한 Tie 인정"인가 "판단 회피"인가.
   Astra의 NO MATERIAL DIFFERENCE 응답 41건(72건 중)의 evidence 텍스트를
   직접 읽고, 실제로 두 클립이 비슷해 보이는 근거가 있는지 vs 그냥 애매하게
   얼버무리는지 확인.
2. **Gemini Originality 반복 불일치 29%(7/24)** — 체계적(특정 pair·confidence
   대에 몰림)인지 경계 사례(confidence가 원래 낮은 pair들)인지. 반복
   불일치 쌍 목록과 그 pair들의 confidence를 대조.
3. **Claude Low-confidence 54건** — 애매한(Medium 티어) pair에 집중됐는지,
   아니면 confidence 자체와 무관하게 전역적으로 낮게 매기는 성향인지.
   54건의 pairId를 Tier1(High/Med-High)/Tier2(Medium) 분포로 갈라서 확인.

**이 세 분석이 끝난 뒤에만 Primary 3 + Reserve 선정으로 넘어간다.**

## 산출물 경로 (오늘, 전부 미커밋)

- `reports/gate1_final_contrast_set_v2_2026-09-10.md` — 24쌍 확정
- `reports/gate1_execution_result_2026-09-10.md` — 432콜 1차 결과
- `reports/gate1_sol_position_bias_2026-09-10.md` — Sol 위치편향 진단
- `reports/gate1_axis_independence_2026-09-10.md` — 3축 독립성 1차(자기라벨링)
- `reports/gate1_fact_verification_2026-09-10.md` — A18_cities/A13_group 직접확인
- `reports/gate1_pilot2_purity_screening_2026-09-10.md` — Pilot2 순도스크리닝(수율낮음)
- `reports/gate1_criterion_evidence_rubric_draft_2026-09-10.md` — Evidence Alignment 기준
- `reports/gate1_criterion_evidence_alignment_2026-09-10.md` — Evidence Alignment 84건 결과(최종)
- `reports/gate1_criterion_v2_stability_result_2026-09-10.md` — ★864콜 최종(역전/반복 안정성, Grok 발견)
- `oxxovo-scoring/reports/gate1_criterion_v2_full_2026-09-10.json` — ★원자료(864레코드)
- `oxxovo-scoring/src/scorer.ts` — GPT-6 Astra 배선 추가(미커밋)

관련 메모리: [[project_jisoo_resume_2026-09-10]] · [[feedback_no_blanket_budget_approval]] ·
[[feedback_blind_review_dispatch_no_prior_opinion]]
