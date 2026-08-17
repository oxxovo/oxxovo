// Server-only access to the SECRET theme field (main_round_twist, the main-
// round required element) and the two PUBLIC theme fields (season_theme,
// main_round_theme_label). SERVER ONLY — never import from a client
// component.
//
// The base seasons table is the only place the twist lives, and only the
// service role can read it after the theme-hybrid migration's REVOKE. This
// module reads it with the service-role client and applies the twist's reveal
// gate (isTwistRevealed, lib/seasons.ts -- see getThemeDisplay), so the twist
// only ever leaves the server once that is true. The two theme fields are
// NOT gated at all (2026-08-17 TK decision) -- see ThemeDisplay in
// lib/seasons.ts for why. Watch (lib/season-stage.ts), Studio
// (app/studio/actions.ts) and /profile (app/profile/actions.ts) all call
// getRevealedTheme() and include the result in their response — this is the
// ONLY place any of them may read main_round_theme_label or main_round_twist
// off a season row. A caller reading either column directly anywhere else is
// the fourth independent read this design exists to prevent.
import 'server-only'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getThemeDisplay, type ThemeDisplay } from '@/lib/seasons'

export async function getRevealedTheme(
  seasonId: string,
  now: Date = new Date(),
): Promise<ThemeDisplay> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('seasons')
    .select('season_theme, main_round_twist, main_round_theme_label, main_round_start_at, theme_announcement_minutes_before')
    .eq('id', seasonId)
    .single()

  if (error || !data) {
    if (error) console.error('[seasons-theme] fetch failed:', seasonId, error.message)
    return { prelimTheme: null, mainTheme: null, twist: null, twistRevealed: false }
  }

  return getThemeDisplay(data, now)
}
