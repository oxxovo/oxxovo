# Rubric v2 — "정적 이미지" 게이트 설계 (Creative Direction) — 2026-09-06

★설계만. `_new_rubric_prompt_2026-09-02.ts` 미수정, 배포 안 함.

## 배경

TK가 Z01_table(스파게티 사진 한 장을 위에서 훑는 영상)을 직접 확인 — 이미지 품질은 광고
사진 수준, 22위(구모델 기준)가 "틀린 점수"는 아니다. 그런데 대회 맥락에서는 다르다:
참가자가 내야 하는 건 "영상"인데, 사진 한 장을 카메라만 훑으면 그건 영상이 아니다. 지금
Rubric v2 Creative Direction 축에 이 기준이 없다.

## 삽입 위치

`buildQualityPrompt()`의 Creative Direction 밴드(90-100~0-29) **바로 다음, FULL_RANGE 앞**.
Execution 축의 "Deliberate roughness is a style choice..." 문단과 같은 자리 — 밴드로 점수를
매긴 다음 예외/경계 조건을 설명하는 기존 구조를 그대로 따른다.

## 삽입 문안 (초안 — TK 원안 + 경계 조항 추가)

```
A video must develop over time. If the work shows essentially a single
static image or a single held moment with no meaningful change in subject,
action, composition, or perspective, treat it as an incomplete use of the
medium and score Creative Direction in the lower bands regardless of image
quality.

High visual polish does not compensate for the absence of temporal
development.

Deliberate minimalism or a slow, held shot is not the same fault. The test
is not speed — it is whether the frame is actually still developing. A
slow shot where something in the scene keeps changing (steam curling,
light shifting, a gesture completing, a texture settling) is not static,
even if nothing moves quickly. A shot is static when the scene itself is
frozen and only the virtual camera moves across it — the same still image
or held instant repeated frame after frame, with nothing in the subject,
action, or environment progressing. Judge by what is actually changing in
the frame, not by tempo.
```

TK 원안의 두 문단은 그대로 두고, 세 번째 문단(경계 조항)만 제가 추가했습니다.

## ⚠️ 경계(느림 vs 정적) — 제 의견

기준은 "속도"가 아니라 **"프레임 평면(scene) 자체가 진행 중인가"**로 잡아야 합니다.

- **정적(감점)**: 카메라만 움직이고, 장면 자체는 1번 프레임과 10번 프레임이 바뀌어도
  못 알아챌 정도로 그대로다 — Z01이 정확히 이 경우(사진 한 장 + 팬/줌).
- **느림(감점 아님)**: 카메라가 거의 안 움직여도, 장면 안에서 뭔가는 계속 진행된다 —
  스팀이 피어오르다 흩어짐, 빛이 서서히 바뀜, 손동작이 끝까지 완성됨, 액체가 퍼짐. 이번
  43편 재채점에서 실제로 A05_plating(스팀·집게 손 묘사)·A08_dessert(쿨리 소스가 퍼지는
  묘사)가 이 경우입니다 — 컷은 적고 느리지만 장면이 계속 변합니다.

실용적 테스트 문장으로 넣은 게 "Judge by what is actually changing in the frame, not by
tempo"입니다 — 모델이 "느리다"를 보고 감점하지 않고, "이 프레임에서 실제로 변하는 게
있는가"를 보게 유도합니다.

## ⚠️ 고문 경고 — 검증은 Z01로 하면 안 된다

Z01은 이 문장을 **쓰게 만든 바로 그 사례**입니다. 문장을 넣고 Z01 점수가 내려간 걸 보고
"고쳐졌다"고 판단하면, 우리가 정답을 미리 알려주고 그 정답을 맞히는지 시험하는 꼴입니다
(고문 경고 그대로).

**43편 풀 전체를 확인했지만, Z01과 같은 유형(사진 한 장 + 카메라 팬/줌, 장면 자체는
안 바뀜)의 클립이 하나도 없습니다** — A/CF/WD 전부 실제로 장면이 진행되는 AI 생성 영상이라,
지금 갖고 있는 43편 중에는 이 문장을 독립적으로 검증할 held-out 후보가 없습니다.

**제안**: Z01과 다른 소재로(예: 다른 음식/제품/풍경 사진 한 장을 훑는 새 클립 1편) 이번
설계 논의에 안 쓰인 새 정적 픽스처를 하나 만들어서, 그걸로만 검증하는 걸 권합니다 — 만드는
사람이 이 rubric 초안을 못 본 상태여야 진짜 held-out입니다. 지금은 설계만 하는 단계라 이
새 픽스처도 아직 만들지 않았습니다 — 승인 시 별도로 준비하겠습니다.

---

## 검증 설계 보완 (본부 지시 2026-09-06) — 두 방향 + 전체 재확인

한쪽만 보면 반쪽이다: "정적을 감점하는가"만 확인하고 "느린 걸 잘못 감점하는가"를 못 본다.
검증은 세 갈래로 한다.

### ① 새 정적 픽스처 → 내려가야 정상

아직 안 만듦(설계만 단계). 아래 사양대로 준비.

### ② A05_plating · A08_dessert → 안 내려가야 정상 (기준선 고정)

이번 43편 재채점(조합 A, `rescore_latest_A_2026-09-06_2026-09-06_2010.json`)에서 나온 값을
기준선으로 고정한다 — 새 rubric 문장 적용 후 이 값과 비교.

| | verified | consensus CD | claude/gpt/gemini CD |
|---|---|---|---|
| **A05_plating** | 66.32 | 68.33 | 71 / 76 / 58 |
| **A08_dessert** | 62.67 | 65.67 | 63 / 76 / 58 |

둘 다 ±4점(재현성 시험에서 잰 노이즈 바닥) 안이면 무해, 넘으면 "문장이 너무 넓게 잡혔다"는
뜻 — 되돌리거나 다시 손봐야 한다.

### ③ 43편 전체 재확인 — 그룹 단위 쏠림 확인

같은 43편을 새 rubric 문장으로 다시 돌려 ①②와 별개로 **모든 편**의 delta를 본다. 개별
±4점 이내는 무해, 특정 그룹(A/CF/WD 등)이 통째로 내려가면 문장이 의도 밖의 것까지 걸고
있다는 뜻이므로 문제.

### 새 픽스처 사양 (만드는 사람에게 이것만 준다 — 이유는 말하지 않는다)

> 사진 한 장을 카메라로 훑는 16초 영상. 소재는 인물·풍경·제품 중 아무거나 좋으나 **음식은
> 안 됨**(Z01과 겹침). 별다른 지시 없음.

### 비용 추산

- 새 픽스처 생성: 기존 R2 정적 클립(Z01~03)과 같은 방식이면 AI 생성 호출 없이 사진+
  ffmpeg 팬/줌만으로 만들 수 있어 **약 $0**. (스튜디오 i2v로 만든다면 클립 1개분 렌더비만
  추가, 별건)
- 채점: 43편(기존) + 새 픽스처 1편 = 44편 × 조합 A(Opus5+Sol+Gemini3.8), 실측 콜당 단가
  그대로(claude $0.193 + gpt $0.123 + gemini $0.011 ≈ $0.327/편) → **44 × $0.327 ≈ $14.4**
  (지난 43편 재채점 $14.06 대비 +$0.3, 오차범위 안)

승인 시 새 픽스처부터 준비하겠습니다.

---

## 재설계 (본부 지시 2026-09-06) — 고문 확정 + Holdout 12편

### ① 문안 교체 — ⚠️고문 원문 미수령

TK 초안("incomplete use of the medium" 포함)은 폐기 — 느린 영화적 장면·롱테이크·미니멀리즘을
잘못 때린다는 지적. **고문 확정 문안이 아직 채팅에 없어 그대로 옮기지 못했다** — 원문 받는
대로 이 자리에 verbatim으로 넣는다. 제 경계 조항("Judge by what is actually changing in the
frame, not by tempo" 문단)은 같은 방향이라 유지.

### ② Temporal Development — 별도 점수 아닌 evidence 필드

Creative Direction(30%) 스키마 안에 `score` 앞에 필드 추가(evidence-first 순서 유지):

```
"creativeDirection": {
  "centralIdea": "...",
  "temporalDevelopment": "<Does the work meaningfully develop through time, or is it
    essentially a still image presented with incidental camera motion? Cite specific
    evidence.>",
  "whatSupportsIt": "...",
  "whatWeakensIt": "...",
  "score": <0-100>
}
```

가중치는 그대로 30% 안에 있고, 새 배점 항목이 아니다 — 판단을 먼저 적게 해서 나중에
역추적 가능하게 하는 것이 목적.

### ③ Holdout 12편 — AI에게 그룹 안 알려줌, ordering만 본다

| 그룹 | 수 | 출처 | 편 |
|---|---|---|---|
| ①정지형 | 4 | **신규 제작** | 아래 사양 |
| ②느리지만 유효 | 4 | **기존 재사용** | A05_plating, A08_dessert, demo_artisan(포터), demo_astronaut(궤도의 하루) |
| ③명확한 동적 | 2 | **기존 재사용** | A09_race, A10_drift |
| ④경계 | 2 | **신규 제작** | 아래 사양 |

②·③ 근거(이번 43편 재채점 raw text 확인, 추측 아님):
- **demo_artisan**: "unhurried observational study... continuous motion", 손이 그릇을 빚으며
  실제로 형태가 바뀜(clay wall thins and rises) — 느리지만 장면이 계속 진행되는 교과서적 사례
- **demo_astronaut**: 3개 숏에 걸친 기립 동작·그림자 추적 등 실제 진행이 있음(다만 5-6번
  프레임 손동작이 2초간 거의 고정 — ②안에서도 내부적으로 살짝 경계에 가까운 지점 존재, 참고만)
- **A09_race/A10_drift**: 스트릭 블러·타이어 회전 블러·드리프트 자세 등 명백한 고속 동작 —
  ③에 정확히 부합

후보였지만 제외한 것: A17_vista(드론이 지형 위를 날지만 지형 자체는 안 바뀜 — 사실 ④경계에
더 가까운 애매한 사례. 필요하면 경계 2편 중 하나로 기존 걸 다시 쓸 수도 있음, 지금은 새로
만드는 안으로 유지), demo_anne(다리는 거의 안 움직이고 카메라 돌리만 — 이것도 ④경계 후보로
쓸 수 있어 신규 제작 대신 재사용하면 비용을 더 줄일 수 있음 — 원하시면 이걸로 교체).

**성공 조건(둘 다 필요, ②가 더 중요)**:
- Sensitivity: ①정지형 4편이 순위/CD점수에서 확실히 낮게 나오는가
- **Specificity(더 중요)**: ②느리지만 유효 4편이 같이 무너지지 않는가 — 넷 다 한꺼번에
  내려가면 문장이 너무 강한 것, 즉시 되돌린다

### 새 신규 제작분 최소 사양 (이유 설명 없이 그대로 전달)

- **정지형 4편**: "사진 한 장을 카메라로 훑는 16초 영상." 소재 4개는 서로 다르게, 음식류
  제외(Z01과 겹침) — 예: 인물 초상, 풍경, 제품, 건축/공간 각 1편.
  ffmpeg 팬/줌만으로 제작 가능(AI 생성 불필요), 실질 비용 거의 0.
- **경계 2편**: "카메라는 거의 고정하고 피사체가 아주 천천히, 미세하게 변하는 16초 영상 —
  단, 초 단위로 실제 변화가 있어야 한다(빛이 바뀌거나, 아주 느린 동작 등)." 이건 진짜
  모호하게 만들어야 값이 있어서, ffmpeg 합성보다는 실제 AI 생성(Studio/Kling i2v 등)이
  필요할 가능성이 높음 — 렌더 단가 별도 확인 필요(추측 값 안 씀).

### ⑤ 43편 전체 재채점(새 rubric 문장 적용) — 그룹 쏠림 확인

지난 combo-A 결과(`rescore_latest_A_2026-09-06_2026-09-06_2010.json`)를 기준선으로, 같은
43편을 새 rubric으로 다시 돌려 편별 delta를 본다. ±4점(재현성 시험 노이즈 바닥) 이내면
무해, 특정 그룹(A/CF/WD 등) 전체가 쏠리면 문제. (지난 지시의 "44편"은 이번엔 새 픽스처
1편이 아니라 별도 holdout 12편 체계로 바뀌었으므로 **43편 그대로**로 이해하고 진행 — 다르게
의도하신 것이면 알려주세요.)

### 비용 재추산

- **신규 제작(6편)**: 정지형 4편 ≈ $0(사진+ffmpeg). 경계 2편은 실제 AI 생성이 필요할 가능성이
  높아 Studio 렌더 단가 확인 후 별도 보고(추측 안 함).
- **채점**: 43편(⑤ 전체 재확인) + 신규 6편(홀드아웃 중 새로 만든 것만 — 재사용 6편은 ⑤의
  43편 재채점 결과에서 그대로 뽑아 쓰므로 중복 채점 없음) = **49편 × 조합 A** ≈
  49 × $0.327 ≈ **$16.0**
- 지난 승인($14) 대비 +$2.0 수준(신규 6편분).
