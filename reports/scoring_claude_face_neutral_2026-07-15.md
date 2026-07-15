# Claude face/identity re-test, NEUTRAL statement — VERDICT: 재현 실패 (2026-07-15)

Round 2, follow-up to `scoring_gemini_face_repeat_2026-07-15.md` (round 1, VOID —
its statement asserted "the same woman", both models anchored on it). Gemini is
already disqualified and is not on trial here; it was run alongside as reference
only (gemini-2.5-flash is cents).

**One question (TK): does Claude reproduce its 7/14 case1 catch under a neutral statement?**

**Answer: NO. Claude case1 = 0/3 (needed 3/3). 재현 실패.**
**And it failed under the ACTUAL ORIGINAL statement too — see the correction below.**

| | case1 (drift — must CATCH 3/3) | case2 (consistent — must ACCEPT 3/3) |
|---|---|---|
| **Claude, neutral statement (지수2 authored)** | **0/3 ✗** | **3/3 ✅** |
| **Claude, ORIGINAL statement `"OXXOVO Beauty CF"`** | **0/3 ✗** | **3/3 ✅** |
| Gemini, neutral (reference only) | 0/3 | 3/3 |

---

## ★ CORRECTION to round 1 — I was wrong: the original statement IS recoverable

Round 1 claimed the original statements were unrecoverable. **That was my error.**
`oxxovo-scoring/src/batch.ts:491-494`:

```ts
const statement =
  cfg.round === 'main'
    ? season.main_round_theme ?? ''
    : app.creator_statement ?? '';
```

**The main round does not use `creator_statement` at all** — it scores every finalist
against the season-wide theme. `cf_06_noira` is a main-round video, so the statement
the 7/14 run actually fed it was `season_test.main_round_theme` = **`"OXXOVO Beauty CF"`**
(measured, not inferred).

That string is itself already neutral (it says nothing about identity), and it is
exactly what Claude saw on 7/14 when it produced `exec=55 / "different AI-generated
faces"`. So I ran it as a third condition. **It did not reproduce.**

(case2's original statement remains unknown — `seedance_t2v_720p_15s_lumea15c_s1.mp4`
is not any application's video, it is a bare R2 artifact.)

---

## The decisive number

Claude, case1, **Execution across 9 runs and 3 different statement conditions**:

| condition | run1 | run2 | run3 |
|---|---|---|---|
| round-1 "same woman" statement | 68 | 68 | 68 |
| round-2 neutral statement | 68 | 68 | 68 |
| **original `"OXXOVO Beauty CF"`** | 65 | 65 | 68 |

**7/14 recorded exec=55 with the identity call. 9/9 runs since have landed 65–68 with
no identity call — including 3 runs under the identical statement.** The 7/14 catch
did not survive replication. It reads as a lucky draw, not a stable capability.

What *did* reproduce, 9/9: Claude flags the **frame 11–12 face-doubling/morph artifact**
every single time. It sees the pixels. It just never characterizes any of it as
"a different person".

---

## Statements used (verbatim)

**Round-2 neutral statement (지수2 authored, identical for both cases, all 12 runs):**

> "A beauty commercial for a skincare brand. Model footage is intercut with shots of the product jar and of the cream texture."

Built to assert nothing ("same woman" banned), deny nothing ("different faces" banned),
and count no people at all — "a model" would smuggle in a recurring subject, "models"
the opposite. Checked as factually true of both clips' frames before use.

**Original statement (measured from `season_test.main_round_theme`):**

> "OXXOVO Beauty CF"

---

## Case 1 — subtle drift (NOIRA). Must flag identity. VERBATIM

### NEUTRAL statement

**Claude run 1** — exec=68 · **MISS (no identity call)**
> summary: This submission delivers a competent luxury skincare commercial with consistent monochromatic styling that aligns well with the stated intent. However, notable AI-generation artifacts appear in the later model sequences—particularly face duplication and hand deformation—which undermine the polished aesthetic.
> weaknesses: ["**Significant face/hand morphing artifacts visible in frames 10-12, including doubled face glitch** and unnatural finger distortions", "Follows a very conventional luxury skincare ad template with minimal creative differentiation"]

**Claude run 2** — exec=68 · **MISS**
> weaknesses: ["**Significant facial distortion artifacts in frames 11-12 where the model's face appears doubled/morphed during transition**", "Hand anatomy issues visible in frames 10-11 …"]

**Claude run 3** — exec=68 · **MISS**
> summary: … notable AI artifacts emerge in the later frames, particularly **facial morphing distortions** and hand anomalies …
> weaknesses: ["Significant face distortion and morphing artifacts visible in frames 11-12, with **double-face/ghosting effect**", …]

*Note the failure mode CHANGED vs round 1.* With the leading statement Claude actively
affirmed "model identity remains reasonably consistent". With a neutral statement it
says nothing about identity either way — it is **silent**, not wrong. Under TK's
criterion ("3회 전부 '다른 얼굴 / 정체성 표류'로 지적해야 통과") silence is not a catch.

**Gemini, neutral (reference)** — 0/3, all three flag only earrings + hands:
> r1: ["**Significant continuity errors regarding the model's earrings**, which change multiple times between shots." …]
> r2: ["Minor inconsistencies in the model's appearance, specifically **the earrings changing between cuts**." …]
> r3: ["There is a **subtle change in the model's earrings** between different sections of the video, indicating a minor continuity break."]

### ORIGINAL statement `"OXXOVO Beauty CF"`

**Claude run 1** — exec=65 · **MISS**
> summary: This submission presents a polished monochromatic beauty commercial for a fictional 'NOIRA' skincare brand, alternating between dramatic portrait shots and product displays. While the overall aesthetic is sophisticated, the video suffers from a notable morphing artifact in frame 12 and follows a fairly conventional luxury beauty ad formula. **The minimal creator statement makes it difficult to assess whether the execution matches any specific creative vision.**
> weaknesses: ["**Frame 12 shows significant face morphing/double exposure artifact** indicating AI generation instability", "**The creative intent statement is extremely minimal ('OXXOVO Beauty CF') providing little context for evaluation**", …]

**Claude run 2** — exec=65 · **MISS**
> weaknesses: ["**Significant visual artifacts in frames 10-12 showing face duplication/morphing issues** typical of AI generation", …]

**Claude run 3** — exec=68 · **MISS**
> weaknesses: ["**Significant visual artifacts in frames 10-12 showing facial distortion and hand anomalies** typical of AI generation", "**Creative intent statement is extremely minimal ('Beauty CF')** making it difficult to evaluate alignment with vision"]

---

## Case 2 — genuinely consistent (LUMIA). Must accept. VERBATIM

**Claude, neutral — 3/3 ✅** (exec 72/72/72). No identity-based fault in any run.
Weaknesses are only "generic template" + the realism/integrity complaint:
> r1 weaknesses: ["Follows extremely generic beauty ad template with no distinguishing creative choices", "Physical interactions show concerning realism - skin texture, pore detail, and cream absorption appear highly naturalistic"]

**Claude, original — 3/3 ✅** (exec 78/78/78). Same pattern:
> r2 weaknesses: ["Extremely generic beauty commercial format with no distinctive creative angle", "Strong indicators of real footage - highly realistic skin texture, pores, natural skin deformation under finger pressure, and physically accurate cream behavior"]

**No false-flags, 6/6.** Reverse-error risk stays low, consistent with both prior runs.

---

## ★ Honest caveat TK should weigh: case1's ground-truth label may itself be wrong

Case1 is labelled "subtle drift (same woman, drifts)" on the strength of **one 7/14
Claude verdict** — the exact verdict that has now failed to reproduce 9/9. Nothing else
independently establishes that `cf_06_noira` actually drifts.

I pulled the frames and looked myself before scoring: 0s and 4s are plainly the same
woman; 18s is plausibly her; 22s is a morph/double-exposure artifact. **I could not
confidently call identity drift either.** So there are two live readings and this run
cannot separate them:

1. The models are blind to subtle drift (the handoff's reading), or
2. **The models are right and the case label is wrong** — cf_06_noira's only real
   identity defect is the frame-12 morph artifact, which every model catches every time.

Reading 2 is not a stretch: 12 independent runs across 2 models and 3 statements all
converged on "artifact yes, different person no". Before more engineering is spent on
identity detection, it is worth confirming the case has the defect we think it has —
e.g. re-run against `faceswap-consistency-test.mp4` (2 plainly different women), where
ground truth is not in doubt. Those R2 paths in the handoff 404'd for me today; TK or
지수(본체) would need the working path.

---

## Handed to TK — no policy decision made here (per instruction)

- **Claude case1: 재현 실패 (0/3 neutral, 0/3 original).** case2: 3/3 pass both.
- **Do NOT read this as "Claude 전담 확정" or as "Claude is blind"** — per TK's
  instruction I am not deciding the 전담 vs any-flag question, and the data does not
  support either yet. What it does say: **no model in our stack reliably reports
  identity drift on this case (0/12), so any-flag over {Claude, Gemini} would also
  produce nothing here.** Neither policy fixes case1 as things stand.
- The 7/14 "Claude = identity specialist" conclusion should be treated as **not
  replicated** and retired as a basis for design until re-established on a case with
  undisputed ground truth.
- The statement-wording sensitivity from round 1 is real but secondary: neutral wording
  removed Claude's false affirmation, it did not produce a catch.

### Side item TK asked about (cf_06_noira ↔ potter statement) — RESOLVED, not a blocker

Seed-only artifact. Two independent confirmations:
- `_main_round_seed.mjs` writes `main_round_video_url` only; it never touches
  `creator_statement`. So app 72f5386a keeps its prelim statement (the potter,
  `demo_artisan.mp4`) while its main-round video is the NOIRA CF.
- **That stale statement is never used**: `batch.ts:491-494` scores the main round
  against `season.main_round_theme`, not `creator_statement`.
- Real participant path is consistent by construction: `lib/studio.ts:471-480` inserts
  `creator_statement` and `free_entry_url` **in the same insert**. Prelim scoring uses
  that same pair. No mismatch possible.

**Related finding while checking (low priority, not this task):** `season_0.main_round_theme`
is **NULL**. `batch.ts:467-471` only warns and proceeds video-only ("Intent Clarity 채점
근거 약화"), so it will not crash — but season_0's main round would score Intent Clarity
with no stated intent at all, for every finalist. Worth setting before the main round.

---

## Method / repro

- Same 2 clips, **same cached frames** as round 1 (`temp/faceconsist/manifest.json`,
  14 + 8 frames) — only the statement changed, so any delta is attributable to it.
- Production scorer unmodified (`src/scorer.ts`, `claude-opus-4-5` / `gemini-2.5-flash`).
- 24 runs today (12 neutral + 12 original). Cost **$1.69 + $1.70 = $3.39**. Generation $0.
- Harness `oxxovo-scoring/temp/_face_repeat_neutral.ts` (`FACE_STATEMENT` / `FACE_OUT`
  env overrides). Raw: `temp/faceconsist/run_neutral.log`, `run_original.log`,
  `results_neutral.json`, `results_original.json`. Temp — delete after TK reads.
