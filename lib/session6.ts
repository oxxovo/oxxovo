// Session 6 (Studio) master switch -- SERVER ONLY.
//
// session6_enabled (platform_config, bool) gates every public studio surface.
// Defaults to FALSE if the key is missing or unreadable, so studio stays hidden
// unless explicitly turned on.

import 'server-only'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export async function isSession6Enabled(): Promise<boolean> {
  try {
    const admin = createSupabaseAdmin()
    const { data, error } = await admin
      .from('platform_config')
      .select('value')
      .eq('key', 'session6_enabled')
      .maybeSingle()
    if (error || !data) return false
    return String(data.value).trim().toLowerCase() === 'true'
  } catch {
    return false
  }
}
