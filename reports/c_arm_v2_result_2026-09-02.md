# C 아암 v2 결과 (2026-09-02)

같은 6편(round=main), temp 0, Pass1/Pass2 별도 호출. 실지출 $1.59. 원본: `oxxovo-scoring/reports/retest_newrubric_c_v2_2026-09-03_0022.json`.

**★R1/R2/R3 출처 — `seasons.main_round_required_elements`는 null(08-28 스키마만 생성, 값 채운 적 없음).** `season_test.main_round_theme` 본문에 이미 있던 "Requirements — all three must appear" 3줄(사람 등장 / 카메라 정면 응시 / 전신 샷)을 그대로 씀(새 문구 아님, A/B/D도 이미 이 theme으로 돌았음). **0/1/2/2/3/3의 정확한 정답표는 갖고 있지 않아서 — Pass1이 "맞았는지"는 제가 판정 못 함, 아래는 실측치만.**

## Pass 1 (Compliance, 3사 각각 판정)

| 영상 | R1 | R2 | R3 |
|---|---|---|---|
| Walk | AGREE(true) | AGREE(true) | AGREE(true) |
| Morph | AGREE(true) | AGREE(true) | AGREE(true) |
| Runway | AGREE(true) | SPLIT(t/t/f) | SPLIT(f/t/t) |
| Fusion | SPLIT(f/t/t) | SPLIT(f/t/t) | SPLIT(f/t/t) |
| Street | AGREE(true) | AGREE(true) | AGREE(true) |
| Weave | AGREE(false) | AGREE(false) | AGREE(false) |

- Weave = 3사 만장일치 0/3(전부 위반) — 기존 A/B/D에서도 계속 최하위였던 영상과 일치.
- Walk/Morph/Street = 3사 만장일치 3/3.
- Runway/Fusion = 3사가 갈림(SPLIT) — 이 둘이 "이행 단계가 애매한 케이스"일 가능성.
- 0/1/2/2/3/3 라는 정확한 6단 정답과 대조하려면 **어느 영상이 어느 단계인지 원본 매핑**이 필요합니다.

## Pass 2 (Quality, Compliance 모른 채 3축)

| 영상 | claude CD/EX/OR | gpt CD/EX/OR | gemini CD/EX/OR |
|---|---|---|---|
| Walk | 58/59/42 | 82/91/78 | 88/91/78 |
| Morph | 62/61/41 | 82/92/78 | 88/79/77 |
| Runway | 62/66/41 | 78/88/82 | 85/89/78 |
| Fusion | 62/61/38 | 82/93/85 | 78/91/79 |
| Street | 58/63/34 | 85/90/80 | 88/87/79 |
| Weave | 38/67/31 | 45/70/65 | 45/60/62 |

**바뀐 것:** 예전(B/D)처럼 GPT가 5편 내내 "90/85/80"을 그대로 반복하거나 Gemini가 "90/85/70"을 반복하는 **완전 동일 반복은 사라졌다** — 영상마다 숫자가 조금씩 다르다. Weave는 3사 전부 확실히 분리(다른 5편 대비 뚜렷하게 낮음).

**여전히 그대로인 것:** Weave를 뺀 나머지 5편끼리는 GPT/Gemini 둘 다 **좁게 뭉쳐 있다** — 특히 Originality가 GPT 78~85, Gemini 77~79로 사실상 평평함. "0/1/2/2/3/3" 같은 뚜렷한 계단은 5편 사이에서 안 보인다, Weave vs 나머지 5편의 2단 구분만 뚜렷함. Claude는 상대적으로 더 낮고 넓게 퍼져 있음(Originality 34~42) — 모델 간 교정(calibration) 차이가 축별 변별력 차이보다 커 보임.

**오염 점검(TK 지적 — Pass2가 Pass1 계단을 그대로 따라가면 의심):** Weave가 Pass1(0/3)·Pass2(최하위) 둘 다에서 꼴찌인 건 사실이나, Weave는 A/B/D 전부에서 이미 최하위였던 영상(단일 프롬프트 시절부터)이라 이번 분리 설계 때문에 생긴 상관관계로 보이지 않음 — 원래 나쁜 영상이라 양쪽에서 다 나쁘게 나온 것으로 판단.

## 요약

- Pass1: 3사 완전 만장일치 4편(Walk/Morph/Street=true, Weave=false), 갈리는 2편(Runway/Fusion) — 정답표 없이는 "정확도"를 못 매김.
- Pass2: Weave 분리는 뚜렷해짐, 나머지 5편 간 변별은 **개선됐지만(완전반복 사라짐) 여전히 좁음**(특히 Originality).
- v1→v2 프롬프트 개선(evidence-first, full-range 문구, Execution 5분할)이 완전반복을 깬 것은 확인되나, "이행 계단이 뚜렷이 보인다"고 하기엔 아직 부족.
