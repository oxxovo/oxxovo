# GT21 Blind Second-Pass Verification — Agent 1 (GT01–GT04)

Independent blind forensic pass. No prior answer key, design doc, or other agents' reports were read.
Category definitions used: `oxxovo-scoring/_new_rubric_prompt_2026-09-09_structured_v1_2.ts` (DEFECT_CATEGORIES_V1_2), read-only.
Category-boundary clarifications from the task brief were applied (motion vs anatomy; lighting vs objectConsistency; otherArtifacts as non-double-counting catch-all; continuity independent of cut presence/absence).

Tools used: `ffprobe` (stream info), `ffmpeg -vf select='gt(scene,0.08)',metadata=print` (scdet, threshold 0.08), `ffmpeg -vf freezedetect` (frozen-frame check), `ffmpeg -af volumedetect` / `-af silencedetect` (audio level/gaps), `ffmpeg -lavfi showspectrumpic` (spectrogram, signal-based inspection only — this is **not** literal listening; it can catch dropouts/glitches/band-limiting but cannot confirm semantic lip-sync or sound-identity match). Dense frame sampling was done via `fps=N,tile=RxC` contact sheets plus full-resolution single-frame extraction at flagged timestamps.

Legend: **P**=POSITIVE (defect directly observed), **N**=NEGATIVE (absence directly confirmed), **U**=UNVERIFIED (genuinely ambiguous). Evidence tags: [육안]=visual inspection, [구조]=structural impossibility/absence, [제작]=production/file-level evidence (ffprobe/freezedetect), [scdet]=scene-cut detection, [오디오분석]=audio signal analysis (not literal listening).

---

## GT01_clean_a.mp4 (1920x1080, 24fps, 15.042s, 1 video + 1 AAC audio stream) — CLEAN-ALL candidate

**6-step protocol applied:**
1. Full-duration dense sweep: 6 windows × 5fps contact sheets covering 0–15.04s (~75 sampled frames), plus targeted 0.1–0.25s-step full-resolution extraction around the one detected cut (9.3–10.3s) and across the whole close-up segment (10.5–15.0s).
2. Section-by-section (~2.5s windows ×6), all 10 categories checked per window.
3. All 10 categories checked individually below.
4. Audio: ffprobe confirms 1 AAC stream (44.1kHz stereo). `volumedetect`: mean -49.8dB, max -20.6dB. `silencedetect` (-35dB/0.3s): silence 0.3–4.31s, brief non-silent burst 4.31–4.88s (with a small gap 4.88–5.0s), then quiet again until a short blip ending 7.46s, then near-total silence 7.46s→end (15.03s). Spectrogram (`showspectrumpic`): uniform hard low-pass at ~15.5kHz for the entire clip (encoding/source characteristic, not a localized defect), periodic soft low-frequency pulses ~0–9.5s, then near-silence. No broadband click/pop or dropout at the t=9.958s cut.
5. scdet (threshold 0.08): exactly **one** flagged frame, t=9.958s, scene_score=0.521. Confirmed independently by two separate metadata-print runs (full-clip and a 7–10.5s trim).
6. This pass is the required independent second check; findings below were actively hunted for, not assumed clean.

**Content:** Single continuous scene, elderly potter's studio. Wide static shot (man enters through a doorway, sits at the wheel, begins centering clay) from 0s to 9.958s, then one hard cut to a close-up of hands shaping a small cylindrical cup on the wheel, continuing to 15.04s.

| Cat | Verdict | Evidence | Reasoning |
|---|---|---|---|
| FI | N | [육안] | Single person throughout (wide shot only shows his face, downward-angled); no second face, no swap. |
| AN | N | [육안] | Full-res close-ups (10.5–15.0s, 0.25s steps) show both hands with 5 fingers each, natural bends, no fusion/extra digits. |
| OC | N | [육안] | Investigated a suspected pot-height discontinuity (two independently-grabbed frames at t=12.0s and t=14.5s looked different in height/width). Re-checked with a fixed-crop, 0.25s-step sequence spanning 12.00–14.50s: the vessel size/shape is stable and changes only gradually — the earlier impression did not hold up under controlled re-comparison. No unexplained size/shape jump. |
| MO | N | [육안]+[제작] | Wheel spin and hand motion are smooth and continuous across all windows; `freezedetect` returned zero frozen segments for the whole clip. |
| BG | N | [육안] | Shelving, pottery, window, door all stable across all 6 windows; no warp/flicker. |
| LI | N | [육안] | Consistent single soft window-light key, consistent shadow direction throughout both shots. |
| CO | N | [육안] | One continuous location/action (enter → sit → center clay → shape); the one cut is a same-subject WS→CU progression consistent with the pottery-throwing process, not an unexplained break. |
| ED | N | [육안]+[scdet] | Exactly one hard cut (t=9.958s). Frame-exact comparison at 9.83s (pre-cut, wide) vs 9.92s (post-cut, close-up) shows an instantaneous, glitch-free jump — no duplicate/black/torn frame at the join. |
| OA | N | [육안] | No texture/geometry flicker on shelves, tools, wheel, or clay surface across dense sampling. |
| AV | N | [오디오분석] | Ambient room-tone track; a brief audio burst at 4.31–4.88s time-aligns plausibly with the visual door-entry/walk-in (~2.7–5s per the frame sweep); spectrogram shows no glitch/dropout at the t=9.958s cut. Signal-based only — cannot confirm literal semantic match, but no technical anomaly found. |

`GT01_clean_a: row(N, N, N, N, N, N, N, N, N, N)`

**CLEAN-ALL 인증: 합격 (PASS)** — all 10 categories directly confirmed NEGATIVE under the full 6-step protocol. Caveat: audio confirmation is signal-based (ffprobe/volumedetect/silencedetect/spectrogram), not literal listening — no technical anomaly was found and no positive defect evidence exists, but a very subtle semantic-only mismatch (if any) could theoretically escape this method.

---

## GT02_clean_b.mp4 (1080x1920, 30fps, 15.000s, 1 video + 1 AAC audio stream) — CLEAN-ALL candidate

**6-step protocol applied:**
1. Full-duration dense sweep: 6 windows × 5fps contact sheets covering 0–15.0s (~75 sampled frames), plus 0.03s-resolution scene-score trace and full-resolution frame extraction around the one detected cut (7.8–8.3s).
2. Section-by-section (~2.5s windows ×6), all 10 categories checked per window.
3. All 10 categories checked individually below.
4. Audio: ffprobe confirms 1 AAC stream (44.1kHz stereo). `volumedetect`: mean -10.3dB, max -0.0dB (continuous, energetic track). `silencedetect` (-35dB/0.3s): **zero** silence segments detected — audio runs continuously start to end. Spectrogram: continuous rhythmic broadband music (~up to 17kHz) with a distinct but non-dropout texture change ~8.2–9.4s (consistent with a music-arrangement passage, not a technical gap); no interruption at the t=8.0s video cut.
5. scdet (threshold 0.08): one strong flag at t=8.0s (scene_score=0.395); four additional very-low-margin flags at t=8.6–9.1s (scores 0.081–0.093) that, on frame-by-frame review, correspond to continuous swirl-motion content with no compositional break — treated as scdet noise, not additional cuts (also matches a small periodic ~0.02 scdet ripple recurring throughout the whole clip, consistent with GOP/encoding artifacts rather than true scene changes).
6. This pass is the required independent second check; findings below were actively hunted for, not assumed clean.

**Content:** Macro/product shot of magenta silk fabric on a black background (vertical 9:16 product ad, "Watch fabric come alive."). Shot 1 (0–8.0s): fabric draping/swaying. One cut through a brief (~0.2–0.3s) black gap at t=8.0s to Shot 2 (8.0–15.0s): fabric swirling into a spiral knot.

| Cat | Verdict | Evidence | Reasoning |
|---|---|---|---|
| FI | N | [구조] | No human or animal face appears anywhere in the clip — pure fabric/product content. |
| AN | N | [구조] | No body/hand/anatomy present anywhere in the clip. |
| OC | N | [육안] | Single continuous magenta silk material identity across both shots; no tearing, color-shift, or material-identity change; folds/knot form plausibly from the same fabric. |
| MO | N | [육안]+[제작] | Cloth motion (draping, swaying, swirling into a knot) is physically plausible at 5fps sampling across all 6 windows; `freezedetect` returned zero frozen segments. |
| BG | N | [육안] | Pure black background stable throughout both shots, no flicker/warp. |
| LI | N | [육안] | Consistent single soft key light / specular highlight pattern maintained within each shot. |
| CO | N | [육안] | Two-shot fabric showcase (drape → swirl) under one consistent style/tagline; no unexplained spatial/temporal break — a standard product-video structure. |
| ED | N | [육안]+[scdet]+[제작] | One cut at t=8.0s via a brief dip-to-black. Full-res frame-exact review (7.80–8.30s, 0.03–0.1s steps) shows a clean fade-to-black-and-back with no stray/duplicate/glitch frame; `freezedetect` found nothing here. |
| OA | N | [육안] | Satin surface sheen and fold/knot geometry stable across dense sampling; no popping, self-intersection, or warping artifacts. |
| AV | N | [오디오분석] | Continuous rhythmic music (zero detected silence); spectrogram shows uninterrupted content straight through the t=8.0s cut — no dropout/glitch. No discrete diegetic sound event exists in this footage to check for a semantic mismatch; signal-based inspection only. |

`GT02_clean_b: row(N, N, N, N, N, N, N, N, N, N)`

**CLEAN-ALL 인증: 합격 (PASS)** — all 10 categories directly confirmed NEGATIVE under the full 6-step protocol. Same audio caveat as GT01 (signal-based, not literal listening; no discrete sound event existed to test in this instrumental-only track).

---

## GT03_clean_c.mp4 (1080x1920, 30fps, 15.000s) — standard method

**Content:** Restaurant food-ad montage, "Create a story around flavor." Shot 1 (0–8.0s): plated seared scallop on black-rice bed, smoke/wine-glass bokeh background, a hand with tweezers places a gold-leaf flake. One hard cut at t=8.0s (scdet score 0.510) to Shot 2 (8.0–15.0s): a seared pork/duck dish with red-wine reduction, candle background, static shot to the end.

| Cat | Verdict | Evidence | Reasoning |
|---|---|---|---|
| FI | N | [구조] | No human face ever appears (only a hand+forearm with tweezers, partial frame). |
| AN | N | [육안] | Full-res check at t=3–4s: thumb/forefinger grip on tweezers is anatomically normal, no deformation. |
| OC | N | [육안] | Garnish (microgreens, pansy, gold leaf) and each dish's own elements stay consistent within their shot; the two distinct dishes (scallop starter / pork main) read as a standard multi-course ad montage under one tagline, not a single-object identity break. |
| MO | N | [육안]+[제작] | Steam/smoke plumes move plausibly across all windows in both shots; camera is static in both; `freezedetect` found zero frozen frames. |
| BG | N | [육안] | Blurred wine-glass/bokeh backdrop stable in Shot 1; candle backdrop stable in Shot 2. |
| LI | N | [육안] | Warm restaurant lighting held consistent within each shot. |
| CO | N | [육안] | Two-dish "story around flavor" structure is a coherent, expected food-ad montage; no unexplained spatial/temporal break. |
| ED | N | [육안]+[scdet] | One clean hard cut at t=8.0s. Full-res frame-exact review (7.83–8.17s) shows an instantaneous jump — no black flash, no duplicate frame, no glitch. |
| OA | N | [육안] | No texture/geometry flicker on plate, food, or garnish surfaces across dense sampling. |
| AV | N | [오디오분석] | Continuous background music (mean -11.7dB, max -0.4dB, zero detected silence); spectrogram shows uninterrupted rhythmic content through the t=8.0s cut, no dropout. No discrete diegetic sound event to check for semantic sync; signal-based only. |

`GT03_clean_c: row(N, N, N, N, N, N, N, N, N, N)`

---

## GT04_face1.mp4 (1080x1920, 30fps, 15.000s) — standard method

**Content:** Food-ad montage. Shot 1 (0–~7.0s): a bearded chef flambé-cooking, tossing a wok, plating (caption "From prompt to plate."). Cut ~t=6.7–7.0s to Shot 2 (~7.0–7.9s): a red-glazed dome dessert with spun-sugar garnish (caption "Desire, served."). Second hard cut at t=8.0s to Shot 3 (8.0–15.0s): a magenta/gold two-tone sphere dessert with a red sauce drip.

scdet (threshold 0.08) flagged many low-margin frames between t≈1–6s (scores 0.08–0.23), all visually confirmed as flame-flicker/lighting-flare noise during the flambé, not real cuts. Two genuine high-magnitude cuts were found: t=7.0s (0.641) and t=8.0s (0.639). `freezedetect` flagged **freeze_start=8.0s, two consecutive segments totaling 0.667s, freeze_end=8.667s** — this was investigated directly (see MO below).

| Cat | Verdict | Evidence | Reasoning |
|---|---|---|---|
| FI | N | [육안] | Close-up face crops at t=0.3s and t=6.2s compared directly (hairstyle, beard shape/color, brow, nose): consistent identity throughout the chef segment. No other face appears in either dessert shot. |
| AN | N | [육안] | Hand/finger grip on the wok handle, tongs, and the plating gesture (t=5.6s, 6.6s) show normal anatomy; fast-toss motion blur (t≈5.6s) obscures fine finger detail but shows no deformity. |
| OC | **U** | [육안] | The dessert "hero" shot changes completely in appearance between Shot 2 (t=7.0–7.9s: solid deep-red glossy dome, spun-sugar garnish) and Shot 3 (t=8.0s+: magenta/gold two-tone split sphere, no spun sugar) despite near-identical staging (candles, pansy garnish, chocolate-soil base, identical "Desire, served." caption). Could not determine from the footage alone whether this is an intentional two-variant dessert showcase (paralleling GT03's two-dish montage) or an unintended identity break in what is staged to look like one hero item. Genuinely ambiguous — not resolved either way. |
| MO | **P** | [육안]+[제작] | Frozen/duplicated frame from t=8.0s to ~8.67s (0.67s) in Shot 3: frames sampled at 0.1s steps (8.0, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6s) are pixel-identical (no drip progress, no candle-flame movement) before motion (the sauce drip lengthening) resumes at ~8.67–8.8s. Independently confirmed by `freezedetect` (freeze_start=8.0, total duration 0.667s, freeze_end=8.667). Audio (see AV) keeps running normally through this span, confirming it is a video-side frozen-motion defect. |
| BG | N | [육안] | Kitchen shelving/lighting fixtures stable through the flambé segment aside from the expected fire; each dessert shot's own background is internally stable. |
| LI | N | [육안] | Lighting held consistent within each shot; the bright whiteout during the flambé flare (~t=1.0–1.4s) is a physically expected result of a fire flare-up, not an inconsistency. |
| CO | N | [육안] | "Cooking process → hero dessert reveal" is a standard ad-montage structure (parallels GT01/GT03's shot patterns); no additional unexplained spatial/temporal break beyond the object-appearance question already captured under OC. |
| ED | N | [육안]+[scdet]+[제작] | Both cuts (~t=6.7–7.0s and t=8.0s) are themselves instantaneous, glitch-free hard cuts — no visual artifact exactly at either join. The freeze is a distinct in-shot motion defect starting just after the second cut, attributed fully to MO to avoid double-counting the same phenomenon. |
| OA | N | [육안] | No additional texture/geometry artifacts found beyond the freeze already reported under MO. |
| AV | N | [오디오분석] | Continuous background music (mean -11.7dB, max -0.4dB, zero detected silence); spectrogram shows uninterrupted music through both cuts and straight through the t=8.0–8.67s video freeze — audio does not freeze even though video does, which is itself confirmation that the defect is video-side motion, not an audio dropout. No discrete diegetic sound event exists to test for lip/action sync; signal-based only. |

`GT04_face1: row(N, N, U, P, N, N, N, N, N, N)`

---

## Summary

| Clip | FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|---|
| GT01_clean_a | N | N | N | N | N | N | N | N | N | N |
| GT02_clean_b | N | N | N | N | N | N | N | N | N | N |
| GT03_clean_c | N | N | N | N | N | N | N | N | N | N |
| GT04_face1 | N | N | **U** | **P** | N | N | N | N | N | N |

- **GT01_clean_a: CLEAN-ALL 인증 = 합격 (PASS)**
- **GT02_clean_b: CLEAN-ALL 인증 = 합격 (PASS)**
- GT03_clean_c: all-clean on standard review (not a CLEAN-ALL-protocol target per task scope).
- GT04_face1: **motion = POSITIVE** (frozen frame, t=8.0–8.67s, directly observed + freezedetect-confirmed) and **objectConsistency = UNVERIFIED** (ambiguous dessert-identity change across the t=7.9→8.0s cut). Not clean.
