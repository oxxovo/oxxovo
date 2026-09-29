# Structured Judging Procedure v1.4 설계 — Temporal Entity Tracking (문서만, 새 호출 0)

⛔ 코드 미반영. 문서 설계만. 새 API 호출 0건 — 아래 ④ dry-run은 전부
(a) 이미 저장된 pilot 원자료(`gate2_pilot_raw_2026-09-11.json`)와
(b) 이미 로컬에 있는 pilot 프레임(`oxxovo-scoring/temp/frames_*`)을 제가
직접 육안으로 재확인한 결과만 쓴다.

## ⚠️ 설계 착수 전 발견한 데이터 공백 (정직하게 먼저 보고)

지난 보고(B. 4단계 실패분해)를 쓸 때 실제 v1.3 절차의 **STEP 2를 확인 안
하고** 진행했다 — 방금 원문을 다시 보니 STEP 2가 이미
"TEMPORAL AND CONTINUITY TRACKING"이라는 이름으로 존재하고, "각 반복
등장 인물이 인식 가능하게 같은 사람으로 유지되는가", "처음부터 끝까지
무엇이 바뀌는가", "의도적일 수 있어도 유의미한 변화는 보고하라"를 이미
묻고 있었다. **그런데 제 pilot 스크립트(`_gate2_pilot_2026-09-11.ts`)의
`toJudgeOutput`이 `step1_observation`과 `step3_defects`만 저장하고
`step2_continuity`(및 step4/5/6)는 애초에 JSON에 안 남겼다** — API
응답엔 있었지만 디스크엔 안 남았고, 지금은 새 호출 없이 복구 불가능하다.

**이게 의미하는 것**: 지난 B 보고의 "Observation failure"/"Misattribution"
단계 배정은 STEP 1과 STEP 3(+weaknesses)만 보고 내린 판단이다. STEP 2가
이 세 사례에서 실제로 뭐라고 답했는지(예: demo_duel에서 "같은 사람인가"
질문에 뭐라 답했는지) 확인을 못 했다 — STEP 2가 이미 맞게 잡았는데 STEP 3
단계에서 유실됐을 가능성을 배제 못 한다는 뜻이다. **이 공백은 새 호출
없이는 못 메운다** — 이번 지시가 "호출 0"이라 지금 메우지 않고, 아래
설계는 이 불확실성을 안고 간다(⑤에서 다시 명시).

## ① 배치 — STEP 1과 STEP 2 사이, 새 STEP 1.5

전체를 뜯지 않는다. STEP 2(Temporal and Continuity Tracking)는 이미
"같은 사람인가"라는 **최종 판단**을 묻고 있다 — 문제는 그 판단을 내리기
**직전에 대조할 원재료(속성별 스냅샷)**가 절차 어디에도 없다는 것이다.
새 STEP 1.5가 그 원재료를 만든다. STEP 2는 그대로 두고, STEP 2가 이제
"위에서 만든 표를 보고 같은 개체인지 답하라"를 참조하도록 한 줄만
추가한다(STEP 2 본문 자체의 판단 로직은 안 건드림).

## STEP 1.5 — TEMPORAL ENTITY TRACKING (신설 원문 초안)

```
STEP 1.5 - TEMPORAL ENTITY TRACKING

From the subjects, objects, and text identified in STEP 1, list every
entity that requires persistence across the video -- i.e., every entity
the video presents as continuing to exist across more than one sampled
frame:
  - person
  - object / product
  - on-screen text, numbers, or labels
  - mechanical or structural assembly

For each such entity, record its defining attributes at the earliest,
a middle, and the latest frame in which it appears:
  - person: face shape, hairstyle and hair color, clothing, distinguishing
    body features
  - text: the exact characters/numbers/label content
  - object / mechanical structure: shape, visible parts, and how those
    parts connect to each other

Record only states that are directly visible in the sampled frames you
were given. Do not infer motion, continuity, or persistence that is not
directly confirmed by comparing frames. If a body part, action, or state
is not visible in any sampled frame, write "not visible in sampled
frames" -- do not assume it from genre convention, framing intent, or
what the scene appears to be depicting.

This step only records comparisons. Do not yet decide whether a
difference is a defect.
```

STEP 2는 본문 앞에 한 줄만 추가:

```
Use the entity comparison table from STEP 1.5 as your evidence when
answering the "does each recurring person/object/text remain the same"
questions below.
```

## ② 핵심 규칙 — 이미 위 초안에 포함, 별도 강조

> "Record only states that are directly visible in the sampled frames
> you were given. Do not infer motion, continuity, or persistence that
> is not directly confirmed by comparing frames."

이건 demo_anne의 hallucinated observation을 막기 위한 장치다 — "walks
forward"라고 쓰려면 실제로 프레임 간 다리/발 위치 변화가 **보여야** 한다.
안 보이면 "not visible in sampled frames"라고만 쓰게 강제한다.

## ③ 변화 발견 ≠ 즉시 defect

기존 STEP 4(classification)의 intentional/likely unintended/ambiguous
3분류를 그대로 재사용한다 — STEP 1.5는 "차이가 있다/없다"만 기록하고,
그게 결함인지 판단은 여전히 뒤(STEP 4)에서 한다. 이렇게 안 하면 의상
교체 연출이나 정상적인 장면 전환까지 전부 Identity Drift로 오탐될 위험이
있다.

## ④ Dry-run — 비용 $0 (제 육안 확인 기반)

### demo_duel (E) — 프레임 재확인 결과: **차단됨(부분)**

frame_000(0s)과 frame_007(14s)를 직접 열어 비교했다. 0s에서 여성 캐릭터의
머리는 짙은 갈색·길게 늘어뜨림(streaming behind), 14s 근접샷에서는 색이
더 밝고 뒤로 넘겨 묶은 형태로 보인다 — **육안으로도 같은 인물이라기엔
스타일·색이 달라 보인다.** STEP 1.5를 적용하면 "hairstyle and hair color"
칸에 0s="dark, long, loose"·14s="lighter, swept back"를 **각각 명시**해야
하므로, 기존처럼 하나의 뭉뚱그린 묘사("long light-brown hair streaming
behind")로 넘어갈 수 없다. → 이 표가 만들어지면 STEP 2가 "같은 사람인가"
질문에 근거를 갖고 답할 수 있다. **다만 차단이 확정은 아니다** — 표를
만들어도 STEP 4에서 "카메라 각도·조명 차이로 인한 렌더링 차이"로
intentional/unintended 판정을 잘못 내릴 여지는 여전히 남는다(⑤ 참조).

### Z03_studio (TRAP) — **이미 STEP 1이 정답을 갖고 있었다**

지난 분석대로 STEP 1(observation)이 이미 "Subject A(frames 1-4)"/
"Subject B(frames 5-8)"로 인종·헤어스타일·나이가 다른 별개 인물임을
정확히 적었다. STEP 1.5를 적용하면 이 둘을 "지속돼야 할 person 개체"로
등록하려는 시도 자체에서 막힌다 — face shape/hair/clothing을 초반·후반
프레임에서 비교하면 **완전히 다른 사람**이라는 결론이 나온다(이미 STEP
1이 그렇게 적었으므로). 여기서 중요한 차이: STEP 1.5는 "이게 한 명인지
두 명인지"를 **명시적 질문으로** 만든다 — 지금처럼 그냥 서술하고 넘어가는
게 아니라 "이 둘이 하나의 지속 개체로 취급될 수 있는가?"에 명시 답을
강제한다. → **관찰 단계에서 이미 정답을 갖고 있었다는 사실 자체가
STEP 1.5의 필요성을 보여준다** — 정보는 있었는데 그걸 "지속성 판단"으로
전환하는 절차가 없어서 캡션 문제로만 흘러갔다. STEP 1.5는 그 전환을
강제하는 장치다. → 차단 **가능성 높음**, 단 STEP 4의 intentional 분류가
"이건 의도된 두 인물 몽타주다"로 여전히 빠져나갈 수 있다(⑤ 참조 — 이게
가장 우려되는 잔존 경로).

### demo_anne (C) — 프레임 재확인 결과: **차단됨(강함)**

frame_000(0s)·frame_004(8s)·frame_007(14s) 세 장을 전부 직접 열어
확인했다 — **8개 샘플 프레임 전체에서 다리/발이 한 번도 프레임에 안
들어온다**(전부 허리~허벅지 선에서 크롭). 기존 STEP 1은 그런데도
"character walks forward"라고 단정했고, shotsAndCamera 필드는 "widens
to medium-wide (knees/full-body, frames 5-8)"라고 **실제로 존재하지
않는 프레이밍까지 지어냈다** — 순수 hallucination이 실측으로 재확인됨.
STEP 1.5의 "not visible in sampled frames" 규칙을 적용하면 다리 상태
칸은 강제로 "not visible"이 되고, "걷는다"는 서술 자체가 성립할
근거(다리·발의 프레임 간 변화)가 없어진다. → **다리/발이 원천적으로
안 보인다는 사실 자체가 프레임에 있으므로, 이 사례는 세 개 중 가장
확실하게 차단된다.**

## ⑤ ★이 절차로도 못 잡는 시나리오 (본부 지시 — 답을 알고 만든 절차가 되지 않도록)

1. **STEP 4의 "intentional" 분류가 새로운 도피처가 될 수 있다.** Z03에서
   보듯 판정관이 "Subject A와 B가 다른 사람"이라고 명시적으로 표를
   채워도, STEP 4에서 "이건 의도된 다중 인물 몽타주 연출"이라고
   판단하면 defect로 안 넘어간다. STEP 1.5는 **관찰을 강제**할 뿐
   **해석을 강제하지 않는다** — "OXXOVO 규정상 한 항목 안에서 인물이
   바뀌는 것 자체가 항상 위반인가, 아니면 의도가 명백하면 봐주는가"라는
   **정책 정의**가 없으면, STEP 1.5가 만든 정확한 관찰도 STEP 4에서 또
   빠져나갈 수 있다. 이건 절차 문제가 아니라 정책 문제라 이 설계만으로는
   못 막는다.
2. **sparse frame sampling 자체는 그대로다.** STEP 1.5는 "주어진 샘플
   프레임 안에서" 비교를 강제할 뿐, 샘플이 애초에 결함 구간을 놓치면
   (A18_cities 결백 오판정의 원인) 여전히 못 잡는다 — 이건 A안(CLEAN
   인증 프로토콜)의 문제이지 이 STEP 1.5의 책임 범위 밖이다.
3. **단일 프레임 내부의 공간적 비일관성은 이 절차의 대상이 아니다.**
   A18_cities의 실제 결함(그리스도상+자유의여신상+맨해튼이 한 프레임 안에
   동시 존재)은 "한 개체가 시간에 따라 바뀌는" 문제가 아니라 "한 프레임
   안에서 여러 실재 랜드마크가 불가능하게 합성된" 문제다 — 지속성
   추적으로는 애초에 질문 대상이 아니다. Temporal Entity Tracking이라는
   이름 자체가 이 결함군을 구조적으로 커버 못 한다.
4. **군중/다수 유사 개체에서 개체 결합(binding) 오류.** A13_group 같은
   군중 씬에서 "초반 프레임의 댄서 3번"과 "후반 프레임의 댄서 3번"이
   실제로 같은 사람인지조차 화면상 확신하기 어렵다(의상이 비슷한 다수
   인물). 여기선 STEP 1.5가 오히려 **틀린 짝짓기**를 만들 위험도 있다 —
   실제로는 다른 두 배경 댄서를 "같은 개체"로 착각해 존재하지 않는
   drift를 만들거나, 반대로 진짜 같은 사람인데 다른 사람으로 잘못
   나눠 놓쳐버릴 수 있다.
5. **STEP 2 실제 출력을 못 봐서, 이 설계가 진짜 새로운 정보를 추가하는
   건지 확신할 수 없다.** 위 "데이터 공백" 절 참조 — STEP 2가 이미
   3사례 중 일부를 스스로 잡았을 가능성을 배제 못 한다. 그렇다면 진짜
   결핍은 "관찰 단계"가 아니라 "STEP 2→STEP 3/4 사이의 정보 유실"일 수
   있고, STEP 1.5는 정확한 처방이 아닐 수 있다. **다음 호출 예산이
   열리면 가장 먼저 할 일은 이 3사례에 대해 STEP 2 전문을 새로 확보하는
   것**(3콜, 매우 저렴) — 그래야 이 설계가 맞는 자리를 겨눴는지 확정된다.

## ⑥ CLEAN — 0개 유지 확인

새 프로토콜(A) 기준 CLEAN 인증 절차를 지금 서두르지 않는다. A18_cities를
포함해 CLEAN 인증된 클립은 여전히 0개다 — 다음 라운드에서 A 프로토콜
그대로(독립 검수 2명, 전체 타임라인, 6cluster+catch-all) 처음부터 다시
돈다.

## 요약

STEP 1.5(Temporal Entity Tracking)는 세 핵심 사례 중 demo_anne(강함)·
demo_duel(부분)을 데이터로 확인했고, Z03_studio는 STEP 1이 이미 가진
정보를 STEP 2/4로 넘기는 통로를 만들어 **차단 가능성이 높지만 확정은
아니다**(STEP 4의 intentional 분류가 여전히 빠져나갈 구멍). 이 절차는
① 프레임 샘플링 부족, ② 단일 프레임 공간 비일관성, ③ 군중 개체 결합
오류, ④ STEP 4 정책 정의 부재라는 네 가지를 못 막는다 — "이 셋을 잡으니
끝"이 아니라는 본부 지적을 반영해 명시했다. 코드 반영·호출은 다음 지시
대기.
