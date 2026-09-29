# 3축 독립성 검증 — 24쌍 전수 (2026-09-10, 본부 지시 ③)

Round 1(정순) 데이터 기준, 모델이 자기 판정 근거로 스스로 라벨링한 축
(`parsedAxis`)과 정답지 축(`axis`)을 24쌍 전부 대조.

## 모델별 축 일치율

| 모델 | 일치율 | n |
|---|---|---|
| Qwen3.8 Max | 64.7% | 17/17(에러 7건 제외, 표본 작음) |
| Gemini 3.8 Flash | 45.8% | 11/24 |
| GPT-5.6 Sol | 41.7% | 10/24 |
| Claude Opus 5 | 37.5% | 9/24 |
| GPT-6 Astra | 37.5% | 9/24 |
| Grok 4.6 | 33.3% | 8/24 |

**6모델 다 절반 이하(Qwen 제외, 표본 작아 참고용)** — 승자 판정은 대부분 맞히지만
"왜 맞았는지" 축 인식은 정답지와 자주 어긋난다.

## 축별 재현율(recall) — 정답축이 X일 때 모델이 실제로 X라고 답한 비율

| 모델 | Execution(정답 6쌍) | Creative Direction(정답 11쌍) | Originality(정답 7쌍) |
|---|---|---|---|
| Claude | 2/6 (33%) | 7/11 (64%) | **0/7 (0%)** |
| Sol | 1/6 (17%) | 9/11 (82%) | **0/7 (0%)** |
| Astra | 1/6 (17%) | 7/11 (64%) | 1/7 (14%) |
| Gemini | 3/6 (50%) | 8/11 (73%) | **0/7 (0%)** |
| Grok | 1/6 (17%) | 7/11 (64%) | **0/7 (0%)** |
| Qwen(n작음) | 4/6 (67%) | 5/7 (71%) | 2/4 (50%) |

## 어긋나는 방향

정답=Execution인데 다르게 답한 경우: **거의 전부 "Creative Direction"으로 감**
(Claude 4·Sol 5·Astra 5·Gemini 3·Grok 5 — 전부 CD 쪽, Originality로 새는 경우는
0건).

정답=Creative Direction인데 다르게 답한 경우: 대부분 **"Execution"으로 감**
(Claude 4·Sol 2·Astra 4·Gemini 3·Grok 4), Qwen만 예외적으로 Originality로 2건.

정답=Originality인데 다르게 답한 경우: **Execution 또는 Creative Direction 둘
다로 흩어짐**(예: Gemini는 Originality 5건을 Execution으로, Sol/Astra/Grok는
Originality 6건을 CD로) — **어느 쪽으로 가든 Originality로는 거의 안 온다.**

## 결론 — Originality는 사실상 "감지되지 않는" 축이다

**5/6모델(Qwen 제외)이 정답=Originality인 7쌍 중 0쌍만 스스로 Originality라고
답했다(Astra만 1쌍).** 반대로 "잘못 답했는데 목적지가 Originality"인 경우는
전체 6모델 통틀어 Qwen의 3건(전부 표본 작은 케이스)을 빼면 사실상 없다 —
**Originality는 도착지로도 거의 안 쓰이는, 방향성이 완전히 한쪽으로만 새는
축이다.**

Creative Direction은 정반대로 "기본값 도착지" 역할을 한다 — Execution 정답도
CD로 새고, Originality 정답도 CD로 새는데, CD 정답이 다른 축으로 새는 경우
(CD→Execution)는 있어도 CD가 "새어 들어오는" 경우가 압도적으로 많다.

**해석**: 승자 판정(방향 정확도)은 대체로 맞지만, 모델이 "왜 이게 나은가"를
설명할 때는 **Execution/Originality 구분 없이 뭉뚱그려 "연출 의도가 더
확실하다(=CD)"는 서사로 환원**하는 경향이 강하다. 특히 Originality는 명시적으로
설계된 pair(S-O1~S-O6)에서조차 모델 스스로는 그걸 "독창성 문제"로 인식 안
하고 "연출 의도/서사 진행"으로 재해석한다 — **3축 독립성은 현재 통과 못
한다**(설계 문서 ③ "세 축이 실제로 갈리는가"에 대한 답은 사실상 "아니오,
CD 하나로 수렴한다"에 가깝다).

이건 승자-정답 정확도(①)와는 별개 문제이므로 Gate 1 자체의 합격/불합격과는
분리해서 봐야 하지만, 다음 단계(Gate 1C Criterion Independence)의 출발점이
이미 여기 있다.
