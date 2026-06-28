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
