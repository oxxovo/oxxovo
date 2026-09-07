# 재채점 — 조합 A (claude-opus-5 + gpt-5.6-sol + gemini-3.8-flash) — 2026-09-06

같은 43편, 같은 Rubric v2, 같은 프레임 수. 설정 = ②재현성 시험과 동일(claude thinking off,
gpt reasoning_effort='none', gemini thinkingConfig.thinkingLevel='low'). B(Astra)는 이번엔
안 함(본부 지시). 실지출 **$14.06**(승인 $14와 일치). DB 쓰기 0건.

원본: `oxxovo-scoring/reports/rescore_latest_A_2026-09-06_2026-09-06_2010.json`
9/5 구모델 원본: `oxxovo-scoring/reports/mock_prelim_2026-09-05_2026-09-05_1834.json`

---

## ⚠️ 먼저 볼 것 — 전체가 9점 정도 아래로 밀렸다

| | 평균 | 중앙값 | 표준편차 | min | max |
|---|---|---|---|---|---|
| 구모델(gpt-4o/opus4.5/gemini2.5) | 73.52 | 74.12 | 3.86 | 61.83 | 79.53 |
| **신모델(sol/opus5/gemini3.8)** | **64.44** | 64.82 | 4.38 | 47.28 | 72.28 |

43편 전체 평균이 **-9.08점** 내려갔다. 이건 "이 편이 나빠졌다"가 아니라 신모델 3사가 전반적으로
더 박하게 채점한다는 뜻 — 그래서 아래 편별 비교는 **원점수 델타가 아니라 "평균 이동분(-9.08)을
뺀 상대 델타"**로 봐야 한다. 원점수만 보면 거의 모든 편이 "4점 넘게 내려갔다"고 나오는데, 그건
노이즈도 모델 개선도 아니라 전체 스케일이 밀린 것이다.

---

## ① A19_sunrise 장소 불연속 — Sol이 잡나? **아니오, 여전히 못 잡는다**

| | 구(gpt-4o) | 신(gpt-5.6-sol) |
|---|---|---|
| GPT weaknesses | "Repetitive theme", "Common visual trope" | "Overextended repetition and a black pause...", "Generic motivational concept and oversized lens flare..." |

**GPT는 두 세대가 지나도 이 결함을 언급하지 않는다** — 템플릿형 문구는 사라졌지만(⑥ 참조),
장소 불연속 자체를 못 본다는 점은 그대로다. 대신 **Gemini가 새로 잡았다**:
- 구(2.5-flash): "Smooth and plausible motion of the sun" (불연속을 오히려 칭찬)
- **신(3.8-flash): "Sudden jump cut between different mountain formations"** ✅

Claude는 양쪽 다 위치 변화를 인지한다(구: "Two distinct mountain locations create
discontinuity" / 신: "Consistent warm colour grade holds the two shots together **despite
the location change**" — 신모델은 이걸 결함이 아니라 색보정이 구해준 것으로 해석해 어조가
약해짐).

**verified 델타**: 72.13→62.18 (-9.95, 상대델타 -0.87 — 전체 평균 이동과 거의 같다). 즉
Gemini가 텍스트로는 결함을 잡았지만 **최종 점수에는 별 차이를 못 만들었다** — 3사 평균에
묻힌다.

## ② Z03 인물 교체를 감점하나 — **부분적으로, 그리고 이번엔 GPT가 먼저 알아챘다**

| | 구 subjectConsistency | 신 subjectConsistency |
|---|---|---|
| Claude | 76 | 84 |
| **GPT** | 90 ("Each subject maintains consistent appearance") | **68** ("the first woman's facial structure, eye shape, smile, and hair arrangement subtly chang[e]") |
| Gemini | 90 ("intentional" 명시, 감점 안 함) | 67 (텍스트는 여전히 "remain stable"이라고 하는데 점수만 내려감) |

**GPT(Sol)가 유일하게 인물이 서서히 변한다는 걸 텍스트로 명시했다** — 구모델의 맹점 하나가
고쳐졌다. Gemini는 점수는 내려갔지만 근거 텍스트가 여전히 "stable"이라 왜 내려갔는지 설명이
안 됨(점수-근거 불일치, 새로운 이상 신호). verified 62.03(구 70.58, 델타 -8.55, 상대델타
+0.53 — 전체 평균 이동과 거의 같아 순위 자체는 거의 안 움직임: 36위→34위).

## ③ 근거 반복률 — **극적으로 개선(GPT 23.9% → 0.3%)**

| 모델 | 구 반복률 | 신 반복률 |
|---|---|---|
| Claude | 1.3% | 0.3% |
| **GPT** | **23.9%** | **0.3%** |
| Gemini | 2.9% | 0.0% |

GPT의 "clean visuals"·"smooth motion" 같은 템플릿 문구 재사용 문제가 사실상 사라졌다 —
**이건 명백히 세대(모델) 문제였고, Sol에서 해결됐다.**

## ④ Z01~Z03 여전히 하위인가 — **그렇다, 그리고 여전히 A18/A15보다는 위**

| | 구 순위 | 신 순위 |
|---|---|---|
| Z01_table | 43/43(꼴찌) | 37/43 |
| Z02_dusk | 39/43 | 40/43 |
| Z03_studio | 36/43 | 34/43 |

셋 다 여전히 하위 1/3. **A18_cities(신 43위, 꼴찌)·A17_vista(42위)·A15_rhythm(41위)가
Z01~Z03 전부보다 낮다** — 9/5에 지적된 "진짜 콘텐츠가 QA 픽스처보다 낮다" 이상 신호가
그대로, 오히려 A18_cities는 상대델타 -8.60으로 **평균 이동보다도 더 나빠져서** 이 이상이
악화됐다.

## ⑤ 점수 분포가 넓어지나 — **표준편차 기준으로는 약간(3.86→4.38, +13%), range 기준으로는 크게(17.7→25.0)**

range 확대는 대부분 A18_cities 한 편(47.28, 이번 최저점)이 끌어내린 것 — 이 편을 빼면
분포 폭 개선은 크지 않다. "변별력이 늘었다"고 보긴 이르다.

## ⑥ 3사 Top 8 겹침 — **거의 그대로, 여전히 안 겹친다**

| | 구 | 신 |
|---|---|---|
| claude∩gpt | 3/8 | 4/8 |
| claude∩gemini | 4/8 | 3/8 |
| gpt∩gemini | 1/8 | 2/8 |
| **3사 공통** | **1/8**(Weightless Duel) | **1/8**(demo_astronaut) |

3사가 "뭐가 최고냐"에 거의 동의 안 하는 근본 문제는 모델을 바꿔도 그대로다.

## ⑦ 안전 거부·503 — **없음. 대신 일시적 네트워크 타임아웃 1건**

- 구: Gemini가 cf_novya를 `PROHIBITED_CONTENT`로 결정적 재현(재시도해도 2회 연속) 거부.
- 신: 그런 콘텐츠 거부는 0건. demo_duel에서 Gemini 호출 1건이 `Request aborted`(네트워크
  타임아웃)로 실패해 Claude+GPT 2사 평균으로 대체 — 성격이 다른 실패(콘텐츠 거부가 아니라
  일시적 연결 문제).

---

## 결론 — "모델 탓이냐 세대 탓이냐"에 대한 답은 하나가 아니다

- **세대 문제였던 것(고쳐짐)**: GPT의 템플릿 문구 반복(23.9%→0.3%), Z03 인물 드리프트를
  텍스트로 언급하기 시작함.
- **모델(회사) 고유 특성으로 보이는 것(안 고쳐짐)**: GPT가 A19 장소 불연속을 두 세대째
  못 잡음 — Gemini는 신세대에서 잡기 시작했다. 즉 "GPT 계열은 이 특정 결함 유형에 원래
  둔감하다"는 가설이 더 설득력 있어졌다.
- **모델을 바꿔도 안 바뀌는 구조적 문제**: 3사 Top8 거의 안 겹침, "진짜 콘텐츠가 QA
  픽스처보다 낮다"는 이상 신호, Z03의 subjectConsistency 축 자체가 인물 교체를 설계대로
  못 잡는 근본 정의 문제.

전체 43편 상세 순위표는 원본 JSON 참조. B(Astra)는 미실행 — 필요하면 다음에.
