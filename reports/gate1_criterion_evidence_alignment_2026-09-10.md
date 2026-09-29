# Criterion Evidence Alignment — 84건 전수 판정 (2026-09-10)

방법론: `gate1_criterion_evidence_rubric_draft_2026-09-10.md` + 본부 수정 4건
반영(①Originality "기억에 남음"을 구체성/독자성 원인으로 한정, ②③ALIGNED/MIXED/
MISALIGNED = "핵심 승자 논리가 어디 있는가" 기준, 단어 1회 등장으로 MIXED
처리 안 함, ④⑤검수 범위, ⑥모델×축 분리 집계). 신규 유료 호출 없음, 비용 $0.
원자료: Pilot 1의 `gate1_axis_separation_pilot_2026-09-10.json` 84건 그대로 사용.

## 결과 요약 — 예상보다 훨씬 깨끗하다

**MISALIGNED = 0/84. MIXED = 3/84(3.6%). ALIGNED = 81/84(96.4%).**

## 모델 × 축 (합치지 않음, 본부 지시대로 분리)

| 모델 | Originality | Creative Direction | Execution |
|---|---|---|---|
| Claude Opus 5 | 7/7 ALIGNED | 6/7 ALIGNED, 1 MIXED | 6/7 ALIGNED, 1 MIXED |
| GPT-6 Astra | 7/7 ALIGNED | 7/7 ALIGNED | 7/7 ALIGNED |
| Gemini 3.8 Flash | 7/7 ALIGNED | 7/7 ALIGNED | 6/7 ALIGNED, 1 MIXED |
| Grok 4.6 | 7/7 ALIGNED | 7/7 ALIGNED | 7/7 ALIGNED |

**축별 합계**: Originality 28/28(100%) ALIGNED · Creative Direction 27/28(96.4%)
ALIGNED · Execution 26/28(92.9%) ALIGNED.

**핵심 답**: Originality가 실제로 독립된 판단 언어를 만들어냈는가 — **그렇다,
28/28 전부 "제네릭/스톡/클리셰 vs 구체적/독자적/비상투적" 어휘로 판단했고,
한 건도 "완성도가 높아서/역동적이라서"로 새지 않았다.** 화려함·완성도를
독창성으로 흡수하는 사례(본부 우려 ①)는 이번 84건 중 0건.

## MISALIGNED 전건 — 0건 (해당 없음)

## MIXED 전건(3/84) — 원문 보존

### 1. (S-O1, gemini, Execution) — winner=B
> "Clip 2 demonstrates higher technical complexity with controlled visual
> transitions, sharp rendering of materials, and consistent studio lighting
> across character transformations, whereas Clip 1 is mostly a static object
> with minimal motion and a basic camera reposition."

판단: "controlled visual transitions/sharp rendering/consistent lighting"는
Execution에 맞으나, "mostly a static object with minimal motion"은 기술적
결함이 아니라 연출/전개 빈약함(CD)에 가까운 논거다. 승자 결정에 두 요소가
비슷한 비중으로 작용 — MIXED.

### 2. (S-O2, claude, Execution) — winner=A
> "...Clip 1 is stylistically striking but is essentially three disconnected
> AI segments (aerial cityscape, hyperspeed tunnel, neon angel) with no
> consistent scene logic; the flythrough frames show heavy smearing, warped
> building geometry and inconsistent neon streak trajectories, and the winged
> figure's anatomy and wing structure shift noticeably between frames. Net:
> Clip 2 is technically cleaner and more controlled."

판단: "smearing/warped geometry/anatomy shift"는 명백한 Execution 결함이라
그 자체로 승자논리 성립. 다만 "no consistent scene logic"(구조/CD 개념)가
독립적 부가논거로 같이 제시됨 — 핵심은 아니지만 무시할 크기도 아니라 MIXED로
분류. 3건 중 가장 경계선에 가깝다(재검수에서 ALIGNED로 뒤집힐 수 있음).

### 3. (S-O4, claude, Creative Direction) — winner=B
> "...the droplet macro beats (frames 6-7) read as generic stock-style
> interstitials rather than a rising moment, and the model shots in the final
> row repeat similar expressions without clear escalation toward the close."

판단: "rising moment/escalation towards close"는 CD 개념이 맞으나, "generic
stock-style"이라는 Originality 어휘가 그 논거 안에 섞여 있다. 핵심 결론
("escalation 없음")은 CD이지만 근거 서술에 genericness 개념이 실질적으로
동원됨 — MIXED.

## 검수 범위(본부 지시 ④) — 다음 단계로 별도 발주

- MISALIGNED 전건: 0건(발주 대상 없음)
- MIXED 전건: 위 3건 전체
- ALIGNED 무작위 10건: (23,astra,Orig)·(S-O2,astra,CD)·(S-O3,gemini,Exec)·
  (S-O4,gemini,CD)·(S-O5,claude,CD)·(S-O6,grok,Orig)·(S-O1,claude,Exec)·
  (S-O2,grok,Exec)·(S-O6,astra,Exec)·(S-O4,astra,Orig)

## 독립 검수 결과 — 13건 중 12건 일치, 1건 정정

완전히 사전정보 없는 검수자에게 같은 원문+같은 기준을 주고 재확인시켰다.

- 10건 무작위 ALIGNED 표본: **10/10 일치**(전부 ALIGNED 재확인, 놓친 오염 없음).
- MIXED 3건 중 2건 확정: **(S-O2,claude,Exec)·(S-O4,claude,CD) → MIXED로
  재확인.**
- MIXED 3건 중 1건 **정정**: **(S-O1,gemini,Exec)는 사실 ALIGNED다** — 독립
  검수 사유: "rendering quality, transition control, lighting consistency가
  핵심 논거이고, 'static object with minimal motion'은 그 안에서 부차적".
  본부가 미리 경고한 "지나치게 엄격한 텍스트 검사" 함정에 정확히 걸렸던
  사례 — 재확인 절차가 실제로 필요했다는 증거.

## 최종 확정 수치(정정 반영)

**MISALIGNED = 0/84. MIXED = 2/84(2.4%, S-O2·S-O4의 claude 건만). ALIGNED =
82/84(97.6%).** Originality축 28/28(100%) ALIGNED는 변동 없음.
