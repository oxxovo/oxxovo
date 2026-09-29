# Stage 1b 결과 — 28콜 (2026-09-12)

실행: `oxxovo-scoring/_stage1b_repeatability_probe_2026-09-12.mjs`(미커밋).
원자료 = `oxxovo-scoring/reports/stage1b_raw_output_2026-09-12.json`
(Stage 1a `stage1a_raw_output_2026-09-12.json`와 합쳐 fixture당 N=5).
**실비 $5.5157**(승인 $7 이내, 총 Stage1a+1b = $6.9050). 28/28 parse 성공,
JSON 스키마 위반 0.

## Fixture별 raw count (①~⑤, 평균 % 없음)

| Fixture | Target CHECK | 5회 certainty | ①Completion | ②/⑤ GT일치 | ③Confab | ④Evidence |
|---|---|---|---|---|---|---|
| Z03_studio | subjectIdentityCount | YES,YES,YES,YES,YES | 5/5 | **5/5** | 0/5 | 0건 위반, 표본 검증 통과 |
| **A04_morph** | handLimbAnatomy | NO,NO,**UNCERTAIN**,NO,**UNCERTAIN** | 5/5 | **3/5 ⛔** | 0/5 | 0건 위반, 표본 검증 통과 |
| demo_anne | claimedActionEvidence | UNCERTAIN×5 | 5/5 | **5/5**(⑤ 정밀표현 기준) | 0/5 | 0건 위반, 표본 검증 통과 |
| **A12_mech** | objectMechanismCoherence | NO,**UNCERTAIN**,NO,**UNCERTAIN**,NO | 5/5 | **3/5 ⛔** | 0/5 | 0건 위반, 표본 검증 통과 |
| demo_consistency | progressiveDegradation | YES×5 | 5/5 | **5/5** | 0/5 | 0건 위반, 표본 검증 통과 |
| aurelie | transitionIntegrity | YES×5 | 5/5 | **5/5** | 0/5 | 0건 위반, 표본 검증 통과(프레임 번호까지 5회 모두 11/12/13 일치) |
| novya | brandTextIdentityStability | NO×5 | 5/5 | **5/5** | 0/5 | 0건 위반, 표본 검증 통과 |

**판정: 5/7 fixture 전부 통과, 2/7(A04_morph, A12_mech) ②에서 미달(3/5 < 4/5).**

## ④ 방법 (본부 수정안 적용)

- 프레임 번호 범위: 전수 자동 검사 — 7 fixture × 5회 × 7 CHECK = **245개 응답
  전체**에서 인용된 프레임 번호를 추출해 유효 범위(1~N) 확인. **위반 0건.**
- 사람 직접 확인: 5회가 갈린 A04_morph·A12_mech는 **5회 전부**(1회가 아니라)
  관찰문을 직접 대조했다 — 아래 §2 참조. 갈리지 않은 5개 fixture도
  시간이 남아 **5회 전부** 읽었다(요구된 "최소 1건"보다 많이 함).
- 새로운 시각적 주장: novya rep5가 "NOWYA/NOVVYA"라고 스스로 글리프
  모호성을 인정한 것 외에 새 주장 없음. aurelie는 5회 모두 프레임
  11/12/13을 근거로 지목 — 번호까지 완전히 안정적.

## ⑤ demo_anne — 본부가 지적한 정확한 표현 기준으로 재확인

5회 전부 "허벅지/청바지는 보인다"를 먼저 인정한 뒤, "무릎 이하·보행 진행이
확인 안 된다"로 마무리했다 — **"다리/사람이 안 보인다"는 표현은 5회 중
0회.** 예(rep 4): *"Legs...visible only from the hip to mid-thigh or knee...
feet are never visible and no stride/gait cycle can be seen."* 본부가 지적한
실패 조건(허벅지 보이는데 "안 보인다"고 하는 것)을 5회 모두 피했다.

## ②실패 2건 — ★confabulation이 아니라 threshold 흔들림

A04_morph·A12_mech 둘 다 5회의 **관찰 내용 자체는 거의 동일**하다(직접 대조,
전문은 별도 스크립트 출력):

- A04_morph: 5회 전부 "frame 1 손끝이 뾰족하게 길다·frame 3은 손이 사각
  블록으로 잘림·frame 6은 파티클로 분해" — 거의 같은 문장. 다른 건 이걸
  NO(비정상 확정)로 마무리하는지 UNCERTAIN(애매함 인정)으로 마무리하는지
  뿐이다.
- A12_mech: 5회 전부 "피스톤이 크랭크축 없이 기어에 얹혀있다·스프로킷
  이가 뭉개져 보인다"는 같은 사실을 보고하지만, "일부 기어는 그럴듯하게
  물린다"는 단서를 UNCERTAIN 쪽 2회에서만 비중있게 다룬다.

**결론**: 이 2개는 날조가 아니라 **같은 증거를 보고 다른 확신도로 끝맺는
문제**다 — 09-12 세션 맨 처음 제가 짚었던 "같은 프레임 5회 실행해도 답이
흔들린다"는 바로 그 현상이 이번 격리 계측(step1_verification)에서도 그대로
재현됐다. instrument가 관찰(observation) 자체는 안정적으로 잡아내는데,
그걸 4값 중 하나로 반올림하는 지점에서 흔들린다.

## 결론

Acceptance 5개 중 ①③④는 7/7 전부 통과, ②/⑤는 5/7 통과(2건 미달, 사유
확인됨). 결과 보고 후 기준 조정 안 함(지시 그대로).

## STOP

Astra·Gemini·STEP3/4·Contact Sheet·CV 전부 HOLD 유지. 추가 실행 안 함.
