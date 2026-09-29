# Gate 2 — v1.3 Baseline Repeatability 결과 (N=5, 2026-09-11)

승인된 9콜 실행 완료($2.07, 예상 $2.1). 조건 전부 고정(Claude만·v1.3
원문·기존 pilot frame 그대로·완전 독립 호출) — 실행 중 prompt/temperature/
frame sampling 변경 없음. 원자료 = `oxxovo-scoring/reports/
gate2_baseline_probe_2026-09-11.json`(신규 9건, STEP1~6+modelId+
promptVersion+frameManifest 전부 저장) + 기존 2건(`gate2_pilot_raw_
2026-09-11.json`, `gate2_step2_probe_2026-09-11.json`).

⛔ 결과만 보고한다 — STEP 3/4 수정은 아직 안 건드림.

## ① Raw count만 (사례당 N=5, 비율·안정성% 표현 없음)

| 사례 | B로 분류된 횟수 |
|---|---|
| demo_duel | **1/5** |
| demo_anne | **1/5** |
| Z03_studio | **0/5**(4건 확정 A + 1건 정황상 비-B) |

## ② "B 아님"의 원인 분해 — 같은 결과라도 원인이 다르다(사람이 STEP별 원문 직접 판독)

### demo_duel (표적: 여성 캐릭터 얼굴/머리 속성 항목)

| Run | 결과 | 원인 |
|---|---|---|
| 원래 pilot | 비-B(A류) | STEP3이 차이를 **관찰은 했으나** "identity is preserved, rendering register만 변함"으로 명시 결함 아님 판정 |
| STEP2 probe | **B** | STEP4가 명시 결함으로 분류(유일한 B) |
| baseline_new_1 | Miss | STEP2 자체가 이번 런엔 "same hair color and length"라고 **차이 자체를 관찰 안 함** — 원천적 관찰 실패 |
| baseline_new_2 | C | STEP4가 항목은 만들었으나 ambiguous로 분류 |
| baseline_new_3 | Miss(유실) | STEP3이 "slight facial proportion shift"를 명시 관찰했는데 **STEP4 항목 목록에서 통째로 빠짐**(STEP3→STEP4 escalation 유실) |

### demo_anne (표적: 정적 포즈/모션결핍 항목)

| Run | 결과 | 원인 |
|---|---|---|
| 원래 pilot | 비-B(A류) | STEP3이 "smooth… no frozen/collapsed"라고 표적을 **정면으로 부정** — 관찰 자체가 사실과 반대 |
| STEP2 probe | **B** | STEP4가 명시 결함으로 분류(유일한 B) |
| baseline_new_1 | C | 항목 있음("Near-static character pose…"), ambiguous로 분류 |
| baseline_new_2 | C | 항목 있음("Lack of visible walking stride progression"), ambiguous로 분류 |
| baseline_new_3 | Miss(유실) | STEP3이 "near-static or minimally articulated gait"를 명시 관찰했는데 **STEP4에서 통째로 빠짐** |

### Z03_studio (표적: 주체 교체 항목) — ★★본부 지시 ④ 그대로 재현됨

| Run | 결과 | 원인 |
|---|---|---|
| 원래 pilot | 비-B(A류, 정황) | STEP3="NONE OBSERVED"(단답), STEP4 미저장(harness 공백) — 정황상 비flag |
| STEP2 probe | A | STEP2="subject substitution", STEP3="NONE OBSERVED within each subject's own segment", STEP4=A("portrait-series structure") |
| baseline_new_1 | A | STEP2="full subject substitution at a hard cut, consistent with a **multi-subject montage structure**", STEP4=A |
| baseline_new_2 | A | STEP2="different people — reads as a **deliberate segment change**", STEP3="NONE OBSERVED — each subject remains stable **within her own segment**", STEP4=A |
| baseline_new_3 | A | STEP2="different people…reads as a deliberate segment change", STEP3="NONE OBSERVED — each subject stays consistent **within her own segment**", STEP4=A |

**5번 중 4번이 STEP4=A로 확정, 5번째(원래 pilot)도 정황상 동일. 그리고
"within each subject's own segment"라는 거의 동일한 문구가 3번(중 2번은
거의 축자적으로 동일)이나 독립적으로 재등장한다.** STEP 2는 매번
"substitution"·"different people"·"deliberate segment change"라는
표현으로 사실 관계를 정확히 잡는데, STEP 3~4는 매번 같은 경로로 그걸
"구조적이라 결함 아님"으로 되돌린다.

## ④ 본부가 특히 보라고 한 지점 — 확인됨

**Z03은 STEP 2가 반복적으로 subject substitution을 정확히 잡으면서
STEP 4가 계속 A로 빠진다.** 5번 중 최소 4번이 명시 확정, 문구까지 거의
동일하게 재현된다 — **이건 노이즈가 아니라 상당히 강한 구조적 증거다**
(본부 표현 그대로). demo_duel·demo_anne는 반대로 **B가 오히려
소수(5번 중 1번)** 였다 — 지난 STEP2 probe에서 "이번엔 제대로 잡혔다"고
본 것 자체가 5번 중 가장 드문 결과였다는 뜻이다. 이 둘은 결함 자체가
아니라 결함 **판정의 반복 안정성**이 낮다(Miss/C/A류로 흩어짐, 뚜렷한
지배적 결과가 없음).

## 요약 (판단은 대표님, 지금 STEP3/4는 안 건드림)

- **Z03_studio**: 구조적으로 안정적인 실패 — STEP3의 세그먼트 내부
  범위 축소 + STEP4의 정책 부재가 **거의 매번** 같은 방식으로 재발한다.
  ③의 수정 후보(STEP3 scope 확장, STEP4 정책 앵커)가 겨냥해야 할 정확한
  표적이 이걸로 다시 확인됐다.
- **demo_duel·demo_anne**: 결과 자체가 불안정하다(B=1/5 각각) — "절차를
  고치면 나아진다"고 말하기 전에, 애초에 무엇을 "정답"으로 놓고 개선을
  측정할지부터 다시 생각해야 한다. 표적 항목이 STEP3에서는 여러 번
  관찰되지만(5번 중 3~4번) STEP4로 넘어가며 손실되는 패턴(Miss-유실)이
  두드러진다 — 이건 Z03과는 다른, **STEP3→STEP4 escalation 자체의
  일반적 손실률** 문제일 수 있다(사례 3개로는 확정 못함).

STEP1~6 전문은 두 JSON 파일에 전부 보존돼 있어 추가 비용 없이 언제든
재분석 가능하다. CLEAN=0 유지. 코드 수정 계속 HOLD.
