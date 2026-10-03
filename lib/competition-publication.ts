// Competition Publication switch -- SERVER ONLY. Phase 0-3 (HQ 2026-09-27).
//
// Responsibility split (the point of this file): isWatchPublic() (lib/watch-gate,
// env-based) answers "is the Watch FEATURE technically reachable at all" -- a
// deploy-time, patent-novelty gate that has nothing to do with content. This
// answers a narrower, DB-editable question: "is COMPETITION content specifically
// open to the public right now". The two are ANDed at every call site that
// serves competition content -- see the call sites list below -- so either one
// alone can close the surface.
//
// Why a second gate, and why in platform_config rather than env: closing
// competition content must not require a redeploy (the whole reason platform_config
// + the generic /admin/settings editor exist -- lib/settings-validate.ts's
// isRiskKey('*_enabled') and platform_config_history already cover this key for
// free, same as member_hosted_enabled). It also has to be independently
// switchable from isWatchPublic(), which stays OFF pre-launch for legal reasons
// unrelated to any one content type. Platform Availability and Competition
// Publication are different questions, decided by different people, on different
// schedules.
//
// News Publication (Daily News) gets its OWN switch (news_publication_enabled)
// instead of either sharing this one or reusing isWatchPublic() -- "Competition
// may be closed while News stays open" is the requirement this split exists for,
// and it only holds if News never reads this key.
//
// FAIL-CLOSED (HQ 2026-10-03; was fail-open until then). Missing row, query
// error, thrown exception, or any value other than 'true' = closed. The
// competition is paused and the row is 'false' (inserted 2026-10-03); re-opening
// it is a deliberate act in /admin/settings, never a side effect of a deleted row.

import 'server-only'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

// Pure, so the direction of every non-'true' input is testable without a
// database. `row` is the maybeSingle() result (null = no row).
export function decideCompetitionPublication(
  row: { value: unknown } | null | undefined,
  error: unknown,
): boolean {
  if (error || !row) return false
  return String(row.value).trim().toLowerCase() === 'true'
}

export async function isCompetitionPublicationEnabled(): Promise<boolean> {
  try {
    const admin = createSupabaseAdmin()
    const { data, error } = await admin
      .from('platform_config')
      .select('value')
      .eq('key', 'competition_publication_enabled')
      .maybeSingle()
    return decideCompetitionPublication(data, error)
  } catch {
    return false
  }
}
