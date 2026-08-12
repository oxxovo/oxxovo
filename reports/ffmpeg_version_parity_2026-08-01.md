# ffmpeg version vs the parity constants -- measured 2026-08-01 (lane A)

Every parity constant in this repo was derived on ONE developer's ffmpeg: the eq
model (yuv444p / BT.601 limited / transfer), the dip alpha-beta pair sampled at 14
points, the nine transition curves, the LUT and glow gates. The deployed worker runs
a different build. If they disagree, the harness says PASS while the render that
participants actually receive is different -- the same shape as the two defects found
the day before (a harness measuring a hand-written copy of the worker's filters, and a
CI job that had never installed dependencies), just in a different place.

So it was measured rather than argued.

## Builds compared

| | version | where |
|---|---|---|
| deployed | `5.1.9-0+deb12u1` | Railway worker's own boot line, 2026-07-31 21:42 |
| local (lane A) | `N-124279-g0f6ba39122-20260430` | this dev machine |
| proxy for deployed | `5.1.2-essentials_build-www.gyan.dev` | downloaded for the A/B |

**Limits of this measurement, stated up front.** Docker and WSL are both absent on the
lane A machine, so the deployed image could not be run directly. 5.1.2 is a proxy for
5.1.9 and a gyan Windows build is not a Debian build. The filter arithmetic is
in-tree C in both cases, which is why a same-branch proxy is informative, but the
results below are a LOWER BOUND on "5.1 vs master", not a statement about
5.1.9-0+deb12u1 specifically. Running the real image is option C in the follow-ups.

## Result 1 -- effect filters: bit-identical, 44/44

Every filter `effectVideoFilters()` can emit, x 4 contents (smooth / mandelbrot /
SMPTE bars / testsrc2), compared as raw rgb24 bytes:

`eq`, `lut3d`, `gblur`+`blend` (glow), `noise` (grain), `tmix` (motionBlur),
`vignette`, `unsharp`, `rgbashift`, `colortemperature`, `colorbalance`,
`format=yuv420p`

-> **max byte difference 0 on all 44 combinations.**

The two parity harnesses agree to two decimals under either binary
(color 0.96/0.71/0.75/0.62, LUT 0.05/0.06/0.04/0.01, glow 0.01/0.14/0.28/0.28;
transitions worst 0.30%).

**Consequence: grain and motionBlur are version-independent.** The effects epic can
change them without an ffmpeg-version question attached.

## Result 2 -- xfade: the last frame differs, on 13 of 14 transitions

25-frame transition window, frame-by-frame:

| | |
|---|---|
| first 24 frames | bit-identical on every type |
| final frame of the window | differs on 13 of 14 types |
| shift test | a +/-1 frame shift does NOT reconcile them -- it is the boundary, not a global offset |

What the final frame actually contains:

| type | 5.1 vs master, mean | 5.1 final frame vs pure incoming |
|---|---|---|
| fade | 2.00% | **0.000%** |
| fadeblack | 1.63% | 0.000% |
| wipeleft | 2.44% | 0.000% |
| slideleft | **10.93%** | 0.000% |
| radial | 0.69% | 0.000% |

5.1 finishes the transition one frame early -- its last window frame is already the
pure incoming clip, while the master build still carries transition residue. It is a
boundary-semantics change, not a change in the transition math.

Magnitude scales as 1/(fps x duration): one frame of a 0.5s transition at 25fps is 8%
of the transition, but only the LAST frame is affected, so the visible effect is
about 40ms. Real but not perceptible.

## Result 3 -- `dissolve` is different in kind

`dissolve` differs on **6 of 25 frames**, not one, and not at the boundary. Its mask
is pseudo-random and the sequence is version-dependent.

**This is the one that matters for the effects epic.** dissolve (plan A, a render
change) cannot be validated on a local ffmpeg: a local PASS says nothing about the
mask the deployed worker will produce. Either the deploy version is reproduced
locally (option C below) or dissolve is replaced with something deterministic. This
measurement is the reason, recorded here so the decision is not re-litigated from
memory.

## What was changed as a result

1. **Dockerfile pins ffmpeg** (`ARG FFMPEG_VERSION=7:5.1.9-0+deb12u1`, worker repo).
   It was unversioned, so a Debian point release would have changed the renderer with
   no record. The pin will break the image build the day 5.1.10 lands -- loudly, and
   before deploy, which is the intended trade. Bump instructions are in the Dockerfile.
2. **The worker boot line reports MISMATCH** when its actual ffmpeg differs from the
   pinned value. `ENV EXPECTED_FFMPEG` comes from the same ARG, so it is one source of
   truth rather than two constants that drift.
3. **`FFMPEG_BIN` on every parity harness** (`scripts/ffmpeg-bin.mjs`). Any table can
   be re-measured under the version that ships:
   `FFMPEG_BIN=/path/to/ffmpeg npm run test:parity:transition`
4. **Every harness prints the binary it used**, so no table is recorded without its
   source.

## Open

- **Reproduce the deployed image locally** (Docker or WSL). The only way to answer
  5.1.9-vs-5.1.2 and to validate dissolve. Machine change -> TK's call.
- Re-run the parity harnesses under the pinned version once that exists, and record
  the numbers here next to the local ones.
