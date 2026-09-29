# Gate 1 — Final Contrast Set (LOCKED) — 2026-09-10

Source of truth for **status/axis** = `gate1_pair_reconciliation_2026-09-09.md`'s
individual pair rows (per 본부 ③). **Confidence** = recomputed for every pair from
scratch using the newly-confirmed rule (본부 ②): `final = min(mining 1차 의견 confidence,
blind 2차 검수 confidence)` on the ordinal scale High > Medium-High > Medium > Low.
**Pair numbering fix**: the supplementary set's own "Pair 1-11" labels (used in my
2026-09-10 chat reply) collided with the original mining doc's "Pair 1-30" labels —
these are relabeled `S-O1..O6` / `S-C1..C4` below to remove the collision.

## 0. What changed vs. my last report

Applying the strict `min()` rule to the **existing Core 20** (not just the
supplementary 10) moved 7 pairs down from their previously-recorded confidence:
Pair 2, 3, 8 (High→Medium-High), Pair 19, 20, 29 (Medium-High→Medium), Pair 26
(High→Medium). The old reconciliation table's confidence values do not follow a
single consistent rule (spot check: Pair 6/7/9/30 already look like min(), but
Pair 2/3/8/19/20/26/29 look like max() instead) — I'm not able to reconstruct
why from what's in the repo, so I've overridden all 20 with the freshly-computed
`min()` value below rather than trust the old numbers.

## 1. Core 20 (mining-doc Pair # retained) — A/B answer key, axis, final confidence

| Pair | A | B | Winner | Axis | Mining conf | Blind conf | **Final (min)** |
|---|---|---|---|---|---|---|---|
| 1 | GT19_anatomy_object1 | GT01_clean_a | B | Execution | High | High | **High** |
| 2 | GT20_anatomy_object2 | GT01_clean_a | B | Execution | High | Medium-High | **Medium-High** |
| 3 | GT21_anatomy_object3 | GT02_clean_b | B | Execution | High | Medium-High | **Medium-High** |
| 6 | A15_rhythm | A14_solo | B | Execution | High | Medium | **Medium** |
| 7 | A07_cooking | A08_dessert | B | Execution | High | Medium | **Medium** |
| 8 | Z03_studio | aurelie (cf_02) | B | Execution | High | Medium-High | **Medium-High** |
| 9 | Z03_studio | demo_ichar | B | Execution | High | Medium | **Medium** |
| 10 | demo_artisan | GT21_anatomy_object3 | A | Execution | High | High | **High** |
| 14 | novya (cf_03) | tk_render_2 | B | Creative Direction | Medium | Medium-High | **Medium** |
| 16 | demo_ichar | demo_duel | B | Creative Direction | Medium | Medium | **Medium** |
| 17 | A01_fashion | A01_fashion_wearable | B | Execution | Medium | Medium | **Medium** |
| 18 | A13_group | A14_solo | B | Creative Direction | Medium | Medium | **Medium** |
| 19 | A09_race | A10_drift | B | Creative Direction | Medium | Medium-High | **Medium** |
| 20 | A09_race | A11_night | B | Creative Direction | Medium | Medium-High | **Medium** |
| 21 | bloomix (cf_04) | eclare (cf_07) | B | Creative Direction | Medium | Medium | **Medium** |
| 23 | velix (cf_09) | noira (cf_06) | B | Originality | Medium | Medium | **Medium** |
| 26 | demo_sf | demo_duel | B | Creative Direction | Medium | High | **Medium** |
| 28 | A13_group | A16_crowd | B | Creative Direction | Medium | Medium | **Medium** |
| 29 | demo_consistency | demo_astronaut | B | Execution | Medium | Medium-High | **Medium** |
| 30 | Z01_table | demo_artisan | B | Creative Direction | High | Medium | **Medium** |

## 2. Supplementary accepted 10 (relabeled, no collision) — same columns

| Pair | A | B | Winner | Axis | Mining conf | Blind conf | **Final (min)** |
|---|---|---|---|---|---|---|---|
| S-O1 | Z01_table | A04_morph | B | Originality | High | High | **High** |
| S-O2 | A18_cities | tk_render_1 | B | Originality | High | High | **High** |
| S-O3 | A16_crowd | A14_solo | B | Originality | Medium-High | Medium-High | **Medium-High** |
| S-O4 | aquelle (cf_05) | noira (cf_06) | B | Originality | Medium-High | High | **Medium-High** |
| S-O5 | A06_splash | A02_fabric | B | Originality | Medium-High | High | **Medium-High** |
| S-O6 | A01_fashion | A03_street | B | Originality | Medium-High | Medium | **Medium** |
| S-C1 | A18_cities | A02_fabric | B | Creative Direction | High | High | **High** |
| S-C2 | A07_cooking | A12_mech | B | Creative Direction | Medium-High | Medium-High | **Medium-High** |
| S-C3 | A20_culture | demo_artisan | B | Creative Direction | High | Medium | **Medium** |
| S-C4 | Z03_studio | lumea (cf_01) | B | Creative Direction | Medium-High | High | **Medium-High** |

## 3. Boundary set (NOT in the 30 — held, not tested in Gate 1)

| ID | A | B | Why boundary |
|---|---|---|---|
| Boundary-1 (old Pair 11) | Z01_table | A08_dessert | Cross-axis trade-off (A=CD-weak/Exec-clean, B=CD-strong/Exec-flawed) — not same-axis contrast. Gate 3 candidate. |
| Boundary-2 (old Pair 25) | A01_fashion_fusion | A01_fashion_wearable | Confidence Low after min() — both reviewers soft/low-confidence, no clean signal. |
| Boundary-3 (new, was mislabeled "S-C" Pair 8) | A13_group | demo_duel | **Direction conflict**: mining says B, genuinely-blind re-review says A, both at self-reported High confidence. Per 본부 ①: this proves both readings are defensible, i.e. the pair fails "obvious CD contrast" by construction — moved to Boundary, not TK-adjudicated. |

## 4. Recount — final confidence distribution, by axis, across the locked 30

| Axis | High | Medium-High | Medium | Low | Total |
|---|---|---|---|---|---|
| Execution | 2 (#1,10) | 3 (#2,3,8) | 5 (#6,7,9,17,29) | 0 | **10** |
| Creative Direction | 1 (S-C1) | 2 (S-C2,S-C4) | 10 (#14,16,18,19,20,21,26,28,30,S-C3) | 0 | **13** |
| Originality | 2 (S-O1,S-O2) | 3 (S-O3,S-O4,S-O5) | 2 (#23,S-O6) | 0 | **7** |
| **Total** | **5** | **8** | **17** | **0** | **30** |

Axis totals confirmed: **Execution 10 / Creative Direction 13 / Originality 7 = 30**,
matches 본부's stated target exactly.

⚠️ **Worth flagging even though not asked**: under the honest `min()` rule, 17/30
(57%) of the locked set is only "Medium" confidence, and Creative Direction —
the single biggest axis at 13 pairs — has **zero** High-confidence pairs (best is
1 High out of 13). If Gate 1's premise is "these are the *obvious* pairs a
competent judge must get right," a set that's majority-Medium on its largest axis
is a softer test than "Core 20" sounded. Not proposing a fix — just flagging before
the paid run, since 본부 asked for a clean-or-not read.

## 5. Duplicate / reused clip check across the locked 30

**No pair shares its exact A+B combination with another pair** — no two rows are
literally the same contrast. But individual clips repeat, which is the risk 본부
flagged:

### Confirmed: 본부's named case
- **A18_cities**: S-O2 (loser vs tk_render_1, axis=Originality) and S-C1 (loser vs
  A02_fabric, axis=Creative Direction) — 2 uses, both as the *loser*, both anchored
  by the same underlying clip.
- **A02_fabric**: S-O5 (winner vs A06_splash, axis=Originality) and S-C1 (winner vs
  A18_cities, axis=Creative Direction) — 2 uses, both as the *winner*.
- These two facts combine: **S-C1 (A18_cities vs A02_fabric) is the single pair
  that ties both together** — if a judge model has any idiosyncratic read on either
  clip specifically (not a genuine skill judgment), it can move 3 pairs at once
  (S-O2, S-O5, S-C1), not 1.

### Bigger finding than what was asked: two clips are literally the same footage, reused as "winner" repeatedly
The original mining doc (`gate1_contrast_pair_candidates_2026-09-09.md`, general
findings #1-#2, self-flagged by the mining author at the time) already noted:
- **GT01_clean_a and demo_artisan are the identical underlying potter clip.**
  In the locked 30 this single piece of footage is the *winner* in **5 of 30
  pairs**: #1, #2 (as GT01_clean_a), #10, #30, S-C3 (as demo_artisan).
- **GT02_clean_b and A02_fabric are the identical underlying silk-fabric clip**
  (different trim lengths only). Winner in **3 of 30 pairs**: #3 (as GT02_clean_b),
  S-O5, S-C1 (as A02_fabric).

So the "30 independent contrasts" premise is weaker than it looks: **one clip (the
potter) alone decides 5/30 = 17% of the set's pass/fail outcome**, and combined
with the fabric clip, **8/30 = 27%** of the set turns on just 2 underlying pieces
of footage. A judge model that happens to mis-rate either of those two clips for
any reason (not necessarily a skill-discrimination failure) drags down a
disproportionate share of the "Gate 1 pass rate" in one shot.

### Full reuse table (clips appearing in 2+ pairs of the locked 30; footage-identity groups merged per general findings #1-#2)

| Clip (footage identity) | Uses | As winner | As loser | Pairs |
|---|---|---|---|---|
| GT01_clean_a / demo_artisan (same footage) | 5 | 5 | 0 | #1,#2,#10,#30,S-C3 |
| Z03_studio | 3 | 0 | 3 | #8,#9,S-C4 |
| A14_solo | 3 | 3 | 0 | #6,#18,S-O3 |
| GT02_clean_b / A02_fabric (same footage) | 3 | 3 | 0 | #3,S-O5,S-C1 |
| A13_group | 2 | 0 | 2 | #18,#28 |
| GT21_anatomy_object3 | 2 | 0 | 2 | #3,#10 |
| demo_ichar | 2 | 1 | 1 | #9(loser),#16(winner) |
| demo_duel | 2 | 2 | 0 | #16,#26 |
| A09_race | 2 | 0 | 2 | #19,#20 |
| noira (cf_06) | 2 | 2 | 0 | #23,S-O4 |
| A16_crowd | 2 | 1 | 1 | #28(loser),S-O3(winner) |
| Z01_table | 2 | 0 | 2 | #30,S-O1 |
| A18_cities | 2 | 0 | 2 | S-O2,S-C1 |
| A01_fashion | 2 | 0 | 2 | #17,S-O6 |

14 distinct clips (or footage-identity groups) each account for 2-5 of the 30
pairs' outcomes. Everything not listed above appears exactly once.

## 6. Not literally duplicate pairs, but worth naming: same axis, same reasoning, different clip

Not a data error, just a concentration note — several pairs test the *same specific
failure mode* rather than genuinely different ones:
- "unrelated dance crew/group spliced together" appears twice on Execution/CD sides
  via A13_group (#18 vs A14_solo, #28 vs A16_crowd) plus Boundary-3 (vs demo_duel).
- "single car vs. multiple different cars" appears twice: #19, #20 (both use
  A09_race as the same loser).
- "Z03_studio identity-swap" appears 3x (#8, #9, S-C4) as noted above.

## 7. Verdict

The set is **not perfectly clean** — see §4 (57% Medium, CD axis has no High) and
§5 (potter clip alone swings 17% of the set, potter+fabric swing 27%). No literal
duplicate pairs and no math errors found once corrected. Recommend 본부/대표님 decide
whether this level of clip concentration is acceptable before the paid run, or
whether a few of the potter/fabric-anchored pairs should be thinned first.

⛔ Gate 1 paid execution: still not started, awaiting 승인.
