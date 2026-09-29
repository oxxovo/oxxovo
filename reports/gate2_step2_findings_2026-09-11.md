# Gate 2 — STEP 2 데이터 공백 해소 + v1.4 채택 여부 근거 (2026-09-11, 승인된 3콜만 사용)

`oxxovo-scoring/reports/gate2_step2_probe_2026-09-11.json`(미커밋). v1.3
그대로, 원래 pilot이 실제로 쓴 프레임 파일 재사용(새 다운로드 없음),
Claude 3콜만($0.68), STEP1~6 전부 + modelId + frame manifest 저장.

## 핵심 결론 먼저

**Z03_studio는 STEP 2가 이미 완벽하게 잡았다 — STEP 1.5는 불필요하다.**
실패는 STEP 3의 범위 설정과 STEP 4의 정책 부재에 있다. demo_duel·
demo_anne는 이번 재실행에서 **원래 pilot과 다른(더 나은) 결론**이
나왔다 — 즉 이 둘의 원래 실패는 절차 구조 문제라기보다 **run-to-run
변동성**이었을 가능성이 있다. **본부가 v1.4를 HOLD한 판단이 데이터로
확인됐다** — STEP 1.5를 그대로 추가하는 건 근거가 약하다.

## Z03_studio — 완전한 인과 사슬 확보

- **STEP 2(continuity)**: *"The change from A to B is a **subject
  substitution**, not drift within a single continuous shot."* — 정확하고
  모호함이 없다. Tracking은 완벽했다.
- **STEP 3(defects, faceIdentity)**: *"NONE OBSERVED **within each
  subject's own segment**; both faces remain stable across their
  respective frames."* — ★여기가 실패 지점★. STEP 3이 질문 범위를
  "각 세그먼트 **안에서** 얼굴이 안정적인가"로 좁혀버려서, STEP 2가 이미
  찾은 "세그먼트 **사이**의 대체"라는 사실 자체가 애초에 질문 대상에서
  빠진다.
- **STEP 3(continuity)**: *"NONE OBSERVED as an error — the subject
  change is **structural**."* — 모델이 스스로 "구조적이라 오류 아님"이라고
  명시적으로 판단.
- **STEP 4(classification)**: "Subject change from Asian woman to Black
  woman, both in red" → **classification A(의도적)**, 근거 = *"shared red
  garment, identical caption, and matched wide-to-close shot pattern
  indicate a deliberate **portrait-series structure**"* — 순수 미학적/
  구조적 일관성 논리로 "의도적"을 판단한다. **OXXOVO 규정상 한 출품작
  안에서 인물이 바뀌는 것 자체가 허용되는가**라는 정책 질문이 절차
  어디에도 없다 — 그래서 "보기 좋게 일관된 구조"라는 이유만으로 A로
  넘어간다.

**결론**: STEP 1.5(Temporal Entity Tracking)를 추가해도 이 사례는 안
바뀐다 — 필요한 관찰·추적은 이미 STEP 2가 갖고 있었다. 고쳐야 할 곳은
① STEP 3의 faceIdentity/continuity 질문 범위를 "세그먼트 내부"가 아니라
"클립 전체"로 명시 확장, ② STEP 4의 classification 기준에 "정책 앵커"를
추가(예: "한 출품작 안의 주체 substitution은 겉보기에 아무리 구조적으로
정돈돼 있어도 기본값은 위반이다" 같은 명문 규칙) — **이건 STEP 1.5 설계와
다른 처방이다.**

## demo_duel — 재현 안 됨(이번엔 더 정확)

- **STEP 2**: *"hair length and color remain consistent"* — 이건 제가
  프레임을 직접 재확인한 결과(0s/8s=짙은 밤색·풍성, 13-14s=더 밝고
  뒤로 넘김)와 **어긋나는 factual 주장**이다. Tracking 단계 자체의 관찰
  정확도 문제로 보인다(Step 1.5를 추가해도 "머리색·스타일을 비교하라"는
  질문 자체는 STEP 2가 이미 했다 — 정확히 답하는 것과는 별개 문제).
- **STEP 3(faceIdentity)**: *"Mild drift on the female: ... frames 7-8
  ... noticeably rounder and smoother with a different jawline."* — 이번엔
  얼굴형 변화를 정확히 짚었다(이전 pilot 답변과 다름).
- **STEP 4**: classification **B(likely unintended)**, 근거 = *"Lighting
  and lens change do not fully account for a change in jaw and cheek
  geometry; consistent with mild identity drift."* — ★이번 실행에서는
  대안 설명(조명·렌즈)을 스스로 검토하고 기각한 뒤 결함으로 분류했다★ —
  원래 pilot의 "identity is preserved"와 **정반대 결론**.

**결론**: 동일 입력·동일 절차인데 결과가 갈렸다 — Input Adequacy 판정
(PARTIAL, 별도 보고서)은 유지하되, 원래 pilot의 "Misattributed"는
**모델이 항상 그렇게 답한다는 뜻이 아니라 그 1회 실행의 결과였다**로
정정한다. Claude가 이 애매한 사례를 올바르게(대안설명 기각 후 결함
분류) 처리할 능력 자체는 있다 — 이번 실행이 그 증거다.

## demo_anne — 재현 안 됨(이번엔 더 정확)

- **STEP 2**: *"Walking is continuous but the pose is nearly identical
  in every sampled frame... No new action, gesture, or event occurs."*
  — "걷기는 연속적"이라는 원래 가정은 그대로 반복하지만, 동시에 "포즈가
  거의 동일하다"는 모순되는 관찰도 같이 적었다 — 다리/발 자체는 여전히
  언급 안 함.
- **STEP 3(motion)**: *"suggesting **minimal or looping locomotion**
  rather than progressive walking mechanics."* — 이전 pilot의 "동작이
  부드럽고 정지 없음"(표적 정면 부정)과 **다른, 훨씬 정확한 답**.
- **STEP 4**: classification **B(likely unintended)**, 근거 = *"A walking
  character should show gait phase variation and expression change;
  static repetition indicates limited motion generation rather than a
  stylistic hold."* — 이번엔 결함으로 올바르게 분류했다.

**결론**: 이것도 재현 안 됨 — 원래 pilot의 완전 부정("smooth, no
collapse")이 이번엔 "제한된 모션 생성"으로 올바르게 뒤집혔다. 다만 두
실행 모두 "다리·발이 어느 프레임에도 안 보인다"는 가장 직접적인 증거는
명시 언급을 안 했다 — 올바른 결론(B)에 도달했어도 **근거를 정확히
짚었는지**는 별개 문제로 남는다.

## ③ v1.4 채택 여부 — 근거 요약(판단은 대표님)

| 사례 | STEP 2가 정보를 갖고 있었나 | 실패 위치 | STEP 1.5가 도움이 되나 |
|---|---|---|---|
| Z03_studio | ✅ 완벽("subject substitution") | STEP3 범위축소 + STEP4 정책부재 | **아니오** — 정보는 이미 있었음 |
| demo_duel | △ 부정확한 claim("color remain consistent")했지만 재실행에선 STEP3/4가 스스로 교정 | run-to-run 변동성 | **불확실** — 관찰 정확도 문제면 유사 절차 추가도 같은 위험 |
| demo_anne | △ "걷기 연속적" 가정은 반복했지만 재실행에선 STEP3/4가 스스로 교정 | run-to-run 변동성 | **불확실** — 동일한 이유 |

**본부의 v1.4 HOLD 판단이 맞았다** — 3사례 중 가장 명확했던 Z03조차
STEP 1.5로 해결이 안 된다. 나머지 둘은 애초에 "절차 결함"이라고 확정할
근거가 이번 재실행으로 약해졌다(재현 안 됨 = 변동성 가능성).

## ④ 신규 개발 원칙 — 반영 완료(메모리에 별도 기록)

"qualification harness는 최종 점수만 저장 금지 — Observation→Tracking→
Defect→Interpretation→Score 전 단계 + 실제 modelId + prompt version +
frame manifest를 전부 저장한다." 이번 pilot의 최초 실수(STEP2 미저장)가
없었다면 이 3콜 없이 기존 원자료만으로 Z03의 정확한 인과 사슬을 알 수
있었을 것 — 그 교훈을 코드가 아니라 **원칙으로 먼저** 박아둔다(다음에
실제 하니스 스크립트를 짤 때 적용).

## ⑤ CLEAN — 0개 유지 확인

변동 없음.
