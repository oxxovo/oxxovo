# GT CLEAN-ALL Candidate Shortlist — 2026-09-09

Purpose: expand the clean-control pool (currently 2: GT01 from `demo_artisan.mp4`, GT02 from
`A02_fabric.mp4`; GT03 from `A05_plating.mp4` rejected — hard splice) toward 8-10, with a genuine
mix of AI-generated and real/licensed footage. Rubric used: v1.3 (8 scored categories —
faceIdentity, anatomy, objectConsistency, motion, background, lighting, continuity, editing —
plus record-only otherArtifacts; audiovisualSync removed entirely, not evaluated).

This is a **first pass only**. A second independent blind pass is required before anything here
enters the certified pool.

Tooling: `ffprobe` for stream metadata, `ffmpeg scdet=threshold=8` for objective cut detection,
single-call sparse (3x3, fps~0.5) then dense (4x3, fps~0.6-0.8) contact-sheet frame grids for
visual inspection. No audio was extracted or analyzed (out of scope per v1.3).

---

## 1. Full unused-candidate inventory

Source library has 54 total `.mp4` files under `outputs/gt21/src/`. 24 are already spoken for
(18 explicitly excluded as already-used + 6 GT19/20/21 raw/v2 source files). That leaves **30
unused candidates**:

| # | File | Duration | Resolution/fps | Notes from ffprobe |
|---|------|----------|-----------------|---------------------|
| 1 | A01_fashion.mp4 | 19.0s | 1920x1080 30fps | |
| 2 | A01_fashion_fusion.mp4 | 19.0s | 1920x1080 30fps | |
| 3 | A01_fashion_wearable.mp4 | 19.0s | 1920x1080 30fps | |
| 4 | A04_morph.mp4 | 19.0s | 1920x1080 30fps | |
| 5 | A06_splash.mp4 | 19.0s | 1920x1080 30fps | |
| 6 | A13_group.mp4 | 19.0s | 1920x1080 30fps | |
| 7 | A14_solo.mp4 | 19.0s | 1920x1080 30fps | |
| 8 | A15_rhythm.mp4 | 19.0s | 1920x1080 30fps | |
| 9 | A18_cities.mp4 | 19.0s | 1920x1080 30fps | |
| 10 | A20_culture.mp4 | 19.0s | 1920x1080 30fps | |
| 11 | cf_01_lumea_premium.mp4 | 27.0s | 1920x1080 30fps | |
| 12 | cf_02_aurelie_premium.mp4 | 27.0s | 1920x1080 30fps | |
| 13 | cf_06_noira_premium.mp4 | 27.0s | 1920x1080 30fps | |
| 14 | cf_07_eclare_premium.mp4 | 27.0s | 1920x1080 30fps | |
| 15 | cf_08_soira_premium.mp4 | 27.0s | 1920x1080 30fps | |
| 16 | cf_09_velix_pop.mp4 | 27.0s | 1920x1080 30fps | |
| 17 | demo_anne.mp4 | 15.07s | 1280x720 24fps | |
| 18 | demo_astronaut.mp4 | 15.04s | 1920x1080 24fps | |
| 19 | demo_consistency.mp4 | 20.10s | 1280x720 30fps | |
| 20 | demo_duel.mp4 | 15.04s | 1920x1080 24fps | |
| 21 | demo_sf.mp4 | 5.88s | 1920x1080 24fps | |
| 22 | g_anne_cafe.mp4 | 15.07s | 1280x720 24fps | |
| 23 | g_astro_single.mp4 | 15.04s | 1920x1080 24fps | |
| 24 | g_composed.mp4 | 15.02s | 1280x720 24fps | |
| 25 | g_ichar2.mp4 | 5.04s | 1244x1660 24fps | |
| 26 | g_ichar3.mp4 | 5.04s | 1244x1660 24fps | |
| 27 | g_sfx_a.mp4 | 8.04s | 1920x1080 24fps | |
| 28 | g_sfx_c.mp4 | 5.64s | 1280x720 25fps | |
| 29 | seedance_1.mp4 | 15.04s | 720x1280 24fps | |
| 30 | tk_render_2.mp4 | 21.02s | 1280x720 24fps | |

Content check (not filename-based): the `A01-A20` series are all OXXOVO-branded marketing cuts
("Fashion, reimagined by AI.", "The world in 30 seconds.", etc.) but the underlying footage in
every A-series file inspected is photoreal in a way consistent with licensed/stock b-roll (real
skin micro-texture, natural cloth physics, real architectural landmarks, real liquid-pour
dynamics) — tagged **real/licensed** below. The `demo_*`, `g_*`, `cf_*`, `seedance_*`,
`tk_render_*` families are OXXOVO Studio AI renders (astronaut/sci-fi/cosmetic-ad/cartoon
generations) — tagged **AI-generated**.

## 2. Screened out (quick-screen or partial full-screen — not in final shortlist)

| File | Reason |
|------|--------|
| A01_fashion.mp4 | Hard subject swap ~mid-clip: dark-skinned model in pink gown cuts to an unrelated blonde model in a different silver gown. High identity/continuity risk, not pursued. |
| A04_morph.mp4 | Explicit "One prompt. Infinite looks." reel — by design shows a model/outfit continuously morphing through many different looks. Not a clean identity/object-consistency candidate by construction. |
| A14_solo.mp4 | Single silhouette dancer, but lighting/background shifts partway through from a cool blue spotlight stage to a warm orange backlit scene. Not verified whether this is a hard cut or an in-shot grade change; deprioritized under time budget once enough passing candidates were secured. |
| A15_rhythm.mp4 | Subject swap mid-clip: dark-skinned dancer in a green top cuts to an unrelated platinum/pink-haired woman in different wardrobe. High identity-continuity risk. |
| cf_06_noira_premium.mp4 | Same clean template family as cf_01/02/07/08/09 (quick-screen 3x3 looked clean, monochrome cosmetics ad) but not run through the dense/scdet full check — time budget. Likely also clean; recommended as a follow-up candidate. |
| demo_consistency.mp4 | Astronaut walk, same family as demo_astronaut/g_composed, but the sky develops a streaky reddish cloud distortion in the second half — unclear if intentional VFX sky animation or a background-instability defect. Not resolved; deprioritized. |
| demo_duel.mp4 | Fast VFX space-battle between two characters, multiple hard cuts, energy-beam effects. High risk of motion/anatomy artifacts under fast action; not a low-risk "clean" candidate. |
| demo_sf.mp4 | Same VFX-battle style/likely continuation of demo_duel; also only 5.9s (below typical 10-19s GT floor). |
| g_astro_single.mp4 | Astronaut figure is nearly motionless across nearly all sampled frames next to a lander/panel prop — possible frozen/collapsed-motion risk if the shot is meant to be dynamic. Not fully verified. |
| g_ichar2.mp4 | Jacket emblem/patch appears to change design between early frames and late frames (possible objectConsistency defect) — also only 5.0s, below the typical duration floor. Needs a second look before use. |
| g_ichar3.mp4 | Otherwise clean (consistent identity, patch, skin texture across a face-profile turn) but only 5.0s — too short to stand alone as a typical 10-19s GT clip. |
| g_sfx_a.mp4 | Clean-looking cosmetics-style close-up but only 8.0s — below typical duration floor. |
| g_sfx_c.mp4 | Only 5.6s, and contact-sheet extraction returned just 3 usable frames instead of the expected ~9 (possible decode/frame-count anomaly). Inconclusive, not pursued further. |
| seedance_1.mp4 | Visually promising continuous skincare jar-unboxing/application demo (single model, single subject), but not run through the dense-frame/scdet full check under this pass's time budget. Recommended follow-up candidate. |
| tk_render_2.mp4 | Contact-sheet extraction returned only 3 of the expected ~9 frames despite a reported 21s duration — possible corrupt/truncated stream or variable-frame-rate issue. Inconclusive; re-probe before use. |

## 3. Shortlist — full 8-category check (12 candidates, all passed as NEGATIVE on all 8 scored categories)

Method per candidate: `ffprobe` (duration/stream), `ffmpeg scdet=threshold=8` (objective cut list,
logged below), a 12-frame dense contact-sheet (single ffmpeg call, tile 4x3) at ~480px width, and
visual inspection against each of the 8 scored categories + otherArtifacts. All all-black
"COMPETE. EARN POINTS. BUILD YOUR RANK. OXXOVO" or brand-tagline end-cards seen in several A-series
and cf-series files are OXXOVO promo slates, not part of the generated content — trim
recommendations below exclude them.

### AI-generated (6)

**cf_01_lumea_premium.mp4** — cosmetics ad ("LUMEA"), 27.0s. scdet: **zero cuts detected** (single
continuous take/camera move, or crossfade-only blends — no hard scene cut over the full 27s).
| Category | Verdict | Evidence |
|---|---|---|
| faceIdentity | NEGATIVE | Same model face/hair recognizable across all 12 sampled frames (profile, hand-on-cheek, 3/4 views); no drift. |
| anatomy | NEGATIVE | Hand-on-face shots (t≈20-25s) show normal 5-finger count, natural joints, no extra/missing digits. |
| objectConsistency | NEGATIVE | "LUMEA" bottle label/cap consistent in every product shot (t≈7,9,22.5,24.75s). |
| motion | NEGATIVE | Natural head turns and hand-raise; no freezing or unnatural snap between sampled frames. |
| background | NEGATIVE | Marble surface / warm-curtain backdrop stable throughout, no warping. |
| lighting | NEGATIVE | Consistent warm directional key light across all shots; a mid-clip (~t=6.75s) dissolve briefly overlaps a translucent bottle silhouette over the face — this is an intentional crossfade transition, not a lighting inconsistency. |
| continuity | NEGATIVE | No unexplained spatial/temporal breaks; product-to-face cutaways are a normal ad structure. |
| editing | NEGATIVE | The one dissolve transition (~t=6.75s) is a clean, deliberate crossfade, not jarring or broken. |
| otherArtifacts (record only) | NEGATIVE | No flicker/warp noted on liquid-serum swirl close-ups (t≈11,13.5s). |
Tag: **AI-generated**. Trim: content appears to end by ~t=24.5s before the "LUMEA — Light begins within" closing card; recommend **[0, ~24s]**, or tighten further to a 15-19s window (e.g. drop the first ~5s) if a stricter typical-length clip is wanted.

**cf_02_aurelie_premium.mp4** — cosmetics ad ("AURÉLIE"), 27.0s. scdet: **zero cuts**.
| Category | Verdict | Evidence |
|---|---|---|
| faceIdentity | NEGATIVE | Same model throughout, consistent facial structure across all angles. |
| anatomy | NEGATIVE | Hand-on-cheek shots (t≈20,22.5s): normal fingers, no anatomy errors. |
| objectConsistency | NEGATIVE | Amber dropper bottle "AURELIE" label consistent across all product shots. |
| motion | NEGATIVE | Natural eye/head motion, droplet falls naturally onto skin (t≈13.5s). |
| background | NEGATIVE | Beige linen/curtain backdrop stable, no morphing. |
| lighting | NEGATIVE | Warm consistent key light; same crossfade-dissolve pattern as cf_01 at ~t=6.75s (bottle silhouette over face), intentional. |
| continuity | NEGATIVE | No unjustified spatial/temporal jumps. |
| editing | NEGATIVE | Dissolve transition clean, not broken. |
| otherArtifacts (record only) | NEGATIVE | Serum-droplet macro (t≈13.5s) shows correct refraction, no flicker. |
Tag: **AI-generated**. Trim: same pattern as cf_01 — recommend **[0, ~24s]** (drop trailing brand card).

**cf_07_eclare_premium.mp4** — cosmetics ad ("ÉCLARE"), 27.0s. scdet: **zero cuts**.
| Category | Verdict | Evidence |
|---|---|---|
| faceIdentity | NEGATIVE | Same model consistent across all 12 frames. |
| anatomy | NEGATIVE | Hand-on-face frames (t≈20,22.5s) show correct 5-finger hands. |
| objectConsistency | NEGATIVE | Gold hexagonal "ÉCLARE" bottle consistent in every product shot. |
| motion | NEGATIVE | Natural head tilt / hand raise, no freezing. |
| background | NEGATIVE | Warm gold-lit backdrop stable. |
| lighting | NEGATIVE | Consistent gold rim-lighting; same dissolve-transition pattern at ~t=6.75s. |
| continuity | NEGATIVE | No unjustified breaks. |
| editing | NEGATIVE | Dissolve clean. |
| otherArtifacts (record only) | NEGATIVE | Gold serum-swirl macro (t≈11,13.5s) shows glitter particles rendered consistently, no flicker. |
Tag: **AI-generated**. Trim: recommend **[0, ~24s]**.

**demo_astronaut.mp4** — astronaut on Mars dunes, 15.04s. scdet: cuts at **t≈4.96s, 10.04s** (3 shots: wide dune walk, medium 3/4 turn+wave, helmet close-up).
| Category | Verdict | Evidence |
|---|---|---|
| faceIdentity | NEGATIVE | Face fully enclosed by helmet visor throughout; no exposed-face identity to drift. |
| anatomy | NEGATIVE | Gloved waving hand (t≈7-10s) shows a natural hand/wrist pose, no malformation. |
| objectConsistency | NEGATIVE | Suit livery (orange trim, chest patch, helmet stripe) identical across all 3 shots. |
| motion | NEGATIVE | Walking gait and wave gesture are smooth and physically plausible across cuts. |
| background | NEGATIVE | Dune ridgeline / rock formation / sun position consistent within each shot, no warping. |
| lighting | NEGATIVE | Warm low-sun backlight consistent across all 3 shots. |
| continuity | NEGATIVE | 3-shot structure (wide -> medium -> close) is a normal, narratively justified sequence. |
| editing | NEGATIVE | Both cuts are clean hard cuts, not glitchy. |
| otherArtifacts (record only) | NEGATIVE | No texture flicker on suit or sand. |
Tag: **AI-generated**. Trim: none needed, full 15.04s clean.

**demo_anne.mp4** — 3D-cartoon girl in an autumn park, 15.07s. scdet: cuts at **t≈5.46s, 9.96s** (near-static framing across all three; likely a slow push-in/eyeline change rather than a hard scene change, but flagged as cuts by scdet regardless).
| Category | Verdict | Evidence |
|---|---|---|
| faceIdentity | NEGATIVE | Same stylized character (hair, freckles, face shape) identical across all 12 frames. |
| anatomy | NEGATIVE | Hands stay in jacket pockets/at sides throughout — no visible malformation. |
| objectConsistency | NEGATIVE | Yellow jacket, backpack strap, park benches/lamppost/skyline identical across all frames. |
| motion | NEGATIVE | Subtle idle animation (blinks, smile, head turn) and falling leaves move naturally; no freezing. |
| background | NEGATIVE | Park/skyline background stable, no warping. |
| lighting | NEGATIVE | Consistent soft daylight throughout. |
| continuity | NEGATIVE | No unexplained spatial/temporal jump. |
| editing | NEGATIVE | No jarring transitions. |
| otherArtifacts (record only) | NEGATIVE | Falling leaves render consistently, no flicker/morphing. |
Tag: **AI-generated**. Trim: none needed, full 15.07s clean.

**g_composed.mp4** — astronaut walking dunes (companion piece to demo_astronaut), 15.02s. scdet: cuts at **t≈5.02s, 10.02s**.
| Category | Verdict | Evidence |
|---|---|---|
| faceIdentity | NEGATIVE | Face fully enclosed by helmet, no identity to drift. |
| anatomy | NEGATIVE | Walking pose/limb articulation natural in all 3 segments. |
| objectConsistency | NEGATIVE | Same suit design/backpack across all shots. |
| motion | NEGATIVE | Consistent walking gait; dust kicked up by footsteps (t≈12.5s) renders as a believable physical detail, not an artifact. |
| background | NEGATIVE | Dune ridgeline and sunset sky consistent within each of the 3 shots. |
| lighting | NEGATIVE | Warm low-sun light consistent throughout. |
| continuity | NEGATIVE | 3-shot walk sequence narratively coherent. |
| editing | NEGATIVE | Clean hard cuts. |
| otherArtifacts (record only) | NEGATIVE | No flicker on suit/sand/dust particles. |
Tag: **AI-generated**. Trim: none needed, full 15.02s clean.

*(Bonus — same template family, spot-checked at the same dense-grid resolution as cf_01/02/07 and found equally clean, but full evidence table omitted for brevity: **cf_08_soira_premium.mp4** and **cf_09_velix_pop.mp4**, both zero-cut per scdet, consistent model/product/lighting throughout, normal hand anatomy in all hand-on-face shots. Recommend trim **[0, ~24s]** for both. **g_anne_cafe.mp4** (15.07s, zero cuts) — cartoon girl at a rainy cafe window, consistent identity/mug/hand position throughout, no defects observed; no trim needed.)*

### Real/licensed (6)

**A06_splash.mp4** — macro liquid-pour product shot ("Taste, in motion."), 19.0s. scdet: **zero cuts** (single continuous take).
| Category | Verdict | Evidence |
|---|---|---|
| faceIdentity | NEGATIVE | No person in frame. |
| anatomy | NEGATIVE | No person/hands in frame. |
| objectConsistency | NEGATIVE | Single red liquid stream/splash-crown physics, consistent color and vessel throughout. |
| motion | NEGATIVE | Splash/droplet dynamics follow consistent real fluid physics (crown formation, droplet fall, reabsorption) across the whole clip. |
| background | NEGATIVE | Black background with subtle red bokeh, stable throughout. |
| lighting | NEGATIVE | Consistent single top-down key light on the liquid column. |
| continuity | NEGATIVE | Single unbroken take, no discontinuity. |
| editing | NEGATIVE | No cuts at all. |
| otherArtifacts (record only) | NEGATIVE | No warping/flicker on droplets or reflections. |
Tag: **real/licensed** (practical macro photography — droplet/splash physics are exactly consistent with real high-speed liquid photography). Trim: content appears to run to ~t=13-14s before the OXXOVO promo end-card kicks in; recommend **[0, ~14s]** (verify exact cut point before use).

**A01_fashion_fusion.mp4** — avant-garde runway look, 19.0s. scdet: cuts at **t≈8.0s, 16.0s** (wide walk -> torso/collar medium shot -> fabric-texture macro).
| Category | Verdict | Evidence |
|---|---|---|
| faceIdentity | NEGATIVE | Same model (dark-skinned, blue eye makeup, black bob) recognizable across all shots. |
| anatomy | NEGATIVE | Arms/hands/gait natural in the walking segment; no malformation. |
| objectConsistency | NEGATIVE | Iridescent geometric collar + wrap skirt design identical across all 3 segments, including the macro fabric-lattice pattern in the final segment. |
| motion | NEGATIVE | Natural runway walk, no collapse/freeze. |
| background | NEGATIVE | Magenta stage lighting/runway consistent; final macro segment is a fabric close-up (no separate background to judge). |
| lighting | NEGATIVE | Consistent magenta/pink stage lighting across shots. |
| continuity | NEGATIVE | 3-shot structure (wide walk -> medium detail -> macro texture) is a standard, narratively-justified fashion-film edit. |
| editing | NEGATIVE | Both hard cuts are clean, not glitchy. |
| otherArtifacts (record only) | NEGATIVE | Fabric lattice weave pattern renders identically and stably across the 4 macro frames sampled (t≈12.7-17.4s). |
Tag: **real/licensed** (runway/editorial footage — skin, fabric physics and studio lighting read as genuinely photographed). Trim: OXXOVO promo end-card appears by ~t=15.8s in the sampling; recommend **[0, ~14s]** to stay clear of it (verify exact cut).

**A01_fashion_wearable.mp4** — houndstooth/pastel runway suit, 19.0s. scdet: cuts at **t≈8.0s, 16.0s** (same 3-shot structure as fusion).
| Category | Verdict | Evidence |
|---|---|---|
| faceIdentity | NEGATIVE | Same model (slicked-back hair) consistent across all shots. |
| anatomy | NEGATIVE | Natural walk and turn, hands/arms unremarkable. |
| objectConsistency | NEGATIVE | Suit pattern/cutout shoulder detail identical front and back (t≈9.5s back view matches earlier front views). |
| motion | NEGATIVE | Smooth walk and turn-around, no freeze/collapse. |
| background | NEGATIVE | Magenta stage consistent; macro segment has no separate background. |
| lighting | NEGATIVE | Consistent stage lighting. |
| continuity | NEGATIVE | Same standard wide -> medium -> macro structure. |
| editing | NEGATIVE | Clean hard cuts. |
| otherArtifacts (record only) | NEGATIVE | Fabric lattice macro (t≈12.7-17.4s) stable, no flicker. |
Tag: **real/licensed**. Trim: same as fusion — recommend **[0, ~14s]**.

**A18_cities.mp4** — "The world in 30 seconds" landmark montage, 19.0s. scdet: cuts at **t≈1.3, 8.0, 8.3, 10.9, 13.0, 16.0s** (Eiffel Tower / Tokyo crossing / NYC skyline / Rio Christ+skyline / Colosseum / Taj Mahal / Statue of Liberty).
| Category | Verdict | Evidence |
|---|---|---|
| faceIdentity | NEGATIVE | No identifiable individual faces (crowd shot at Tokyo crossing is long-shot/anonymous). |
| anatomy | NEGATIVE | No close-up human subjects. |
| objectConsistency | NEGATIVE | Each landmark (Eiffel Tower, One WTC, Christ the Redeemer, Colosseum, Taj Mahal, Statue of Liberty) renders with correct, undistorted real-world architecture in every sampled frame. |
| motion | NEGATIVE | Natural water/boat motion (Eiffel Tower shot), crowd motion (Tokyo), no unnatural motion. |
| background | NEGATIVE | Sky/water/vegetation stable within each shot, no warping. |
| lighting | NEGATIVE | Each shot has coherent, physically plausible lighting for its scene (blue sky, dusk NYC, daylight Rio/Rome/Agra). |
| continuity | NEGATIVE | Rapid landmark-to-landmark cutting is explicitly the concept ("the world in 30 seconds") — narratively justified, not an unexplained break. |
| editing | NEGATIVE | All 6 detected cuts are clean hard cuts between real stock shots, not broken/glitchy. |
| otherArtifacts (record only) | NEGATIVE | No warping/flicker on any of the architectural details inspected (Colosseum arches, Taj Mahal dome, Liberty crown). |
Tag: **real/licensed** (stock/licensed landmark b-roll — iconic real-world architecture at native fidelity is not something these AI pipelines reproduce this precisely). Trim: promo end-card appears in the last ~2 sampled frames; recommend **[0, ~14s]** (verify exact cut).

**A20_culture.mp4** — Morocco souk/tea-vendor/textile montage ("Every place. A story."), 19.0s. scdet: cuts at **t≈8.0s, 16.0s** (spice-souk interior -> tea-pouring vendor -> rug stack -> tassel macro).
| Category | Verdict | Evidence |
|---|---|---|
| faceIdentity | NEGATIVE | Vendor's face consistent across the tea-pour shot; crowd in the souk shot is anonymous/long-shot. |
| anatomy | NEGATIVE | Vendor's arms/hands during the pour (t≈9.5-11s) move naturally, no malformation. |
| objectConsistency | NEGATIVE | Teapot/tray/rug setup identical across the two tea-pour frames; rug patterns identical across the 3 rug-stack frames. |
| motion | NEGATIVE | Steam rises naturally from the teapot; pour stream behaves like real liquid. |
| background | NEGATIVE | Ornate archway/tilework stable across the tea-pour shots; sky/sand backdrop stable behind the rug/tassel macro shots. |
| lighting | NEGATIVE | Warm interior light in the souk/archway shots, bright overcast light in the rug/tassel macro shots — each internally consistent. |
| continuity | NEGATIVE | Souk -> vendor -> textiles is a coherent travel-documentary sequence, narratively justified. |
| editing | NEGATIVE | Both cuts clean. |
| otherArtifacts (record only) | NEGATIVE | No flicker/warping on the rug's woven pattern across the 3 sampled frames. |
Tag: **real/licensed** (documentary/travel stock b-roll). Trim: promo end-card appears near the end; recommend **[0, ~14s]** (verify exact cut).

**A13_group.mp4** — "Let movement become emotion" dance-performance montage, 19.0s. scdet: cuts at **t≈3.77-4.60s (5 closely-spaced cuts, likely fast internal edit within the group routine), 8.0s, 16.0s** (girl-group choreography w/ LED-screen backdrop -> street/b-boy dancers, different venue).
| Category | Verdict | Evidence |
|---|---|---|
| faceIdentity | NEGATIVE | Each performer's identity is stable within their own shot; no drift observed. |
| anatomy | NEGATIVE | Fast choreography (mid-air kick, floor freezes) shows physically plausible limb positions throughout, including at the peak of the jump (t≈3.8s) — no extra/missing limbs. |
| objectConsistency | NEGATIVE | Costumes (silver jacket/black shorts for the group; yellow hoodie, red bandana for individual dancers) consistent within their respective shots. |
| motion | NEGATIVE | Motion blur present is consistent with genuine fast live-action dance capture, not a generation artifact; no freeze/collapse. |
| background | NEGATIVE | Stage lighting rig, LED backdrop screen, and venue framing are stable within each shot. |
| lighting | NEGATIVE | Purple/blue concert lighting consistent within the first venue; warmer stage lighting consistent within the second. |
| continuity | NEGATIVE | Cutting between dance groups/styles is a normal, narratively justified performance-reel structure. |
| editing | NEGATIVE | All cuts are clean hard cuts; the 5 closely-spaced cuts around t≈4s read as normal fast-paced highlight editing, not glitches. |
| otherArtifacts (record only) | NEGATIVE | LED screen in the background shows a normal camera-vs-screen refresh interaction (mild moire), which is a real-world filming artifact, not an AI-generation artifact — recorded as NONE OBSERVED per the category's AI-artifact scope. |
Tag: **real/licensed** (live performance footage). Trim: promo end-card appears at the end; recommend **[0, ~14s]** (verify exact cut).

## 4. Summary

- **12 candidates passed all 8 scored categories as NEGATIVE** (otherArtifacts also NEGATIVE for all): 6 AI-generated + 6 real/licensed.
- Plus **3 bonus/spot-checked passes** in the same clean template families (cf_08_soira_premium, cf_09_velix_pop, g_anne_cafe) — same construction and same clean result, evidence abbreviated above.
- **Total this pass: 15 clips screened clean**, well above the "at least 8" target, split roughly evenly: **9 AI-generated / 6 real-licensed** (or 6/6 if only the fully-tabled 12 are counted).
- **2 close-call / needs-another-look** items flagged during screening but not promoted: A14_solo.mp4 (lighting transition, unresolved cut-vs-grade question) and demo_consistency.mp4 (possible background sky instability).
- **13 items screened out** with reasons in section 2 (subject swaps, intentional morph reels, too-short duration, decode anomalies, or simply not reached under the time budget — cf_06_noira_premium and seedance_1 both look promising on quick screen and are recommended follow-ups).
- All recommended trims stay within or near the typical 10-19s GT clip length; exact in/out frames should be re-verified with a frame-accurate scrub before final use, per this codebase's parity-harness discipline.
