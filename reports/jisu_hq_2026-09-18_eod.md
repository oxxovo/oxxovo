# 지수 본체 EOD — 2026-09-18

**다음 세션은 이 파일 하나만 읽고 재개.**

## ★★★최종 요약 (같은 날 맨 마지막, 여기부터 읽기 — 이 절이 최신 진실)

### 오늘 한 일

- Dense Safety/Generalization pilot **25콜 $7.7885** — 회귀축 4개
  (Z03_studio·demo_consistency·aurelie·novya) 전부 5/5 유지,
  demo_anne UNCERTAIN×5+confab 0/5. **종합 PASS.**
- Cross-Verification Layer 설계 rev.1→rev.2→**rev.3(최종)**.
- 독립 검증 후보 전수 판정(지수 의견) — benchmark 축적 외 전부 기각.
- **production `src/scorer.ts` 코드 조사** — certainty/checkId/
  CONFIRMED 스키마가 **production에 아예 없다**는 사실 발견(7-CHECK는
  전부 `oxxovo-scoring`의 연구용 `_stage1b_*.mjs`에만 존재).

### 오늘 가장 큰 것 3

1. **Dense = 개선(A04·A09 3/5→5/5) + 비회귀(회귀축 4개 5/5 유지)** —
   7 fixture 규모 pilot 결론, production 확정 아님(Gate3 대기).
2. **독립 검증으로 남는 건 benchmark 축적 하나뿐**, 그런데 이것도
   본부가 "카테고리 검증≠개별 제출물 진실 보장"으로 추가 제한 —
   **개별 인스턴스 SUPPORTED를 실제로 채우는 방법은 여전히 미해결.**
3. **N=5는 production 트리거가 아니라 qualification/calibration용
   이었다** — 정정됨. production은 원래도 N=1이고, 그래도 된다
   (모델 자체 certainty 필드 하나로 충분, 추가 API 콜 불필요).

### Cross-Verification 설계 rev.3 — 확정된 수정 3건

- ⛔ **"benchmark된 카테고리 + YES/NO = CONFIRMED" 자동승격 미채택**
  — 카테고리 검증은 개별 submission의 truth guarantee가 아니다.
- **상태 명칭 = SUPPORTED / UNCERTAIN / UNQUALIFIED / DISPUTED**
  (CONFIRMED/DISPUTED/UNCERTAIN 3종에서 확장). **Evaluation에는
  SUPPORTED만** 전달. UNQUALIFIED는 버리지 않고 audit 큐에 적재
  (카테고리를 익히는 원재료).
- ⛔ **identity·text·transition·degradation도 지금
  production-qualified로 확정 안 함** — 전부 pilot evidence일 뿐,
  승격은 Gate 3의 human-GT 대조 규모(100~150편)에서만.

전문: `oxxovo/reports/cross_verification_layer_design_2026-09-18.md`
(rev.3, 파일 자체가 최종본 — 이력은 파일 안 rev.2/rev.3 변경사유
절 참고).

### ⛔ 발견 — production이 원칙을 지키는지 확인된 적 없다

`src/scorer.ts`에 `certainty`/`checkId`/`CONFIRMED` 스키마가 없다
— "UNCERTAIN은 점수 제외" 원칙 자체가 지금 production 코드에
**존재하지도 않는다.** 이건 설계 문제가 아니라 지금 실제로 무언가를
위반하고 있을 수도 있는 리스크다.

### ★★내일 첫 작업 — code audit 하나만 (read-only, 코드 수정·commit·deploy 금지)

- 현재 production에서 factual observation이 실제로 점수에 어떻게
  들어가는지(`src/scorer.ts`의 `buildScoringPrompt` Step1~6 전체
  흐름 정독).
- uncertainty(또는 그에 준하는 애매한 관찰)를 지금 코드가 어떻게
  처리하는지 — 점수에 그대로 들어가는지, 별도 처리가 있는지, 아무
  처리도 없는지.
- **코드 수정·commit·deploy 전부 금지 — 읽기만.**

### 상태 (본부 표 그대로, 2026-09-18 최종)

- Gate 1 PASS · Gate 2 NOT PASSED
- Dense Evidence Acquisition pilot **PASS**(7 fixture, pilot 수준)
- Dense production 적용 **HOLD**
- CV/ROI 기본 경로 **HOLD**
- **Cross-Verification 연구 STOP**(rev.3가 최종 설계, 더 안 다듬음)
- 추가 API **HOLD**

### 오늘 실비 합계

$5.7029(A04+A09) + $7.7885(Dense Safety) = **$13.4914**.

---

## ★추가 (같은 날, 본부 GO 승인 후 실행 — 이 섹션이 최신)

본부가 Dense Safety/Generalization pilot을 **GO** 승인 → 25콜 실행
완료. **결과: 종합 PASS** — 회귀축 4개(Z03_studio·demo_consistency·
aurelie·novya) 전부 5/5 유지, confabulation 통제(demo_anne) certainty
UNCERTAIN×5 유지+새 confabulation 0건. 실비 **$7.7885**(추정 $9~11
이내). ⚠️ novya만 GT 문구("NOWYA→NOVYA")와 Dense 전사("NOVVYA→NOVYA")가
글자 그대로는 다름 — 정직하게 기록, 판정은 안 바꿈(§상세는 결과
리포트). 본부 지시대로 **여기서 STOP** — production 적용·prompt/code
수정·STEP3/4·추가 CV 전부 여전히 HOLD, 다음 판단은 본부.

산출물: `oxxovo/reports/dense_safety_generalization_pilot_result_2026-09-18.md` ·
`oxxovo-scoring/reports/stage1b_dense_safety_*_raw_2026-09-18.json` ·
`oxxovo-scoring/_stage1b_dense_safety_2026-09-18.mjs`.

오늘 실비 최종 합계: $5.7029(A04+A09) + $7.7885(Dense Safety) =
**$13.4914**.

## ⛔ 지금 절대 하지 말 것 (본부 명시 지시)

- **고치지 마라 · 커밋하지 마라 · 배포하지 마라.**
- **API 호출 계속 HOLD.**

## ★★추가2 (같은 날, 본부 "Dense 종료 → Cross-Verification 설계로")

본부가 Dense를 **잠정 결론으로 확정·종료**시키고 다음 단계를
Cross-Verification Layer **설계**(API 호출 아님)로 지정. 요지:

- Dense 결론 확정 문구: "현재 검증 범위에서 Dense temporal evidence는
  production sparse frames보다 confirmed fine-detail observation의
  반복성을 개선했고, 기존에 안정적이던 관찰과 uncertainty control에서
  측정된 regression을 만들지 않았다"(개선2+비회귀4+불확실성통제1=
  7 fixture). **production 확정 아님** — Gate 3(100~150편)에서
  재검증 필요, **소규모 Dense 추가 실험은 이제 STOP**.
- ROI/CV **기본 경로에 안 넣음** — Dense 단독이 Original+ROI와
  동등(5/5)했고 ROI-only는 오히려 불안정했다. CV는 Dense로 안 풀리는
  미래 사례의 보조 경로로만 HOLD.
- novya는 "정체성 불안정 탐지는 맞았다"까지만 — "정확한 OCR
  전사까지 검증됐다"로 확대 금지(별도 기록 유지).
- **다음 = Cross-Verification Layer 설계**(3사 단순 다수결 아님 —
  2026-09-16 Cross-Model 테스트에서 Claude3/5 vs Astra/Gemini0/5로
  다수결이 정답을 지운다는 게 이미 실증됨). 질문 = "Claude가
  UNCERTAIN일 때 어떤 독립 evidence/다른 judge observation으로
  CONFIRMED/DISPUTED/UNCERTAIN을 정할 것인가". **설계 완료**
  (`reports/cross_verification_layer_design_2026-09-18.md`) —
  트리거(N=5 분포로 3분기)·증거 위계(1순위=Dense 재관찰[검증됨],
  2순위=디컴포지션 재질의[미검증 제안], 다수결=사용 안 함)·
  CONFIRMED/DISPUTED/UNCERTAIN 상태 정의.
- ★★원칙 고정: "불확실한 사실을 억지로 확정하지 않는 것도 좋은
  심사관의 능력이다 — 증거가 부족하면 UNCERTAIN으로 남기고, 그런
  사실은 감점 근거로 쓰지 않는다." Evaluation 계약의 하드 규칙으로
  취급(UNCERTAIN sub-claim은 점수 근거로 전달 안 함,
  [[feedback_absent_is_not_zero]]와 동일선상) — 설계만, 구현 없음.

**여전히 STOP**: API 호출 0, 코드/prompt 변경 0, 커밋/배포 0.
Gate1 PASS·Gate2 NOT PASSED 그대로.

## ★★★추가3 (같은 날, 본부 "Cross-Verification 설계 수정 6건") — rev.2 최신

본부가 최초 설계안의 **"N=5 전원일치=즉시 CONFIRMED" 규칙을
기각** — 근거: Gemini가 A04·A09 **둘 다 YES×5(5/5 완전일치)로
매번 확신에 차서 틀렸다**(0/5 accuracy). **반복성≠정확성**, 같은
AI가 다섯 번 같은 말을 해도 사실이 되지 않는다. 수정 6건 반영해
설계 rev.2 완료(`reports/cross_verification_layer_design_2026-09-18.md`,
파일 그대로 덮어씀, 이력은 파일 안 "rev.2 변경 사유" 절 참고):

1. **Reliability Check 신설** — 구조가 5단계로:
   Evidence Acquisition→Factual Observation→**Reliability Check**
   →Cross-Verification→Evaluation. Reliability Check는 N=5
   일치여부만 STABLE/UNSTABLE로 라벨링, **CONFIRMED로 승격 안 함**.
   CONFIRMED는 Cross-Verification 단계에서 **benchmark 검증 이력
   또는 독립 검증 증거**가 있을 때만.
2. **accuracy(`accuracyStatus`)와 repeatability(`repeatability`)를
   항상 분리된 필드로 표기** — Gemini 사례(STABLE이면서 완전히
   틀림)가 이 분리가 왜 필요한지 보여주는 실측 근거.
3. UNCERTAIN/DISPUTED = 감점·가점 근거에서 제외 — 유지
   ([[feedback_absent_is_not_zero]]와 동일선상).
4. **실제 대회 참가작에는 Human fallback 미채택** — 사람이 참가작
   사실판정을 대신하면 Triple-AI 심사구조가 흐려짐. AI가 끝까지
   못 정하면 DISPUTED→점수 근거 제외가 더 깨끗함. Human
   verification 자체는 계속 씀(시스템장애 진단·GT 연구구축·
   qualification 단계 3곳 한정).
5. **다음 질문은 열어만 둠**(안 풀음): "Cross-Verification에서
   무엇을 '독립 검증'으로 인정할 것인가" — 최초안이 1순위로 뒀던
   "같은 모델의 Dense 재관찰"이 진짜 독립인지도 이번엔 판단
   보류.

**수정 후 바로 실험 안 함**(본부 명시) — API·코드·prompt 계속
HOLD.

## 오늘 전체 요약

| 항목 | 상태 |
|---|---|
| Gate 1 | PASS |
| Gate 2 / Observation Repeatability | **NOT PASSED** |
| anatomy(A04) pilot | **종료·결과 고정** — production 3/5, dense **5/5**, crop만 2/5(+UNCERTAIN 3), 원본+crop **5/5** |
| mechanism(A09) Dense pilot | **완료** — Arm A(재사용) 3/5 → Dense **5/5** (단 certainty는 둘 다 UNCERTAIN×5 그대로, 확신 전환 아님) |
| MediaPipe ROI $0 sanity check | 완료 — frame4 정상 탐지, 10 중 3 탐지실패(fallback 정상 작동) |
| CV/ROI production 도입 | **HOLD** — "crop이 해결책"이 아니라는 판단, dense가 ROI 없이도 통함 |
| Dense production 적용 | **HOLD — generalization 필요**(내일 첫 작업이 그 설계) |
| Contact Sheet | 종결(09-16), 오늘 안 건드림 |
| Astra·Gemini·STEP3/4 | 전부 HOLD |
| 오늘 실비 합계 | anatomy pilot $4.0741 + A09 dense $1.6288 = **$5.7029**(전부 본부 사전 승인 후 실행) |

**오늘 가장 큰 발견**: 서로 다른 두 confirmed defect
category(anatomy=A04, mechanism=A09) **둘 다에서 dense frame(밀도만
2배, CV·crop 없음)이 DETECT를 개선했다**(3/5→5/5). 단, **Detection
개선과 Certainty 개선은 별개다** — A04는 certainty가 NO 5/5로
확신까지 전환됐지만, A09는 DETECT는 올라도 certainty가 UNCERTAIN
5/5 그대로였다. 본부가 이 둘을 뭉개지 말라고 명시적으로 지시.

## 오늘 한 일 (순서대로)

1. **Perception Layer 설계 승인**(수정 1건 반영) — "Evaluation 3사
   평균 유지"를 확정→"유지 후보"로 하향(Gate2 통과 후 확정).
2. **anatomy A04 pilot 설계** — 질문 1개(Evidence Acquisition을
   바꾸면 A04 confirmed defect를 안정적으로 관찰할 수 있는가), 4 arm
   비교(현재/dense/crop만/원본+crop), oracle crop 금지 원칙으로
   ROI 자동선택 규칙 설계.
3. **최소 CV 승인 후 실행** — MediaPipe Pose(pose_landmarker_full,
   sha256 고정)로 anatomy 한정 자동 ROI. $0 sanity check(frame4
   정상, 10 중 3 fallback) → 15콜($4.0741) 실행.
   - 결과: A(현행) 3/5 · B(dense) **5/5** · C(crop만) 2/5(+UNCERTAIN
     3) · D(원본+crop) **5/5**.
4. **본부가 A04 pilot 종료** — CV/ROI production 도입 HOLD, "crop이
   아니라 context보존+증거추가"가 핵심일 가능성 제기.
5. **A09_race Dense pilot 설계 → 승인 → 실행**(5콜, $1.6288) —
   Individual Production(재사용, DETECT 3/5) vs Dense 19프레임
   (신규, DETECT **5/5**). certainty는 둘 다 UNCERTAIN×5로 안 바뀜
   — 본부 지시로 별도 기록, DETECT 개선과 확신 전환을 구분.
6. **본부 "정리하라"** — 오늘 결과 확정 정리 + 내일 첫 작업(Dense
   safety/generalization) 설계 지시.
7. **Dense Safety/Generalization pilot 설계**(오늘 마지막 작업,
   API 미실행) — Z03_studio·demo_consistency·aurelie·novya(회귀축,
   기존 5/5 baseline 전부 재사용) + demo_anne(confabulation 통제,
   기존 UNCERTAIN×5·confab 0건 재사용). Dense frame 5 fixture 전부
   로컬 생성 완료(109장 합계, $0). 신규 25콜(fixture당 N=5) 추정
   $9~11. hard gate = 회귀축 4개 각각 5/5 유지(하나라도 4/5 이하면
   독립 FAIL) + demo_anne confabulation 0건.

## 내일 첫 작업

**Dense Safety/Generalization pilot 실행 여부 — 본부 승인 대기.**
설계는 끝났다(§7). 승인되면:
- 신규 25콜 실행(추정 $9~11).
- 결과는 fixture별로 따로 보고, 평균 금지.
- hard gate 기준(§7)은 결과를 본 뒤 바꾸지 않는다.
- 통과하면: dense를 Perception Layer 기본 Evidence Acquisition으로
  채택할 근거가 강해진다(단 여전히 production 적용은 별도 결정).
- 실패(회귀 또는 confabulation)하면: dense 채택은 category-specific
  설계로 후퇴, "무조건 dense" 결론은 폐기.

## 상태(본부 표 그대로)

- Gate1 PASS
- Gate2 Observation Repeatability **NOT PASSED**
- A04 Dense 5/5 pilot PASS · A04 Original+ROI 5/5 pilot PASS ·
  A04 ROI-only FAIL
- A09 Dense DETECT 3/5→5/5 PASS(acceptance 기준) · certainty는
  UNCERTAIN 그대로(별도 기록)
- Dense production 적용 **HOLD — generalization 필요**
- CV/ROI production 적용 **HOLD**
- Contact Sheet **종결**
- Astra·Gemini·STEP3/4 **HOLD**

## 산출물 경로 (오늘 전체, 전부 미커밋)

- `reports/anatomy_evidence_acquisition_pilot_design_2026-09-18.md` ·
  `reports/anatomy_evidence_acquisition_pilot_result_2026-09-18.md` —
  A04 pilot 설계·결과.
- `reports/a09_dense_pilot_design_2026-09-18.md` ·
  `reports/a09_dense_pilot_result_2026-09-18.md` — A09 pilot 설계·결과.
- `reports/dense_safety_generalization_pilot_design_2026-09-18.md` —
  내일 첫 작업 설계(오늘 마지막 산출물, API 미실행).
- `oxxovo-scoring/reports/a04_roi_manifest_2026-09-18.json` ·
  `a04_roi_sanity_check_2026-09-18.md` ·
  `a04_roi_detect_result_2026-09-18.json` — ROI 규칙·sanity check.
- `oxxovo-scoring/reports/a09_dense_manifest_2026-09-18.json` ·
  `dense_safety_manifest_2026-09-18.json` — dense 추출 규칙 고정.
- `oxxovo-scoring/reports/stage1b_a04_roi_armB_raw_2026-09-18.json` ·
  `..._armC_raw...` · `..._armD_raw...` · `stage1b_a04_roi_pilot_cost_2026-09-18.json` ·
  `stage1b_a09_dense_armB_raw_2026-09-18.json` — 원자료(신규 20콜).
- `oxxovo-scoring/models/pose_landmarker_full.task`(sha256 기록됨) —
  MediaPipe 모델, anatomy pilot 전용.
- `oxxovo-scoring/_stage1b_a04_roi_detect_2026-09-18.py` ·
  `_stage1b_a04_roi_pilot_2026-09-18.mjs` ·
  `_stage1b_a09_dense_2026-09-18.mjs` — 실행 스크립트.
- 로컬 프레임(레포 밖 temp/, 전부 sha256 검증된 기존 R2 원본에서
  재생성 — 원본 자체는 영구보관): `oxxovo-scoring/temp/a04_roi_pilot_2026-09-18/` ·
  `a09_dense_pilot_2026-09-18/` · `dense_safety_pilot_2026-09-18/`.

## 메모리

- [[project_jisoo_resume_2026-09-18]] — 오늘 하루 전체 타임라인.
- [[project_jisoo_resume_2026-09-16]] · [[feedback_disagree_when_wrong]] ·
  [[feedback_no_blanket_budget_approval]] · [[feedback_aggregate_stat_vs_target_subgroup]] ·
  [[project_identity_continuity_quality_vs_compliance_2026-09-12]]
