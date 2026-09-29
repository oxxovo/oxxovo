# v1.3.1 최소 수정안 설계 (2026-09-11, 본부 지시)

**설계만. 코드·API·새 호출 0건, $0. CLEAN 인증 클립 = 0개 유지.**
대조군 = `reports/gate2_baseline_repeatability_result_2026-09-11.md`(v1.3
현행, N=5). 이 문서가 승인되고 실제 코드 반영이 열리면(아직 아님) 동일
스크립트(`oxxovo-scoring/_gate2_baseline_probe_2026-09-11.ts`)·동일
프레임·동일 N으로 전후 비교한다.

## 0. 수정 범위 — 딱 셋 (본부 지시 그대로, 그 이상 없음)

1. STEP 3 identity/continuity scope: 세그먼트 내부 → whole-clip
2. STEP 4를 Intent(A) / Defect(B) / Compliance(C) 3질문으로 분리
3. Evidence Carry-Forward — STEP 2 material observation은 절차 끝까지
   5개 종결 태그 중 하나로만 닫을 수 있다

Observation 단계(STEP 1/2 자체의 관찰 실패)는 이번 범위에 없다(④).
목표 수치를 미리 5/5로 정하지 않았고, 결과를 본 뒤 기준을 정하지도
않는다 — §4의 수치는 이 설계 승인 시점에 고정, 사후 완화·강화 없음(⑤).

## 1. ① STEP 3 — identity/continuity scope 확장

**현행 (baseline 원문 그대로, 3개 독립 실행에서 재등장)**:
> "NONE OBSERVED — each subject remains stable **within her own segment**"
> "NONE OBSERVED — each subject stays consistent **within her own segment**"

이 문구가 구조적으로 실패하는 이유: 컷 경계에서 인물이 A→B로
바뀌어도, "각 세그먼트 *내부*"만 보면 세그먼트 A 안에서도 세그먼트 B
안에서도 인물은 각각 안정적이다 — 질문 자체가 컷을 넘는 비교를
원천적으로 배제한다. STEP 2("TEMPORAL AND CONTINUITY TRACKING")는
이미 매번 "subject substitution"·"different people"·"deliberate segment
change"를 정확히 잡는데(baseline 5/5 중 4/5 명시), STEP 3가 그 발견을
받아서 평가할 창구가 없다.

**수정 (초안 문구, 코드 미반영)**:
> Identity/character-consistency 항목의 비교 창은 **클립 전체,
> 처음부터 끝까지**다 — 개별 샷·세그먼트·컷 안이 아니다. STEP 2가 클립
> 어느 시점에서든(컷 경계 포함) 인물의 정체성·외형·인원수가 바뀐다고
> 보고했다면, 그 변화는 이 항목의 **평가 대상**이다. 각 세그먼트가
> 내부적으로 일관되다는 이유만으로 "NONE OBSERVED"로 닫을 수 없다 —
> 세그먼트 내부 일관성은 이 질문에 답하지 않는다.

## 2. ② STEP 4 — Intent / Defect / Compliance 3분리

**현행**: 하나의 판단("의도적인가")이 곧바로 A(문제없음)/B(결함)/C(애매)
최종 분류로 이어진다 — Z03에서 "portrait-series structure"라는 미학적
해석 하나가 전체를 A로 닫아버림.

**수정**: STEP 2/3에서 넘어온 각 material item마다 세 질문에 **각각
독립적으로** 답한다.

| 질문 | 내용 | 답 |
|---|---|---|
| **A. Creative Intent** | 프레임·창작자 진술(Competition Brief 슬롯) 근거로, 이 변화가 의도적 연출 선택으로 보이는가 (vs 의도치 않은 렌더링 실패) | YES / NO / UNCERTAIN + 1문장 근거 |
| **B. Technical Defect** | Intent와 무관하게, 이 변화가 AI 생성 실패의 징후(통제 안 된 전환, 워핑/블렌딩, 해부학적으로 잘못된 과도 구간 등)를 보이는가 | YES / NO / UNCERTAIN + 1문장 근거 |
| **C. Brief Compliance** | 해당 제출물의 Competition Brief 원문에 이 항목이 지켜야 할 명시 요구사항(예: "동일 인물/캐릭터를 처음부터 끝까지 유지")이 있는가. 있다면 그 문구 기준으로 PASS/FAIL, 없다면 NOT APPLICABLE | PASS / FAIL / NOT APPLICABLE + 근거(요구사항이 있다면 인용) |

**금지 규칙 (명문화)**: A=YES가 C=FAIL을 자동 면제하지 않는다. "의도적
연출이니 규정 위반이 아니다"라는 자체 면제 권한을 모델에게 주지 않는다.
세 답은 동시에 성립할 수 있다 — 예: A=YES(의도적 몽타주) · B=NO(기술
결함 아님) · C=FAIL(브리프가 동일 인물을 요구하는데 위반) → 최종 종결은
COMPLIANCE VIOLATION이며, "의도적이었다"는 사실은 그 종결을 바꾸지
않는다.

**⚠️ 확인 필요 (제가 임의로 못 정함, HQ/TK 판단)**: C 질문이 실제로
무언가를 FAIL 시키려면 그 시즌/제출물의 Competition Brief 원문에
"동일 인물 유지" 류의 문구가 **실제로 있어야** 한다. 지금까지 확인한
공식 규정 문서(`reports/regular_season_rules_2026-06.md`,
`reports/world_championship_rules_2026-06.md`) 어디에도 이런 문구를
찾지 못했다(레포 grep 0건, [[feedback_db_object_absence_unprovable_by_repo]]
원칙대로 이건 "레포에 없다"는 것뿐이지 브리프 원문 전체를 다 본 것은
아님 — season_test.main_round_theme 실제 값 확인 필요). **만약 브리프에
그런 요구사항이 없다면, C는 정직하게 NOT APPLICABLE로 닫히는 게
맞다** — 그 경우 Z03류 사례가 이 수정만으로 자동으로 "위반"이 되지는
않는다(A=YES·B=NO·C=N/A → 종결은 INTENTIONAL CHANGE). 이게 "고쳤는데도
그대로"로 보일 수 있으니, 본부가 ⓐ 브리프에 continuity 요구사항을 신설할
지 ⓑ 아니면 이번 수정의 목표를 "일관되게 종결되는가"(§4 기준A)로만
한정할지 결정 필요.

## 3. ③ Evidence Carry-Forward (신규 원칙)

**문제(baseline에서 실측)**: STEP 2/3가 항목을 명시적으로 관찰해놓고도
STEP 4의 자유서술 결함 목록에서 그 항목이 **통째로 빠지는** 사례가 5건
중 2건(demo_duel baseline_new_3, demo_anne baseline_new_3) 확인됨 —
"결함이 아니다"라는 판정조차 없이 그냥 사라짐(오답이 아니라 유실).

**원칙**: STEP 2에서 identity/continuity 관련 material observation이
기록되면, 그 항목은 고유 ID를 받고 STEP 3·STEP 4를 통과하는 동안
**목록에서 삭제될 수 없다**. STEP 4는 그때까지 살아있는 모든 항목 각각에
대해 A/B/C 답을 채우고, 다음 5개 중 정확히 하나로 종결해야 한다:

- **DEFECT** — B=YES가 지배적 근거
- **INTENTIONAL CHANGE** — A=YES, B=NO, C=NOT APPLICABLE 또는 PASS
- **AMBIGUOUS** — A/B/C 중 하나 이상이 UNCERTAIN이고 사람 확인 필요
- **COMPLIANCE VIOLATION** — C=FAIL (A/B 값과 무관)
- **NOT APPLICABLE** — 재검토 결과 애초에 실질적 차이가 아니었음(예:
  조명/카메라 각도 차이로 재분류, STEP 2 관찰 자체가 재확인 안 됨)

출력 스키마는 이 종결 목록을 **구조화된 배열**로 강제한다(현행처럼
자유서술 안에 있어서 파서/후속 단계가 놓칠 수 있는 형태 금지) — 이게
현행 "자유서술 사이 유실"을 구조적으로 막는 지점이다.

## 3.5 확정 구조 — Quality Judge와 Compliance Judge는 다른 질문이다 (본부 정리, 2026-09-11)

오늘 작업에서 나온 가장 큰 결론: **오늘 발견한 것은 AI 심사 실패가
아니라 규정 정의의 부재다.** Z03을 실격시키지 못하는 게 STEP3/4
프롬프트의 결함이 아니라 애초에 실격시킬 근거(명문화된 요구사항)가
없어서다 — 근거가 없으면 정답 자체가 없다. 이 구분을 구조로 고정한다.

- **Quality Judge** — "잘 만들었는가"를 묻는다. §2의 A(Intent)·
  B(Defect)는 여기 속한다. 미학적·기술적 판단이며, 정답은 프레임/평가자
  판단에서 나온다.
- **Compliance Judge** — "대회가 요구한 조건을 만족하는가"만 묻는다.
  §2의 C가 여기 속한다. **오직 명문화된 Brief Requirements 원문**을
  기준으로 PASS/FAIL만 낸다. Quality Judge의 판단(잘 만들었다, 의도가
  좋았다)이 이 판정에 영향을 줄 수 없다.
- ⛔ **AI가 스스로 대회 규칙을 만들면 안 된다.** "동일 인물 유지가
  중요해 보이니 그걸 기준으로 FAIL 시키겠다"는 판단은 Compliance
  Judge의 권한 밖이다 — 규정에 없는 걸 있는 것처럼 판정하는 것과
  같다. 규정에 없으면 PASS도 FAIL도 아니라 **NOT APPLICABLE**이
  유일하게 정직한 답이다.

이 구분이 §2의 표와 §4의 acceptance 분리(A/B는 테스트 가능, C는
BLOCKED)의 근거다.

## 4. ⑤ Acceptance Threshold (구현 전 사전 고정, 사후 조정 없음)

**세 항목으로 분리 기록** — 본부 정리 그대로.

| 항목 | 상태 | 사유 |
|---|---|---|
| **A. Evidence Carry-Forward** | ✅ 테스트 가능 | §4 기준A(유실 0/5) — 규정 정의와 무관하게 절차 완결성만 측정 |
| **B. Whole-clip Identity Scope** | ✅ 테스트 가능 | §4 기준B(4/5) — STEP3가 STEP2 발견을 세그먼트 경계 안에서 지워버리지 않는지만 측정, 정답이 뭔지는 안 물음 |
| **C. Compliance** | ⛔ **BLOCKED** | official requirement 미정의 — 근거가 없으면 PASS/FAIL 자체가 정의 불가. §4 기준C는 요구사항이 신설된 **이후에만** 활성화 |

세 트랙으로 나눈다 — 이 수정이 실제로 겨냥하는 결함(Z03류: STEP2는
맞는데 STEP3/4가 되돌림)과, 이 수정 범위 밖인 결함(demo_duel/anne류:
observation 자체의 불안정성, ④에 의해 이번엔 안 건드림)을 같은 잣대로
재지 않기 위함.

### 기준 A — Carry-Forward 기계적 완결성 (즉시 판정 가능, 두 사례군 공통)

동일 N=5 재실행에서, STEP 2가 기록한 identity/continuity material
observation 중 **최종 STEP 4 출력에서 5개 종결 태그 중 하나 없이
사라지는 항목 = 0/5**여야 한다. baseline에서 이 유실이 2/5(demo_duel·
demo_anne 각 1회) 확인됐으므로, 이 수정의 최소 존재 이유는 이 유실을
없애는 것이다. **이 기준 미달이면 채택 보류.**

### 기준 B — STEP 3 whole-clip scope 작동 확인 (Z03_studio 표적)

Z03_studio 재실행 5회 중 **4/5 이상**에서 STEP 3 출력이 "within each
subject's own segment" 류 세그먼트 내부 문구로 종결되지 않고, STEP
2가 찾은 세그먼트 간 대체를 항목으로 명시해야 한다. 4/5는 임의 수치가
아니라 **오늘 baseline에서 본부가 이미 "강한 구조적 증거"로 확정한
바로 그 반복률**을 그대로 재사용한 것 — 사후에 기준을 낮추거나 높이지
않기 위해 같은 잣대를 앞뒤에 씀.

### 기준 C — Compliance 판정 정확성 (§2의 확인 필요 항목에 조건부)

§2에서 확인 필요로 남긴 "브리프에 continuity 요구사항이 실재하는가"가
**YES로 확정된 경우에만** 적용: Z03_studio 5회 중 4/5 이상이
COMPLIANCE VIOLATION으로 종결. **NO로 확정되거나 미확정 상태로
남으면**, 이 기준은 적용하지 않고 Z03_studio가 INTENTIONAL
CHANGE(A=YES/B=NO/C=N/A)로 일관되게 종결되는 것 자체를 "정직한 결과"로
받아들인다 — 규정에 없는 걸 있는 것처럼 판정하게 만드는 게 이번 수정의
목적이 아니다.

### demo_duel · demo_anne에 대한 명시적 비적용

baseline에서 이 둘은 B=1/5로 원래도 불안정했고, 원인은 STEP 1/2
observation 실패(색·자세 변화를 애초에 기록 안 함)가 섞여 있다(④,
이번 범위 밖). 이 둘에게 "B로 몇 번 잡히는가"라는 방향성 기준을
적용하지 않는다 — 적용되는 건 기준 A(유실 0건)뿐이다. 방향성
개선(더 잘 잡는가)은 별도 설계(Observation 단계 보강)가 필요하며, 이
문서가 그 설계를 대신하지 않는다.

## 5. 검증 방법 (승인 후, 아직 실행 안 함)

동일 스크립트(`_gate2_baseline_probe_2026-09-11.ts`) 재사용, STEP3/4
프롬프트 텍스트만 §1/§2 초안으로 교체, 동일 프레임 매니페스트·동일 3개
사례(demo_duel/demo_anne/Z03_studio)·N=5 유지. 전 단계
(STEP1~6+modelId+promptVersion+frameManifest) 저장은
[[feedback_harness_save_full_pipeline]] 그대로 준수.

## 6. 확인 필요 목록 (본부/TK 판단, 제가 임의로 안 정함)

1. §2 Compliance 앵커 — 브리프에 "동일 인물 유지" 류 요구사항을 신설할지, 신설 안 하면 기준 C를 영구히 미적용으로 둘지.
2. §2가 참조하는 Competition Brief 슬롯이 실제로 season_test Z03_studio 제출물에 어떤 원문으로 들어가 있는지(신청 시 창작자 진술 vs 대회 공통 규정, 코드 열람 없이는 확인 못 함).
3. 기준 A/B가 통과해도 기준 C가 미적용(위 1번 NO)이면, 이번 수정이 "Z03을 최종적으로 A(문제없음)로 놔둔다"는 결과 자체는 바뀌지 않는다 — 이걸 이번 v1.3.1의 성공으로 볼지, 아니면 이게 부족해서 별도 브리프 신설 트랙이 필요한지는 본부 판정 대상.

## 7. 다음 작업 순서 (본부 확정, 2026-09-11 정리)

**대표님(TK) 결정 대기 1건이 전부를 막는다**: "본선에 동일 주인공 유지를
공식 필수조건으로 할 것인가." 이 결정이 나기 전엔 §3.5의 Compliance
Judge가 판정할 규정 자체가 없다 — 코드/API HOLD는 이 결정과 무관하게
계속.

순서는 반드시 이것대로:
1. **Rule** — TK가 위 질문에 YES/NO로 답한다(YES면 정확한 문구까지,
   예: "동일 인물/캐릭터가 클립 전체에서 유지되어야 한다" 같은 실제
   브리프 삽입 문구).
2. **Compliance 해석** — YES인 경우, 그 문구를 §2 C 질문의 근거로
   정확히 어떻게 인용할지(어느 시즌부터 적용? 예선/본선 둘 다? 몽타주·
   멀티 캐릭터 연출을 명시적으로 예외 처리할지) 설계.
3. **심사 절차 반영** — 그 다음에야 §1/§2 초안 문구를 실제 코드로
   옮기고 §4 기준 A/B/C를 전부 활성화한 상태로 검증 재실행.

①②③ 순서를 바꾸지 않는다 — 규정 없이 절차부터 손대면 오늘 발견한
문제(AI가 스스로 규칙을 만드는 것)를 코드 반영 단계에서 그대로
반복하게 된다.

관련: [[project_jisoo_resume_2026-09-11]] · [[feedback_harness_save_full_pipeline]] · [[feedback_business_essence_check]] · [[feedback_no_blanket_budget_approval]] · [[project_face_consistency_scoping]]
