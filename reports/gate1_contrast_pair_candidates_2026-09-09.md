# Gate 1 Contrast-Pair Candidates (mined from existing footage) — 2026-09-09

**Status: DRAFT for TK review. Nothing here is settled — every "My opinion" line below is my own read after watching frame sweeps of both clips, not a verdict. TK's judgment overrides all of it.**

Method: for all 43 pool clips I pulled duration via `ffprobe` directly off the R2 URL (no download needed) and generated a 9-frame evenly-spaced contact sheet via `ffmpeg` (fps filter + 3x3 tile). All 43 URLs loaded successfully — **zero failures**. For a handful of clips where I wanted to double-check something (a possible identity swap, a possible dish-swap, a "consistency"-named fixture, a low-scoring outlier with no obvious visible cause) I pulled a finer 12-frame grid or a specific timestamp frame. The 5 local GT21 clips were sampled the same way with `ffmpeg` directly on the local files. I did **not** trust the pre-computed `verified`/`consensus` scores from `mock_prelim_2026-09-05_2026-09-05_1834.json` as ground truth — they are shown only as context, and in at least one pair below (Pair 12) my own read actually disagrees with that score's ordering, which I've flagged explicitly.

## Important general findings (please confirm/correct)

1. **`GT01_clean_a` and `demo_artisan` (WD group) appear to be the identical underlying video** — same potter, same three-shot structure (doorway wide shot → wheel medium shot → hands close-up), same duration (15.042s to the millisecond). I have treated them as one piece of footage: I use `GT01_clean_a` for two pairs and `demo_artisan` for a third (against a different partner each time) so no pair compares them to each other, but please don't read this as three independently-sourced "clean" clips — it's one clip used three times.
2. **`GT02_clean_b` and `A02_fabric` appear to share the same base generated footage** (identical magenta silk fabric, identical framing/camera moves, identical "Watch fabric come alive" caption) but are trimmed to different lengths (15.0s vs 19.0s — the promo version has ~4s of extra OXXOVO outro card that the GT version doesn't). I have used them in separate pairs, never against each other, and flagged this so they aren't mistaken for two independent instances of good execution.
3. In one pair (Pair 12, Z02_dusk vs A18_cities) my own visual read **contradicts** the old scoring run's ranking (it scored the blurrier clip higher). Flagged inline — this seems like exactly the kind of miscalibration the new benchmark is meant to catch, not a reason to distrust my read.

---

## Candidate Pairs

### Pair 1 — subject/theme match: same
- A: GT19_anatomy_object1 — `outputs/gt21/final/GT19_anatomy_object1.mp4` — close-up hand repeatedly pinching a coin on a wood table
- B: GT01_clean_a — `outputs/gt21/final/GT01_clean_a.mp4` — elderly potter shaping a bowl on a wheel, hands + wet clay
- My opinion: B is better (confidence: high)
- Why: In A, the hand pinches/grips the coin several times across the clip and the coin never so much as tilts — a flat, edge-balanced coin should react to direct contact and doesn't, which reads as broken physics the moment you watch it twice. A also has a confirmed anatomy defect around 5.5–7s: I pulled the frame at 6.2s myself and the fingers collapse into a fused, indistinct clump with a greenish-brown blotch where a nail/fingertip should be. B's hands are consistent and anatomically normal throughout, and the clay visibly deforms and responds to touch exactly as expected.
- Existing AI score gap (context only): A=n/a (GT21 anchor, not in the AI-scored pool) vs B=n/a (same)

### Pair 2 — subject/theme match: same
- A: GT20_anatomy_object2 — `outputs/gt21/final/GT20_anatomy_object2.mp4` — hand pressing down on a gold ring on black marble
- B: GT01_clean_a — `outputs/gt21/final/GT01_clean_a.mp4` — elderly potter, hands + wet clay
- My opinion: B is better (confidence: high)
- Why: In A the finger presses directly down onto a ring lying flat on a hard reflective surface, repeatedly, with visible force — a free ring under that kind of contact should slide, spin, or tip, and it stays perfectly static every time, which is an obvious physical-plausibility failure. B's clay and hands behave exactly as expected throughout.
- Existing AI score gap (context only): A=n/a vs B=n/a

### Pair 3 — subject/theme match: different (flagged)
- A: GT21_anatomy_object3 — `outputs/gt21/final/GT21_anatomy_object3.mp4` — hand pinching a glass marble on concrete
- B: GT02_clean_b — `outputs/gt21/final/GT02_clean_b.mp4` — magenta silk fabric flowing macro (no hands/people)
- My opinion: B is better (confidence: high)
- Why: A's marble never moves despite a clear repeated pinching motion directly on it — same non-reactive-object problem as the other GT19-21 clips. B is a clean, artifact-free macro shot with fluid, physically plausible cloth motion throughout. Different subjects entirely, but the "does this look like a broken simulation vs. a believable one" contrast is stark and should be easy for any viewer to agree on.
- Existing AI score gap (context only): A=n/a vs B=n/a

### Pair 4 — subject/theme match: different (flagged)
- A: Z01_table — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_Z01_table_EN_9x16.mp4 — static plate of spaghetti bolognese, "A plate, plainly."
- B: A12_mech — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A12_mech_EN_9x16.mp4 — macro shots of blue mechanical engine parts (pistons, gears), "Precision in every frame."
- My opinion: B is better (confidence: high)
- Why: A is essentially one static-ish camera angle on a plate for the whole 19s — almost no camera movement, no action, nothing changes; it visibly earns its "deliberately low-intent" label. B moves through several different mechanical subjects with confident macro camera work and a consistent, purposeful visual concept. Both are technically clean (no artifacts in either), so this is purely a "does this look like someone had a creative idea" gap, which is large.
- Existing AI score gap (context only): A=61.8 vs B=77.1

### Pair 5 — subject/theme match: different (flagged)
- A: Z02_dusk — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_Z02_dusk_EN_9x16.mp4 — city-at-dusk montage, "The city at the end of the day."
- B: A02_fabric — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A02_fabric_EN_9x16.mp4 — magenta silk fabric macro (same base footage as GT02_clean_b, see general note #2)
- My opinion: B is better (confidence: high)
- Why: A's opening shot has heavy motion-blur streaking that looks like an execution/rendering issue rather than a deliberate effect, and a couple of the later alley/wall shots are visibly murky and indistinct. B is crisp, smooth, and artifact-free in every frame I looked at.
- Existing AI score gap (context only): A=67.9 vs B=77.9

### Pair 6 — subject/theme match: same
- A: A15_rhythm — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A15_rhythm_EN_9x16.mp4 — solo dancer, "Feel the rhythm."
- B: A14_solo — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A14_solo_EN_9x16.mp4 — solo silhouetted dancer backlit, "Every move tells a story."
- My opinion: B is better (confidence: high)
- Why: A starts with a dark-skinned dancer in a neon-green crop top and silver pants, and partway through — with no cut, no transition effect — she is simply a different person: pink hair, different face, different metallic outfit. It's presented as one continuous performance and isn't. B is a single consistent silhouetted figure the whole way through, with a deliberate and coherent blue-to-gold lighting shift.
- Existing AI score gap (context only): A=64.2 vs B=76.5

### Pair 7 — subject/theme match: similar (same broad genre — food/culinary ad with a human cook)
- A: A07_cooking — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A07_cooking_EN_9x16.mp4 — chef flambéing food in a wok, "From prompt to plate."
- B: A08_dessert — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A08_dessert_EN_9x16.mp4 — chocolate-dome dessert with red sauce pour, "Desire, served."
- My opinion: B is better (confidence: high)
- Why: I pulled a finer 12-frame grid on A specifically to check this — a bearded, light-skinned chef in white chef's whites cooks for the first ~9 seconds, then is abruptly and permanently replaced by a different chef (dark hair, clean-shaven, black apron instead of whites) for the rest of the clip, with no cut or explanation. It's a hard identity swap mid-"continuous" sequence. B has no people at all and is a clean, consistent dessert/sauce shot throughout.
- Existing AI score gap (context only): A=72.6 vs B=72.6 (scores are tied — the swap in A wasn't caught by the original AI scoring pass at all, which is itself worth noting)

### Pair 8 — subject/theme match: similar (both single-woman studio portrait/beauty setting)
- A: Z03_studio — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_Z03_studio_EN_9x16.mp4 — "In red." studio portraits
- B: aurelie (CF) — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/cf/v3/cf_02_aurelie_premium.mp4 — skincare-serum ad, consistent model
- My opinion: B is better (confidence: high)
- Why: A is presented as one continuous "woman in red" shoot but is actually at least three different women — a young Asian woman, then a different young woman, then a middle-aged Black woman — shown back-to-back as if it's one identity. B keeps the same model's face, hair, and setting consistent across all 9 sampled frames.
- Existing AI score gap (context only): A=70.6 vs B=70.1 (near-tied on the old score, but B has no visible consistency break and A has an obvious one)

### Pair 9 — subject/theme match: different (flagged — both are "single consistent person, studio/controlled setting" in concept, but genre differs: fashion-portrait vs. sci-fi character)
- A: Z03_studio — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_Z03_studio_EN_9x16.mp4
- B: demo_ichar (WD) — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/watch_demo/season_test/demo_ichar.mp4 — sci-fi character portrait (red-haired woman, green jacket) in a ship corridor
- My opinion: B is better (confidence: high)
- Why: Same underlying issue as Pair 8 — A swaps identities mid-clip. B is the same character (same hair, same face, same jacket) across every one of the 9 sampled frames despite different angles/backgrounds.
- Existing AI score gap (context only): A=70.6 vs B=73.6

### Pair 10 — subject/theme match: same (hands + small object, macro)
- A: demo_artisan (WD) — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/watch_demo/season_test/demo_artisan.mp4 — elderly potter (identical footage to GT01_clean_a — see general note #1)
- B: GT21_anatomy_object3 — `outputs/gt21/final/GT21_anatomy_object3.mp4` — hand pinching a non-reactive glass marble
- My opinion: A is better (confidence: high)
- Why: Same reasoning as Pair 3, reversed direction of which clip is "A" — included so both of GT21's flawed anchors (GT19, GT20 via Pairs 1/2, and here as the direct counterpart) get paired against the "clean hands" anchor without literally reusing GT01_clean_a a third time against the same kind of partner.
- Existing AI score gap (context only): A=79.4 vs B=n/a

### Pair 11 — subject/theme match: same (food/plate)
- A: Z01_table — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_Z01_table_EN_9x16.mp4
- B: A08_dessert — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A08_dessert_EN_9x16.mp4
- My opinion: B is better (confidence: high)
- Why: Both are technically clean single-dish food shots, so this one is purely about direction: A holds one nearly static angle on a plate for the full 19s with almost no camera movement or action. B has a garnish-placement beat, steam, a deliberate sauce pour, and changing camera angles — much more of an actual "shot" than a photo of a plate.
- Existing AI score gap (context only): A=61.8 vs B=72.6

### Pair 12 — subject/theme match: same (city/urban montage) — ⚠ my read disagrees with the old score's ranking
- A: Z02_dusk — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_Z02_dusk_EN_9x16.mp4
- B: A18_cities — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A18_cities_EN_9x16.mp4 — world-landmarks tour (Eiffel Tower, NYC, Rio, Colosseum, Taj Mahal, Statue of Liberty), "The world in 30 seconds."
- My opinion: B is better (confidence: medium)
- Why: A has the motion-blur/execution issue described in Pair 5. B's landmark shots are crisp, sharp, and well-composited with no visible artifacts — though I'll note B's concept ("famous landmarks in sequence") is much more generic/stock-footage-like than A's, which is presumably why the old scoring run rated B *lower* (64.97) than A (67.88): it was weighing originality heavily. On pure "which video looks more competently made," I'd call it for B. Flagging this explicitly since it's a case where my opinion and the old AI score disagree — worth TK's attention on its own.
- Existing AI score gap (context only): A=67.9 vs B=65.0 (old score favors A; I disagree)

### Pair 13 — subject/theme match: similar (both "place/travel" montage, city vs. market)
- A: Z02_dusk — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_Z02_dusk_EN_9x16.mp4
- B: A20_culture — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A20_culture_EN_9x16.mp4 — Moroccan market, "Every place. A story."
- My opinion: B is better (confidence: high)
- Why: Same motion-blur issue in A as above. B is sharp throughout with a consistent central figure (a man pouring tea) tying the shots together, and richer, more deliberate color/texture work (textiles, tassels).
- Existing AI score gap (context only): A=67.9 vs B=74.1

### Pair 14 — subject/theme match: same (skincare-bottle ad, single consistent model)
- A: novya (CF) — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/cf/v3/cf_03_novya_pop.mp4
- B: tk_render_2 (TK) — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/renders/season_test/9b5ceed5-34b3-4a64-af4a-3fe898dd547f/9f31a120-91c9-46f8-9d63-5163b431c327.mp4 — bathroom/serum-dropper/face-application skincare ad
- My opinion: B is better (confidence: medium)
- Why: I looked closely at novya specifically because it scored as a clear outlier-low within the CF group (67.3 vs. 70-77 for the rest) and I could not find a visible technical defect to match — face, hands, and product are all consistent and clean. So my honest read is these two are closer in quality than the old score suggests; if I have to pick, B has a slightly more varied and cinematic shot sequence (establishing bathroom shot → entrance → dropper → application) versus novya's more repetitive face/bottle alternation. Flagging the low confidence honestly — this is a case where I couldn't find a strong reason for the old score gap.
- Existing AI score gap (context only): A=67.3 vs B=75.9

### Pair 15 — subject/theme match: same (skincare-bottle ad)
- A: aurelie (CF) — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/cf/v3/cf_02_aurelie_premium.mp4
- B: lumea (CF) — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/cf/v3/cf_01_lumea_premium.mp4
- My opinion: B is better (confidence: medium)
- Why: Both are clean, well-shot, single-model ads. B has a more memorable hero shot (a ribbon of gold liquid double-exposed over the model's face) that reads as more deliberate/crafted than aurelie's droplet-on-skin close-up, which is a fairly generic beauty-ad shot.
- Existing AI score gap (context only): A=70.1 vs B=76.6

### Pair 16 — subject/theme match: same (sci-fi VFX character)
- A: demo_ichar (WD) — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/watch_demo/season_test/demo_ichar.mp4
- B: demo_duel (WD) — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/watch_demo/season_test/demo_duel.mp4 — two armored characters dueling with energy beams in space
- My opinion: B is better (confidence: medium)
- Why: A is a solid, clean, but visually simple set of static-ish portrait shots. B attempts a much more ambitious two-character action sequence with energy-beam VFX and pulls it off without visible artifacts in the frames I sampled — more ambitious and executed cleanly, though I'd call this a genuinely closer case than the extreme pairs above.
- Existing AI score gap (context only): A=73.6 vs B=78.7

### Pair 17 — subject/theme match: same (same runway show/series)
- A: A01_fashion — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A01_fashion_EN_9x16.mp4
- B: A01_fashion_wearable — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A01_fashion_wearable_EN_9x16.mp4
- My opinion: B is better (confidence: medium)
- Why: A's lead model has a slightly uncanny/waxy face quality and eye makeup that reads as "painted on" rather than natural under close inspection (also independently noted in the original AI eval's own raw notes). B's model close-ups look more natural, and the sequence includes a clean back-view turn that reads as more deliberate camerawork.
- Existing AI score gap (context only): A=71.8 vs B=74.7

### Pair 18 — subject/theme match: same (dance/performance montage)
- A: A13_group — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A13_group_EN_9x16.mp4 — montage of two different dance crews
- B: A14_solo — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A14_solo_EN_9x16.mp4
- My opinion: B is better (confidence: medium)
- Why: A is technically fine (no consistency breaks — each dance crew's identity holds within its own shots) but is a fairly generic multi-group montage without a strong single visual idea. B commits to one performer, one lighting concept, and a deliberate color transition, which reads as more crafted.
- Existing AI score gap (context only): A=69.2 vs B=76.5

### Pair 19 — subject/theme match: same (cars, night)
- A: A09_race — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A09_race_EN_9x16.mp4 — multiple different sports cars, "The beauty of speed."
- B: A10_drift — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A10_drift_EN_9x16.mp4 — single car drifting with tire smoke, "Motion is emotion."
- My opinion: B is better (confidence: medium)
- Why: A cuts between several different cars/models, which feels more like a generic stock-footage reel. B follows one hero car through a cohesive drift sequence with consistent smoke/lighting, which feels more like a single deliberate shot idea.
- Existing AI score gap (context only): A=72.0 vs B=74.8

### Pair 20 — subject/theme match: same (cars, night)
- A: A09_race — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A09_race_EN_9x16.mp4
- B: A11_night — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A11_night_EN_9x16.mp4 — single sports car cruising neon-lit city, "Chase the night."
- My opinion: B is better (confidence: medium)
- Why: Same reasoning as Pair 19 — B's single consistent car and moodier, more cinematic neon-city treatment reads as more deliberate than A's multi-car cutaway montage.
- Existing AI score gap (context only): A=72.0 vs B=73.5

### Pair 21 — subject/theme match: same (cosmetics-jar/bottle ad)
- A: bloomix (CF) — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/cf/v3/cf_04_bloomix_pop.mp4
- B: eclare (CF) — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/cf/v3/cf_07_eclare_premium.mp4
- My opinion: B is better (confidence: medium)
- Why: Both are clean and well-lit. B includes a liquid-gold pour/texture hero shot in addition to the standard portrait+product shots, giving it a bit more visual variety than bloomix's mostly portrait-and-static-jar sequence.
- Existing AI score gap (context only): A=74.4 vs B=76.1

### Pair 22 — subject/theme match: same (nature/landscape vista)
- A: A17_vista — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A17_vista_EN_9x16.mp4 — aerial coastline/mountain montage, several locations
- B: A19_sunrise — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A19_sunrise_EN_9x16.mp4 — single mountain sunrise hero shot
- My opinion: B is better (confidence: medium)
- Why: Genuinely close — both are beautiful, clean drone-style footage with no artifacts I could find. My mild preference for B is that it commits to one strong, cohesive golden-hour image rather than A's sequence of several different locations that feels more like a generic scenic-footage compilation.
- Existing AI score gap (context only): A=71.6 vs B=72.1

### Pair 23 — subject/theme match: same (cosmetics-bottle ad)
- A: velix (CF) — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/cf/v3/cf_09_velix_pop.mp4
- B: noira (CF) — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/cf/v3/cf_06_noira_premium.mp4
- My opinion: B is better (confidence: medium)
- Why: Both clean. B commits to a distinctive monochrome/grayscale aesthetic held consistently across every shot, plus a striking double-exposure hand-on-face composite; velix's red palette and shot list feel comparatively more generic beauty-ad fare.
- Existing AI score gap (context only): A=73.7 vs B=75.6

### Pair 24 — subject/theme match: same (cosmetics-bottle ad)
- A: soira (CF) — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/cf/v3/cf_08_soira_premium.mp4
- B: aquelle (CF) — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/cf/v3/cf_05_aquelle_cool.mp4
- My opinion: B is better (confidence: medium)
- Why: Very close call between two clean, similarly-produced ads. B's floating water-sphere/splash hero shot is a slightly more technically impressive single composition than soira's cream-texture close-up.
- Existing AI score gap (context only): A=76.7 vs B=74.9 (old score favors A; my visual read leans slightly the other way — flagging this the same way as Pair 12, though with lower confidence here)

### Pair 25 — subject/theme match: same (same runway show/series)
- A: A01_fashion_fusion — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A01_fashion_fusion_EN_9x16.mp4
- B: A01_fashion_wearable — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A01_fashion_wearable_EN_9x16.mp4
- My opinion: B is better (confidence: medium)
- Why: Both are excellent, clean, high-production shots from the same show — this is a genuinely subtle pair. B's back-view turn gives the sequence a bit more narrative shape than fusion's mostly front-facing/macro-texture sequence.
- Existing AI score gap (context only): A=73.9 vs B=74.7

### Pair 26 — subject/theme match: same (sci-fi VFX character-in-space)
- A: demo_sf (WD) — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/watch_demo/season_test/demo_sf.mp4 — single character in red energy armor flying through asteroids
- B: demo_duel (WD) — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/watch_demo/season_test/demo_duel.mp4
- My opinion: B is better (confidence: medium)
- Why: Both are polished VFX pieces with no visible artifacts. B's two-character interaction with energy-beam effects is more ambitious and still executed cleanly, which edges it ahead of demo_sf's (also excellent) single-character flythrough.
- Existing AI score gap (context only): A=76.2 vs B=78.7

### Pair 27 — subject/theme match: same (cosmetics-bottle ad)
- A: bloomix (CF) — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/cf/v3/cf_04_bloomix_pop.mp4
- B: velix (CF) — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/cf/v3/cf_09_velix_pop.mp4
- My opinion: B is better (confidence: medium)
- Why: bloomix is mostly static portrait-and-jar shots; velix includes a dynamic bottle-drop/water-splash hero shot that gives it a bit more visual energy and production value.
- Existing AI score gap (context only): A=74.4 vs B=73.7 (old score favors A; my read leans slightly the other way, low-moderate confidence)

### Pair 28 — subject/theme match: similar (crowd/performance-group energy)
- A: A13_group — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A13_group_EN_9x16.mp4
- B: A16_crowd — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A16_crowd_EN_9x16.mp4 — festival crowd celebrating, one consistent woman in focus
- My opinion: B is better (confidence: medium)
- Why: Both are technically clean. B follows one consistent central subject through a cohesive crowd-celebration moment (confetti, raised arms, a genuine emotional beat); A's cut-between-two-different-dance-crews structure feels more like a generic sizzle reel without a throughline.
- Existing AI score gap (context only): A=69.2 vs B=73.3

### Pair 29 — subject/theme match: same (astronaut-in-desert-at-sunset)
- A: demo_consistency (WD) — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/watch_demo/season_test/demo_consistency.mp4
- B: demo_astronaut (WD) — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/watch_demo/season_test/demo_astronaut.mp4
- My opinion: B is better (confidence: medium — genuinely borderline)
- Why: I pulled a finer 12-frame grid on A specifically because its filename suggested it might be a deliberate consistency-test fixture like the Z-series. I couldn't find an identity break (it's the same astronaut throughout), but dramatic streaked red/pink clouds appear abruptly partway through the shot that weren't present or building up earlier, which reads as slightly less coherent than B's single steady golden-hour sky. This is a soft call and I would not be surprised if TK disagrees or finds this pair too subtle to be useful — flagging honestly.
- Existing AI score gap (context only): A=73.7 vs B=79.5

### Pair 30 — subject/theme match: different (flagged — potter process vs. static food shot)
- A: Z01_table — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_Z01_table_EN_9x16.mp4
- B: demo_artisan (WD) — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/watch_demo/season_test/demo_artisan.mp4 (identical footage to GT01_clean_a — see general note #1)
- My opinion: B is better (confidence: high)
- Why: Both are quiet, real-world-feeling process shots with minimal drama, so it's a reasonably fair comparison despite the different subject. A holds one near-static angle on a plate; B has ongoing hand motion, a wheel actually turning, and clay visibly changing shape — much more of an engaging, directed shot.
- Existing AI score gap (context only): A=61.8 vs B=79.4

---

## Summary by gap band

| Band | Pairs | Count |
|---|---|---|
| Extreme / obvious gap | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 30 | 13 |
| Clear but moderate gap | 12, 14, 15, 16, 17, 18, 19, 20, 21 | 9 |
| Subtle gap | 22, 23, 24, 25, 26, 27, 28, 29 | 8 |

**Total candidate pairs: 30**

Notes on the bands:
- The "extreme" band leans on the GT21 forensic anchors (Pairs 1, 2, 3, 10), the two most blatant identity-swap defects I found in the A-series (Pairs 6, 7 — A15_rhythm, A07_cooking) and Z-series (Pairs 8, 9 — Z03_studio), and clean-vs-known-flawed Z crossovers (Pairs 4, 5, 11, 13, 30) per HQ's suggested approach.
- The "moderate" and "subtle" bands are almost entirely same-subject, same-genre pairs (skincare ads vs. skincare ads, cars vs. cars, dance vs. dance, etc.) so TK is judging craft/direction differences rather than obvious technical breakage — this is where I'd expect the most disagreement/overturns, and where I've been most explicit about confidence being "medium."
- Two pairs (12 and, more tentatively, 24 and 27) are flagged because my own visual read disagrees with the old AI scoring run's ranking — I'd treat these as especially interesting for TK to check first, since a mismatch here is direct evidence of the kind of miscalibration Gate 1 is meant to catch.

## 축(Creative Direction / Execution / Originality) 분류 — 본부 지시 2026-09-09

특정 결함 유형에 편중된 pair 세트를 "전체 영상 품질 변별력"으로 착각하지 않기 위해,
30쌍 각각을 "왜 명백한 우열인가"와 "그 차이가 어느 축에서 발생하는가"로 재분류했다.
기준: **Execution** = 기술적 결함/완성도(정합성 붕괴, 물리 위반, 렌더링 결함, 흐림 등
"만듦새"의 문제. **Creative Direction** = 연출 의도/샷 구성의 강도(하나의 확실한
아이디어를 밀어붙였는가 vs 제네릭한 몽타주인가), 결함 유무와 무관. **Originality** =
독창성/기억에 남는 시각적 선택(제네릭 스톡풋티지 느낌 vs 눈에 띄는 컨셉).

| Pair | 우열 이유(요약) | 축 |
|---|---|---|
| 1 | 물체 무반응(물리 위반)+손가락 붕괴 vs 정상 | **Execution** |
| 2 | 반지 무반응(물리 위반) vs 정상 | **Execution** |
| 3 | 구슬 무반응(물리 위반) vs 정상 | **Execution** |
| 4 | Z01=설계된 low-intent(정적 앵글) vs A12=목적있는 다중 서브젝트 | **Creative Direction** |
| 5 | 모션블러/렌더링 결함 vs 크리스프 | **Execution** |
| 6 | 무설명 인물교체(연속 공연으로 제시) vs 일관 | **Execution** |
| 7 | 무설명 셰프교체(연속 스토리로 제시) vs 일관 | **Execution** |
| 8 | Z03=설계된 low-consistency(3인 이상 교체) vs 일관 모델 | **Execution** |
| 9 | 위와 동일(Z03) vs 일관 캐릭터 | **Execution** |
| 10 | 물체 무반응 vs 정상(9와 반대방향) | **Execution** |
| 11 | Z01=정적 단일앵글 vs 가니시/스팀/카메라워크 있는 "샷다운 샷" | **Creative Direction** |
| 12 | 모션블러 vs 크리스프 (단, B는 컨셉이 더 제네릭 — Originality는 오히려 A쪽에 가까울 수 있음, 아래 "긴장" 참고) | **Execution**(긴장: Originality는 반대일 수 있음) |
| 13 | 모션블러 vs 크리스프+일관된 중심인물 | **Execution** |
| 14 | 반복적 얼굴/병 교차 vs 다양한 시네마틱 샷 시퀀스(둘 다 기술결함 없음) | **Creative Direction** |
| 15 | 제네릭 드롭릿 클로즈업 vs 기억에 남는 금색리본 이중노출 히어로샷 | **Originality** |
| 16 | 단순 정적 포트레이트 vs 2인 액션+이펙트(둘 다 클린, 야심 차이) | **Creative Direction** |
| 17 | 얼굴 렌더링이 밀랍/부자연 vs 자연스러운 클로즈업+백뷰 턴 | **Execution** |
| 18 | 제네릭 멀티그룹 몽타주 vs 단일 컨셉+조명+색전환 | **Creative Direction** |
| 19 | 차량이 샷마다 다른 모델/색(정체성 붕괴, 실제 검증된 결함)+스파크 물리위반 vs 일관 | **Execution** |
| 20 | 위와 동일(A09 결함) vs 일관된 단일 차량 | **Execution** |
| 21 | 정적 포트레이트+병 vs 골드리퀴드 포어 히어로샷 추가(둘 다 클린) | **Creative Direction** |
| 22 | 여러 장소 짜깁기(제네릭 스카닉 컴필레이션) vs 단일 골든아워 히어로샷 | **Creative Direction** |
| 23 | 제네릭 레드팔레트 vs 일관된 모노크롬 미학+이중노출 컴포지트 | **Originality** |
| 24 | 크림텍스처 클로즈업 vs 플로팅 워터스피어 히어로샷(더 인상적인 단일 구성) | **Originality** |
| 25 | 프론트페이싱/텍스처 위주 vs 백뷰 턴으로 서사감 추가(둘 다 우수) | **Creative Direction** |
| 26 | 단일 캐릭터 플라이스루 vs 2인 상호작용+빔이펙트(둘 다 클린, 야심 차이) | **Creative Direction** |
| 27 | 정적 포트레이트/병 vs 다이나믹 보틀드롭/스플래시 히어로샷 | **Creative Direction** |
| 28 | 컷투컷 두 댄스크루(스루라인 없음) vs 단일 중심인물의 응집된 감정 비트 | **Creative Direction** |
| 29 | 후반부 구름이 갑자기 이상하게 소용돌이(시간적 정합성 붕괴, 실제 검증된 결함) vs 안정된 골든아워 | **Execution** |
| 30 | Z01=정적 단일앵글 vs 실제 손동작+물레회전+점토변형이 있는 인게이징 샷 | **Creative Direction** |

### 축 분포 — ★불균형 확인됨

| 축 | 개수 | 비율 |
|---|---|---|
| **Execution** | 15 | 50% |
| **Creative Direction** | 12 | 40% |
| **Originality** | **3** | **10%** |

**한쪽에 몰려 있다 — Originality가 심각하게 부족하다(30쌍 중 3쌍뿐, 그마저도 확신도
전부 medium).** 이유를 짚어보면: 이번 30쌍은 ①GT19~21(전부 Execution류 물리위반)
②Z01~03(설계 자체가 low-intent/low-consistency, 즉 Creative Direction·Execution
전용 픽스처) ③40편 자연조사에서 나온 실제 결함(대부분 Execution류: 정체성드리프트,
텍스트불안정, 모션결핍)을 앵커로 많이 썼기 때문 — Originality축 결함은 애초에
"결함"으로 나타나지 않고 "밋밋함/제네릭함"으로만 나타나서 포착이 더 어렵다.

**보완 필요**: Originality축 pair를 늘리려면 "둘 다 기술적으로 완벽히 클린하고
연출 강도도 비슷하지만 하나는 뻔하고 하나는 독창적인" 케이스를 더 찾아야 한다 —
현재 15/23/24가 이 유형에 가장 가깝다. 기존 자산(특히 CF그룹 나머지 조합, WD그룹)
에서 추가 스캔이 필요할 수 있음, 다음 마이닝 라운드에서 Originality축을 명시적으로
우선순위에 놓을 것을 제안.

## URLs that failed to load
None. All 43 remote R2 URLs from `_gate1_mockprelim_urls_2026-09-09.json` loaded successfully via `ffprobe`/`ffmpeg`; all 5 local GT21 files read successfully.
