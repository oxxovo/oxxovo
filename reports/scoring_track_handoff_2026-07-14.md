# Scoring-track handoff — Integrity inversion + Face-consistency (2026-07-14)

Empirical data for 지수(본체) + 특허 track. Two scoring defects found during the
season_test main-round E2E, both the same disease: **the better-made work is not
rewarded.** All numbers are real Triple-AI runs (verbatim), not estimates.

Scoring model: 4 axes — Intent 25% / Execution 45% / Originality 20% / Integrity
10%. Integrity is **Claude-only** (`integrityPolicy: claude-only`); the other 3
axes are consensus of Claude+GPT+Gemini. ~8–14 frames sampled at fixed intervals
(`max(2s, dur/20)`), **no shot-boundary detection**.

---

## DEFECT 1 — Integrity axis penalizes realism (photorealism → low integrity)

Main-round ranking put the Seedance breakthrough (hand+cream physics) at #7 and a
face-drifting Kling at #1. Per-model:

| | verified | Claude int/exec/orig/**integ** | GPT | Gemini | Integrity(Claude) |
|---|---|---|---|---|---|
| **Seedance "Her Gaze"** (better) | 72.48 | 85/78/45/**35** | 80/75/60 | 95/**98**/40 | **35** review |
| **Kling "Zero-G" #1** (worse) | 81.12 | 72/65/45/**85** | 85/90/75 | 95/98/85 | **85** accept |

Claude integrity explanations (verbatim):
- **Seedance (integrity 35, "review")**: *"피부 모공, 점, 손가락 관절 주름 등이 매우
  사실적이고, 크림을 만질 때 물리적 변형이 자연스러워서 실제 촬영 영상일 가능성이 높아 보입니다."*
  (Too realistic → suspected real footage → penalized.)
- **Kling (integrity 85, "accept")**: *"피부 질감이 과도하게 매끄럽고, 프레임 12에서 얼굴 왜곡
  현상이 나타나며, 모델의 얼굴이 장면마다 미묘하게 달라지는 등 AI 생성 영상의 전형적인 특징들이
  확인됩니다."* (Obvious AI artifacts → clearly AI → passed.)

**Root pathology**: the Integrity prompt asks "does this appear AI-generated?" and
treats realism (depth of field, real shadows, physical hand interactions) as
STRONG signals it is NOT AI. So the more photorealistic the AI film, the lower its
integrity. Note Gemini gave the Seedance **exec=98** — the models DO see the
quality; Integrity (35) + low Originality (beauty-CF template, ~48) sink it.

**Proposed direction (TK/변리사)**: retire on-screen "AI vs real" judgment →
CryptoBind generation proof (our platform proves it was generated, so no visual
suspicion needed). Integrity should judge only plagiarism / external-URL / rule
violation. Realism is the GOAL, not a defect.

---

## DEFECT 2 — Face/character consistency: unreliable, diluted by averaging

Four constructed cases, each real-scored. Videos in R2 (test artifacts):
- faceswap (2 different women): `…/seasons/season_e2e/9b5ceed5…/faceswap-consistency-test.mp4`
- partial-swap (2 same +1 diff): `…/seasons/season_e2e/9b5ceed5…/partial-swap-test.mp4`
- subtle-drift: `…/cf/v3/cf_06_noira_premium.mp4` · consistent: `…/seedance/seedance_t2v_720p_15s_lumea15c_s1.mp4`

| case | Claude exec / verdict | GPT | Gemini |
|---|---|---|---|
| **① subtle drift** (same woman, drifts) | 55 ✅ *"facial features inconsistent across frames… different AI-generated faces rather than one consistent character"* | 85 ❌ *"maintains consistency"* | 70 ⚠️ *"minor inconsistencies (earrings)… consistently portraying **the same model**"* (missed identity) |
| **② consistent** (genuinely same) | 68 ✅ no false-flag | 80 ✅ | **98** ✅ *"exceptional consistency"* |
| **③ partial swap** (2 same +1 diff) | 65 ✅ *"face in frames 4-5 different from person in 6-8"* | 90 ❌ *"smooth transitions"* | 70 ⚠️ *"lack of continuity… stylistic"* (not identity) |
| **④ multi-person legit** (2 women intended) | 72 ✅ no false-flag (*"absence of interaction"*) | 50 ✅ | 40 ✅ (*"two distinct women… no interaction"*) |
| (earlier) dramatic 2-different-people | 55 ✅ | 90 ❌ | **20** ✅ (hard) |

**Pattern (needed >1 case to see):**
- **Claude** = most reliable at IDENTITY (caught ①③ + earlier dramatic; no false-flags).
- **Gemini** = catches artifacts/discontinuity + rewards true consistency (98), but
  **misses identity drift** in ① ("same model") and ③ ("stylistic"). Its dramatic-case
  hardness (20) was misleading — it is NOT reliable on the subtle/partial cases.
- **GPT** = blind to identity inconsistency (missed ①③ + dramatic), no false-flags.
- **Consensus averaging DILUTES**: ①drift exec=70, ③swap exec=75, ②consistent exec=82 —
  a face-swap scores only 7–12 pts below a consistent film, because GPT's blindness
  pulls it up.
- **No reverse-error**: ②consistent + ④multi-person → all 3 correctly used the creator
  statement; none false-flagged. (Unlike Defect 1, which ignores the statement.)

**Answers to TK's 3 questions:**
1. "Gemini only" safe? → **NO.** Gemini missed identity drift in the subtle ① and
   partial ③ (the realistic cases). Claude is the identity specialist.
2. Max/any-flag better than averaging? → **YES.** Models are complementary; averaging
   dilutes. A "if any model confidently flags identity inconsistency, apply penalty"
   policy recovers detection. (Data shows no false-positives on ②④ to worry about.)
3. Reverse-error risk? → **LOW** (statement-grounded), unlike Defect 1.

**Proposed direction**: add an explicit "verify the same character/identity persists
across all shots (when the intent implies a recurring subject)" instruction (would
fix GPT's blindness); shot-aware frame sampling; and a max/any-flag consensus for the
identity signal rather than straight averaging. This directly enables the i2v / image
-generation feature (character consistency is its whole purpose).

---

## TOMORROW (before handoff)
- **Repeat ① and ② three times each.** PASS CRITERIA (TK): ① subtle drift = Gemini
  must catch 3/3; ② consistent = Gemini must correctly accept 3/3. Any miss/false-flag
  = FAIL (prize-money scoring must be 0 error). If it passes → hand to 지수(본체) as
  the "Gemini-dedicated" basis; if not → the multi-case data already shows Gemini alone
  is unsafe.
- Cost: ~$0.4/case-run. Generation = $0 (reused clips).
