# GT21 Blind Second-Pass Verification — Agent 2

Independent blind re-verification of 5 assigned clips against the v1.3 9-question / 8-scored-category
schema (`faceIdentity, anatomy, objectConsistency, motion, background, lighting, continuity, editing,
otherArtifacts`; `audiovisualSync` deleted per v1.3, not reported). No prior answer-key or other agents'
reports were read. All findings below are from direct ffprobe/ffmpeg/ssim measurement and frame-by-frame
visual inspection performed in this session.

Legend: **P** = POSITIVE (directly observed, timestamp/quantitative evidence given), **N** = NEGATIVE
(directly checked, confirmed absent), **U** = UNVERIFIED (genuinely ambiguous, reason given).

---

## GT05_face2.mp4 (duration 10.0s, 1080x1920, 30fps)

Hard cut detected via `ffmpeg scdet` at **pts_time=5.0s** (scene_score=0.700, by far the largest score
in the clip — no other frame exceeded 0.24). Frame-by-frame inspection (20 frames @ 0.5s spacing)
confirms: **Segment A (0.0–4.83s)** = dark-skinned woman, afro hair, gold hoop earrings, red backdrop.
**Segment B (5.0–10.0s)** = a different, light-skinned East-Asian woman, updo hairstyle, no visible
earrings, teal/blue backdrop. This is a full identity + setting swap at a single clean cut, not a
gradual drift within one continuous take.

| Cat | State | Evidence | Reasoning |
|---|---|---|---|
| FI | **P** | scdet cut @5.0s (score 0.700); frame@4.5s vs frame@5.0s show two entirely different faces | Textbook "face/identity appears different from earlier in the clip" |
| AN | N | 20 sampled frames, both segments | No hands/limbs in frame in either segment; face/neck/shoulder proportions normal throughout |
| OC | N | both segments | Earrings/hair/wardrobe stable within segment A; hair/top stable within segment B; no deformation/disappearance |
| MO | N | frames every 0.5s | Natural gradual head-turn (seg. A) and eyes-open→closed progression (seg. B); no freeze/collapse |
| BG | N | both segments | Solid-color backdrops, no warp/flicker within either segment |
| LI | N | both segments | Lighting internally consistent per segment; cross-cut difference is a scene change, not an in-shot inconsistency |
| CO | N | cut boundary frames | Reads as two distinct, separately-shot beauty-ad vignettes (different subject/wardrobe/location) — an ordinary edited scene change, not an unexplained break within one continuous narrative |
| ED | N | frame@4.5s vs frame@5.0s | Clean straight cut, no blend/glitch/morph artifact at the boundary |
| OA | N | — | Nothing observed outside the above |

`GT05_face2: row(P, N, N, N, N, N, N, N, N)`

---

## GT06_face3.mp4 (duration 15.0s, 1080x1920, 30fps, has audio track — not scored per v1.3)

Two hard cuts: **t=6.0s** (score 0.464) and **t=8.0s** (score 0.390). Structure: **Seg A (0–5.5s)**
chef flambéing in a kitchen, caption "From prompt to plate." → cut → **Seg B1 (6.0–7.7s)** wide shot of
a sports car at night, caption "Chase the night." → cut → **Seg B2 (8.0–15.0s)** tight close-up of the
same car's front-left corner/mirror, camera creeping very slowly. Fine sampling (6fps) across the
flambé toss (t=1–3s) and SSIM check across the long B2 shot (t=10.7s vs 14.6s → SSIM=0.36, i.e.
substantial change, not a freeze) were both done explicitly to rule out anatomy/motion defects.

| Cat | State | Evidence | Reasoning |
|---|---|---|---|
| FI | N | Seg A frames (0,1,2,3s fine + 2fps coarse) | Only one face present (chef) for the whole segment where a face exists; consistent features/beard throughout; car segments have no face |
| AN | N | 6fps extraction over t=1.0–3.0s (toss) | Hands on pan and open-mouth theatrical expression during toss are anatomically normal; no finger/limb malformation |
| OC | N | all segments | Pan, jacket, buttons, car body/mirror geometry stable throughout |
| MO | N | SSIM t=10.7s vs 14.6s = 0.36 | Toss motion naturally blurred; car close-up is a slow creeping dolly, NOT a freeze (SSIM far from 1.0) |
| BG | N | frames across all 3 segments | Kitchen lights and glowing-cube tower shape stable, no flicker/morph; city backdrop consistent in car shots |
| LI | N | all segments | Flame glow and neon reflections physically consistent frame-to-frame |
| CO | N | both cut boundaries | Two clean cuts delineate three distinct, caption-labeled vignettes — consistent with an intentional multi-concept ad/demo reel, not an unexplained narrative or spatial break |
| ED | N | frame09/10 (5.33/6.0s), frame12/13 (7.33/8.0s) | Both cuts are clean straight cuts, no glitch/blend frame |
| OA | N | — | Nothing observed outside the above |

`GT06_face3: row(N, N, N, N, N, N, N, N, N)`

---

## GT07_motion1.mp4 (duration ~19.0s, 1080x1920, 30fps, has audio — not scored)

scdet found continuous moderate scores (0.08–0.22) from t=1.1–2.6s (a push-in zoom/re-frame) and a
single spike to 0.356 at **pts_time=4.0s** — checked at 8fps around that spike and found **no actual
cut** (no discontinuity in pose/framing; only a background neon glow appearing/fading). Structure:
**t=0–1s** wide full-body shot (arms at sides, no glasses) → fast push-in/re-frame → **t≈2.6s onward**
tight close-up, hand raised adjusting sunglasses. That exact hand-to-glasses pose then **does not
advance for the remainder of the clip** (~14 of 19s, ~83% of runtime), confirmed quantitatively.

SSIM (this pose-hold window only, to rule out a literal frozen-pixel duplicate): 5s↔10s=0.473,
10s↔15s=0.479, 15s↔18.5s=0.522, 5s↔18.5s=0.358 — i.e. real pixel-level variance persists (hair/neon
flicker), so this is **not** a duplicate-frame freeze, but the gesture/pose itself is locked in place
far longer than any natural completion of that action would take — a motion-collapse pattern.

| Cat | State | Evidence | Reasoning |
|---|---|---|---|
| FI | N | wide shot vs close-up | Same identity/features before and after the zoom |
| AN | N | close-up hand/finger frames t=1.7–18s | Fingers, ring, thumb on glasses temple proportionate throughout |
| OC | N | all frames | Jacket, sunglasses, ring consistent |
| MO | **P** | hand-to-glasses pose static from ~t=2.6s to ~t=18.3s; SSIM 0.36–0.52 across that window (real but non-progressing variance) | Gesture never completes/advances over 14+s — "unnatural motion"/collapse per category definition |
| BG | N | all frames | Bokeh/neon shapes stable, no warping |
| LI | U | bright pink neon glow visible at t=3.6s, absent/dimmed by t≈3.9–4.1s (8fps check), coincides with the clip's only scdet spike (0.356 @ t=4.0) | Abrupt on/off change within one continuous shot — could be a real lighting inconsistency or a stylistic/realistic neon flicker; not confirmed either way |
| CO | N | 8fps check around t=3.6–4.4s | No actual scene/spatial break found — single continuous take |
| ED | N | same check | No genuine cut located despite the scdet blip |
| OA | N | — | Nothing beyond the items above |

`GT07_motion1: row(N, N, N, P, N, U, N, N, N)`

---

## GT08_motion2.mp4 (duration ~19.0s, 1080x1920, 30fps, has audio — not scored)

No hard cuts (scdet: zero hits ≥0.08 or ≥0.35 for the whole clip except the moving open). Visual
inspection immediately flagged near-identical successive frames from ~t=2s onward. Quantified via
consecutive-frame SSIM:

| interval | SSIM |
|---|---|
| 0.5↔1.0s | 0.413 |
| 1.0↔1.5s | 0.447 |
| 1.5↔1.8s | 0.481 |
| 1.8↔2.0s | 0.506 |
| 2.0↔2.3s | 0.517 |
| 2.3↔2.6s | 0.505 |
| 2.6↔3.0s | 0.469 |
| 3.0↔3.2s | **0.999** |
| 3.2↔3.4s .. 3.8↔4.0s | 0.999–1.000 |
| 3.0↔5.0s / 5↔8 / 12↔16 | 0.985–0.9998 |
| 16↔18.5s | 0.991 |

Onset of freeze pinpointed to **between t=2.6s and t=3.2s** (last "real" delta 0.469 at 2.6→3.0s,
already 0.998 by 3.0→3.2s). The frame is then static (car parked/creeping under a teal-lit overpass,
crosswalk visible) for the remainder of the clip through duration end (18.99s) — roughly **16 of 19
seconds (~84%)** frozen.

| Cat | State | Evidence | Reasoning |
|---|---|---|---|
| FI | N | — | No person/face in frame (car product shot) |
| AN | N | — | No anatomy present |
| OC | N | t=0–3s + frozen portion | Car body/mirror/panel geometry stable in the moving segment; unchanged (frozen) thereafter |
| MO | **P** | consecutive-frame SSIM table above; onset ≈t=2.6–3.2s, sustained ≥0.985 to t=18.99s | Quantitatively confirmed hard freeze covering ~84% of clip duration |
| BG | N | moving + frozen portions | No warping/flicker in the moving portion; frozen thereafter (no separate BG instability) |
| LI | N | moving + frozen portions | No lighting inconsistency in the moving portion; static thereafter |
| CO | N | — | Single continuous (if frozen) shot/location, no spatial or temporal break |
| ED | N | scdet: 0 hits | No cuts detected anywhere in the clip |
| OA | N | — | Nothing beyond the motion freeze already captured |

`GT08_motion2: row(N, N, N, P, N, N, N, N, N)`

---

## GT09_motion3.mp4 (duration ~19.0s, 1080x1920, 30fps, has audio — not scored)

No hard cuts (scdet: zero hits ≥0.08 for the whole clip). Single continuous macro shot of a plated
dome dessert (mirror-glaze, gold leaf, sugar tuile, edible flower, mango coulis) with a slow push-in.
Consecutive-frame SSIM (1s steps):

| interval | SSIM | interval | SSIM |
|---|---|---|---|
| 0↔1s | 0.697 | 9↔10s | 0.994 |
| 1↔2s | 0.691 | 10↔11s | 1.000 |
| 2↔3s | 0.659 | 11↔12s | 1.000 |
| 3↔4s | 0.634 | 12↔13s | 1.000 |
| 4↔5s | **0.993** | 13↔14s | 1.000 |
| 5↔6s | 0.999 | 14↔15s | 1.000 |
| 6↔7s | 1.000 | 15↔16s | 1.000 |
| 7↔8s | 0.999 | 16↔17s | 0.987 |
| 8↔9s | 0.914 | 17↔18s | 0.972 |
|  |  | 18↔18.9s | 0.999 |

Finer sampling (0.2s steps, t=3.0–4.0s) shows the transition is gradual (0.79–0.85), landing fully
frozen by ~t=4.5–5.0s. Visual spot-check at t=0.5s/2.0s/3.5s (before freeze) shows only a slow,
coherent push-in with no warping of the delicate sugar-tuile lattice or garnish. From ~t=4.0–4.5s to
clip end (18.99s) the frame is effectively static — **~14.5 of ~19s (~76%)** of the clip.

| Cat | State | Evidence | Reasoning |
|---|---|---|---|
| FI | N | — | No person/face (dessert product shot) |
| AN | N | — | No anatomy present |
| OC | N | t=0.5/2.0/3.5s spot-checks | Dome/garnish/flower/coulis shapes stable through the moving portion; unchanged (frozen) after |
| MO | **P** | consecutive-frame SSIM table above; onset ≈t=4.0–4.5s, sustained ≥0.97 (mostly ≥0.999) to t=18.99s | Quantitatively confirmed hard freeze covering ~76% of clip duration, following an initial coherent push-in |
| BG | N | moving + frozen portions | Bokeh backdrop stable, no flicker/morph |
| LI | N | moving + frozen portions | Specular highlight and warm lighting consistent throughout |
| CO | N | — | Single continuous shot; freeze is a motion issue, not a spatial/temporal narrative break |
| ED | N | scdet: 0 hits | No cuts detected |
| OA | N | — | Nothing beyond the motion freeze already captured |

`GT09_motion3: row(N, N, N, P, N, N, N, N, N)`

---

## Summary (single-line tuples, order FI,AN,OC,MO,BG,LI,CO,ED,OA)

```
GT05_face2: row(P, N, N, N, N, N, N, N, N)
GT06_face3: row(N, N, N, N, N, N, N, N, N)
GT07_motion1: row(N, N, N, P, N, U, N, N, N)
GT08_motion2: row(N, N, N, P, N, N, N, N, N)
GT09_motion3: row(N, N, N, P, N, N, N, N, N)
```
