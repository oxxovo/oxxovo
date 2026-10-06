// Fresh (uncached) platform_config reader for the dispatch switches. Text
// values, exactly as stored -- the same view the RPCs have.
import 'server-only'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type { ConfigReader } from '@/lib/dispatch-switch'

export function adminConfigReader(): ConfigReader {
  return async (keys) => {
    const admin = createSupabaseAdmin()
    const { data, error } = await admin.from('platform_config').select('key, value').in('key', keys as string[])
    if (error || !data) return null
    return new Map((data as { key: string; value: string }[]).map((r) => [r.key, r.value]))
  }
}
