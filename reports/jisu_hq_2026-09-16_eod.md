# 지수 본체 EOD — 2026-09-16

**다음 세션은 이 파일 하나만 읽고 재개.**

## ⛔ 지금 절대 하지 말 것 (본부 명시 지시)

- **고치지 마라 · 커밋하지 마라 · 배포하지 마라.**
- **API 호출 계속 HOLD.**

## 오늘 전체 요약

| 항목 | 상태 |
|---|---|
| Gate 1 | PASS |
| Gate 2 / Observation Repeatability | **NOT PASSED** |
| Stage 1b | **FAIL**(A04_morph·A09_race, 미달 유지) |
| Contact Sheet 일반화 실험 | **종결** — "일반효과 미확인" |
| Contact Sheet production 적용 | HOLD(종결, 추가 실험도 HOLD) |
| A12_mech → A09_race fixture 교체 | **확정**(A12는 UNCERTIFIED로 GT 증거에서 제외, 연구기록만 유지) |
| Cross-Model(Claude vs Astra vs Gemini) | 완료 — "모델 교체로 해결된다" **기각** |
| Perception Layer 설계안 | 작성 완료(구현 0) |
| Astra·Gemini·STEP3/4·Contact Sheet·CV | 전부 HOLD |
| 오늘 실비 합계 | $1.09(A04 CS Arm B) + $7.20(일반화 35콜) + $3.30(Cross-Model 20콜) ≈ **$11.6**(전부 본부 사전 승인 후 실행) |

**오늘 가장 큰 발견**: 7개 CHECK 카테고리 중 **4개(identity·text·
transition·degradation)는 이미 production 개별 프레임만으로 5/5
완벽**하다. 문제는 **anatomy·mechanism·action 셋뿐**이고, 그중
action은 정지 프레임으로 원리적으로 증명 불가능한 카테고리라 애초에
"고쳐야 할 결함"이 아니다 — 사실상 **실질적으로 손봐야 할 카테고리는
anatomy·mechanism 둘**로 좁혀졌다.

## 오늘 한 일 (순서대로)

1. **$0 forensic**(고문 지시) — A04_morph·A12_mech 5회 raw output
   대조. 09-12 예비결론("순수 calibration")을 정정: A04는 관찰 결측,
   A12는 관찰 충돌 — 둘 다 순수 calibration 아님.
2. **인간 GT 재확인**(본부 지시) — A04_morph frame4 왼팔 결함
   **CONFIRMED**(원본에서 명확). A12_mech frame5/6 기어 맞물림은
   **UNCERTIFIED**(원본 고배율 crop으로도 사람이 못 가름).
3. **A04 단독 Contact Sheet A/B** 설계·승인·실행 — Arm A(기존
   재사용, 3/5) vs Arm B(신규 5콜, DETECT 4~5/5) — **Pass 후보
   신호**, production 미적용(N=5·단일 fixture라 검증 후보로만 격상).
4. **A12 대체 fixture 탐색**($0) — survey cluster D 후보 A09_race를
   처음부터 재검증(survey 원문 "above the hood"와 실제 위치
   "지붕/앞유리 위"가 다름을 직접 확인) → **CONFIRMED**(frame_07
   t=12.0 단독, crop 없이 원본에서 명확).
5. **Contact Sheet 일반화 A/B**(35콜, $7.2037) — 일반화축(A09)
   FAIL(3/5→3/5 + 신규 명시적 오탐 1건), 회귀축 4개 전부 PASS,
   confabulation축(demo_anne) PASS. → **결론: "Contact Sheet
   일반효과 미확인", 추가 실험 종결.**
6. **Cross-Model**(Claude 재사용 0 + Astra/Gemini 신규 20콜,
   $3.3037) — A04·A09 둘 다: **Claude 3/5·3/5 > Astra 0/5·0/5 =
   Gemini 0/5·0/5.** "모델을 바꾸면 나아진다" 가설 **기각**. Astra는
   회피적 hedge만 반복, Gemini는 두 fixture 모두 5/5 확신에 찬
   오답 — "안정"이 정답 쪽이 아니라 오답 쪽이었다.
7. **Perception Layer 설계안** 작성(`perception_layer_design_2026-09-16.md`,
   구현 0) — 현재 구조(`Frames→AI관찰→해석→평가` 1콜 뭉침)를
   **Evidence Acquisition→Factual Observation→Cross-Verification→
   Evaluation** 4단계로 분리하는 안. 7개 CHECK를 이번 실측 기반으로
   재분류(4개는 이미 충분, anatomy·mechanism은 국소증거 문제,
   action은 정지프레임 원리적 한계). CV 일괄배선 금지 반영, 비용은
   상대배율만(예산 결정 안 함).

## 내일 첫 작업

**Perception Layer 카테고리별 pilot 순서 — 그 전에 고문 검토
먼저.** 설계 문서 3개 후보(§"다음 단계 후보"):
1. anatomy dense frame pilot(Contact Sheet가 유일하게 통했던
   카테고리).
2. mechanism의 "원본이 명확한 경우(A09) vs 사람도 애매한 경우(A12)"
   사전 분류 단계 필요성.
3. action의 UNCERTAIN-as-정답 원칙을 이대로 확정할지 여부.

이 셋 중 무엇부터, 어떤 순서로 pilot을 태울지는 **고문 검토가
먼저** — 지수가 임의로 순서를 정하지 않는다.

## 상태(본부 표 그대로)

- Gate1 PASS
- Gate2 Observation Repeatability **NOT PASSED**
- Contact Sheet production **HOLD(종결)**
- Astra·Gemini·STEP3/4·CV **HOLD**
- Stage 1b **FAIL**

## 산출물 경로 (오늘 전체, 전부 미커밋)

- `reports/observation_accuracy_stage1b_forensic_2026-09-16.md` —
  오늘의 핵심 문서. ADDENDUM 1~9 전체(forensic→인간GT재확인→A04
  A/B설계/실행→A12대체탐색→일반화A/B설계/dry-run/실행→Contact
  Sheet종료+Cross-Model설계→Cross-Model실행결과).
- `reports/perception_layer_design_2026-09-16.md` — Perception
  Layer 설계안(오늘 마지막 산출물).
- `reports/jisu_hq_2026-09-16_eod.md` — 이 파일.
- `oxxovo-scoring/_stage1b_a04_contactsheet_ab_2026-09-16.mjs` +
  `reports/stage1b_a04_contactsheet_armB_raw_2026-09-16.json`.
- `oxxovo-scoring/_stage1b_contactsheet_generalization_ab_2026-09-16.mjs` +
  `reports/stage1b_contactsheet_generalization_raw_2026-09-16.json`.
- `oxxovo-scoring/_stage1b_crossmodel_a04_a09_2026-09-16.mjs` +
  `reports/stage1b_crossmodel_a04_a09_raw_2026-09-16.json`.
- 로컬 프레임(레포 밖, 세션 스크래치패드 — 소멸 가능, 원본 클립은
  R2 영구보관·URL은 `reports/_gate1_mockprelim_urls_2026-09-09.json`):
  A04_morph·A09_race·Z03_studio·demo_consistency·aurelie·novya·
  demo_anne 프레임 + 각 contact sheet.

## 메모리

- [[project_jisoo_resume_2026-09-16]] — 오늘 하루 전체 타임라인(추가1~9).
- [[project_jisoo_resume_2026-09-12]] · [[feedback_harness_save_full_pipeline]] ·
  [[feedback_evidence_scope_before_conclusion]] · [[feedback_absent_is_not_zero]] ·
  [[feedback_disagree_when_wrong]] · [[feedback_no_blanket_budget_approval]] ·
  [[project_identity_continuity_quality_vs_compliance_2026-09-12]]
