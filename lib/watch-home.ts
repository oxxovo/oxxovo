// Watch-as-home master switch -- SERVER ONLY.
//
// watch_as_home (platform_config, bool) decides whether the root (/) shows the
// Watch surface (on) or the marketing landing (off). Defaults to FALSE if the
// key is missing/unreadable, so launch (7/25, no videos yet) keeps the landing.
// TK flips it on manually once Season 0 entries have accumulated.

import 'server-only'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export async function isWatchHome(): Promise<boolean> {
  try {
    const admin = createSupabaseAdmin()
    const { data, error } = await admin
      .from('platform_config')
      .select('value')
      .eq('key', 'watch_as_home')
      .maybeSingle()
    if (error || !data) return false
    return String(data.value).trim().toLowerCase() === 'true'
  } catch {
    return false
  }
}

// Entry rule for the new site (home + its pages): open when watch_as_home is on, or
// whenever this is NOT the production deployment (Preview / local dev), so the site can be
// reviewed before TK flips the switch. Same env rule as isWatchPublic (lib/watch-gate.ts):
// Preview and Production share one database, so a DB flag cannot tell them apart; VERCEL_ENV
// can. Production behavior is unchanged -- there the switch alone decides.
// isWatchHome() stays the pure switch reader (the admin screen shows it).
export async function isNewSiteOpen(): Promise<boolean> {
  if (process.env.VERCEL_ENV !== 'production') return true
  return isWatchHome()
}
