// Member-Hosted Tournament master switch -- SERVER ONLY.
//
// member_hosted_enabled (platform_config, bool) gates every public member-hosted
// surface. Defaults to FALSE if the key is missing or unreadable, so the partner
// program stays hidden unless explicitly turned on.

import 'server-only'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export async function isMemberHostedEnabled(): Promise<boolean> {
  try {
    const admin = createSupabaseAdmin()
    const { data, error } = await admin
      .from('platform_config')
      .select('value')
      .eq('key', 'member_hosted_enabled')
      .maybeSingle()
    if (error || !data) return false
    return String(data.value).trim().toLowerCase() === 'true'
  } catch {
    return false
  }
}
