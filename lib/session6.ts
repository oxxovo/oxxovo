// Session 6 (Studio) master switch -- SERVER ONLY.
//
// session6_enabled (platform_config, bool) gates every public studio surface.
// Defaults to FALSE if the key is missing or unreadable, so studio stays hidden
// unless explicitly turned on.

import 'server-only'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export async function isSession6Enabled(): Promise<boolean> {
  // Demo/dev unlock. STUDIO_DEV_UNLOCK is set ONLY in local .env.local and the
  // Vercel *Preview* environment -- NEVER in Production. Production
  // (www.oxxovo.ai) therefore always falls through to the DB switch below,
  // which stays false until launch, so studio is never publicly exposed. This
  // lets us record the studio funnel on a local/preview build with zero prod
  // exposure. See reports/studio_demo_runbook.md.
  if (process.env.STUDIO_DEV_UNLOCK === 'true') return true
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
