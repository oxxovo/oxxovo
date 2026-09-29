# v1.1 진단 채점표 — 정답지(Answer Key) (2026-09-08, 2026-09-09 10칸 갱신)

본부 지시: Z01/Z02/Z03/A19는 결함을 설계 단계에서부터 알고 만든 QA fixture다. 이
넷에서 모델별 **Recall**(정답 결함을 카테고리 중 맞는 자리에 찾았는가)과
**False Positive**(정답에 없는 카테고리에 결함을 지어냈는가)를 재고, 그것이
Visual Observation 점수의 근거다 — 결함 개수로 점수를 주지 않는다.

★2026-09-09 갱신: 8칸 정의 감사로 2칸(otherArtifacts, audiovisualSync)이
추가되어 **10칸**이 됐다(`_new_rubric_prompt_2026-09-09_structured_v1_2.ts`
근거). 아래 4개 fixture 모두 이 두 칸을 타깃하지 않으므로 정답은 CLEAN(=
"NONE OBSERVED" 기대) — False Positive 측정 대상으로는 그대로 유효하다.

## 정답지

| Fixture | 설계된 결함 | 정답 카테고리(있음=예상 finding, 나머지 8~9칸=NONE OBSERVED 기대) |
|---|---|---|
| **Z01_table** | 정지 이미지(사진 한 장 + 카메라 팬, 실제 움직임 없음) | **motion** |
| **Z02_dusk** | 흔들림 · 색온도 불일치 · 거친 전환 | **motion**(흔들림) · **lighting**(색온도 불일치) · **editing**(거친 전환) |
| **Z03_studio** | 인물 교체(중간에 다른 사람으로 바뀜) | **faceIdentity** |
| **A19_sunrise** | 장소 불연속 | **continuity**(주 채점 — 원래 Step3 체크리스트의 "spatial discontinuity"가 여기로 통합됨). **background**도 합리적 대안 카테고리로 인정(장소=배경이라 경계가 모호 — false negative로 안 침) |

## 채점 방법

각 판정관(claude/gpt/gemini/grok/qwen) × 각 fixture:

1. **Recall**: 정답 카테고리에 "NONE OBSERVED"가 아닌 구체적 finding을 적었으면 1,
   아니면 0. (A19는 continuity 또는 background 둘 중 하나면 인정)
2. **False Positive**: 정답에 없는 카테고리(위 표에 안 나온 나머지 8~9개, otherArtifacts/
   audiovisualSync 포함)에 "NONE OBSERVED"가 아닌 finding을 적었으면 그 개수만큼 카운트.
3. **10칸 검사율**(③): 10개 필드 전부가 채워졌는가(누락/공백 없이), "NONE OBSERVED"를
   정확한 문자열로 쓰는가, 아니면 얼버무리거나 빈칸으로 넘기는가.

## 점수 근거로 쓰는 법

Visual Observation(Step1~3 관찰 품질)을 **결함 개수**가 아니라 **이 Recall/FP
표**로 판단한다 — 결함을 많이 적었다고 관찰을 잘한 게 아니라(지어낸 것일 수
있음), 설계된 정답을 정확히 짚고 없는 걸 안 지어냈는지가 기준이다.

## 다음 단계

13편 캐노니컬 실행 후, 이 4개 fixture의 실제 8칸 응답을 이 표에 대입해 판정관별
Recall/FP/8칸 검사율 표를 채운다. 1편(A09_race) 캐노니컬은 이 4개에 안 속해
비용/포맷 확인용이고, 이 표 채점 대상 아님 — 13편 안에 Z01/Z02/Z03/A19가
포함되므로 그때 채점한다.
