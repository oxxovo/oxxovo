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
// unrelated to any one content type -- see [[project-official_actors_...]]-style
// reasoning: Platform Availability and Competition Publication are different
// questions, decided by different people, on different schedules.
//
// News Publication (Daily News) is NOT built here -- this file, and the
// platform_config row it reads, exist so that when News ships it gets its OWN
// switch (news_publication_enabled) instead of either sharing this one or
// reusing isWatchPublic() -- "Competition may be closed while News stays open"
// is the requirement this split exists for, and it only holds if News never
// reads this key.
//
// Default TRUE when the key is missing/unreadable: unlike member_hosted_enabled
// (a program that was never live and defaults hidden), competition content is
// live today under isWatchPublic() alone -- defaulting this switch to false
// before the platform_config row exists would silently close Watch with no code
// change and no admin action. The row insert (reports/competition_publication_switch_2026-09-27.sql)
// is a DB write and was NOT run by this change -- see the Phase 0 report.

import 'server-only'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export async function isCompetitionPublicationEnabled(): Promise<boolean> {
  try {
    const admin = createSupabaseAdmin()
    const { data, error } = await admin
      .from('platform_config')
      .select('value')
      .eq('key', 'competition_publication_enabled')
      .maybeSingle()
    if (error || !data) return true
    return String(data.value).trim().toLowerCase() !== 'false'
  } catch {
    return true
  }
}
