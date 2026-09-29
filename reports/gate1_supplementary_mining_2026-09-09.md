# Gate-1 Supplementary Mining — Originality & Creative-Direction Pairs

Date: 2026-09-09
Method: for each candidate pair, pulled `ffprobe` duration on both clips, extracted 12 frames spread evenly across the full duration of each clip via `ffmpeg` (tiled into contact sheets), and viewed the actual frames. No pre-computed AI score was consulted. tk_render_1 and A04_morph got an extra close-up pass (individual full-res frames) to check the specific defect notes flagged in the brief. All proposals below are my own opinion only — not a verdict — and every pair still needs independent blind re-verification later.

Source pool: `reports/_gate1_mockprelim_urls_2026-09-09.json` (43 clips). All 6 never-used clips (A03_street, A04_morph, A05_plating, A06_splash, demo_anne, tk_render_1) were reviewed. None of the pairs below duplicate an exact A-vs-B combination from the round-1 "already tried" list.

---

## Originality-primary pairs (target 6-8)

### Originality Pair 1
- A: Z01_table — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_Z01_table_EN_9x16.mp4 — static overhead-ish shot of a plate of spaghetti bolognese on a plain white table (synthetic "deliberately boring" QA fixture, on-screen text literally reads "A plate, plainly")
- B: A04_morph — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A04_morph_EN_9x16.mp4 — fashion model whose outfit dissolves/shatters into a shimmer of particles and reforms into a new couture look ("One prompt. Infinite looks.")
- My opinion: B is better (confidence: high)
- Why: Both are clean, well-lit, professionally composed shots with no rendering defects. Z01_table is static and single-note by design — one angle, one plate, nothing changes. A04_morph is built around a genuinely inventive edit device (a glitter/ash dissolve-transition used as a wardrobe-change mechanic), plus camera movement and a memorable color world (magenta backdrop, afro/updo silhouettes). One note for the record: partway through, the dissolve transition also swaps to a second model — worth flagging so it isn't mistaken for a defect, but it reads as an intentional "look #2" reveal rather than a broken render, and it doesn't change the core originality read (the transformation device itself is the distinctive concept).

### Originality Pair 2
- A: A18_cities — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A18_cities_EN_9x16.mp4 — literal stock "world tour" cutting between the Eiffel Tower, Shibuya crossing, NYC skyline, Rio's Christ the Redeemer, the Colosseum, the Taj Mahal, and the Statue of Liberty (on-screen text: "The world in 30 seconds")
- B: tk_render_1 — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/renders/season_test/9b5ceed5-34b3-4a64-af4a-3fe898dd547f/c0114e2c-f374-4063-b146-4f54d5a71502.mp4 — aerial flyover of an imagined neon cyberpunk city (with flying-saucer silhouettes in the sky), diving into a light-speed street-level run, culminating in a giant glowing phoenix/angel figure rising over a plaza
- My opinion: B is better (confidence: high)
- Why: A18_cities is textbook generic/stock-footage-like — real, recognizable landmark photography with no original visual idea beyond "famous places, in sequence." tk_render_1 is a fully imagined world with an escalating narrative (flyover → speed run → mythic reveal) that nothing else in the pool resembles. I specifically checked this clip for the previously-flagged "garbled signage" and "floating light-trail" issues at full resolution: the flying discs read as an intentional stylistic choice (consistent across multiple frames, not a glitch), and the street-level light trails are a deliberate light-speed motion effect — one beam bends slightly off the road's vanishing point, a minor imperfection, but not a major defect that would undercut the technical-comparability requirement.

### Originality Pair 3
- A: A16_crowd — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A16_crowd_EN_9x16.mp4 — festival crowd cheering under stage lights with confetti falling, zooming in on one attendee ("Move the world")
- B: A14_solo — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A14_solo_EN_9x16.mp4 — solo dancer rendered entirely in silhouette against a stark spotlight, then against a golden backlight, flowing fabric catching the rim light ("Every move tells a story")
- My opinion: B is better (confidence: medium-high)
- Why: Both are polished and defect-free. A16_crowd is a very common "happy festival crowd + confetti" stock trope. A14_solo makes a specific, memorable lighting/composition choice — shooting the dancer as pure silhouette against blown-out light rather than a conventionally lit dance shot — which is a more distinctive visual concept than a well-executed but generic crowd shot. Not "high" because silhouette-dance lighting is itself a fairly familiar device within dance/perfume-ad visual language, just less common than the crowd trope.

### Originality Pair 4
- A: aquelle — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/cf/v3/cf_05_aquelle_cool.mp4 — blue-toned skincare ad, model portrait → bottle → water-droplet macro → application → tagline ("Pure hydration")
- B: noira — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/cf/v3/cf_06_noira_premium.mp4 — the same beauty-ad shot structure, but shot entirely in high-contrast black-and-white ("Beauty, uncolored")
- My opinion: B is better (confidence: medium-high)
- Why: All nine CF beauty/perfume ads in this pool share an almost identical shot template (portrait → product → texture macro → application → logo card), just recolored (gold, blue, coral, pink, red...). Within that context, aquelle is one of the more interchangeable/generic-feeling entries — pleasant but indistinguishable from several siblings. noira's full monochrome treatment is a genuinely bold departure from the template's usual glossy-color language and is the one CF ad that reads as a deliberate creative statement rather than a palette swap. Medium-high rather than high because this is a stylistic/grading choice more than a structural concept change — a close reader could argue it's "the same ad, different color."

### Originality Pair 5
- A: A06_splash — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A06_splash_EN_9x16.mp4 — red liquid pouring and splashing in slow motion against a dark background ("Taste, in motion")
- B: A02_fabric — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A02_fabric_EN_9x16.mp4 — magenta silk fabric rippling and folding, building into a hypnotic swirling vortex knot ("Watch fabric come alive")
- My opinion: B is better (confidence: medium-high)
- Why: Both are abstract macro product-style b-roll of comparable technical polish (clean lighting, no artifacts). Liquid-pour/splash macro is about as generic and stock-footage-familiar as this genre gets — it's a beverage-commercial cliché. The fabric clip builds to a genuinely unusual, almost hypnotic visual (a self-forming vortex/knot) that's more memorable and less "seen it a thousand times."

### Originality Pair 6
- A: A01_fashion — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A01_fashion_EN_9x16.mp4 — glossy runway show, feathered pink couture gown under stage lights
- B: A03_street — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A03_street_EN_9x16.mp4 — rain-slicked neon-lit city alley at night, multiple models in metallic puffer jackets ("Your style. AI's canvas")
- My opinion: B is better (confidence: medium-high)
- Why: Both are fashion-editorial in genre and similarly well-produced. A01_fashion is a straightforward "pretty dress on a runway" concept — the most boilerplate possible framing for a fashion ad. A03_street commits to a specific, atmospheric mood (rain, neon signage, cyberpunk street styling) that's a more distinctive visual world for the same product category. Not "high" since street-fashion/neon styling is itself a recognizable genre convention, not a wholly novel idea.

---

## Creative-Direction-primary pairs (target 4-6)

### CD Pair 1
- A: A18_cities — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A18_cities_EN_9x16.mp4 — see above, a strung-together sequence of unrelated world landmarks
- B: A02_fabric — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A02_fabric_EN_9x16.mp4 — see above, one continuous abstract shot building a single visual idea to a payoff (the vortex knot)
- My opinion: B is better (confidence: high)
- Why: This is the clearest possible Creative-Direction gap in the pool. A18_cities is a literal slideshow of disconnected, real-world locations with zero connective thread beyond "famous places" — by design (the on-screen copy even calls it a checklist: "the world in 30 seconds"). A02_fabric is one continuous shot, one visual idea, escalating in complexity toward a clear payoff moment. Obvious on a fair look, not a close call.

### CD Pair 2
- A: A13_group — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A13_group_EN_9x16.mp4 — cuts between two entirely different, unrelated dance crews (a K-pop-style all-female group in silver jackets on one stage, then a separate all-male street-dance crew in different lighting/wardrobe) with no connective narrative
- B: demo_duel — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/watch_demo/season_test/demo_duel.mp4 — two superhero-style characters (red energy vs. blue energy) fly toward each other in space and clash in an escalating energy-beam standoff
- My opinion: B is better (confidence: high)
- Why: demo_duel is one continuous, escalating action sequence — establishing shot of both characters converging, then progressively closer/more intense shots of the beam clash, a clear single throughline. A13_group reads as two unrelated stock dance clips spliced together under one caption; there's no shot logic connecting the two crews beyond "people dancing." The contrast is obvious without needing to look for defects.

### CD Pair 3
- A: A07_cooking — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A07_cooking_EN_9x16.mp4 — flambé/wok-tossing montage that cuts between two visibly different chefs in two different kitchens, connected only by "cooking with fire"
- B: A12_mech — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A12_mech_EN_9x16.mp4 — single continuous macro sequence moving across one engine block's timing chain, piston, and gears, all in one consistent blue-lit visual world ("Precision in every frame")
- My opinion: B is better (confidence: medium-high)
- Why: A12_mech commits to one subject and one lighting/color language throughout, with the camera continuously discovering new details of the same mechanism — a coherent single idea, even if a simple one. A07_cooking is a compilation that switches identity and location partway through with nothing tying the two halves together besides the general subject of "cooking." Medium-high rather than high because A12_mech's "direction" is fairly minimal (a slow macro crawl), so the gap, while real, is less dramatic than CD Pairs 1-2.

### CD Pair 4
- A: A20_culture — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A20_culture_EN_9x16.mp4 — Moroccan-market montage: souk interior → tea-pouring ceremony → stacked textiles → a tassel close-up, presented as a "many places, many vignettes" reel ("Every place. A story")
- B: demo_artisan — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/watch_demo/season_test/demo_artisan.mp4 — a single potter at a wheel, shot with a clear escalating progression: wide establishing shot of him entering the workshop → medium shot at the wheel → macro close-up of his hands shaping the clay
- My opinion: B is better (confidence: high)
- Why: demo_artisan follows one subject through a deliberate framing progression (wide → medium → macro) that builds toward the actual craft being performed — clear directorial intent. A20_culture strings together several unconnected vignettes (market, tea, textiles, a tassel) under a single "culture" umbrella with no single subject or narrative thread holding it together. The gap is obvious on a fair look.

### CD Pair 5
- A: Z03_studio — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_Z03_studio_EN_9x16.mp4 — plain studio portrait fixture that cuts between two unconnected models, both "in red," with no narrative beyond the wardrobe prompt (synthetic QA fixture)
- B: lumea — https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/cf/v3/cf_01_lumea_premium.mp4 — single-model, single-product premium skincare ad with a clear arc: face → product bottle → serum-texture macro → application → brand card, all in one consistent warm-light visual world
- My opinion: B is better (confidence: medium-high)
- Why: lumea ties every shot to one continuous story (one face, one product, one mood) building to a clear payoff (the branded final frame). Z03_studio is, by its own design as a QA fixture, just two unconnected portrait takes under a shared costume note ("in red") — there's no throughline linking the two models beyond the color of their outfits. Medium-high rather than high because Z03_studio is a synthetic test clip rather than a real attempt at a directed piece, which makes the comparison slightly less apples-to-apples than the other CD pairs.

---

## Yield summary

- **Originality-primary: 6 pairs found** (target was 6-8) — 2 at high confidence, 4 at medium-high. Hit the low end of the target range without padding.
- **Creative-Direction-primary: 5 pairs found** (target was 4-6) — 3 at high confidence, 2 at medium-high. Comfortably within target.

Honest assessment: the pool skews heavily toward two failure modes that are easy to find but aren't what this round needed — either genuine defects (identity swaps mid-clip: A01_fashion, A07_cooking, A08_dessert, A13_group, A15_rhythm, Z03_studio all do this) or content that is merely *pretty* rather than *distinctive* (the fine-dining macro shots, the drone-vista shots, most of the CF beauty-ad template). True Originality gaps — where both sides are equally clean and the only difference is "boring concept vs. interesting concept" — were genuinely hard to find outside of the two synthetic Z-fixtures (which were designed to be boring) and the two Studio/TK renders (which are the only content in the pool built around an actual creative idea rather than a stock-footage genre). I did not force any "medium" calls to pad either list; every pair above is one I'd stand behind as medium-high or better on an honest look.
