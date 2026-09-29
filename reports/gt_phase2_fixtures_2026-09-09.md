# Phase 2 GT fixtures — new POSITIVE defect examples (2026-09-09)

Built with ffmpeg only, from existing raw footage in `outputs/gt21/src/`. No AI-generation
API calls, no cost. All outputs live under a new directory,
`outputs/gt21/phase2_fixtures/`, and nothing under `outputs/gt21/final/`, `outputs/gt21/src/`,
the GT21 answer key, the rubric prompt, or `scorer.ts` was touched. None of these 5 clips
are wired into any answer key yet — that's a separate follow-up step for whoever owns the
GT21 key file.

Priority order requested: anatomy > faceIdentity > objectConsistency > motion > lighting >
background. All five higher-priority categories got a fixture; background (Tier B, already
at 3/4-5, lowest priority) was skipped as instructed.

Category definitions used (verbatim from `_new_rubric_prompt_2026-09-09_structured_v1_2.ts`,
which v1.3 reuses unchanged for these 8 keys):
- **anatomy**: "Hands, limbs, or body proportions are malformed, extra, missing, or physically impossible."
- **faceIdentity**: "A person's face or identity appears different from earlier in the clip."
- **objectConsistency**: "An object, prop, product, or clothing item unexpectedly deforms, disappears, or changes between shots."
- **motion**: "Movement collapses, freezes, or becomes physically unnatural."
- **lighting**: "Lighting or shadows are inconsistent within or across shots."

---

## 1. `anatomy_finger_ghost_seedance1.mp4` — anatomy

- **Source**: `seedance_1.mp4` (Lumia hand-cream ad), t=6.0–8.2s, cropped to a
  500x600 hand/cheek region (`crop=500:600:100:250`) — a close-up of a finger repeatedly
  dabbing cream onto a cheek. Not one of the 15 flagged CLEAN-ALL sources, not previously
  used in the frozen GT21 set.
- **Construction**: raw footage has clean, normal hands throughout — ffmpeg splicing alone
  cannot invent a deformed hand that isn't already there, per the brief. So this is the
  "next best" ffmpeg-only technique: `split` the clip into two copies, time-shift one copy
  by 0.4s (`trim=start=0.4`), and `blend=all_mode=average` them back together. Wherever the
  frame is static (skin, background) the two copies are identical and the average is a
  no-op; wherever something moved during that 0.4s window (only the finger), the two finger
  positions overlap and average into a translucent double-exposure — extra/duplicated
  fingertip and nail contours, i.e. a rendered geometry defect isolated to the hand, exactly
  as the brief suggested ("isolates a hands-only sequence... construct a segment where a
  body-part rendering issue is visible").
- **My verification**: extracted a contact sheet of the output at 8fps. Frames around
  t≈1.2–1.5s of the output clearly show two overlapping fingernail edges / duplicated
  finger-tip silhouettes at once (a "too many finger contours" look), while the cheek/skin
  behind stays sharp and unaffected — confirming the ghosting artifact is localized to the
  moving hand, not a global blur.
- **Designed around the phenomenon, not a judge**: I picked this construction because it
  directly instantiates "malformed/extra... physically impossible" hand geometry as a
  rendering artifact, using the same physical mechanism (motion-domain ghosting) that
  produces extra/blurred digits in real AI video generators. No judge-model behavior
  informed the choice.
- **Confidence it shows the defect**: medium-high. It's a clean, unambiguous double-exposure
  on the hand only; it reads less like "two fingers frozen in place" and more like a
  motion-smear anomaly, which is a fair, conservative characterization of what's on screen.

## 2. `faceidentity_dancer_swap_a15rhythm.mp4` — faceIdentity

- **Source**: `A15_rhythm.mp4` ("Feel the rhythm" dance ad), t=4.5–10.0s (native trim, no
  re-encoding of content beyond the container). Explicitly flagged by the earlier review
  pass as containing a real subject swap, so it was pre-vetted raw material.
- **What's there**: the raw source itself contains a hard cut at ≈t=7.2–7.3s from a
  dark-skinned dancer in a green crop top/braids to a different, light-skinned dancer with
  pink/blonde hair in a white sequined top — mid-routine, under the same "Feel the rhythm."
  caption card, same neon-lit dance-stage color grade (magenta/blue), same high-energy
  hair-whip choreography beat. I did not fabricate a new splice; I trimmed a window around
  the source's own existing cut so the swap is isolated and unambiguous.
- **Why this avoids today's flagged trap**: the earlier failure mode was clips that "cut to
  an unrelated ad shot of a different person" or had "no second face to even compare
  against" — read by a blind reviewer as ordinary multi-shot montage with zero defect. Here
  there IS a second face to compare (both dancers are clearly on screen, front-facing,
  well-lit), and both halves share the same caption text, same song/theme, same color
  palette and same club-lighting setup, so a viewer's expectation (per the brief's fallback
  guidance: "share enough context... that a viewer would expect the person to be the same")
  is that this is one dancer's routine shot across cuts — not a jump to a different ad.
  I could not achieve a true same-continuous-take swap (no source had that); this is the
  explicitly sanctioned fallback.
- **My verification**: frame-by-frame sweep at t=6.3–7.6s (12fps) pinned the cut to
  t≈7.22–7.3s exactly; frames immediately before and after both show full, comparable,
  front-on faces under matching color grade and the same on-screen caption.
- **Caveat I want on record**: the lighting rig visibly differs either side of the cut
  (neon tube poles + floor visible before; diagonal blue beams, tighter crop, no floor
  after), and the motion energy doesn't match across the cut (calm pose before vs.
  mid-hair-whip after) — so a sufficiently skeptical reviewer could still call this an
  intentional shot change rather than a defect. I flagged this rather than hide it.
- **Confidence it shows the defect**: medium. Best available material in the approved
  pool for this category; better than the previously-invalidated splices, but not a
  slam-dunk same-take swap.

## 3. `objectconsistency_logo_dropout_seedance1.mp4` — objectConsistency

- **Source**: `seedance_1.mp4`, t=3.0–4.6s — a locked-off tripod product shot of the LUMIA
  jar with a finger descending into the cream. Confirmed camera-locked via a pixel diff
  between two frames in this window (background/jar pixels showed zero difference except
  where the hand itself moved), so the printed "LUMIA" wordmark on the jar sits at an
  identical fixed pixel location the whole time.
- **Construction**: cropped the label region (`crop=400:140:170:985`), applied a heavy
  `boxblur=18:18` to that crop only, then `overlay`ed the blurred version back on top of the
  original at the same coordinates, gated to `enable='between(t,0.5,1.1)'`. Result: the
  crisp printed product label melts into an illegible blur for ~0.6s, then sharpens back to
  normal, while the hand, cream, jar rim and background stay fully sharp and continuous the
  entire time.
- **Why this fits the brief's guidance**: it's exactly "a specific tracked object (not the
  whole scene)" — here, the branded product label/wordmark — deforming while everything else
  in an otherwise-continuous single locked shot stays visually stable. It also matches the
  category definition's explicit "product... unexpectedly deforms" wording.
- **My verification**: contact sheet at 10fps across the full clip shows sharp "LUMIA" text
  in the first ~0.5s, a visibly blurred/illegible smear in the middle ~0.6s, and sharp text
  again afterward, with the finger's independent downward motion into the cream completely
  unaffected/uninterrupted throughout.
- **Confidence it shows the defect**: high. Clean, localized, unambiguous — the only thing
  that changes is the one tracked object; nothing else in the frame is touched.

## 4. `motion_freeze_astronaut_democonsistency.mp4` — motion

- **Source**: `demo_consistency.mp4` (astronaut walking across dunes at sunset), t=8.0–11.0s
  — a steady walk cycle with clear leg articulation, arm sway and moving dust/light rays.
- **Construction**: replicated the existing successful GT07/08/09 freeze-frame pattern on
  new, previously-unused source footage. 1.0s of normal walking, then the frame at t=9.0s is
  held static for 1.0s (29 duplicate frames via `loop`), then normal walking resumes from
  where it paused (2.0s more). Whole-frame freeze (not just the actor), matching the
  successful GT07-09 approach.
- **My verification**: pixel-diffed two frames sampled inside the claimed frozen window
  (output t=1.2s vs t=1.8s) — the difference image is flat, uniform, zero-signal, confirming
  the frames are bit-identical (a true freeze). As a control, I diffed two frames from the
  pre-freeze window (t=0.2s vs t=0.8s) using the same method — that diff clearly shows the
  astronaut's silhouette edges (real motion), proving the diff method itself is sensitive
  and the frozen-window result isn't a false negative.
- **Designed around the phenomenon**: this is a literal "motion collapse... frozen motion"
  per the category definition — the simplest, least ambiguous possible instance of the
  category, applied to fresh unused footage rather than reusing GT07-09's source.
- **Confidence it shows the defect**: high. Verified via pixel diff, not just eyeballing.

## 5. `lighting_stray_flash_gichar2.mp4` — lighting

- **Source**: `g_ichar2.mp4` (character portrait reel, static-ish frontal shot, flat
  even ambient lighting, plain gray backdrop), t=0.0–1.6s.
- **Note on the raw footage**: this source does contain a *natural* anomaly later in the
  clip — a real stray red/magenta flash washes across her face around t≈3.4s. I inspected it
  closely (fine frame sweep) and decided **not** to use it: the wall behind her also picks
  up a matching red bleed at the same moment, which reads as a deliberate colored-gel mood
  cue/transition effect in the showreel rather than an unmotivated rendering inconsistency —
  exactly the kind of "could be read as intentional" ambiguity the brief warns about. I
  didn't want to ship an ambiguous natural example for the same reason the earlier
  face/continuity splices got invalidated.
- **Construction instead**: a controlled, honest synthetic injection of the literal defect
  phenomenon. Cropped a fixed 380x480 region over her forehead/eye (`crop=380:480:280:120`),
  pushed it hard toward red via `colorchannelmixer` (boosted red gain, suppressed green/blue)
  plus a slight `eq` brightness/saturation lift, then `overlay`ed that tinted crop back onto
  the original at the same coordinates, gated to `enable='between(t,0.6,1.1)'`. A solid-red
  patch appears on part of her face for ~0.5s with no visible motivating light source (no
  practical light, no reflection surface, no color-matched bleed onto the neutral backdrop
  next to her), then disappears — while the ambient lighting on the rest of her face, the
  jacket, and the wall stays completely unchanged throughout.
  - Build note: an earlier attempt using ffmpeg's `blend=all_mode=screen`/`addition` against
    a synthetic black canvas produced a full-frame magenta wash instead of a localized glow
    (confirmed via an isolated test that the pre-blend "glow" layer was correctly localized,
    so the bug was specifically in combining it via `blend`); switched to the same
    proven crop+color-grade+`overlay` recipe used for fixture 3, which behaved correctly.
- **My verification**: contact sheet at 8fps shows a clean, sharp-edged red patch appearing
  over 3–4 consecutive frames then fully disappearing; every other frame, and the entire
  rest of the frame (background wall, jacket, other side of the face) throughout, is
  untouched.
- **Caveat I want on record**: the patch has a hard rectangular edge rather than a soft
  falloff (an alpha-feathering attempt via boxblur-on-alpha didn't render correctly in the
  time available, so I kept the simpler, verified-working hard-edged version). I'd call this
  a feature more than a bug for unambiguity — a perfect rectangle of red light is even less
  plausible as an intentional practical light than a soft glow would be — but it does look
  more like a graphic overlay than a naturalistic light source, so flagging it rather than
  overselling the realism.
- **Confidence it shows the defect**: high on "is this an inconsistent-lighting instance" as
  literally defined; medium-high on "does it look like a natural light source" (edge
  softness would improve this if revisited).

---

## Design-around-phenomenon confirmation

For all 5 fixtures: the category/defect to build was chosen and the exact technique for
each was decided by asking "what is the physical/rendering phenomenon this category
describes, and how do I make ffmpeg produce (or isolate a source example of) that specific
phenomenon" — never by asking "what would a judge model plausibly miss." No information
about how Claude/Gemini/GPT score these clips fed into any decision above; the two
techniques used (motion-domain ghost-blend for anatomy/hand geometry, and localized
crop+overlay for a tracked object/light region) are generic, phenomenon-first constructions
that would apply identically regardless of which model(s) end up judging them.

## Sources touched vs. avoided

Used: `seedance_1.mp4` (2 fixtures, different segments/regions — anatomy hand crop at
t=6.0–8.2s, object label crop at t=3.0–4.6s), `A15_rhythm.mp4`, `demo_consistency.mp4`,
`g_ichar2.mp4`. None of these are in the 15-item CLEAN-ALL list. None of these segments/
timestamps overlap with any already-used-in-final-GT source. `g_ichar3.mp4`, `A04_morph.mp4`,
`A14_solo.mp4`, `demo_duel.mp4`, `demo_sf.mp4`, `g_sfx_a.mp4`, `g_sfx_c.mp4`,
`cf_06_noira_premium.mp4`, `tk_render_2.mp4`, `g_astro_single.mp4` were inspected as
candidates but not used — either the natural anomaly they contained turned out on close
inspection not to exist (e.g. the g_ichar2/g_ichar3 jacket patch, which I initially
suspected of "appearing" mid-shot but a fine-grained frame sweep showed it present in every
frame from t=0 — a camera-angle reveal, not an object-consistency defect), or the content
was too stylized/ambiguous (VFX action clips, "infinite looks" transformation reel) to yield
a clean, unambiguous positive within the time budget.
