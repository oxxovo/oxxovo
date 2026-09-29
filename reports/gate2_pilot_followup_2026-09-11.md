# Gate 2 — Pilot 후속 조치 A/B/C (2026-09-11, 새 API 호출 0건)

전부 이미 있는 원자료(`oxxovo-scoring/reports/gate2_pilot_raw_2026-09-11.json`)와
이미 추출된 프레임(`oxxovo-scoring/temp/frames_*`)만 사용. 새 호출 없음.
Primary 3 변경 없음 — Gate 1(quality discrimination)과 Gate 2(perception)를
안 섞는다.

---

## A. CLEAN Certification Protocol (설계)

### 왜 새로 필요한가

A18_cities가 "결백"으로 잘못 지정된 원인은 명백하다 — 40편 조사(2026-09-09)
와 이번 pilot의 프레임 추출 둘 다 **sparse sampling**(8-10프레임 / 10프레임,
전체 19초 중 균등 간격)을 썼고, 결백 판정을 내린 사람은 **1명**이었다.
결함(콜로세움 아치 속 철골 잔여물, 그리스도상/자유의여신상/맨해튼 지리적
합성)은 실존했지만 그 sparse 표본에 우연히 안 걸렸을 뿐이다. 이번 pilot의
프레임(10장)에는 우연히 걸려서 제가 육안으로 확인할 수 있었다 — **이건
이번 표본이 운 좋게 더 잘 잡았다는 뜻이지, 결백 판정 절차 자체가
고쳐졌다는 뜻이 아니다.**

### 프로토콜

1. **전체 타임라인 검사 — sparse sampling 금지.** CLEAN 인증 검토는
   production 채점이 쓰는 2-3초 간격/최대 20프레임 표본을 그대로 재사용하지
   않는다. 후보 클립은 실제 재생(또는 1초 이하 간격의 조밀 프레임)으로
   전체 구간을 본다 — "결함이 없다"는 부재 증명이라서, 표본에 없는 구간은
   증거가 아니다([[feedback_absent_is_not_zero]] 원칙과 같은 이유).
2. **독립 인간 검수 최소 2명.** 사전 정보 공유 없이 각자 검토
   ([[feedback_blind_review_dispatch_no_prior_opinion]]과 동일 원칙 — 먼저
   본 사람의 판단이 뒤 검수자를 오염시키면 안 된다). 각자 다음 둘을 전부
   기록:
   - (a) 6개 cluster(A~F) 각각을 체크리스트로 명시 확인 — "이 클립에
     해당 cluster 유형 결함이 있는가, 없는가"를 6칸 전부 답한다(건너뛰기
     금지).
   - (b) **catch-all 스윕** — 6개 cluster에 안 걸리는 임의의 다른 명백한
     technical defect가 있는가(자유 서술).
3. **판정**:
   - **CLEAN** = 2명 다 (a)(b) 전부 "없음"으로 독립 일치 + 전체 타임라인
     검사 완료.
   - **UNCERTIFIED**(디폴트) = 둘 중 하나라도 어떤 결함이든 하나라도
     플래그하거나, 두 검수자가 불일치하거나, 전체 타임라인 검사가
     생략됐으면 자동으로 이 상태. **애매하면 CLEAN이 아니다** — "아마
     괜찮을 것"은 CLEAN 근거가 안 된다.
4. **비용 주의**: 이 프로토콜은 API $는 안 들지만 사람 시간이 실제로
   든다(클립당 최소 2명×전체 재생 1회씩) — 필요한 후보에만 한정해서
   적용한다(전체 43편 일괄 재인증 아님).
5. **참고**: 제가 이번에 A18_cities에서 한 확인(§B 이전 보고, 프레임 3장
   직접 열람)은 이 프로토콜을 **충족 못 한다** — 검수자 1명, 이미 있던
   sparse 10프레임 재사용이었다. 그 확인은 "결백 아님을 반증"하기엔
   충분했지만(결함 실존을 육안 확인), "다른 후보가 CLEAN이다"를 증명하는
   덴 이 프로토콜 전체가 필요하다. **지금 CLEAN 인증된 클립은 0개다.**

---

## B. Identity / Motion Failure Analysis — 4단계 분해

가설 폐기 반영: "컷 때문에 다른 인물로 해석한다"가 원인이 아니다. 셋 다
분해해 보면 **컷의 유무와 무관하게, 판정관이 한 개체(subject)의 정의
속성을 프레임 전체에 걸쳐 명시적으로 추적·대조하는 단계 자체가 절차에
없다**는 같은 뿌리에서 갈라져 나온다. 4단계(Observation / Tracking /
Interpretation·Misattribution / Defect escalation)로 Claude 3개 핵심
사례를 원자료(step1_observation 전문 + 기존 step3/weaknesses)로 추적.

### B-1. demo_duel (E, 컷 없음) — **Observation failure + Misattribution의 이중 실패**

- **Step 1(observation)**: `subjects` 필드가 "Figure B: female-presenting,
  long light-brown hair streaming behind..."로 **단 하나의 고정 묘사**만
  적는다 — 머리색·스타일이 프레임마다 어떻게 다른지 애초에 기록조차 안
  했다. 같은 인물을 프레임별로 나눠 적지 않고 하나의 합성 묘사로 뭉갰다.
  ⚠️**여기가 1차 실패 지점** — 나중 단계가 뭘 하든 애초에 비교할 원재료
  (프레임별 머리 묘사)가 기록에 없다.
- **Step 3(defects, 기존 보고에서 확인)**: 그런데도 "the female likewise
  appears smoother in frame 6 vs. more defined in frame 7-8"처럼 프레임
  간 차이를 **별도로** 알아챘다 — Step 1에 안 적었던 걸 Step 3에서 다시
  관찰한 것. 하지만 이걸 "identity is preserved, rendering register만
  변함"이라고 **결함이 아니라고 명시적으로 결론**냈다.
- **판정**: Observation failure(1차, Step1이 머리 속성 변화를 데이터로
  못 남김) + 별도 재관찰이 있었음에도 Misattribution(2차, Step3에서
  "정체성 아님"으로 적극적으로 결론). Tracking 단계는 성립 자체가 안 됨
  (추적할 원재료가 없었으니까) — escalation은 애초에 논의 대상이 아님
  (결함이 아니라고 결론났으니).

### B-2. Z03_studio (TRAP, 컷 있음) — **순수 Interpretation/Misattribution 실패, Observation은 성공**

- **Step 1(observation)**: 놀랍게도 **완벽하다** — "Subject A(frames
  1-4): East Asian woman, long straight black hair..." vs "Subject B
  (frames 5-8): Black woman, middle-aged to older, short tightly-coiled
  hair..."로 **처음부터 둘을 별개 인물(A/B)로 정확히 구분해서 묘사**했다.
  인종·나이·헤어스타일 전부 다르다고 명시했다 — 관찰은 틀린 게 하나도
  없다.
- **Tracking**: 해당 없음 — 애초에 "같은 사람"이라고 가정한 적이 없어서
  추적 실패가 성립할 여지가 없다.
- **Interpretation/Misattribution**: 여기가 **유일한 실패 지점**이다.
  weaknesses에서 "a caption that never updates across **the subject
  change**"라고 적었다 — "the subject change"라는 표현 자체가 인물이
  바뀐 걸 **이미 사실로 전제**하고 있다. 그런데 그 교체 자체를 결함으로
  잡지 않고, 그 위에 얹힌 다른 문제(캡션 미갱신)만 지적했다. 즉 "관찰은
  정확했지만, 그 관찰된 사실(다른 사람)을 규정 위반으로 분류하는 절차가
  없었다."
- **더 근본적인 재정식화(본부 지시 반영)**: 이건 "컷이 있어서 다른
  사람이어도 괜찮다고 착각"한 게 아니다 — Claude는 이게 다른 사람이라는
  걸 **정확히 알고 있었다**. 문제는 판정 절차 자체에 "한 clip 안에서
  피사체가 바뀌는 것 자체가 identity-continuity 위반"이라는 명시적 채점
  규칙이 없다는 것. 컷의 유무는 원인이 아니라 **결과의 겉모습**일 뿐이다
  — cluster J(편집상 하드컷)로 읽든 진짜 인물 스왑으로 읽든, 이 절차는
  둘을 구분하는 질문 자체를 안 던진다.

### B-3. demo_anne (C, 모션결핍) — **순수 Observation failure**

- **Step 1(observation)**: `actions` 필드가 "The character **walks
  forward** along the path..."라고 **단정적으로 서술**한다 — 실제 시각
  증거(다리·발이 전체 클립 동안 한 번도 안 보임/안 움직임)를 프레임별로
  검증한 흔적이 `subjects`/`actions` 어디에도 없다. 캐릭터가 "재킷
  주머니에 손을 넣고" 있다는 건 적었지만, 다리가 프레임에 보이는지 여부
  자체를 기록 안 했다.
- **Step 3(motion)**: "Walking motion is smooth in the sampled frames;
  no frozen or collapsed motion observable" — Step 1의 가정을
  **재확인하며 강화**했을 뿐, 독립적으로 재검증하지 않았다.
- **판정**: 순수 **Observation failure**. 판정관이 "걷는 장면으로
  프레이밍됐다"는 장르적 관습(연출 의도)을 그대로 사실로 받아들이고,
  실제 신체 부위별 움직임 증거를 프레임 단위로 대조하지 않았다 — 하향식
  가정이 상향식 시각 검증을 대체한 사례. Tracking/Interpretation/
  Escalation 이전, 가장 이른 단계에서 이미 끝났다.

### B 요약 — 3사례가 가리키는 공통 원인

| 사례 | Observation | Tracking | Interpretation | Escalation |
|---|---|---|---|---|
| demo_duel | ❌ (속성변화 미기록) | N/A(원재료 없음) | ❌ (Step3에서 재관찰했지만 "정체성 아님"으로 오귀속) | N/A |
| Z03_studio | ✅ (완벽히 구분) | N/A(같은사람 가정 자체가 없었음) | ❌ (관찰된 차이를 위반으로 미분류) | N/A |
| demo_anne | ❌ (프레이밍 관습을 그대로 사실로 서술) | N/A | N/A | N/A |

세 사례 다 실패 **단계**는 다르지만, 공통 원인은 하나다 — **Structured
Judging Procedure 어디에도 "한 개체의 정의 속성을 프레임 전체에 걸쳐
명시적으로 나열·대조하라"는 전용 단계가 없다.** Step 1은 샷 단위 요약을
쓰고(Z03처럼 우연히 컷 경계와 일치하면 자동으로 분리되지만, demo_duel처럼
컷 없이 서서히 변하면 하나로 뭉개진다), Step 3은 "위반 있는가"를 카테고리
당 한 줄로 묻지 "이 사람이 시작과 끝에서 같은 사람인가"를 명시적으로
대조 질문하지 않는다.

---

## C. 나머지 4 cluster — 확정 표현 정정

이전 보고(`reports/gate2_pilot_result_2026-09-11.md`)의 "Detected" 표기를
**"detectability signal 존재(n=1, 미확정)"**로 다시 읽어야 한다 — 표본
1개로 "이 cluster는 된다"고 말할 수 없다:

- A(전환글리치, aurelie): Claude/Astra/Gemini 전부 반응 — signal 존재,
  미확정.
- B(텍스트불안정, novya): Claude/Astra 반응, Gemini 무반응 — signal
  존재, 미확정.
- D(기계적 비개연성, A12_mech): Claude/Gemini 반응, Astra 무반응 —
  signal 존재, 미확정.
- F(손가락해부학, A13_group): Claude/Gemini 반응, Astra 무반응 — signal
  존재, 미확정.

## FP 표기 정정 (본부 지시 ②, 반영 완료)

이전 보고의 "Core FP = 0건"을 **"Core FP = N/A — valid CLEAN control
없음"**으로 정정한다. 0은 "검사했고 없었다"는 뜻이라 오해를 부른다 —
실제로는 "검사할 유효한 기준선 자체가 없었다."

---

## 다음 (본부 판단 대기, 새 호출 없음)

- A 프로토콜이 승인되면, 다음 CLEAN 후보 선정에 적용(비용=사람 시간).
- B의 "정의 속성 프레임별 명시 대조" 결핍은 Structured Judging Procedure
  자체의 설계 이슈로 보임 — 프롬프트 변경 여부는 Gate 2 확대 여부와 함께
  본부 판단.
- C — 나머지 4 cluster 확정은 표본을 늘리기 전까진 보류.
