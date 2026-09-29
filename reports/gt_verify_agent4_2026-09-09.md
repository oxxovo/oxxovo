# GT21 Verification — Agent 4 (GT14, GT15, GT16, GT17, GT18) — 2026-09-09

Method: `ffprobe` for duration/streams, `ffmpeg -af volumedetect` for audio content check,
scdet (`select='gt(scene,0.08)'`) for cut detection, and dense frame extraction
(`fps` sweeps + targeted high-fps windows around splice points) read visually frame-by-frame.
Narrowed category boundaries from the task brief applied throughout (motion vs anatomy,
lighting vs objectConsistency, otherArtifacts vs background, continuity vs cut-absence).

## ★★ Most important cross-cutting finding: the universal AV=NEGATIVE rule is FALSE for all 5 of my clips

The existing answer key documents (`v1_1_ground_truth_answer_key_21_2026-09-08.md` line 21-28,
and the `_gt21_answer_key_2026-09-09.ts` header) assert AV is NEGATIVE for **all 21 clips**
because "the harness only extracts frames, never encodes audio (`-an` throughout), confirmed
0 audio streams via ffprobe." I ran `ffprobe` on all 5 of my assigned clips and this is not
true for them:

| Clip | Audio stream? | `volumedetect` mean/max | Verdict |
|---|---|---|---|
| GT14_continuity1 | aac, 44.1kHz stereo | mean -13.9dB, max -0.0dB | **real audio content, not silence** |
| GT15_continuity2 | aac, 44.1kHz stereo | mean -14.2dB, max -0.0dB | **real audio content, not silence** |
| GT16_background1 | aac, 44.1kHz stereo | mean -31.7dB, max -13.1dB | **real audio content, not silence** |
| GT17_background2 | aac, 44.1kHz stereo | mean -15.8dB, max 0.0dB | **real audio content, not silence** |
| GT18_background3 | aac, 48kHz stereo | mean -13.9dB, max -2.4dB | **real audio content, not silence** |

For comparison I spot-checked GT19_anatomy_object1 (0 audio streams — matches the doc) and also
GT01/GT02/GT04/GT07 (all have an aac stream too). So the "universal NEGATIVE, guaranteed by
production method" claim appears to hold only for the GT19-21 batch (made in a separate,
later production pass), not the GT01-18 batch. Since real audio content exists on these 5
clips and I have no audio-listening capability, **AV is UNVERIFIED for all 5 of my clips**,
not NEGATIVE — marking it NEGATIVE the way the current answer key does would be recording an
unverified claim as verified. This same check should be re-run on GT01-13 before trusting the
"AV=NEGATIVE ×21" row in the summary table.

---

## GT14_continuity1 (`outputs/gt21/final/GT14_continuity1.mp4`, 15.0s, A19_sunrise)

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[구조]` no human ever appears — pure landscape across ~40 sampled frames | NEGATIVE `[구조]` no body/hands | UNVERIFIED — no discrete object/prop/clothing item to evaluate in landscape footage | UNVERIFIED — trajectory smoothness of clouds/fog/sun not specifically vetted beyond the splice itself | UNVERIFIED — see note below, oscillation found | UNVERIFIED — see note below, lens-flare pulsing found | **POSITIVE** `[설계+육안]` confirmed, precise timing: fog-filled valley between two dark ridges (0-3.3s) hard-jumps to a single snow-capped peak with the sun directly behind it (3.5s+) — genuinely different terrain (no fog river, different peak shape/snow texture), matching the documented "0:04, complete location change" | UNVERIFIED — see note below | UNVERIFIED — not separately checked | UNVERIFIED — real audio present (see cross-cutting finding above), cannot assess sync |

**Note (BG/LI/ED ambiguity):** dense re-sampling around and after the splice produced an
inconsistent pattern — some frames near 3.3-4.3s and again at 7.9-8.1s appear to toggle back
and forth between the "valley" and "peak" compositions at intervals too short for a deliberate
re-cut (e.g. 3.83s=peak, 4.0s=valley, 4.33s=peak). A second scdet-flagged cut also lands at
8.0s and independently shows the same valley→peak pattern recurring. This could mean either
(a) genuine additional background instability / multiple splice points beyond the single
documented 0:04 break, or (b) an artifact of my own fps-filter frame sampling combined with a
strongly pulsing lens-flare effect that makes "how much of the valley is visible" swing
frame-to-frame. I could not resolve which — flagging as genuinely ambiguous rather than
guessing. **Recommend a director-level re-check with a dense uniform frame dump (not filter-based
resampling) before scoring BG/LI/ED on this clip.**

`GT14_continuity1: row(N, N, U, U, U, U, P, U, U, U)`

---

## GT15_continuity2 (`outputs/gt21/final/GT15_continuity2.mp4`, 15.0s, A17_vista+A10_drift)

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[구조]` no human face across ~30 sampled frames (aerial vista + car/wheel shots) | NEGATIVE `[구조]` no body/hands | UNVERIFIED — car body/wheels not exhaustively checked for deformation | UNVERIFIED — not specifically assessed | UNVERIFIED — neither segment's background was densely swept for warping | UNVERIFIED — not specifically assessed | **POSITIVE** `[설계+육안]` confirmed, precise timing: hard cut from aerial coastal-mountain footage ("Take us on a journey") to an unrelated night-time car burnout ("Motion is emotion.") between 6.17s and 6.33s — earlier than the documented "0:07" by ~0.7-0.8s but the same designed defect, completely different subject/location/text-card | UNVERIFIED — the main splice itself is a clean hard cut (no dissolve/glitch), but the car segment appears to contain further internal cuts of its own (a street-driving shot at ~7s reverts to a tight wheel-burnout close-up at ~8s) that I did not fully vet for jarring artifacts | UNVERIFIED — not separately assessed | UNVERIFIED — real audio present (see cross-cutting finding), cannot assess sync |

`GT15_continuity2: row(N, N, U, U, U, U, P, U, U, U)`

---

## GT16_background1 (`outputs/gt21/final/GT16_background1.mp4`, 5.04s, demo_ichar)

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[육안]` same woman (red hair, green eyes, freckles) consistently identifiable across all 12 sampled frames spanning both background states, no identity drift | UNVERIFIED — only bust/shoulders in frame, no hands/limbs to assess | **POSITIVE** `[육안, moderate confidence]` the shoulder patch/insignia on her jacket appears to change shape/orientation/legibility between the beige-wall frames and the corridor frames — flagged with a resolution/confidence caveat, worth a zoomed re-check | UNVERIFIED — mostly static portrait, not specifically assessed | **POSITIVE** `[설계+육안]` confirmed with precise timing: plain beige interior wall (0-2.1s) morphs into a sci-fi spaceship corridor with blue neon lighting and a door/signage (2.5s onward through end at 5.03s) — matches the documented "3-vendor-agreed" background instability | **POSITIVE** `[육안, new finding]` the character's face/hair lighting never updates to the new blue-neon corridor environment behind her — she stays lit as if still in the original neutral/warm room, an environment-lighting mismatch not previously logged | UNVERIFIED — this environment swap could arguably also read as continuity (unexplained location jump); per the task's instruction not to double-count the same phenomenon under BG and CO, I left CO UNVERIFIED rather than also marking POSITIVE — flagging as a boundary case for HQ to decide which axis owns it | NEGATIVE `[육안+scdet]` scdet found 0 cuts; my sampling confirms a continuous morph/warp, not a hard cut — no jarring/broken transition | NEGATIVE `[육안]` checked jacket fabric, hair, wall/corridor textures across all 12 frames for artifacts beyond what's already logged under BG/OC — found nothing additional | UNVERIFIED — real audio present (see cross-cutting finding), cannot assess sync |

`GT16_background1: row(N, U, P, U, P, P, U, N, N, U)`

---

## GT17_background2 (`outputs/gt21/final/GT17_background2.mp4`, 15.0s, A09_race trim)

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[구조]` no human/driver visible in any of ~15 sampled frames (car exterior/interior dark) | NEGATIVE `[구조]` no body/hands | UNVERIFIED — car body/wheels not exhaustively checked | UNVERIFIED — heavy motion blur throughout makes trajectory smoothness hard to judge from stills | POSITIVE `[육안, carried over]` corroborates the existing designed finding — buildings/neon signage show geometric warping/smearing beyond ordinary motion blur in multiple frames (e.g. the top-down drift frame, the wide-angle close frame); genuinely hard to fully separate stylistic motion blur from AI instability at this resolution, noted as a caveat | UNVERIFIED — not separately assessed from BG | UNVERIFIED — single continuous drift sequence, no additional splice found, but not a dedicated continuity sweep | UNVERIFIED — scdet found many high-frequency hits consistent with extreme camera motion; did not confirm whether any are genuine jarring edits vs. motion-triggered false positives | UNVERIFIED — not separately assessed | UNVERIFIED — real audio present (see cross-cutting finding), cannot assess sync |

`GT17_background2: row(N, N, U, U, P, U, U, U, U, U)`

---

## GT18_background3 (`outputs/gt21/final/GT18_background3.mp4`, 18.0s, tk_render_1 trim)

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[구조]` no human present anywhere in ~35 sampled frames (aerial cyberpunk cityscape + a stylized winged light-figure, not a human) | NEGATIVE `[구조]` no human body/hands | UNVERIFIED — not specifically assessed | UNVERIFIED — extreme motion blur throughout, hard to judge trajectory from stills | POSITIVE `[육안, carried over]` corroborates the existing designed finding — buildings/cityscape show geometric distortion/streaking beyond plain motion blur in multiple frames | UNVERIFIED — not specifically assessed | UNVERIFIED — see note below, additional finding worth flagging | UNVERIFIED — scdet found several cuts (0.08s, ~6.04-6.08s, ~7.4-7.56s, ~11.24s, ~12.04s); did not confirm jarring/broken vs. clean scene cuts within the source montage | UNVERIFIED — not specifically assessed | UNVERIFIED — real audio present (see cross-cutting finding), cannot assess sync |

**Note (CO):** the clip ends (~15.6s+) with an abrupt tonal/content shift from a fast aerial
flythrough (city + background flying ships) to a static "arrival" shot of a giant glowing
winged humanoid figure/statue over a plaza. This reads as a plausible intentional "reveal"
moment for a promo video (arriving at a landmark) rather than a defect, but it is a dramatic,
unexplained subject/pace change I could not fully contextualize against the source footage's
intent — flagging as genuinely ambiguous rather than calling it either way.

`GT18_background3: row(N, N, U, U, P, U, U, U, U, U)`

---

## Summary of ambiguous/contradictory findings vs. existing answer key

1. **AV universal-NEGATIVE claim is false for all 5 of my clips** (see top section) — all have
   real, non-silent audio tracks per `ffprobe`/`volumedetect`. Changed AV from the existing
   key's implicit NEGATIVE-by-default expectation to UNVERIFIED for all 5. This likely also
   affects GT01-13 (I spot-checked GT01/02/04/07 and found audio streams there too) — worth a
   full re-audit before trusting the "AV=21/21 NEGATIVE" line in the category summary table.
2. **GT14 continuity**: my re-sampling around the documented 0:04 break shows a pattern that
   doesn't cleanly resolve into one one-way cut — frames toggle between "valley" and "peak"
   compositions at sub-second intervals in a couple of spots, and there's a second
   scdet-flagged cut at 8.0s showing the same pattern. I kept CO as POSITIVE (the core defect
   is real and clearly observed) but left BG/LI/ED UNVERIFIED rather than guessing whether this
   is additional instability or a sampling artifact on my end — recommend a director-level
   re-check with uniform (non-filter-based) frame extraction.
3. **GT15 continuity timing**: the existing key/design note says the splice is at "0:07"; my
   frame-accurate check pins it at 6.17-6.33s, about 0.7-0.8s earlier. Same defect, just a
   timing correction.
4. **GT16 objectConsistency + lighting**: two findings not in the existing key (which only has
   BG=POSITIVE, everything else UNVERIFIED) — the shoulder patch appears to change between the
   two background states (OC, moderate confidence, low-res caveat), and the character's face
   lighting never adapts to the new blue-neon corridor backdrop (LI, new finding). Both are
   additive, not contradictions.
5. **GT16 continuity vs background boundary**: the wall→corridor environment swap could
   arguably be scored as continuity (unexplained location change) rather than pure background
   instability. Per the task's narrowed-boundary instruction I attributed it to BG only and
   left CO UNVERIFIED to avoid double-counting, but this is a judgment call HQ may want to
   confirm.
6. **GT18 ending**: the appearance of a giant winged light-figure at the very end of the clip
   is a striking, previously unlogged element — most likely intentional promo content (a
   landmark reveal) rather than a defect, but flagged as unresolved rather than assumed benign.

## Files referenced
- `outputs/gt21/final/GT14_continuity1.mp4`, `GT15_continuity2.mp4`, `GT16_background1.mp4`,
  `GT17_background2.mp4`, `GT18_background3.mp4`
- `reports/v1_1_ground_truth_answer_key_21_2026-09-08.md` (read only, not edited)
- `C:\Users\Tom\oxxovo-scoring\_gt21_answer_key_2026-09-09.ts` (read only, not edited)
- `C:\Users\Tom\oxxovo-scoring\_new_rubric_prompt_2026-09-09_structured_v1_2.ts` (read only, not edited)
