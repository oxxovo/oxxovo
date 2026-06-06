// Server-only access to the SECRET theme fields (main_round_twist, and the
// deprecated main_round_theme fallback). SERVER ONLY — never import from a
// client component.
//
// The base seasons table is the only place the twist lives, and only the
// service role can read it after the theme-hybrid migration's REVOKE. This
// module reads it with the service-role client and applies the reveal gate, so
// a twist only ever leaves the server once isTwistRevealed() is true. A future
// main-round SSR page calls getRevealedTheme() and includes the result in its
// response — the raw secret never crosses to the client before reveal.

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
    .select(
      'season_theme, main_round_twist, main_round_theme, main_round_start_at, theme_announcement_minutes_before',
    )
    .eq('id', seasonId)
    .single()

  if (error || !data) {
    if (error) console.error('[seasons-theme] fetch failed:', seasonId, error.message)
    return { theme: null, twist: null, revealed: false }
  }

  return getThemeDisplay(data, now)
}
