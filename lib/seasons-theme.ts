// Server-only access to the SECRET theme fields (main_round_twist, the main-
// round required element). SERVER ONLY — never import from a client component.
//
// The base seasons table is the only place the twist lives, and only the
// service role can read it after the theme-hybrid migration's REVOKE. This
// module reads it with the service-role client and applies the reveal gate
// (isMainThemeRevealed, below), so the value only ever leaves the server once
// that is true. Studio (app/studio/actions.ts) calls getRevealedTheme() and
// includes the result in its response — the raw secret never crosses to the
// client before reveal.

import 'server-only'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getFinalistRevealState } from '@/lib/watch'
import { isMainThemeRevealed } from '@/lib/theme-reveal'
import type { ThemeDisplay } from '@/lib/seasons'

// ★2026-08-13 (제니2/제니3): the reveal gate here MUST match Watch's
// (isMainThemeRevealed, lib/season-stage.ts) -- finalists learn what they're
// making (theme label AND the required element) the moment Watch's public
// teaser opens, not at the later main_round_start_at instant. Previously this
// used isTwistRevealed()/theme_announcement_minutes_before (lib/seasons.ts),
// a DIFFERENT, later gate meant only for the MainRoundStart email's copy --
// using it here reproduced the exact "public page knows before the finalist's
// own workspace does" bug this fix exists for.
//
// `theme` prioritizes main_round_theme_label (the real main-round theme) once
// revealed; before that (or if a season never sets it) it falls back to
// season_theme (the free-form prelim slot, null for season_0 by design).
export async function getRevealedTheme(
  seasonId: string,
  now: Date = new Date(),
): Promise<ThemeDisplay> {
  const admin = createSupabaseAdmin()
  const [{ data, error }, finalistReveal] = await Promise.all([
    admin
      .from('seasons')
      .select('season_theme, main_round_twist, main_round_theme_label, main_round_start_at')
      .eq('id', seasonId)
      .single(),
    getFinalistRevealState(seasonId),
  ])

  if (error || !data) {
    if (error) console.error('[seasons-theme] fetch failed:', seasonId, error.message)
    return { theme: null, twist: null, revealed: false }
  }

  const mainStart = data.main_round_start_at ? Date.parse(data.main_round_start_at) : null
  const inMainRound = mainStart != null && now.getTime() >= mainStart
  const revealed = isMainThemeRevealed(finalistReveal, inMainRound)

  return {
    theme: (revealed ? data.main_round_theme_label : null) ?? data.season_theme ?? null,
    twist: revealed ? (data.main_round_twist ?? null) : null,
    revealed,
  }
}
