// The one reveal-gate function, in its own file with zero local imports so
// every surface that needs it can depend on it without creating a cycle --
// lib/season-stage.ts (Watch) and lib/seasons-theme.ts (Studio, /profile)
// both import from here; neither imports the other. Before this split,
// seasons-theme.ts imported isMainThemeRevealed from season-stage.ts, which
// made season-stage.ts importing FROM seasons-theme.ts (to consolidate on
// getRevealedTheme, 2026-08-16 leak fix) a circular import.
//
// ★Single source of truth for "is the main-round theme/required-element
// public yet" -- shared by every surface so they open at the exact same
// instant instead of two independently-tuned gates drifting apart
// (2026-08-13: caught before shipping -- Studio was about to gate on
// `round === 'main'` alone, which is main_round_start_at, strictly LATER
// than this -- finalists learn what they're making before the round starts,
// not at the instant it starts). Deliberately NOT
// theme_announcement_minutes_before / isTwistRevealed() (lib/seasons.ts) --
// that lead-time only drives the MainRoundStart email's copy, a different,
// unrelated concern.
export function isMainThemeRevealed(
  finalistReveal: { count: number; revealAt: string } | null,
  inMainRound: boolean,
): boolean {
  return finalistReveal != null || inMainRound
}
