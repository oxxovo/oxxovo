# ② 얼굴/인물 일관성 채점 — 스코핑 (2026-08-05, 지수 본체)

본부 지시: "②가 본선 채점 가능 여부를 결정한다. 추산을 만들어라."
전부 **읽기 전용 실측**. DB 쓰기 0건, 코드 변경 0건.

---

## 0. 결론

**채점기는 인물 불일치를 정확히 본다. 그런데 점수에 거의 반영하지 않는다.**

측정된 영향력 = 최종 `verified_score` 기준 **약 1.0점**. 본선 상위권 간격보다 작다.
"채점기가 못 잡는다"가 아니라 **"잡은 것을 값으로 안 바꾼다"**가 실제 문제다.
→ 처방은 모델 교체나 파이프라인 재설계가 아니라 **루브릭/집계 배선**이다.

---

## 1. 근거 A — 채점기는 실제로 본다 (탐지력 있음)

`scoring_results` 51행(season_test: 본선 10 + 예선 41), `ai_outputs` 전문 검사.

Claude가 남긴 실제 문장:

- "The model's face changes noticeably between segments (different facial features,
  earrings appearing/disappearing), breaking continuity"
- "Significant identity inconsistency — the model's face changes noticeably between
  frames (different facial features, hairstyle shifts between afro and updo)"
- "face consistency issues across shots"
- "mid-video character switch" — 두 인물이 섞인 영상
- "Noticeable inconsistencies in hand anatomy and finger count across several frames"
- Gemini: "the woman's earring changing between shots"

정지 프레임 15~20장으로 **인물 동일성 붕괴는 충분히 탐지된다.** 이건 해결된 문제다.

## 2. 근거 B — 그런데 값이 안 붙는다 (집계 결함)

| 모델 | 인물 불일치 지적 | exec(지적있음) | exec(지적없음) | Δ |
|---|---|---|---|---|
| claude | **18/51 (35%)** | 64.5 | 71.2 | **−6.7** |
| gemini | 5/51 (10%) | 63.0 | 80.6 | −17.6 |
| gpt | **1/51 (2%)** | 85.0 | 83.0 | +2.0 |

**희석 산술**: Claude만 −6.7 → consensus는 3모델 평균이라 −2.2 →
Execution 가중 0.45 → **최종 −1.0점**.

본선 10편 직접 확인:

- 인물 불일치 지적 **있음** 8편 → 평균 verified **74.32**
- 지적 **없음** 2편 → 평균 verified **73.78**

지적받은 쪽이 오히려 **+0.54 높다.** (대조군 n=2라 통계적 의미는 없다.
주장할 수 있는 것은 하나뿐 — **감점이 관측되지 않는다.**)
최고점 81.12를 받은 영상의 Claude 평가문에 "face consistency issues across shots"가
그대로 적혀 있다.

## 3. 근거 C — 루브릭에 축이 없다

`src/scorer.ts` 채점 축은 4개: Intent / Execution / Originality / Integrity.
"인물 일관성"이라는 항목은 **없다.** Execution 설명문의
`scene consistency, motion stability, continuity` 한 줄에 우연히 얹힐 뿐이고,
그 줄은 "기술적 안정성"을 뜻하지 "같은 사람인가"를 묻지 않는다.

반면 참가자에게 고지된 `season_0.main_round_theme` 말미:

> Evaluation — Core Skills Assessed:
> **Character Consistency** / **Natural Hand–Face Interaction** /
> Lotion·Serum Texture & Material Realism / Camera Direction & Cinematography /
> Storytelling / Product Presentation / Overall Commercial Quality

**대외 고지 7개 vs 실제 채점 4축.** 그중 어느 것도 인물 일관성을 명시하지 않는다.

★그리고 그 주제문은 `Creator Statement:` 슬롯으로 들어간다
(`batch.ts:430` — 본선 statement = `season.main_round_theme`).
즉 모델은 "Character Consistency"라는 글자를 **참가자의 주장**으로 읽지
**채점 기준**으로 읽지 않는다.

## 4. ★부수 발견 (별건, 심각도 높음) — 가중치가 두 개다

| 출처 | Intent | Execution | Originality | Integrity |
|---|---|---|---|---|
| `seasons` 라이브 행 (season_0·season_test 동일) | 0.20 | **0.25** | **0.35** | 0.20 |
| `scorer.ts:212-215` **하드코딩** | 0.25 | **0.45** | **0.20** | 0.10 |

랜딩(`app/_landing/LandingView.tsx:298,382`)과 `/rules`는 **DB 값**을 렌더링한다.
워커는 **하드코딩 값**으로 계산한다. 워커는 `scoring_*_weight` 컬럼을 **한 번도 읽지 않는다**
(scoring 레포 전체 grep, 0건).

**증명** — 본선 10행 전부, 저장된 `verified_score`를 두 벡터로 역산:

```
id       stored    code(25/45/20/10)  db(20/25/35/20)
e5268489  75.083        75.083            67.883
6da63ab9  72.483        72.483            62.167   ← 최대 괴리 10.3점
d824124b  81.117        81.117            78.800
...  10/10 전부 code 벡터와 소수점까지 일치
```

**지금 www.oxxovo.ai가 참가자에게 알리는 배점과 실제 계산이 다르다.**
weight·30–40초 건과 **같은 계열**이다(고지 ≠ 실제). [[feedback-no-hardcode]] 위반이기도 하다.

②의 추산이 이 건에 걸린다 — 인물 일관성을 Execution에 넣을 때 그 축이
25%인지 45%인지에 따라 영향력이 두 배 차이 난다. **어느 쪽이 진짜인지 본부 판정 필요.**

## 5. 구조적 한계 — 프레임으로 못 보는 것 하나

`extractor.ts:156` 샘플링 = `interval = max(2, duration/20)`.
30초 → 2초 간격 15장 / 40초 → 2초 간격 20장.

- **인물 동일성**(같은 얼굴인가) = 정지 프레임으로 판정 가능 → **문제 없음**
- **손 해부학**(손가락 개수, 관절) = 판정 가능 → 실제로 잡고 있음
- **손–얼굴 상호작용의 "자연스러움"**(도포 동작) = **원리적으로 불가**.
  도포 장면은 보통 3~5초, 2초 간격이면 2~3장뿐이고 동작의 연속성은 프레임 사이에 있다.

즉 고지된 7개 중 **"Natural Hand–Face Interaction"은 현재 파이프라인으로
동작 축을 평가할 수 없다.** 정적 결과(손 모양·크림 잔여)만 본다.
이건 배선으로 안 되고 입력 방식(밀집 샘플링 또는 네이티브 비디오 입력)을 바꿔야 한다.

## 6. 처방 옵션

| 안 | 내용 | 인물 일관성 | 손 동작 | 비용/행 | 위험 |
|---|---|---|---|---|---|
| **A. 루브릭 명시** | criterion 2에 인물 일관성·제품 노출·규정 준수를 하위 항목으로 못박고, 세 모델 모두에게 **보고를 강제**(JSON 필드 추가) | ✅ 해결 | ❌ | +$0 | 낮음 |
| **B. 주제문 슬롯 분리** | `Creator Statement:` → `Competition Brief:` 로 분리해 주제를 **기준**으로 제시 | ✅ 보강 | ❌ | +$0 | 낮음 |
| **C. 밀집 샘플링** | 도포 구간만 0.5초 간격 추가 추출(또는 ffmpeg `scene` 컷 경계 추출) | ✅ | △ 부분 | +$0.1~0.2 | 중 |
| **D. 네이티브 비디오** | Gemini에 영상 자체 입력(Claude·GPT는 이미지 전용이라 3모델 대칭 깨짐) | ✅ | ✅ | 미실측 | 높음 |
| **E. 결정적 사전측정** | 얼굴 임베딩(ArcFace 등) 컷 경계 코사인 거리 → 수치를 증거로 주입 | ✅✅ | ❌ | 추론비 0 | 중(의존성) |

**추천 = A + B 먼저.** 근거:
- 탐지는 이미 되고 있으므로 **모델을 바꿀 이유가 없다** — 못 보는 게 아니라 안 세는 것이다.
- A는 GPT의 2% 실명률을 직접 겨냥한다(보고 강제 → 세 모델이 같은 질문에 답하게 됨).
- 본선은 최대 50편(상위10% clamp)이라 C/E의 비용 논거가 약하다. 필요하면 **본선에만** 적용.
- D는 3모델 대칭·Triple-AI 담합 방지 설계를 흔든다. 발사 전에 손댈 것이 아니다.

**손 동작 축은 별개 판정 사안이다.** A+B로는 안 풀린다.
선택지는 (a) C를 본선에만 적용 (b) 고지 문구에서 동작 축을 빼고 정적 평가로 명시
(c) 시즌0은 현행 유지하고 시즌1 과제로 이월. **비용·고지 문제라 본부 결정.**

## 7. 추산

★일수 견적은 규칙상 내지 않는다([[feedback-no-schedule-estimates]]).
작업 단위와 **완료 판정 기준**으로 낸다.

| # | 작업 | 완료 판정 |
|---|---|---|
| 1 | 가중치 이중 진실 판정 + 한쪽으로 통일 | 워커 계산 == 랜딩 표시. 회귀 테스트 1개 추가 |
| 2 | A: criterion 2 하위 항목 + JSON 보고 필드 | `npm run test:prompt` 확장(현 28/28 유지) |
| 3 | B: statement/brief 슬롯 분리 | 본선 경로에서 `Competition Brief:` 로 렌더됨을 테스트로 고정 |
| 4 | **실측 검증** — season_0 실제 주제문으로 재채점 | 인물 불일치 영상의 감점이 **≥5점**으로 관측(현재 1.0점) |
| 5 | (조건부) 손 동작 처리 | 본부 결정에 따름 |

**비용 추산**: 재채점 1편 Triple-AI = **$0.2788 실측**(9프레임/17.5초 기준).
검증에 본선 10편 재사용 = **약 $2.8**. 시즌0 실길이(15~20프레임) 단가는 **미실측** —
`_probe_40s.ts`가 그 목적으로 작성돼 있으나 **실행 이력이 없다**(reports 0건). 약 $0.8.

**신뢰도**: 1~3 = **높음**(전부 코드 배선, 실측 근거 있음).
4 = **중간** — 프롬프트 변경이 점수를 얼마나 움직이는지는 돌려봐야 안다.
5 = **낮음**(미실측, 본부 결정 선행).

## 8. 아직 실측 안 한 것 (신뢰도 한계)

1. **season_0 실제 주제문이 채점기를 통과한 적이 없다.** 본선 10행은
   `season_test.main_round_theme = "OXXOVO Beauty CF"` — **네 단어**로 채점됐다.
   시즌0 주제문은 약 200단어 + 7개 평가 항목이다. 그 긴 문장이 4축 점수를
   어떻게 움직이는지는 **완전 미지**다. → 작업 4의 첫 실험이 이것이어야 한다.
2. 51행은 **Defect1 수정 전** 산출물이다(Integrity가 사실성을 처벌하던 판).
   본 스코핑의 결론은 Execution 축이라 영향 없지만, 재채점 시 기준선이 바뀐다.
3. 30~40초 실길이의 비용·지연 미실측(위 `_probe_40s.ts`).

---

관련: [[project-scoring-v22]] · [[project-scoring-results-schema]] ·
[[project-jisoo-resume-2026-08-04]] · [[feedback-no-hardcode]]
