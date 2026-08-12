# Gemini face/identity repeat-test — VERDICT: FAIL (2026-07-15)

Follow-up to `scoring_track_handoff_2026-07-14.md` "TOMORROW". Question: can Gemini
serve as the **sole** identity-detection safeguard? Pass criteria (TK): case1 (subtle
drift) caught 3/3 AND case2 (consistent) correctly accepted 3/3. Any miss = FAIL.

**Answer: Gemini FAILS — case1 0/3 (needed 3/3).**
**Unexpected: Claude ALSO 0/3 on case1** — the handoff's "Claude = identity
specialist" did NOT reproduce. See CONFOUND below before acting on this.

---

## Method (what was actually run)

- **Clips reused, $0 generation** (per TK):
  - case1 subtle drift: `…/cf/v3/cf_06_noira_premium.mp4` (NOIRA, B&W, 27.0s, 14 frames)
  - case2 consistent: `…/seedance/seedance_t2v_720p_15s_lumea15c_s1.mp4` (LUMIA, 15.0s, 8 frames)
- **"3종" read as 3 repeat runs of the same clip**, per the handoff's "Repeat ① and ②
  three times each". The handoff names exactly one clip per case.
- Production scorer used **unmodified** (`oxxovo-scoring/src/scorer.ts`, same
  SCORING_PROMPT, `claude-opus-4-5` / `gemini-2.5-flash`).
- **Frames extracted ONCE per case and reused across all 6 runs** — so the only
  variable is model nondeterminism, not frame sampling.
- 12 runs total (2 cases x 3 repeats x 2 models). Cost **$1.70**.
- Harness: `oxxovo-scoring/temp/_face_repeat.ts` (temp, delete after use).
  Raw: `temp/faceconsist/run.log` + `results.json`.

### ★ CONFOUND — read this before trusting the Claude row

The original run's creator statements are **not recoverable**. The seed script maps
`cf_06_noira_premium` to app `72f5386a`, but that app's stored statement belongs to a
different clip (`demo_artisan.mp4`, a potter) — so it was not what the 7/14 run used.

I therefore **authored one statement and used it identically for both cases and all
12 runs** (verified accurate against the frames of both clips first):

> "A beauty commercial built around a single model. The same woman carries every shot
> she appears in — I wanted her face and styling to stay locked as the framing, angle
> and lighting change, intercut with product shots of the jar and of the cream itself."

This statement **asserts** consistency. That is a leading assertion, and both models
visibly anchored on it ("fulfilling the 'same woman' intent"). This is the most likely
explanation for Claude's reversal vs 7/14 (exec 55 "different AI-generated faces" →
68 "consistent model identity", 3/3). **So: the Gemini FAIL is solid (it failed under
a statement that, if anything, is the easy direction — nothing stopped it from
flagging). But this run does NOT clear Claude, and it does not reproduce the handoff's
Claude result. Treat the Claude row as "not established", not as "Claude is also blind".**

Second caveat: **the two cases are not matched in difficulty.** case1 is multi-shot
portraiture; case2 is mostly one continuous macro shot of a cheek, where "same person"
is near-trivial. case2's 3/3 accept is therefore weak evidence of anything.

---

## VERDICT TABLE

| | case1 (drift — must CATCH) | case2 (consistent — must ACCEPT) | Result |
|---|---|---|---|
| **Gemini** | **0/3** (1 borderline, 2 clear miss) | 3/3 ✅ | **실격 / FAIL** |
| **Claude** | **0/3** | 3/3 ✅ | fail (but see CONFOUND) |

**Gemini is NOT safe as a sole identity safeguard.** This is now the second
independent run to reach that conclusion (7/14 multi-case + today's repeat).

---

## Case 1 — subtle drift (NOIRA). Must flag identity. VERBATIM

### Gemini run 1 — exec=88 · **BORDERLINE → counted as MISS**
> summary: This video successfully fulfills its creator's intent to produce a monochrome beauty commercial, **featuring a consistent model** and intercut product shots. The execution is highly polished with excellent visual quality and coherent narrative flow. While there are subtle inconsistencies in the model's appearance between distinct shots, the video is a strong example of AI's capability in commercial production.
> weaknesses: ["Minor inconsistencies in the 'single model's' details, such as earrings and **subtle facial feature shifts**, between different shots."]

*Adjudication*: it does say "subtle facial feature shifts" — the only run that touches
the face at all. But it affirms "a consistent model" in the summary and files it under
*minor styling detail* alongside earrings. Under TK's criterion ("다른 얼굴 / 정체성
표류로 지적"), this is not a drift call. **TK may re-adjudicate this one** — even if
counted as a catch, 1/3 still fails 3/3.

### Gemini run 2 — exec=68 · **MISS**
> summary: This beauty commercial effectively captures its stated intent, **showcasing a consistent model identity** alongside sleek product shots. While the overall visual quality is high, minor inconsistencies in the model's accessories and some product text artifacts slightly hinder technical execution.
> strengths: [… "**Remarkable consistency of the primary model's face across various angles, fulfilling the 'same woman' intent.**"]
> weaknesses: ["Inconsistent details in model styling, such as earrings and eyelash density, detract from the 'styling to stay locked' intent." …]

*Adjudication*: reverse error. Face consistency listed as a **strength**.

### Gemini run 3 — exec=92 · **MISS**
> summary: This submission delivers a high-quality beauty commercial with a strong monochrome aesthetic, **featuring a consistent model** and product shots.
> strengths: [… "**Largely consistent appearance of the model across various shots, fulfilling the creative intent.**"]
> weaknesses: ["A minor inconsistency in the model's **earrings** between different sequences slightly detracts from the 'styling locked' intent." …]

*Adjudication*: identity affirmed; only earrings flagged. Same failure mode the
handoff recorded ("minor inconsistencies (earrings)… the same model").

### Claude run 1 — exec=68 · **MISS (identity)**
> summary: This submission delivers on its stated intent of **maintaining model consistency** across varied shots intercut with product imagery. … execution suffers from visible transition artifacts, particularly during the face-touching sequence where morphing creates ghosting effects.
> strengths: ["**Strong visual consistency with the model's appearance maintained** across multiple shots with varying angles and lighting" …]
> weaknesses: ["Significant morphing artifacts visible in transition frames (particularly frames 11-12 showing face doubling/ghosting)" …]

### Claude run 2 — exec=68 · **MISS (identity)**
> summary: … successfully **maintains a consistent model identity** and monochromatic luxury aesthetic across multiple shots. … one frame shows severe facial doubling …
> strengths: [… "**Model identity remains reasonably consistent** across multiple angles and framings as intended" …]

### Claude run 3 — exec=68 · **MISS (identity)**
> summary: This luxury beauty commercial successfully **maintains a consistent model identity** across multiple shots … compromised by notable AI artifacts, particularly a disturbing face-merge glitch in frame 12 …
> strengths: ["**Strong visual consistency in the model's appearance** across multiple shots with varying angles and lighting" …]

**Note**: Claude caught the frame-12 face-doubling artifact 3/3 (a *rendering* defect)
while calling identity consistent 3/3. It sees the pixels; it read the identity
question as answered by the statement.

---

## Case 2 — genuinely consistent (LUMIA). Must accept. VERBATIM

### Gemini run 1 — exec=95 ✅ · run 2 — exec=98 ✅ · run 3 — exec=98 ✅
> r1 strengths: [… "**Excellent continuity and absence of common AI artifacts** in the provided frames."]
> r2 strengths: [… "High technical stability with **consistent scene elements, character appearance**, and product branding." …]
> r3 strengths: [… "**Flawless continuity and consistency in product, model's appearance**, and interactions across all shots." …]

### Claude run 1 — exec=72 ✅ · run 2 — exec=72 ✅ · run 3 — exec=72 ✅
> r1: "competent beauty commercial with **consistent model styling** and clear product focus as stated in the intent"
> r2 strengths: ["**Strong visual consistency** between product shots and model shots …"]
> r3: "a beauty commercial with **consistent model identity across varied shots**"

**No false-flags, 6/6.** Consistent with the handoff: reverse-error risk is low.

---

## Two further findings (not asked for, but they bear on prize-money scoring)

### 1. Gemini's Execution score is unstable; Claude's is not
Identical frames, identical statement, 3 runs:

| | case1 exec | spread | case2 exec | spread |
|---|---|---|---|---|
| **Gemini** | 88 / 68 / **92** | **24 pts** | 95 / 98 / 98 | 3 pts |
| **Claude** | 68 / 68 / 68 | **0 pts** | 72 / 72 / 72 | 0 pts |

A 24-point Execution swing on the same file is worth ~10.8 pts of verified_score
(exec weight 45%) — larger than the gap the handoff measured between a face-swap and a
clean film. For a $3,000 prize ladder this is its own defect, independent of identity.

### 2. DEFECT 1 (Integrity punishes realism) reproduced 6/6, and it is getting worse
case2 — the Seedance photorealism breakthrough — was integrity-penalized in **every**
run by **both** models:

| | run1 | run2 | run3 |
|---|---|---|---|
| Gemini integ | **10** | **15** | **10** |
| Claude integ | **35** | 40 | 40 |

> Gemini r3 verbatim: *"The video exhibits numerous visual characteristics (hyper-realistic hand interactions, natural shadows, precise depth of field) that **strongly indicate it may be real footage**, rather than AI-generated, which impacts integrity for the competition."*
> Claude r1 verbatim: *"Physical hand interactions with cream and skin show **suspiciously realistic detail** including skin pores, natural skin deformation, and proper shadow behavior"*

Meanwhile the same clip scored exec 95–98 (Gemini). **The models can see it is the
better film and penalize it for exactly that.** Gemini's integrity numbers (10–15) are
far harsher than Claude's (35–40) — so the current `claude-only` integrity policy is
accidentally the *lenient* one. Any move toward Gemini on integrity would make
Defect 1 substantially worse.

---

## Handed to TK — no policy decision made here (per instruction)

- **Gemini as sole identity safeguard: 실격.** 0/3 on the case it had to catch.
- **Claude not cleared either** — and the statement confound means today's run cannot
  settle it. If TK wants the Claude question answered, the clean re-test is: same 2
  clips, **neutral statement that does not assert consistency** (e.g. "A monochrome
  beauty commercial for NOIRA."), 3x each, ~$1.70. That isolates whether Claude's 7/14
  catch was real skill or an artifact of statement wording.
- The wording dependence is itself a finding: if a creator's own statement can talk the
  judge out of noticing a face change, the identity signal is not prize-safe regardless
  of which model is used. This supports the handoff's "add an explicit verify-identity
  instruction" direction over any model-swap.
