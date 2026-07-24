# Studio Music v1 — design proposal (pre-build approval)

2026-07-23. Author: 지수2. Status: **awaiting TK approval before build.**
Follows the text-overlay v1 discipline (data model → signing → worker render →
preview WYSIWYG → parity gate → UI, verified per stage).

## 0. Policy (TK-confirmed, not open)
Two sources, **no participant upload** (no external ingress by design + copyright
risk):
1. **Platform music library** — royalty-free tracks WE prepare (same stance as
   self-authored LUTs). Copyright-clean only.
2. **In-platform AI generation** — generated inside OXXOVO (Genesis Rule: all
   in-platform).

Provider: **Beatoven.ai** for both (library authoring + participant AI gen) —
its explicit royalty-free / commercial-clean licensing is the safest legal story
for music that ships inside a public competition entry. **Stable Audio 2.5** is a
higher-fidelity alternative but the redistribution/commercial-output license
story is less clean for user-facing generation; recommend Beatoven, revisit only
if TK wants to trade legal-clarity for fidelity. ⚠ Beatoven API shape/pricing to
be CONFIRMED at build (실측), same as we did for fal concurrency — not asserted here.

## 1. Data model + signing (append-only, byte-mirror both repos)
Add to `ComposeEdl` (app `lib/cryptobind.ts` ↔ worker `src/cryptobind.ts`):
```
music?: {
  assetId: string          // studio_music_assets.id (library or ai)
  source: 'library' | 'ai'
  volume: number           // music bed gain 0..100 (%)
  clipVolume: number       // original clip audio gain 0..100 (%) -- the balance
  startMs?: number         // bed starts at this composition time (default 0)
  endMs?: number           // bed ends (default = composition end)
  fadeInMs?: number
  fadeOutMs?: number
}
```
Canonical: **APPEND-ONLY `MU:` section**, emitted ONLY when music is present, so
every existing (music-free) EDL keeps its exact canonical + hash. assetId
percent-encoded; volumes/times on the fixed integer grid (like text). Order:
after the existing `AR:` section.
- **KAT golden update**: add ONE music KAT vector to the cross-repo golden set
  (app + worker). Existing vectors are unchanged (MU absent) so their hashes hold.
  This is the render_sig_mismatch tripwire — must be byte-identical or renders
  fail wholesale. Verified by the existing KAT test in both repos.
- **Signed asset bundle**: the music asset is signed like a source clip. The
  render request bind (v1sr) includes the music asset's signature in the bundle,
  so the bed can't be swapped after signing. (§4 asset table carries the sig.)

## 2. Worker mixing — ONE post-compose pass, both paths (mirrors overlayTexts)
Current audio: no-transition = `concat -c copy` (stream-copy, clip audio only);
transition = `filter_complex` + `acrossfade` → `[aout]`. Rather than fork both,
apply music AFTER the composed video exists (exactly where text overlay sits):
```
mixMusic(inPath, music, musicLocalPath, outPath):
  ffmpeg -i inPath -i musicLocalPath -filter_complex "
    [0:a]volume=<clipVol>[c];
    [1:a]afade=t=in:st=<start>:d=<fadeIn>,afade=t=out:st=<end-fadeOut>:d=<fadeOut>,
         volume=<musicVol>,adelay=<start>|<start>[m];
    [c][m]amix=inputs=2:duration=first:normalize=0[a]
  " -map 0:v -c:v copy -map [a] -c:a aac -b:a 128k -ar 48000 -ac 2 -movflags +faststart outPath
```
- ★**`-c:v copy`** — video is NOT re-encoded; only the audio is remixed. So the
  no-transition path stays cheap (no full re-encode; earlier worry over-stated).
- `duration=first` → output length = composed video (music that is shorter ends;
  no loop in v1). `normalize=0` so our explicit gains are honored (no auto-ducking).
- Runs uniformly on whatever the join produced (concat OR xfade output), so the
  transition acrossfade path is untouched and respected (§ user note 3 honored).
- Silence-only clips already get anullsrc (normalizeSegment), so `[0:a]` is always
  a valid continuous stream.
- E2E real-render required: music × {transition, no-transition} × {shorter,
  longer than comp} × {startMs>0}.

## 3. Preview audio WYSIWYG — the master clock (hardest)
**Problem**: playback today is per-clip `<video>.src` swaps; composition time is
derived (`compStart(idx)+video.currentTime-startMs`) but there is no single
continuous clock, and the music bed must play continuously ACROSS clip swaps.

**Design — composition clock drives a standalone `<audio>` bed:**
- `playheadMs` (composition-global) is already the editor's clock: advanced by the
  engine's `onProgress` during play, set by scrub/seek. Treat it as the master.
- Add a **music transport controller** (new `music-preview.ts`) that owns one
  `<audio>` element (the bed), independent of the video:
  - **play(fromCompMs)**: if `fromCompMs ∈ [start,end]`, `audio.currentTime =
    fromCompMs - start`, `audio.play()`; else keep paused until the window opens.
    Bed plays CONTINUOUSLY across clip src-swaps (music must not gap at hard cuts).
  - **seek/scrub(compMs)**: set `audio.currentTime = compMs - start`; match transport.
  - **pause()**: pause audio.
  - **tick(compMs)** (on each onProgress): (a) enter/exit the window (start/stop the
    bed), (b) set `audio.volume = musicVol × fadeEnv(compMs)` — same envelope the
    worker's afade computes, (c) **drift guard**: if `|audio.currentTime -
    (compMs-start)| > 120ms`, nudge currentTime (rare; src-swaps don't touch the bed).
  - Clip original audio: set `video.volume = clipVol` in BOTH engines (the GL path
    keeps the video element alive + audible; only hidden visually).
- Net: two elements, two gains, same track/timing/fades as the render → what you
  hear is what renders. No new global timeline engine needed — the existing
  composition clock is elevated to drive the bed. (This is the lightest correct
  option; a full sample-accurate WebAudio graph is deferred unless parity fails.)
- WebAudio vs element.volume: v1 uses `audio.volume` set per tick for fades
  (smooth enough at ~20fps progress). Escalate to a GainNode ramp only if audible.

## 4. Asset pipeline — table + R2 + credits + moderation + refund
New `studio_music_assets` (migration, TK-run): `id, source('library'|'ai'),
user_id(null for library), title, mood, prompt(ai), duration_seconds, r2_key,
cryptobind_signature, cryptobind_generated_at, active, created_at`.
- **R2**: add `kind:'music'` → `music/` folder in `uploadVideo` (rename or generalize).
- **Library**: TK-curated set, seeded like presets/LUTs (data not code). We author
  clean tracks (Beatoven) → upload → sign → `active=true`. Admin-listable.
- **AI generation** (reuses the clip-generation machinery):
  - **Prompt moderation**: `moderateSubmission({text: prompt})` before the API call
    (fail-safe pending → not usable, admin queue).
  - **Credits**: charge like a generation via `platform_config` pricing
    (`studio_music_credit_*`), refund on failure (existing credit/refund path).
  - **Failure refund**: Beatoven job fails/times out → refund credits, mark asset
    failed (mirrors the fal generation refund).
  - Async: enqueue → poll Beatoven → download → R2 → sign → asset ready. Likely a
    worker path (like render/generation) or an API route with polling — decide at
    build after confirming Beatoven's sync/async API.
- EDL `music.assetId` → worker resolves asset → downloads r2_key → **verifies the
  asset signature** + includes it in the render bind bundle (anti-swap).

## 5. Library curation — cosmetic CF 30–40s (proposal)
Start with **8 tracks** (expand later), 30–40s edits with a clean ending (no hard
cutoff), instrumental, 48kHz stereo. Mood taxonomy tuned to beauty/cosmetic ads:
| # | Mood | Feel |
|---|------|------|
| 1 | Elegant / Luxe | soft piano + strings, premium |
| 2 | Fresh / Airy | bright light-pop, clean skin/daytime |
| 3 | Confident / Bold | modern beat, statement product |
| 4 | Dreamy / Ethereal | ambient pad, glow/serum |
| 5 | Warm / Intimate | acoustic, natural/organic |
| 6 | Energetic / Upbeat | electro-pop, youthful |
| 7 | Minimal / Clean | subtle beat, minimalist brand |
| 8 | Cinematic / Build | slow build to a lift, hero reveal |
TK curates final selections; I prep candidates via Beatoven for approval.

## 6. Parity gate — audio isn't pixels, so decompose (like text pos/SSIM)
Preview can't be sample-identical to the render, but WYSIWYG = **same track, same
timing, same balance, same fades**. Gate the RENDER against the deterministic mix
spec (both sides compute identical gains from the EDL), then argue preview parity
from "same spec + same track" (final sign-off by TK's ear, like motion for text).
Harness (`scripts/music-parity` — decode rendered PCM, RMS per 100 ms window):
- **Timing**: music energy present only within `[start,end]` (clip-only outside);
  onset/offset within ±1 window of spec.
- **Balance**: music-band vs clip-band dB ratio matches `musicVol/clipVol` within
  **±3 dB** (measured on a known music-only vs clip-only reference render).
- **Fades**: RMS ramps up over `fadeIn` and down over `fadeOut` (monotonic, slope
  within tolerance) — the audio analog of the text alpha 0.50/1.00/0.50 check.
- **Negative controls**: a wrong-volume / shifted-window render must FAIL the gate.

## 7. UI (same discipline as effects/text — expose only the verified)
Inspector "음악" panel: pick from library (mood-grouped) OR "AI 생성"(prompt +
generate, shows credit cost + moderation + progress + refund-on-fail); bed volume
+ clip volume (balance) sliders; start/end + fade in/out; preview plays the mix
live (§3). Allowlist-gated like the rest of compose. Text/aspect unaffected.

## 8. Build order (per-stage verify, no dates)
1. Data model + signing + KAT (both repos) — KAT golden green.
2. Worker `mixMusic` pass — real-render E2E (both join paths, edge cases).
3. Asset table + R2 `music/` + library seed (a few real tracks) + signing.
4. Preview master-clock bed controller — WYSIWYG by ear + drift guard.
5. Parity harness (RMS/timing/balance/fade) — gate green.
6. AI generation (moderation + credits + refund) — E2E incl. failure refund.
7. UI + allowlist → deploy → TK eyeball/ear.

## Open items to confirm at build
- Beatoven API sync/async shape, latency, pricing, output format/license text.
- AI-music credit price (platform_config).
- Whether AI music generation runs in the existing worker or a new path.
- Loop vs silence when the bed is shorter than the composition (v1 = silence).
