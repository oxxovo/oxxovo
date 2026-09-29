# GT21 Blind Second-Pass Verification — Agent 3

Clips assigned: GT10_lighting1, GT11_lighting2, GT12_editing1, GT13_editing2.
No prior-pass files were read. Method: `ffprobe` for duration/frame-count integrity, one `ffmpeg scdet=threshold=0.08` pass per clip to locate candidate cut points, then dense frame extraction (contact-sheet tiles, 12-16 frames per view, one `ffmpeg` call each) read visually. All four clips are 1080x1920, 30fps, container frame count exactly matches duration*30 (no dropped/duplicated container frames: GT10=450, GT11=450, GT12=240, GT13=540).

## Interpretive stance used throughout (per instructions)
- **editing** marked POSITIVE only if a cut/transition is itself technically broken (visible tear, duplicate/frozen frame at the join, flash-frame, glitch). A clean instant hard cut to different content is NOT scored positive, even when it joins very different material.
- **continuity** marked POSITIVE only if the SAME subject/scene, presented as continuous, is physically broken (something that should persist doesn't, or a location claimed continuous isn't). Ordinary multi-shot montage cutting to different content is not a continuity defect.
- **lighting** is scored at scene level (illumination/color-temperature grading), distinct from **objectConsistency** (an object's own material/color persistence). Where a whole scene's color grade flips coordinated across every element (subject, prop, background) at a cut, I attribute that to lighting rather than to the individual object.

---

## GT10_lighting1 (15.0s, "Move the world" festival-crowd ad)

Structure found: single internal hard cut at t=8.0s (scdet score 17.8, confirmed visually) — wide crowd/confetti shot (0-8s) cuts to a solo woman close-up shot (8-15s). Checked via 1fps full-timeline sheet, 12-frame native-res detail sheet, and two dense 15-frame/1s windows (0.5-1.5s and 8.0-9.0s) for flicker/warp.

| FI | AN | OC | MO | BG | LI | CO | ED | OA |
|---|---|---|---|---|---|---|---|---|
| N | N | N | N | N | N | N | N | N |

- **FI (faceIdentity) — NEGATIVE.** Solo-woman segment (8-15s) sampled at ~1s intervals (frames at 8,9,10,11,12,13,14,15s): same face, hoop earrings, hair-flower, floral top throughout. No identity drift observed.
- **AN (anatomy) — NEGATIVE.** Raised fists in the crowd (checked in the 0.5-1.5s dense window) show normal closed-fist shape with plausible finger wrap; no extra/missing digits or malformed joints at the resolution available.
- **OC (objectConsistency) — NEGATIVE.** Woman's earrings, hair flower, and floral-print top are pixel-stable across the 8 sampled close-up frames; no deformation/disappearance.
- **MO (motion) — NEGATIVE.** Checked two dense 15-frame/1s windows: crowd arm-raises and confetti fall look physically continuous, no freeze/warp/unnatural jump.
- **BG (background) — NEGATIVE.** Stage light beams and crowd silhouette are stable frame-to-frame in both dense windows; no warping/morphing.
- **LI (lighting) — NEGATIVE.** Checked pre/post the t=8s cut and within both dense windows. Woman's face keeps a consistent warm front key-light across head turns (including the side-profile frame at ~14s, where shadow falls correctly on the far cheek); no flicker in either dense window. The crowd shot and close-up shot use different but individually-plausible practical concert lighting; I did not find a coordinated, scene-wide color-grade flip like the one in GT11 (see below) — this is ordinary multi-setup concert cinematography, not an inconsistency.
- **CO (continuity) — NEGATIVE.** The t=8s cut moves from a wide crowd shot to a different individual (solo woman) — an ordinary cutaway in a multi-shot ad, not a claim that one continuous subject/scene persists across the cut. No physical-impossibility found.
- **ED (editing) — NEGATIVE.** Cut at t=8.0s verified with a 15fps/1s dense extraction spanning the join: instant, clean, no duplicate/torn/flash frame.
- **OA (otherArtifacts) — NEGATIVE.** No texture/geometry flicker found outside the categories above.

`GT10_lighting1: row(N, N, N, N, N, N, N, N, N)`

---

## GT11_lighting2 (15.0s, "Precision in every frame" engine/piston product ad)

Structure found: single internal hard cut at t=8.0s (scdet score 16.0, confirmed visually) — timing-chain/piston shot (0-8s, warm-beige background, chrome/silver piston) cuts to a gear/piston shot (8-15s, fully blue-monochrome grade, same conceptual piston now rendered blue).

| FI | AN | OC | MO | BG | LI | CO | ED | OA |
|---|---|---|---|---|---|---|---|---|
| N | N | N | N | N | **P** | N | N | N |

- **FI — NEGATIVE.** No human/animal figures in this clip (mechanical product shots only); checked across the full 12-frame timeline sheet.
- **AN — NEGATIVE.** No organism anatomy present.
- **OC (objectConsistency) — NEGATIVE.** I attribute the piston's color change (see LI below) to a scene-wide lighting/grade shift rather than an isolated object defect, because the piston, the gear, AND the background bokeh all shift together at the same instant — a coordinated whole-scene change, not one prop deforming/vanishing independent of its surroundings. Geometry of piston/gear/timing-chain is otherwise stable and correctly formed in both segments.
- **MO — NEGATIVE.** Checked 15fps/1.2s dense window spanning the cut plus the 12-frame timeline sheet: piston reveal (camera tilt) and gear rendering look physically plausible; no freeze/warp. (Caveat: gear-tooth rotation is hard to judge frame-to-frame because a gear looks similar at many rotation angles — noted for auditability, did not change the call.)
- **BG (background) — NEGATIVE.** Within each of the two shots, background gear/bokeh geometry is stable frame-to-frame; no warping.
- **LI (lighting) — POSITIVE, timestamp ~7.97s-8.03s (the cut).** Evidence: frames at t≈3-7.9s show a chrome/silver piston under warm-beige practical lighting with a blue-toned timing-chain assembly (mixed-material, warm-key look). Immediately after the cut (t≈8.0-15s), the same conceptual piston/gear subject is rendered in a fully blue, cool-toned monochrome grade — piston, gear, AND the background all shift together from warm-neutral to cool-blue in the same instant. Per the category definition ("lighting or shadows inconsistent... across shots"), this is in-scope: a coordinated scene-wide illumination/color-temperature discontinuity between two shots of the same subject matter within one continuous ad. I considered the alternative reading — that this is a deliberate stylistic "two different color treatments" edit, which is a legitimate technique in real product ads — but the fact that the identical prop geometry (piston shape) reappears in an incompatible material color, rather than two visually distinct components being shown, reads more like a generation-consistency miss than an intentional regrade choice. Flagging this explicitly for audit since it is a judgment call.
- **CO (continuity) — NEGATIVE.** Distinct from the lighting call above: no spatial/temporal logic violation (no persisting object that should remain but vanishes/impossibly moves). This is ordinary product-montage cutting.
- **ED (editing) — NEGATIVE.** Cut at t=8.0s verified via 15fps/1.2s dense extraction directly spanning the join: instant, clean, no glitch/duplicate/torn/flash frame — despite the large color-grade jump, the cut mechanics themselves are technically clean.
- **OA — NEGATIVE.** No additional artifact beyond the lighting finding above.

`GT11_lighting2: row(N, N, N, N, N, P, N, N, N)`

---

## GT12_editing1 (8.0s, "Chase the night" car/city ad)

Structure found: single hard cut at t≈5.0s (scdet score 11.5, confirmed visually) — car driving through a canyon of tall neon skyscrapers, cyan-dominant reflections (0-5s), cuts to a closer shot of the same car at street level with magenta/orange neon and an orange streetlight (5-8s).

| FI | AN | OC | MO | BG | LI | CO | ED | OA |
|---|---|---|---|---|---|---|---|---|
| N | N | N | N | N | N | N | N | N |

- **FI / AN — NEGATIVE.** No human figures visible in any sampled frame (car exterior only); checked across the full 12-frame timeline sheet plus mirror zoom-crops.
- **OC (objectConsistency) — NEGATIVE.** Car body shape, side-mirror shape/housing, and door line are consistent between the two shots (checked via zoom crop on the mirror before/after the cut); the mirror's blue LED accent is visible in the closer post-cut shot and is consistent with what a closer camera would resolve, not a shape change.
- **MO — NEGATIVE.** Checked the full timeline sheet; camera/car movement reads as smooth continuous motion in both segments, no freeze/warp. (Wheel motion could not be conclusively verified — largely out of frame/blurred — noted for audit, does not change the call since nothing anomalous was actually observed.)
- **BG (background) — NEGATIVE.** Skyscraper/signage geometry stable frame-to-frame within each shot; no warping detected in the samples checked.
- **LI (lighting) — NEGATIVE.** The car's paint/reflection color shifts between the two shots (cyan-dominant vs magenta/orange-dominant), but this tracks the different ambient signage color in each shot's environment — a mirror-finish car reflecting its surroundings is physically correct behavior, not an inconsistency, and there is no discontinuity within either individual shot.
- **CO (continuity) — NEGATIVE.** The cut moves to a different stretch of the city (different signage, different street level) — read as an ordinary chase-montage cutaway (implying distance/speed), not a claim that one specific continuous moment is preserved and then broken. No persisting-object impossibility found.
- **ED (editing) — NEGATIVE.** Cut at t≈5.0s verified with a 15fps/1.4s dense extraction spanning the join (7 columns x 3 rows covering 4.3-5.7s): instant, clean, no duplicate/torn/flash frame. Frame count (240) exactly equals duration x fps, ruling out a stray held/duplicated frame at the join.
- **OA — NEGATIVE.** No additional artifact found; stylized neon signage text is not real language and did not visibly warp across frames.

`GT12_editing1: row(N, N, N, N, N, N, N, N, N)`

---

## GT13_editing2 (18.0s, same underlying footage/ad as GT10_lighting1, reordered)

**Key structural finding (scdet cross-correlation):** GT13's scdet score sequence exactly matches GT10's, offset by +3.0s, for t=6.0s-16.8s (e.g. GT10's spike 9.773@3.6s == GT13's 9.774@6.6s; GT10's internal cut 17.802@8.0s == GT13's 16.867@11.0s). GT13's first 3.0s is an exact-offset-0 match to GT10's first 3.0s. This means GT13 = [GT10 0-3s] + [a ~3s excerpt of GT10's 8-15s solo-woman close-up, relocated earlier] + [GT10's 3-15s replayed from t=6s onward, including GT10's own internal 8s cut now landing at t=11s]. I verified this directly (not just via scdet) by dense-frame-inspecting all three candidate cut points at 15fps/1s: t≈3.0s (couple/confetti wide shot -> solo-woman close-up), t≈6.0s (solo-woman close-up -> back to couple/confetti wide shot, i.e. a literal return to earlier-looking footage), and t≈11.0s (crowd/confetti -> solo-woman close-up again, matching GT10's own native cut).

| FI | AN | OC | MO | BG | LI | CO | ED | OA |
|---|---|---|---|---|---|---|---|---|
| N | N | N | N | N | N | N | N | N |

- **FI/AN/OC/MO/BG — NEGATIVE**, same evidence and reasoning as GT10 (this is the identical source material, re-timed): consistent face identity in the woman's close-ups, normal fist/hand shapes in the crowd, stable wardrobe/accessories, natural motion, stable background beams — all re-checked directly in this file (not merely assumed from GT10) via the three dense-frame windows above.
- **LI (lighting) — NEGATIVE.** Each of the three shot types re-used here (crowd wide, confetti-burst wide, solo-woman close-up) already reads as individually lighting-consistent in GT10; re-examined here at the new cut points, no flicker or shadow-direction inconsistency found within any single shot.
- **CO (continuity) — NEGATIVE, with an explicit judgment call flagged for audit.** This is the more interesting case: the wide crowd/confetti shot is cut to, away from, and then back to across the video (t=0-3s -> away -> t=6-11s reprise, i.e. the same visual content recurs after a cutaway). I considered two readings: (a) this reads as a "cutback" — cutting from a wide shot to a close-up and back to the wide shot — which is one of the most standard techniques in real edited video (especially concert/festival ads that intercut a couple/crowd wide shot with a featured dancer's close-up); under that reading it is not a continuity violation at all, since nothing that should persist is contradicted — the crowd is simply shown again, which is normal for a recurring wide shot. (b) Alternatively, a stricter reader could flag that the wide shot's content is suspiciously reused rather than freshly filmed footage of the "same" moment — but a viewer without access to the frame-level provenance data I extracted here (scdet cross-correlation) would have no way to perceive this as a violation; it looks like ordinary A/B shot intercutting, and no physical-impossibility (vanishing/impossible persistence) is visible on screen. I am scoring this NEGATIVE under the instructed criterion (physical/spatial impossibility required), while flagging the underlying construction fact above so HQ can decide if "detectable-only-via-provenance-analysis reuse" should count under a future rubric revision.
- **ED (editing) — NEGATIVE.** All three examined cuts (t≈3.0s, 6.0s, 11.0s) are instant, clean hard cuts in the dense 15fps/1s extractions — no visible tear, duplicate frame, freeze, or flash at any of them. Frame count (540) exactly equals duration x fps. Despite having more cuts than GT10 and being the "editing2" case, none of the transitions themselves are technically broken by the instructed criterion.
- **OA — NEGATIVE.** No artifact beyond the structural note under CO above, which I judged does not fit "otherArtifacts" (that category is for surface/texture/geometry flicker or a defect not covered by another category, not for footage-reuse structure).

`GT13_editing2: row(N, N, N, N, N, N, N, N, N)`

---

## Summary of positive/notable findings across my 4 clips
- Only one POSITIVE call: **GT11_lighting2 → lighting**, at the t≈8.0s cut (chrome/warm-beige piston shot -> fully blue monochrome-graded piston/gear shot, coordinated scene-wide color-temperature flip).
- GT12 and GT13 (the "editing" pair) both came back all-NEGATIVE for editing and continuity under the instructed "technically broken cut" / "physically impossible persistence" criteria — every cut examined (5 total across the two clips) was frame-verified clean via dense 15fps extraction at the join.
- GT13's most notable finding is structural, not visual: it is a re-timed reuse of GT10's exact footage (proven via scdet score cross-correlation, offset +3.0s match), which produces a wide-shot "cutback" pattern. I scored it NEGATIVE for continuity/editing since it is visually indistinguishable from ordinary A/B intercutting, but flagged the underlying construction for HQ's awareness.

`GT10_lighting1: row(N, N, N, N, N, N, N, N, N)`
`GT11_lighting2: row(N, N, N, N, N, P, N, N, N)`
`GT12_editing1: row(N, N, N, N, N, N, N, N, N)`
`GT13_editing2: row(N, N, N, N, N, N, N, N, N)`
