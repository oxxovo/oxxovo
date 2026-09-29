# GT Verification — Agent 3 (GT10-13) — 2026-09-09

Assigned clips: GT10_lighting1, GT11_lighting2, GT12_editing1, GT13_editing2.
Method: `ffprobe` (duration/streams), `ffmpeg` scdet(0.08) scan, dense + evenly-spaced
frame extraction (visually inspected via Read), plus audio waveform/spectrogram/
volumedetect/silencedetect inspection where an audio stream existed.

## ★★ Headline finding — the "AV universal NEGATIVE" premise is FALSE for 3 of my 4 clips

The existing answer key's universal rule states: *"harness only extracts frames and
never creates an audio track (all encoded with `-an`), verifiable via ffprobe showing
0 audio streams)"* → AV=NEGATIVE `[제작]` for all 21 clips.

`ffprobe` on my 4 assigned clips:

| clip | video | audio |
|---|---|---|
| GT10_lighting1 | h264 | **aac, 44100Hz, stereo, present** |
| GT11_lighting2 | h264 | **none (0 audio streams)** — matches the universal rule |
| GT12_editing1 | h264 | **aac, 44100Hz, stereo, present** |
| GT13_editing2 | h264 | **aac, 44100Hz, stereo, present** |

So 3 of my 4 clips (GT10/12/13) actually DO carry a real AAC audio track — the
"all `-an`" claim in the existing document does not hold universally. This is not
a hypothetical: `volumedetect` on GT10 gives `mean_volume: -12.8dB, max_volume: 0.0dB`
— real, audible content, not silence padding. `silencedetect` (noise=-30dB, d=0.3)
found **zero silence gaps** in any of the three.

I did not just fall back to UNVERIFIED — I inspected the actual audio (waveform +
spectrogram images, `references/audio/*_wave.png` and `*_spec.png` in my scratch
dir) for all three:
- GT10 and GT13 waveforms show a steady, evenly-spaced rhythmic pulse (kick-drum-like
  loop) — classic generic non-diegetic stock background music, not diegetic sound
  effects tied to on-screen events.
- GT12's waveform is a slow-building rising texture (quiet start, energy increasing
  toward the end) — also reads as a generic music bed / rising tension cue, not
  discrete diegetic sound (no honks, engine revs, etc. tied to specific visual beats).
- Spectrograms for all three show continuous, unbroken frequency content straight
  through every hard cut / designed defect point (GT10's 8.0s cut, GT12's 5.0s cut,
  GT13's 3.0/6.0/11.0s cuts) — no dropout, no glitch, no discontinuity in the audio
  itself at the video edit points.

Conclusion I'm landing on: AV=**NEGATIVE** for GT10/12/13, but via `[육안]` (I actually
listened/inspected), not `[제작]` (the production guarantee is false for these three).
The reasoning for NEGATIVE: the audio is generic non-diegetic music with no discrete,
on-screen-event-linked content, so there is nothing for the visuals to "mismatch"
against, and the track itself never glitches/drops at the cut points. **This should
be corrected in the machine-readable answer key's evidence tag for GT10/GT12/GT13's
AV cell — do not leave it tagged `[제작]`,** and whoever verifies the other 17 clips
should re-run `ffprobe -show_streams` per clip rather than trusting the universal
claim, since it's already falsified for 3/21.

## ★★ Second finding — GT10 has an ORGANIC (undesigned) editing+continuity defect exactly at the designed lighting cut point

Design intent for GT10 was: single continuous A16_crowd shot, [0:8) untouched,
[8:15) with a color-temperature filter applied — i.e. one continuous scene, only
the color grading changes at 0:08.

What the frames actually show: at t=7.83s the frame is still the "4-person wide
crowd shot" (yellow top / pink top / orange-print man), and at t=8.00s (one frame
later, still within the same 0.17s dense-sampling window) the frame is a
**completely different scene** — a solo woman in a floral dress with flower hair
clips and hoop earrings, medium-close framing, different lighting rig, no crossfade,
no camera-move bridge. This is not merely a color-temperature shift; the underlying
A16_crowd source itself has an internal, unplanned hard scene-cut baked in at ~8s,
independent of the color-temp filter the test harness applied there. This is the
same class of surprise as GT11's precedent (source footage carrying an unplanned
defect beyond the single designed one).

This exact same pair of "sub-scenes" inside A16_crowd (group-of-4 wide shot /
solo-floral-woman close-up) is also what GT13's 4-segment re-edit deliberately
cuts between — confirming both GT10 and GT13 draw on the same 2-shot A16_crowd
source material.

Consequence: GT10 gets an *additional* organic editing POSITIVE and continuity
POSITIVE beyond its single designed lighting defect — same pattern as GT11 had
with the source's face-swap.

---

## GT10_lighting1 — A16_crowd[0:8) + color-temp shift[8:15)

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[육안]` Each tracked face keeps its own identity within its own shot: foreground crowd woman (yellow top) consistent across 0–7.83s frames; solo floral-dress woman consistent across 8–14s frames. The hard cut introduces a *new* person, but that's a scene/edit change, not drift of a tracked individual's face. | UNVERIFIED Fast crowd motion (arm-waving, clapping, confetti) blurs finger-level detail in every sampled frame; no gross deformity (extra/missing limbs) seen, but I did not do a dedicated zoomed hand-by-hand pass, so I can't certify absence at the fine-grained level the existing GT19-21 standard used. | NEGATIVE `[육안]` Clothing/props (yellow top, orange tie-dye tank, pink top, floral dress, hoop earrings, flower hair clips) stay stable and undeformed within each shot across 15 general + 7 dense frames. | NEGATIVE `[육안]` Arm-raising/clapping motion across both shots is physically plausible; no freeze-frame, no impossible trajectory. | NEGATIVE `[육안]` Stage lights/confetti/background screens stable, no warping/flicker observed within either shot across sampled frames. | POSITIVE `[설계]` 0:08 warm→cool shift (pre-existing, confirmed). | **POSITIVE `[육안]` NEW finding.** 7.83s→8.00s: hard jump from the 4-person wide crowd shot to a solo different woman in a totally different framing/location, no narrative bridge — genuine spatial/narrative discontinuity, additional to the designed lighting defect. | **POSITIVE `[육안]` NEW finding.** Same 7.83→8.00s point: zero-transition hard cut (no crossfade, no camera-move bridge) — qualifies as an editing/transition defect independent of the designed color-temp change. | NEGATIVE `[육안]` No flicker/warping texture artifacts beyond what's already captured under LI/CO/ED. | **NEGATIVE `[육안]`** ★NOT `[제작]` — see headline finding. Real AAC audio present (44.1kHz stereo, mean -12.8dB); generic rhythmic non-diegetic music, continuous/unbroken through the 8.0s cut (spectrogram confirmed, no dropout), no diegetic sound events to mismatch against. |

`GT10_lighting1: row(N, U, N, N, N, P, P, P, N, N)`

## GT11_lighting2 — A12_mech[0:15), color-temp@8 (filling OC/MO/BG/OA only; other cells unchanged from existing key)

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[구조]` (existing, unchanged) | NEGATIVE `[구조]` (existing, unchanged) | NEGATIVE `[육안]` Piston/gear/metal surfaces keep consistent shape, teeth count, and reflectivity across the whole continuous macro dolly-in (15 sampled frames spanning 0–14s); no morphing or deformation. | NEGATIVE `[육안]` Camera push-in / mechanical-part relationships are smooth and physically continuous throughout; no freeze-frame, no impossible motion. | NEGATIVE `[육안]` Out-of-focus rear machinery elements remain stable across all sampled frames, no warping/flicker. | POSITIVE `[설계+육안]` (existing, unchanged) | NEGATIVE `[육안]` (existing, unchanged) | NEGATIVE `[육안]` (existing, unchanged) | NEGATIVE `[육안]` No flicker/moiré on the blue-anodized metal or chrome piston surfaces across sampled frames. | NEGATIVE `[제작]` (existing, unchanged — **confirmed correct**: ffprobe shows 0 audio streams for this clip, unlike GT10/12/13). |

`GT11_lighting2: row(N, N, N, N, N, P, N, N, N, N)`

(Only OC/MO/BG/OA newly resolved here; FI/AN/LI/CO/ED/AV were already correct in
the existing key and I did not need to touch them. Confirmed GT11 is the one clip
of my four where the audio-absence premise genuinely holds.)

## GT12_editing1 — A11_night[0:5)+[10:13) forced splice

Precise frame-timing note: my first pass (2fps `fps=` filter numbering) briefly
mislabeled where the cut was — I recomputed everything with `-ss <exact-time> -frames:v 1`
extraction at 0.5s steps from 0.1s–7.9s to pin it down properly. Result: the last
frame still showing the pre-cut "driving under a teal overhead bridge" composition
is at **t≈4.83–4.9s**; the first frame of the close-up purple-lit profile shot is at
**t=5.0s** — the cut lands almost exactly on the designed 0:05 mark. Within [0,5) the
scene evolves continuously (open street → passing under an illuminated overpass),
which is normal continuous camera/subject movement, not a second hidden cut.

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[구조]` No discernible human face visible in any sampled frame (0–8s) — this is a pure car-exterior chase shot; the driver is invisible behind dark/rain-speckled, reflective glass in every frame. | NEGATIVE `[구조]` No visible hands/limbs/body anywhere in the clip (exterior car shot only). | NEGATIVE `[육안]` Car body shape, mirror, door-vent lines, and paint stay consistent in both segments (0–5s wide chase / 5–8s close profile) despite the cut — no object deformation of the car itself. | NEGATIVE `[육안]` No freeze-frame or physically impossible motion in either segment; camera/car movement plausible throughout. | NEGATIVE `[육안]` Buildings/billboard geometry stable in both segments (billboard text is soft/illegible but that reads as ordinary depth-of-field blur, not warping/flicker). | NEGATIVE `[육안]` No jarring *intra-shot* lighting inconsistency: segment 1's teal/white neon and segment 2's purple/pink neon are each internally stable across their own frames; the color difference between segments is attributable to the cut to a different physical location/moment (already captured under ED), not a lighting defect. | **UNVERIFIED** — Genuinely ambiguous: I cannot tell from the visuals alone whether segment 2 (close-up, purple lighting) is spatially continuous with segment 1's street (car simply seen closer up, same continuing drive) or a discontinuous jump to an unrelated moment/location. The design intent (`A11_night[0:5)+[10:13)`, same source, 5s later) suggests it's plausibly still the same drive, but I have no independent visual anchor (no shared landmark) to confirm. | POSITIVE `[설계]` (existing, confirmed with precise timing — see note above). | NEGATIVE `[육안]` No flicker/moiré on car paint, rain droplets, or wet-road reflections across sampled frames. | **NEGATIVE `[육안]`** ★NOT `[제작]` — see headline finding. Real AAC audio present; generic rising-energy music bed, no diegetic engine/tire sound events to check for mismatch, continuous through the 5.0s cut per spectrogram (energy actually swells right around 4.8–5.3s, consistent with a music cue timed to the edit, not a glitch). |

`GT12_editing1: row(N, N, N, N, N, N, U, P, N, N)`

## GT13_editing2 — A16_crowd 4-segment re-edit

Confirmed all 3 designed cut points precisely via dense frame sampling:
- **~2.8–2.97s**: group-of-4 wide confetti shot → solo floral-dress woman (matches "0:03")
- **~5.97–6.1s**: solo floral-dress woman → group-of-4 wide confetti shot (matches "0:06")
- **~10.7–11.1s**: group-of-4 wide confetti shot → solo floral-dress woman (matches "0:11")
- Segment 4 (11–18s) stays on the solo-woman scene through to the end (checked f_13/f_17 at t=12/16).

This confirms GT13 is built from the *same two sub-scenes* inside A16_crowd that
GT10 revealed (group-of-4 wide shot / solo-floral-woman close-up) — GT13 just
deliberately re-sequences/re-cuts between them. No extra, undesigned cuts were
found beyond the 3 designed ones in my sampling.

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[육안]` Each tracked individual (group-of-4's foreground woman, solo floral woman) keeps her own identity consistently within her own shot segments across the whole 18s; cuts introduce a *different* person/scene, which is an editing/continuity matter, not identity drift of one tracked face. | UNVERIFIED Same motion-blur caveat as GT10 — fast crowd arm-waving obscures finger-level detail; no gross deformity seen but no dedicated zoomed-hand pass performed. | NEGATIVE `[육안]` Clothing/hair accessories (yellow top, floral dress, flower clips, hoop earrings) stay stable and undeformed within each shot segment across all sampled frames. | NEGATIVE `[육안]` Crowd motion physically plausible in all segments; no freeze-frame or impossible trajectory. | NEGATIVE `[육안]` Stage lighting/confetti/background stable within each shot segment, no warping. | NEGATIVE `[육안]` No jarring *intra-shot* lighting inconsistency; color/grading differences occur exactly at the (already-captured) cut points between the two different sub-scenes, not mid-shot. | **POSITIVE `[육안]` NEW finding, beyond the designed editing-only defect.** The video repeatedly alternates between two unrelated scenes/subjects (group-of-4 vs. solo woman) with zero narrative bridge, 3 times over 18s — genuine spatial/narrative discontinuity ("does the scene make logical sense across time" fails), not just cut mechanics. | POSITIVE `[설계]` (existing, confirmed — all 3 cut points precisely located, see above). | NEGATIVE `[육안]` No flicker/texture artifacts beyond what's already captured. | **NEGATIVE `[육안]`** ★NOT `[제작]` — see headline finding. Real AAC audio present; same rhythmic generic-music-bed profile as GT10, continuous/unbroken through all 3 cut points (spectrogram: unbroken vertical banding across 0–18s, no dropout at 3s/6s/11s). |

`GT13_editing2: row(N, U, N, N, N, N, P, P, N, N)`

---

## 3. Ambiguities / contradictions vs. the existing answer key

1. **AV evidence tag is wrong for GT10/GT12/GT13.** The existing key tags AV=NEGATIVE
   `[제작]` (production-guaranteed, "all clips encoded with `-an`, 0 audio streams")
   for all 21 clips. `ffprobe` shows GT10, GT12, and GT13 all carry a real AAC
   44.1kHz stereo audio track with actual signal (`mean_volume: -12.8dB` on GT10,
   confirmed non-silent, no silence gaps on any of the three). The *value* NEGATIVE
   still holds after I inspected the audio content (generic background music, no
   diegetic content to mismatch, no glitches at cut points), but the *evidence tag*
   must change from `[제작]` to `[육안]` for these three, and the universal-rule
   paragraph in the markdown doc should be corrected to say "20 of 21 clips" or
   have someone re-verify all 21 individually rather than trusting one spot-check.
   Only GT11 (of my four) actually matches the "0 audio streams" claim.

2. **GT10 has an undesigned organic editing+continuity defect co-located with its
   designed lighting defect**, discovered because the source A16_crowd clip
   apparently contains an internal, unplanned hard scene-cut around 8s (different
   subject/framing entirely, not just a color-temp change). I've marked CO and ED
   both POSITIVE for GT10 with `[육안]` tags distinct from the existing LI `[설계]`
   cell — these are additive findings, not a replacement of the lighting POSITIVE.

3. **GT13's continuity is POSITIVE, not just editing.** The existing key only had
   ED=POSITIVE `[설계]` for GT13 with CO left UNVERIFIED. I'm marking CO=POSITIVE
   as well: the repeated alternation between two disconnected scenes with no
   narrative bridge (3 times) is a genuine spatial/narrative discontinuity distinct
   from the cut mechanics themselves, per the narrowed continuity definition given
   for this task. This is analogous to the GT19 precedent already in the doc
   (object-consistency failure independently reported as a continuity failure by
   judges) — here it's an editing-mechanics failure that also independently reads
   as a continuity failure.

4. **GT12's continuity is UNVERIFIED, not resolved either way** — I could not
   determine whether the two spliced segments (0–5s wide chase / 5–8s close-up)
   represent the same continuing drive (spatially continuous) or a discontinuous
   jump, since there's no shared landmark/anchor visible in both segments to check.
   Flagging this explicitly rather than guessing.

5. **Anatomy (AN) is UNVERIFIED for GT10 and GT13**, not resolved to NEGATIVE,
   because the crowd scenes have enough motion blur on hands/arms that I could not
   do the same fine-grained finger-count/shape check the existing answer key used
   for GT19–21 (9-frame close inspection). I did not see gross deformity, but I'm
   not certifying absence at that level of rigor, per the 3-state discipline.

No other contradictions found — GT11's already-confirmed cells (FI/AN/LI/CO/ED via
`[구조]`/`[설계+육안]`/`[육안]`) all held up under my own re-check of the frames I
sampled; I did not touch those cells.
