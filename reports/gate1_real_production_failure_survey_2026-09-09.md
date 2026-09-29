# Gate 1 — Bottom-Up Survey of Real Production Video Defects (2026-09-09)

## What this is

A read-only visual survey of 40 real AI-generated video clips already in use for OXXOVO
(promo videos, contestant-style entries, watch/demo submissions, and TK's own Studio
renders). For each clip: `ffprobe` for duration/resolution, then 8-10 frames extracted
with `ffmpeg` spread across the full duration and actually viewed. No predefined defect
category list was applied while looking — observations below are written in plain
language first; the taxonomy in Section 2 was built *after* looking at all 40, from
what was actually seen.

This is NOT scoring and NOT a benchmark test. It is meant to replace a prior
defect-detection benchmark that HQ shelved because its categories were invented before
looking at real footage and didn't hold up under blind review.

Source list: `reports/_gate1_mockprelim_urls_2026-09-09.json`. Groups Z01/Z02/Z03
(deliberately-broken synthetic QA fixtures) were excluded per instructions — not natural
production output. 40 clips surveyed: A (22, promo), CF (9, contestant-style "cf/v3"),
WD (7, watch/demo), TK (2, TK's own Studio renders). All 40 URLs resolved and all 40
frame sweeps completed — no failed clips.

Work was split across 4 parallel research passes (one per group-ish batch) to keep
per-clip viewing effort proportionate to a 40-clip survey; this document is the
synthesis of all four.

---

## 1. Per-clip log

### Group A — promo videos (22 clips, all 19.0s, 1080x1920, h264/aac/30fps unless noted)

**A01_fashion** — Runway compilation: model in pink feathered gown, hard cut to a
different model in silver sequined gown.
- Hard scene cut mid-clip to a completely different model/outfit/background with no
  transition — reads as a compilation of unrelated generations, not one continuous shot.
- Otherwise clean skin/fabric rendering, no hand/face/motion artifacts noticed.

**A01_fashion_fusion** — Same two runway models, then a very tight garment-detail close-up.
- Back-half close-up shows a bizarre magenta organic/vein-like lattice texture where
  fabric should be — an uncanny bio-organic pattern substituting for cloth.
- Same hard cut to an unrelated model/scene as A01_fashion.

**A01_fashion_wearable** — Model in metallic/holographic origami-style outfit, then a
magenta laser-cut/lattice garment close-up.
- Same ambiguous organic/vein-like close-up texture as fashion_fusion.
- Model's face renders as a nearly featureless flat matte-black mask (could be
  stylistic, but facial detail is essentially absent).

**A02_fabric** — Abstract silk/satin fabric draping in slow motion, no people.
- No obvious issues noticed.

**A03_street** — Two different models posing on a rain-slicked neon city street at night.
- Neon signage text is garbled/illegible gibberish in nearly every frame ("Buatkers
  Pran Ub", "MTANS", "SGSLHR").
- Graphic print on a t-shirt is a scrambled, indecipherable image.
- One model's eyes glow pink/red in close-up (possibly stylistic, reads unnatural).
- Hard cut between two unrelated models/scenes.

**A04_morph** — "Look transformation" showcase, model morphs through several outfits.
- One transition frame shows a clear blocky/pixelated digital-tearing glitch — face and
  torso break into rectangular chunks with visible seams mid-morph.
- Early frame: resting hand at hip looks blob-like, fingers not clearly separated.

**A05_plating** — Fine-dining plating: seared scallop dish, then a cut to an unrelated
second dish.
- Hard cut to an unrelated dish partway through (continuity/editorial note).
- Background steam/smoke has an oddly smooth, ribbon-like shape, not quite natural.
- No obvious food/hand rendering defects otherwise.

**A06_splash** — Red wine/juice poured in slow motion onto a reflective black surface.
- No obvious issues noticed. Minor: the specular highlight on the pouring stream stays
  unusually straight/static relative to the undulating liquid around it.

**A07_cooking** — Montage of what appears to be two distinct, unrelated chefs (different
builds/hairstyles/kitchens) doing wok flambés.
- Different chef identities cut together as if one continuous story — a
  character-consistency break if meant to be the same person.
- Fire, smoke, and pan-tossed food otherwise rendered convincingly.

**A08_dessert** — Fine-dining dessert compilation, two different plated desserts.
- No obvious issues noticed. Minor: a poured sauce stream starts abruptly mid-air with
  no visible vessel in frame (likely just tight cropping).

**A09_race** — Supercar drifting through a neon city street at night.
- Car model, body shape, wheel design, and paint color change from shot to shot —
  reads as several different vehicles rather than one car from different angles.
- During an extreme drift angle, the car body looks warped/melted with incoherent
  wheel-to-body proportions.
- Sparks in one shot float disconnected above the hood rather than originating from
  tire-road contact.

**A10_drift** — Single black car doing a burnout/drift on a rain-slicked street.
- Vehicle identity is consistent (unlike A09).
- Opening fast-pan frame shows the car body looking slightly geometrically distorted
  (hard to confirm through motion blur).
- Final close-up burnout shot is nearly static/frozen for a couple of seconds.

**A11_night** — Sports car driving through a neon rainy city, then a static close-up.
- Back half of the clip is a near-static close-up — car and background barely change
  across several seconds despite "chase" framing.
- Paint reflections show odd iridescent rainbow streaks not tied to any visible light
  source — reads like a liquid-metal color-bleed effect rather than real reflection.

**A12_mech** — Abstract macro close-ups of blue-toned mechanical engine parts.
- The mechanical assembly is not physically coherent: gear teeth interpenetrate/overlap
  rather than mesh, and a piston rod appears to plug directly into a gear surface with
  no crankshaft or bearing journal — mechanically impossible.
- Otherwise clean, sharp, no flicker or morphing within shots.

**A13_group** — Choreographed dance groups on stage (silver-jacket group, then a
male street-dance crew).
- Hard, unexplained cut between two different dance groups/venues/lighting.
- A bent-forward dancer's hand/fingers look elongated and slightly melted/smudged.
- A mid-air jumper has asymmetric limb shapes and hair that renders more like a red
  smear than physically flowing hair.

**A14_solo** — Solo dancer in silhouette against spotlight, then a second silhouette
scene at sunset.
- Raised hand's fingers look slightly elongated/thin in the sun-flare shot, though
  heavy backlight makes this hard to confirm.
- Otherwise clean — silhouette lighting conceals most fine detail.

**A15_rhythm** — Dancer amid neon light tubes, then a close-up of a different performer.
- First dancer's loose/flying hair renders as thin, messy, scribble-like strands more
  like digital noise than natural hair in motion.
- Hard cut to a different performer/setting.
- Second segment (close-up) looks clean.

**A16_crowd** — Festival crowd scenes, then a close-up of a woman laughing/dancing.
- Background crowd faces are indistinct/blurry (generic AI crowd fill — minor/expected).
- Foreground subjects stay coherent, no morphing or continuity breaks noticed.

**A17_vista** — Aerial nature footage: mountains/coastline, cliffs, waterfall.
- One transition frame shows an oddly dense, wave-like cloud/mist bank at a cliff edge
  that reads more synthetic than natural fog (minor/ambiguous).
- Otherwise very clean, no warping or geometry problems.

**A18_cities** — World-landmark montage (Eiffel Tower, NYC, Rio, Colosseum, Taj Mahal,
Statue of Liberty).
- No obvious issues noticed. Landmarks geometrically accurate, several shots are
  deliberately slow static push-ins.

**A19_sunrise** — Two mountain sunrise landscape shots.
- Both halves show extremely low motion — consecutive sampled frames within each shot
  are nearly identical, closer to a static image with slight zoom than real movement.
- No morphing/warping issues otherwise.

**A20_culture** — Moroccan souk, mint tea pouring with steam, woven textile close-ups.
- Steam from the poured tea forms an oversized, dense, cloud-like plume relative to the
  small liquid stream — looks artificial.
- Tea-pouring and textile shots are both largely static between sampled frames.
- No face/hand distortion noticed.

### Group CF — contestant-style entries (9 clips, all 27.0s, 1080x1920)

**lumea** — Perfume/skincare ad; woman in sunlit room, bottle product shots, logo card.
- Embossed micro-text on the bottle cap renders as illegible scrambled glyphs, distinct
  from the correctly-legible "LUMEA" wordmark elsewhere on the same bottle/logo card.
- Human/skin frames otherwise clean.

**aurelie** — Skincare/serum ad; woman near a window, dropper bottle, logo card.
- One frame shows two overlapping/duplicated views of the bottle label at once
  (partial "RELIE" + a separate disconnected text fragment) — a compositing/duplication
  glitch.
- A transition frame overlays a circular lens/ring shape across the model's eye plus a
  second disconnected reflective ring near her jaw — geometry doesn't resolve into one
  coherent object.
- No face/hand anatomy errors in the clear frames.

**novya** — Futuristic skincare ad; metallic gradient bottle, logo card.
- Bottle's embossed brand text reads "NOWYA" in one shot but "NOVYA" in another and on
  the final card — a letter changes mid-video, i.e. the label text isn't stable across
  shots.
- A transition frame shows a disjointed ring of metallic/glass shapes and floating
  droplets over a face — multiple overlapping partial circles that don't resolve into
  one object.
- Skin/face frames otherwise clean.

**bloomix** — Color-cosmetics ad; coral jar, logo card.
- Embossed logotype's "M" renders as a smooth wavy squiggle rather than a normal
  letterform, consistently across frames — a font-generation quirk.
- One transition frame overlays a large translucent circular/handle shape across the
  lower face and hand like a stray, disconnected 3D asset.
- Face/skin/hand frames otherwise clean.

**aquelle** — "Hydration" cosmetic ad; blue glass spray bottle with bubbles, logo card.
- A transition frame overlays multiple concentric glassy ring shapes across the face
  with mismatched reflections — a glitchy multi-layer composite rather than one clean
  design element.
- No face/hand/skin anatomy problems in the straightforward frames.

**noira** — Monochrome luxury cosmetics ad; matte black jar, logo card.
- One transition frame double-exposes the model's hand over half her face with a
  flowing smoke texture; fingers partly dissolve into the smoke, making the hand shape
  ambiguous (likely intentional artistic effect, but does blur hand form).
- Otherwise the cleanest clip in this batch — wordmark stays legible/consistent
  throughout, no garbling or warping.

**eclare** — Golden-hour perfume ad; gold hexagonal bottle, logo card.
- Bottle's brand text is unstable: two separate product shots show illegible scrambled
  glyphs, while the final logo card shows a clean, correctly-spelled "ÉCLARE."
- Lighting/skin rendering and hand-on-face gestures otherwise clean.

**soira** — Pastel-pink skincare ad; frosted pink bottle with rose-gold cap, logo card.
- One product shot shows the label cut off mid-word ("SOIR" instead of the fully
  legible "SOIRA" seen elsewhere) — a minor label-consistency wobble.
- A transition frame overlays a translucent ring/lens shape across the face and raised
  hand in a way that makes fingers look partially fused with the glass shape.
- Straightforward portrait frames otherwise clean.

**velix** — Red-toned sport/color cosmetics ad; red cylindrical bottle, logo card.
- A transition frame overlays wavy glass-ribbon shapes that appear to pass directly
  through the mouth/teeth rather than in front of the face plane — a depth/compositing
  error.
- In one frame the raised hand's finger/nail arrangement is ambiguous — a possible
  extra or misplaced digit near the lower-left of the hand, though partly obscured by
  motion blur (not fully conclusive).
- Bottle label stays legible throughout; core portrait frames otherwise clean.

### Group WD — watch/demo submissions (7 clips)

**demo_sf** (5.9s, 1920x1080) — Armored sci-fi figure flying through an asteroid field.
- One mid-clip frame shows a doubled/ghosted helmet silhouette — two overlapping head
  shapes rather than one clean head.
- Heavy bloom/motion blur obscures other body detail; no other clear anatomy errors.

**demo_duel** (15.0s, 1920x1080) — Two armored humans flying toward each other, then a
close face-off.
- The female character's hair changes identity across the clip: early frames show long
  loose dark-brown hair, later frames (same character/scene) show lighter/blonde hair
  in an updo — a character-consistency break, not an obvious costume change.
- Faces read as sharp close-ups pasted onto heavily blurred/painterly bodies, a slight
  "cutout" look in some frames.

**demo_astronaut** (15.0s, 1920x1080) — Astronaut walking desert dunes at sunset, then
a close-up profile shot.
- Hard, unexplained jump from a wide shot of the astronaut walking away in the distance
  to a close-up profile facing camera, with no transition — a shot discontinuity.
- Last several sampled frames (close-up on the helmet) are nearly identical — a
  held/near-frozen shot late in the clip.
- Suit detail, sand texture, and lighting otherwise consistent and well-rendered.

**demo_artisan** (15.0s, 1920x1080) — Elderly man in a pottery studio shaping clay on a
wheel.
- Jump/teleport: potter is shown far away in a doorway, then in the very next sampled
  frames is already seated at the wheel with clay in progress — no transition shown.
- Otherwise no rendering issues; hands, wheel motion, clay deformation, and skin detail
  all look physically plausible — close to real-footage fidelity.

**demo_ichar** (5.0s, 1244x1660) — Identity-consistency test: same woman/outfit across
two backgrounds.
- Jacket shoulder patches contain garbled, illegible pseudo-text ("W?LUWOIG," an
  unreadable insignia) that never resolves into real words.
- Background changes abruptly from a plain wall to a lit sci-fi corridor partway
  through — likely intentional (this looks like it was built as a consistency test),
  but it's a hard discontinuity worth flagging.
- Face, hair, and jacket otherwise impressively consistent frame-to-frame.

**demo_anne** (15.1s, 1280x720) — Stylized 3D cartoon girl "walking" through an autumn
park.
- The character never actually walks: hands stay in jacket pockets, legs/feet aren't
  visible/animated for the whole sequence, while only the background pans — a
  "cardboard cutout gliding" effect rather than real locomotion.
- Minor backpack-strap placement inconsistency across frames.

**demo_consistency** (20.1s, 1280x720) — Astronaut walking a dune at sunset, camera
tracking from behind.
- Progressive sky corruption: normal gradient sunset/stars at first, but starting
  roughly halfway through, swirling red/orange ribbon-like streaks appear and get more
  chaotic/flame-like toward the end — a temporal-coherence breakdown that worsens over
  the clip, not present at the start.
- Walking gait looks slightly unnatural later on (legs cross/scissor in an odd stance).

### Group TK — TK's own Studio renders (2 clips)

**tk_render_1** (18.0s, 1920x1080) — Neon cyberpunk city flyover ending on a giant
winged humanoid figure.
- Building signage/text throughout is illegible garbled glyphs.
- Light-trail streak shapes in the upper sky (early frames) appear disconnected from
  any object generating them.
- A small pink/purple bird-like blob briefly appears near the winged figure with no
  clear origin.

**tk_render_2** (21.0s, 1280x720) — Skincare commercial: gold bathroom fixtures, woman
in white robe, serum bottle, application.
- No obvious issues noticed — hands, fingers, face, product label text, and reflections
  all look clean and consistent; commercial-grade fidelity.
- Minor: a second gold fixture at the frame edge in one shot has no visible supporting
  counter, but this is likely just tight framing rather than a defect.

---

## 2. Bottom-up failure taxonomy

These clusters were named from what was actually observed across the 40 clips, not
mapped onto a predefined scheme. Counts are clip counts (a clip can appear in more than
one cluster). See Section 4 for explicit comparison against a prior imagined taxonomy.

**A. Transition/overlay compositing glitches — 8 clips**
(`aurelie`, `novya`, `bloomix`, `aquelle`, `soira`, `velix`, `demo_sf`, `A04_morph`)
During scene transitions (not steady-state shots), decorative or ghosted elements
(rings, lenses, duplicated silhouettes, blocky pixel-tearing) appear disconnected from
or improperly layered against the subject — wrong depth order, overlapping partial
shapes that don't resolve into one coherent object, or outright duplication.
- `aurelie`: two overlapping/duplicated bottle-label views in one frame.
- `velix`: glass ribbon shapes appear to pass *through* the mouth/teeth rather than in
  front of the face — a depth-order error.
- `A04_morph`: blocky/pixelated tearing during an outfit-morph transition.

**B. Text/label rendering instability — 7 clips**
(`lumea`, `novya`, `eclare`, `soira`, `demo_ichar`, `tk_render_1`, `A03_street`)
Any in-scene text (product labels, signage, jacket patches, graphic prints) either
renders as illegible scrambled glyphs, or is spelled/rendered inconsistently across
shots of the same object.
- `novya`: bottle text reads "NOWYA" in one shot, "NOVYA" in another and on the final
  card — the same object's label changes letters mid-video.
- `eclare`: bottle text is scrambled in two product shots but perfectly legible on the
  final logo card.
- `A03_street`: neon signage and a t-shirt graphic are both illegible gibberish in
  nearly every frame.

**C. Motion starvation / near-frozen shots (movement implied but not delivered) — 6 clips**
(`demo_astronaut`, `demo_anne`, `A10_drift`, `A11_night`, `A19_sunrise`, `A20_culture`)
Shots framed as if they show ongoing motion (a "chase," a "walk," a "drift," a pour)
where consecutive sampled frames across several seconds are nearly identical — a
near-static image rather than real camera or subject movement.
- `demo_anne`: character's legs/feet are never animated for the entire clip despite
  being framed as "walking."
- `A11_night`: back half of a "chase" is a near-static close-up with the background
  barely changing for several seconds.
- `A19_sunrise`: both landscape shots are close to static images with only a slight
  zoom.

**D. Mechanically/physically implausible object geometry — 2 strong + 3 minor clips**
(strong: `A12_mech`, `A09_race`; minor/ambiguous: `A06_splash`, `A20_culture`, `A17_vista`)
Objects that are internally incoherent as physical mechanisms or physical processes —
not a consistency break across shots, but a single depicted object/process that
couldn't work as shown.
- `A12_mech`: gear teeth interpenetrate rather than mesh, and a piston rod plugs
  directly into a gear surface with no crankshaft or bearing — mechanically impossible
  even within one static-ish shot.
- `A09_race`: sparks float disconnected above the hood rather than originating from
  tire-road contact; car body looks warped/melted mid-drift.
- Minor cases (splash highlight too static, steam plume oversized, cloud bank
  synthetic-looking) are softer, more "slightly off" than "impossible."

**E. Object/character identity drift within a continuous narrative — 3 clips**
(`demo_duel`, `A09_race`, `A07_cooking`)
The same character or object, presented across one continuous scene/story, visibly
changes core identity attributes partway through.
- `demo_duel`: the same female character's hair color and style change (dark loose hair
  → lighter updo) mid-clip with no in-story reason.
- `A09_race`: the "one car" being followed changes body shape, wheel design, and paint
  color across shots.
- `A07_cooking`: what's cut together as one chef's story is visibly two different
  people (different build, hairstyle, kitchen).

**F. Hand/finger anatomy artifacts — 3-4 clips**
(`A04_morph`, `A13_group`, `velix`; `A14_solo` uncertain/silhouette-obscured)
Hands/fingers that look blob-like, elongated, melted, or have an ambiguous/possibly
extra digit.
- `A13_group`: a bent-forward dancer's hand/fingers look elongated and melted.
- `velix`: possible extra or misplaced digit near a raised hand (motion blur makes this
  not fully conclusive).

**G. Progressive temporal corruption (defect that worsens over the clip's own duration) — 2 clips**
(`demo_consistency`, `A11_night`)
Distinct from a one-off glitch: visual quality/coherence degrades as the clip plays,
starting clean and ending distorted.
- `demo_consistency`: sky renders as a normal gradient sunset at the start, then
  develops swirling, increasingly chaotic red/orange streaks by the back half.
- `A11_night`: paint reflections show rainbow color-bleed not tied to a light source
  (steady throughout, but visually similar "shouldn't happen physically" character).

**H. Uncanny texture/material substitution — 2 clips**
(`A01_fashion_fusion`, `A01_fashion_wearable`)
A close-up material that should read as a normal substance (fabric, in both cases)
instead renders as an organic, vein-like/bio-organic lattice.

**I. Jarring continuity jump/teleport in a single presented shot — 2 clips**
(`demo_astronaut`, `demo_artisan`)
Distinct from editorial hard cuts (below) because these are presented as one
continuous action, not a montage — a person's position/pose changes with no
transition where the framing implies continuity.
- `demo_artisan`: potter is far away in a doorway, then in the very next sampled frames
  is already seated at the wheel mid-work.

**J. Editorial hard cuts to unrelated content — 8 clips (structural pattern, not a
per-generation defect)**
(`A01_fashion`, `A01_fashion_fusion`, `A01_fashion_wearable`, `A03_street`,
`A05_plating`, `A07_cooking`, `A13_group`, `A15_rhythm`)
Nearly every multi-shot clip in the "A" promo group is a fast-cut compilation of 2+
unrelated generations (different models/dishes/dancers) stitched under one caption —
this looks like the deliberate editorial structure of that promo series, not an
artifact of any single generation. Flagged separately from cluster I because it's a
consistent, repeated *editorial choice* across this content type, not an unplanned
break in an otherwise-continuous shot.

**K. Minor/one-off cosmetic notes — not clustered further**
- `A16_crowd`: background crowd faces are generically blurry (expected AI crowd-fill).
- `A01_fashion_wearable`: model's face renders as a flat, nearly featureless
  matte-black mask (possibly stylistic).
- `A17_vista`, `A20_culture`, `A05_plating`: minor unnatural-looking cloud/steam shapes,
  below the threshold of cluster D.

**Genuinely clean clips (no obvious issues noticed): 3**
`A02_fabric`, `A18_cities`, `tk_render_2`.
An additional 5 clips (`A06_splash`, `A08_dessert`, `A16_crowd`, `A17_vista`, `noira`)
had only trivial/ambiguous notes not rising to a real defect.

---

## 3. Frequency-ranked summary

| Rank | Cluster | Clips | Share of 40 |
|---|---|---|---|
| 1 | J. Editorial hard cuts to unrelated content (structural, not a defect) | 8 | 20% |
| 1 (tie) | A. Transition/overlay compositing glitches | 8 | 20% |
| 3 | B. Text/label rendering instability | 7 | 17.5% |
| 4 | C. Motion starvation / near-frozen shots | 6 | 15% |
| 5 | D. Mechanically implausible object geometry | 2 strong + 3 minor | 5-12.5% |
| 6 | E. Object/character identity drift | 3 | 7.5% |
| 6 (tie) | F. Hand/finger anatomy artifacts | 3-4 | 7.5-10% |
| 8 | G. Progressive temporal corruption | 2 | 5% |
| 8 (tie) | H. Uncanny texture/material substitution | 2 | 5% |
| 8 (tie) | I. Jarring continuity jump/teleport (single shot) | 2 | 5% |
| — | K. One-off cosmetic notes | 3 (no dup counting) | ~7.5% |

**Common enough to be primary categories for a defect benchmark:** A (transition/overlay
glitches), B (text/label instability), C (motion starvation), and arguably D
(implausible object geometry, if the minor cases are included) and E/F together as an
"identity & anatomy consistency" family — these five/six each recurred across
independent, unrelated productions (different vendors/styles: promo, contestant,
watch/demo, TK render), so they're not artifacts of one content pipeline.

**Rare / one-off — candidates for a catch-all bucket rather than dedicated categories:**
G (progressive corruption), H (texture substitution), I (single-shot teleport), and all
of K. Each appeared in only 1-2 clips and, in at least G's case (`A11_night`'s rainbow
streaks), the observation itself is somewhat subjective/borderline.

**Structural note, not a defect category at all:** J (editorial hard cuts) is really a
finding about the *content*, not about generation quality — it says the promo pipeline
deliberately stitches unrelated generations into one file. A benchmark aimed at
judging AI generation quality should probably exclude J from scoring entirely (or score
each cut segment separately), rather than treating "cuts to something else" as a defect.

---

## 4. Comparison to a prior imagined taxonomy

A prior benchmark used categories: `faceIdentity / anatomy / objectConsistency / motion
/ background / lighting / continuity / editing / otherArtifacts`. Comparing:

**Converges (independently arrived at something similar):**
- Cluster F (hand/finger anatomy) ≈ `anatomy`.
- Cluster E (object/character identity drift) ≈ `faceIdentity` + `objectConsistency`
  combined — in the real data, face-identity drift and object-identity drift showed up
  together in the same kind of clip (one continuous scene, one subject changing
  partway through), so splitting them into two categories may be less natural than
  treating it as one "same-subject-should-stay-the-same" family.
- Cluster J (hard cuts) ≈ `editing`.
- `A16_crowd`'s background blur ≈ `background`.

**Diverges — patterns that don't map cleanly onto the old scheme:**
- **Motion (cluster C) turned out to be the opposite of what "motion" categories
  usually assume.** The real, recurring motion problem was *not* jerky/glitchy
  movement — it was the near-absence of movement in shots that are framed to imply
  it (a "walk," a "chase," a "drift," a "pour"). A benchmark category literally named
  "motion quality" built around glitchy/unnatural movement would miss this; it needs
  to explicitly include "implied motion that never happens" as a failure mode.
- **Text/label rendering instability (cluster B, 7/40 = the single most textually
  identifiable recurring defect) has no home in the old scheme at all** — it isn't
  `objectConsistency` (the object is fine, only its rendered text is garbled or
  unstable) and it isn't quite `otherArtifacts` either since it's specific and
  frequent enough to deserve its own category.
- **Transition/overlay compositing glitches (cluster A, tied for most common) also
  don't map onto `editing`.** `editing` in the old scheme likely meant cut
  placement/pacing; what was actually observed is a *rendering*-layer problem during
  transitions specifically — disconnected decorative props, ghosting, wrong depth
  order — which is closer to a generation defect that happens to cluster at
  transition points, not an editorial decision.
- **Mechanically implausible object geometry (cluster D)** is a more specific claim
  than generic `objectConsistency`: the object doesn't even work as a single static
  mechanism (gear teeth interpenetrating, a piston with no crankshaft), independent of
  whether it stays consistent across shots.
- **Progressive temporal corruption (cluster G)** — a defect that starts clean and
  worsens over the clip's own runtime — is a temporal/severity dimension that none of
  the old category names capture (they read as present/absent per clip, not
  "escalates within the clip").

**Bottom line:** anatomy, identity-consistency, background, and cut-editing concepts
survive contact with real data reasonably well. But two of the most frequent real
failure modes — text/label instability, and transition-time compositing/ghosting
glitches — sit outside the old scheme entirely, and the old "motion" framing actively
points in the wrong direction (glitchy motion vs. absent motion). A benchmark rebuilt
from this survey should add explicit categories for text-rendering instability and
transition-compositing glitches, and reframe "motion" to cover motion starvation as
a first-class failure, not just erratic motion.

---

## 5. Tier-A (judging-relevant) vs. cosmetic/minor

**Looks Tier-A (would plausibly move a human judge's quality/rank assessment):**
- Cluster E (object/character identity drift) — a judge would very likely notice "the
  car changed" or "her hair changed" mid-video; this is a direct hit on perceived
  production quality/coherence.
- Cluster F (hand/finger anatomy) — classic, judge-visible "AI tell."
- Cluster D strong cases (`A12_mech`, `A09_race`) — mechanically-wrong objects and
  physics-violating effects (floating disconnected sparks) are visually jarring even to
  a non-technical viewer.
- Cluster G (progressive temporal corruption) — `demo_consistency`'s sky corruption is
  the kind of defect that gets worse the longer a judge watches, which is a real risk
  for narrative/continuity-weighted scoring.
- Cluster C (motion starvation) is judging-relevant but more subtle: it wouldn't read
  as "broken," more as "boring" or "static" — likely affects perceived quality/effort
  more than it reads as a hard technical defect.
- Cluster A (transition/overlay glitches) is judging-relevant when the transition
  itself is on-screen for long enough to notice (e.g. `velix`'s ribbons passing through
  the mouth) — otherwise fast transitions may hide it.

**More cosmetic/minor (unlikely to change judged rank on their own):**
- Cluster B (text/label instability) — ironically the most *frequent* finding, but
  garbled background/product text is a well-known, almost-expected AI quirk that most
  viewers already discount; likely low weight for ranking purposes even though it's
  common enough to be worth detecting.
- Cluster H (texture substitution) — subtle, close-up-only, easy to miss at normal
  viewing speed.
- Cluster K (crowd blur, flat face rendering, minor cloud/steam shapes) — background
  fill-quality issues, generally below a casual viewer's notice threshold.
- Cluster J (editorial hard cuts) — not a generation-quality issue at all; a scoring
  system should not penalize this as a "defect."

---

## Summary

- **40/40 clips surveyed** (all URLs resolved, all frame sweeps completed, 0 failures).
- **37/40 clips showed at least one noted issue** (including minor/ambiguous ones);
  **3/40 were genuinely clean** (`A02_fabric`, `A18_cities`, `tk_render_2`), with 5 more
  having only trivial notes.
- Severity varies enormously within "issue" — from a blurry background crowd to a
  mechanically-impossible engine or a car that changes identity mid-shot.
- Top clusters by frequency: transition/overlay compositing glitches (8), editorial
  hard cuts — structural, not a defect (8), text/label rendering instability (7),
  motion starvation/near-frozen shots (6), implausible object geometry (5, 2 strong),
  identity drift (3) and hand/finger anatomy (3-4).
- Two of the most frequent real patterns (text-rendering instability, transition-time
  compositing glitches) have no home in a prior imagined taxonomy built around
  faceIdentity/anatomy/objectConsistency/motion/background/lighting/continuity/editing/
  otherArtifacts, and the old "motion" framing points the wrong direction (the real
  motion problem is absence of motion, not erratic motion).
