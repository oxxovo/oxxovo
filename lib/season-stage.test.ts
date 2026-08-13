// isMainThemeRevealed: the single reveal gate shared by Watch (resolveSeasonStage)
// and Studio (lib/seasons-theme.ts's getRevealedTheme) -- this is the fix for the
// 2026-08-13 bug where Studio gated on main_round_start_at (later) while Watch
// already gated on finalist selection (earlier), leaving finalists unable to see
// their own main-round theme/required element while the public page already had it.
// Run: node --import ./scripts/test-register.mjs --test lib/season-stage.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { isMainThemeRevealed } from './season-stage.ts'

test('neither finalists selected nor main round started -> not revealed', () => {
  assert.equal(isMainThemeRevealed(null, false), false)
})

test('finalists selected (pre-main-round teaser window) -> revealed, even though main round has not started', () => {
  assert.equal(isMainThemeRevealed({ count: 12, revealAt: '2026-11-09T08:00:00Z' }, false), true)
})

test('main round already started -> revealed, even if finalistReveal has gone null (its own window closed)', () => {
  assert.equal(isMainThemeRevealed(null, true), true)
})

test('both true (main round started AND finalistReveal still non-null) -> revealed', () => {
  assert.equal(isMainThemeRevealed({ count: 12, revealAt: '2026-11-09T08:00:00Z' }, true), true)
})
