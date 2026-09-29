# Blind Second-Pass Verification — Agent 4 — 2026-09-09

Independent forensic review of GT14-GT18. No prior answer-key files were read. Method: `ffprobe` (duration/streams), `ffmpeg` scene-cut detection (`select='gt(scene,0.08)'`), `freezedetect`, `volumedetect`/`silencedetect`, and dense time-seeked frame extraction (`-ss <t> -frames:v 1`, which is reliable; an initial frame-index-based extraction (`select='not(mod(n,N))'`) was discarded mid-task after it produced internally inconsistent timestamps, likely from B-frame reordering).

Legend: state = POSITIVE (defect directly observed) / NEGATIVE (absence directly confirmed) / UNVERIFIED (genuinely unresolved). Evidence tags: [육안]=visual frame inspection, [구조]=structural/ffmpeg-filter evidence (freezedetect, scdet, stream count), [제작]=production/file-level evidence, [scdet]=scene-cut detector output, [오디오분석]=volumedetect/silencedetect only (no content listening).

---

## GT14_continuity1.mp4 (15.0s, 1080x1920, 30fps, has audio)

Sunrise-over-mountains "Chase horizons." B-roll. Two shots: (1) 0.0-7.5s static-camera valley/fog vista with a smooth sunrise brightening; (2) 8.0s-14.9s essentially static close-up on a single snow peak with sun beside it. One hard cut confirmed at pts_time=8.0s (only scdet hit in the whole clip); frames at t=7.5s and t=8.0s bracket a clean, instantaneous swap with no glitch/freeze artifact. No human subject anywhere.

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| N [육안] no human present anywhere in clip | N [육안] no human/animal anatomy present | N [육안] no object besides terrain/sun; lens flare is a stable artistic element, no deformation | N [육안][구조] shot1 = static cam + smooth sunrise brighten, shot2 = static; no collapse/freeze/unnatural motion | N [육안] terrain/cloud/sun stable across dense sampling within each of the 2 shots | N [육안] shot1's brightening is one smooth continuous progression (not a jump); shot2 stable; no incoherent lighting within a shot | N [육안][scdet] single hard cut 8.0s from wide valley to close peak; both are golden-hour mountain vistas — reads as a conventional multi-shot travel-reel montage, not an impossible/contradictory spatial claim | N [scdet] the one cut is clean (no freeze/glitch/duplicate frame at the boundary) | N [육안] no unstable texture/geometry beyond ordinary lens-flare/HDR grading | U [오디오분석] audio present & continuous (mean -13.9dB, max -0.0dB, no silence gaps) but purely instrumental/ambient landscape B-roll — no visible mouth or sound-producing event to check correspondence against |

`GT14_continuity1: row(N, N, N, N, N, N, N, N, N, U)`

---

## GT15_continuity2.mp4 (15.0s, 1080x1920, 30fps, has audio)

Composite of **two unrelated ad templates**. Segment A (0.0-~7.2s): "Take us on a journey." aerial coastal-mountain shot, visually near-static (freezedetect found **zero** frozen intervals ≥1s anywhere in the file, so it is not a true freeze, just an extremely slow/subtle shot — confirmed with 0.1-0.3s-dense sampling through the two scdet-flagged windows 0-0.8s and 2.1-3.8s, which show only a slowly drifting lens-flare streak, not real cuts). At **~7.2-7.3s** a hard cut lands on Segment B: "Motion is emotion." — a black sports car drifting through a neon night city, caption text changing mid-cut. A second, internal cut at ~8.0-8.5s (wide car shot → close-up burnout wheel) is a normal cutaway within Segment B itself.

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| N [육안] no human face in either segment | N [육안] no human anatomy present | U [육안] same black coupe plausible across wide (7.3-7.9s) vs close-up-wheel (8.5-14.9s) framing, but the crop change (no shared reference point, e.g. plate) prevents full confirmation | N [구조][육안] freezedetect: 0 frozen segments in the entire 15s despite Segment A looking near-static; Segment B shows coherent wheel-spin/smoke-plume physics | N [육안] Segment A terrain stable under 0.1s-dense sampling (only the slow flare streak moves); Segment B cityscape stable within its own segment | N [육안] each segment is internally coherent (golden-hour daylight vs blue-neon night); the cross-segment lighting swap accompanies the content swap, not a within-shot inconsistency | **P** [육안]★ caption literally switches "Take us on a journey." → "Motion is emotion." exactly at the ~7.2s hard cut, simultaneous with a total unrelated-subject change (aerial coastal mountains → night-city car drift) — two unrelated ad templates spliced together, unexplained | **P** [scdet][육안] jarring hard cut at ~7.2s joining unrelated content with no transition; scdet shows a dense cut-cluster at pts_time 7.0-8.0 bracketing it; caption mismatch corroborates a defective/broken splice, not intentional editing | N [육안] no unstable texture/geometry distinct from BG | U [오디오분석] one continuous audio bed (mean -14.2dB, max -0.0dB, no silence) spans the splice — cannot verify audio content matches either visual segment without listening |

`GT15_continuity2: row(N, N, U, N, N, N, P, P, N, U)`

---

## GT16_background1.mp4 (5.04s, 1244x1660, 24fps, has audio)

Head-and-shoulders shot of a woman in a green flight-jacket (patches/badge visible), facing camera. **0 scene cuts detected for the entire clip** (scdet). Dense 0.1-0.2s sampling from t=2.5s to t=3.7s shows the background smoothly morphing, in-shot, from a flat beige wall into a sci-fi ship corridor/door frame with blue neon strip lighting, while the subject (face, hair, jacket, patches) stays essentially unchanged.

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| N [육안] face (freckles, eye color, features) consistent across the transition, t=2.5s vs t=3.1-4.8s | U [육안] hands/limbs never enter frame in this head-and-shoulders composition for the full 5s — cannot assess | N [육안] jacket, shoulder patch, chest badge unchanged in shape/color across the transition | N [구조][육안] 0 scene cuts (scdet) for the whole clip yet the background fully changes — confirms in-shot morph not a cut; subject's own motion (subtle head/hair sway) is natural | **P** [육안]★ at t=2.5s background = flat beige wall; by t=2.9-4.8s it has smoothly morphed into a sci-fi corridor/door frame with neon strip lighting — full environment change with 0 detected cuts, i.e. blended/warping rather than cut | N [육안] the lighting shift (soft flat → blue rim-lit) is coherent with, and internal to, the same background-morph event already captured under BG; each state is internally consistent | **P** [육안]★ same evidence as BG: subject's physical location changes (plain room → ship corridor) with no cut and no narrative explanation — spatial discontinuity | N [scdet] 0 scene cuts across the whole 5.04s clip, so no jarring/broken cut occurred (blended transition = evidence for editing=negative per rule) | N [육안] no additional generic texture/geometry artifact beyond the background-morph itself (already scoped to BG) | U [오디오분석] audio present but quiet (mean -31.7dB, max -13.1dB, no silence); subject's mouth never opens/moves in sampled frames — no speech event to check |

`GT16_background1: row(N, U, N, N, P, N, P, N, N, U)`

---

## GT17_background2.mp4 (15.0s, 1080x1920, 30fps, has audio)

"The beauty of speed." — a single continuous-feeling dynamic hero shot of a blue/cyan sports car speeding through a neon night city, camera orbiting/tracking with heavy motion blur throughout. scdet flags 68 "cuts," but dense sampling across the full 15s shows continuous, consistent content (same car, same environment, same visual style) — the high count is attributable to motion-blur-driven frame-to-frame difference, not real hard cuts to different content.

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| N [육안] no human depicted, pure car b-roll | N [육안] no human anatomy present | N [육안] same car silhouette, headlight/taillight design (distinctive checkmark LED), wheel style consistent across all 15s despite heavy blur; apparent paint-color shifts attributable to neon reflections | N [육안] wheel spin, spark trails, smoke plume all physically coherent with the depicted speed; no freeze or impossible motion | U [육안] extreme motion-blur/light-streak stylization throughout makes it impossible to confirm whether background building geometry is genuinely stable or subtly warping underneath the blur | N [육안] consistent blue/cyan neon night palette throughout, no incoherent lighting jump | N [육안] single consistent car/setting theme throughout; no unrelated-content splice found in sampling across the full duration | N [육안][scdet] despite the high raw scdet count, visual sampling across the full duration shows continuous, consistent content — attributable to motion-blur noise, not broken transitions | N [육안] no unstable texture/geometry beyond expected motion blur | U [오디오분석] audio present (mean -15.8dB, max 0.0dB, no silence; plausibly engine/music) — cannot verify content match without listening |

`GT17_background2: row(N, N, N, N, U, N, N, N, N, U)`

---

## GT18_background3.mp4 (18.0s, 1920x1080, 25fps, has audio)

Cyberpunk-city trailer in 3 shots: (1) 0-~6s aerial flyover establishing shot with flying vehicles; (2) ~7.4-11.9s street-level neon "speed tunnel" POV; (3) ~12.0-17.9s wide static plaza shot where a giant stylized winged light-creature rises/reveals itself. Cuts confirmed by scdet at pts≈6.04-6.08, 7.4-7.56, 11.24, 12.04. All three segments share one consistent neon-night visual palette and theme; the structure reads as a conventional trailer arc (establish → action → landmark reveal), not an unexplained jump. No human subject.

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| N [육안] no human face; only cityscape, vehicles, and a stylized non-human winged creature | N [육안] no human anatomy; the winged creature's design (bipedal, symmetric wings) is internally consistent across its reveal, no malformation | N [육안] flying vehicles, buildings, and the winged creature retain consistent design within their respective segments | N [육안] flight/speed/rising motion all coherent within each of the 3 segments; no freeze or physically impossible motion | U [육안] segments 1 and 3 show stable backgrounds under sampling, but segment 2's extreme neon light-streak/motion-blur styling (7.4-11.9s) prevents reliably distinguishing genuine warping from intentional blur | N [육안] consistent neon-night palette across all 3 segments; each internally coherent | N [육안][scdet] 3 hard cuts move aerial→street→plaza, but content is thematically unified (same city, same night, same neon aesthetic) — reads as conventional trailer editing, not an unexplained/contradictory jump | N [scdet][육안] cuts are clean at each transition point (no freeze-frame/glitch at splices), consistent with intentional trailer editing | N [육안] no unstable texture/geometry beyond the (consistent) stylized VFX design | U [오디오분석] audio present (mean -13.9dB, max -2.4dB, no silence) — no visible mouth/speech event; cannot verify content match without listening |

`GT18_background3: row(N, N, N, N, U, N, N, N, N, U)`

---

## Summary table (P/N/U, order FI/AN/OC/MO/BG/LI/CO/ED/OA/AV)

```
GT14_continuity1: row(N, N, N, N, N, N, N, N, N, U)
GT15_continuity2: row(N, N, U, N, N, N, P, P, N, U)
GT16_background1: row(N, U, N, N, P, N, P, N, N, U)
GT17_background2: row(N, N, N, N, U, N, N, N, N, U)
GT18_background3: row(N, N, N, N, U, N, N, N, N, U)
```

## Headline findings
- **GT15**: two unrelated ad templates spliced together mid-clip — on-screen caption itself changes ("Take us on a journey." → "Motion is emotion.") exactly at the cut (~7.2s). Marked CO=POSITIVE and ED=POSITIVE.
- **GT16**: background visibly morphs, in one continuous unedited shot (0 scene cuts, confirmed structurally), from a flat wall into a sci-fi ship corridor while the subject stays fixed. Marked BG=POSITIVE and CO=POSITIVE.
- **GT14, GT17, GT18**: no defect found with the same confidence. GT14's single hard cut and GT18's three-shot trailer structure both read as conventional multi-shot editing rather than violations. GT17 and GT18's segment 2 have background stability marked UNVERIFIED because extreme intentional motion blur prevents ruling out subtle warping either way.
- AV is UNVERIFIED for all 5 clips: every clip has a real, non-silent audio track (so the "no audio track → NONE OBSERVED" rule does not apply), but none show a visible mouth/speech event to check content correspondence against, and content-level listening is outside this harness's capability.
