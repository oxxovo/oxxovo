import { isCompetitionPublicationEnabled } from './competition-publication'

// Pre-launch access gate for the public Watch surface (/watch, /watch/[id],
// /watch-arena, the watch-as-home root, and the /api/watch stats endpoint).
//
// Why: until the patent is filed (2026-07-20), the competition UI must not be
// publicly reachable -- public accessibility can count as prior disclosure and
// jeopardize novelty. Production is therefore CLOSED by default. Preview and
// local dev stay OPEN so we can keep building and reviewing (Preview is already
// private behind Vercel SSO).
//
// This is env-based, NOT a DB flag: Preview and Production share one Supabase
// database, so a DB flag would close Preview too. VERCEL_ENV cleanly separates
// the two ('production' vs 'preview'); it is undefined in local dev (-> open).
//
// At launch: set WATCH_PUBLIC_ENABLED=true in the PRODUCTION Vercel env to open
// Watch to the world (mirrors the STUDIO_DEV_UNLOCK switch pattern, inverted).
export function isWatchPublic(): boolean {
  if (process.env.WATCH_PUBLIC_ENABLED === 'true') return true
  return process.env.VERCEL_ENV !== 'production'
}

// ── Composed gate for COMPETITION content (Phase 0-3, HQ 2026-09-27) ───────
//
// isWatchPublic() alone answers "is the Watch feature reachable at all"
// (Platform Availability). Every call site below serves competition content
// specifically, so it must also pass isCompetitionPublicationEnabled()
// (Competition Publication, lib/competition-publication.ts -- DB-editable via
// /admin/settings, no redeploy). Both must be true. When News Publication ships
// it gets its OWN composed gate against a separate news_publication_enabled
// switch -- never this one -- so Competition can close while News stays open.
//
// Call sites (all of them -- keep this list in sync, it is the whole point of
// having one function instead of six copies of the AND):
//   app/watch/page.tsx, app/watch/[id]/page.tsx, app/watch/rankings/page.tsx,
//   app/watch-arena/page.tsx, app/api/watch/stats/route.ts, app/page.tsx,
//   lib/watch-nav.ts.
// robots.ts deliberately still reads isWatchPublic() alone -- crawler policy is
// a Platform Availability concern (does the surface exist to index at all), not
// a content-publication one, and is out of Phase 0-3's scope (master-gate
// responsibility split only, not a rewrite of every Watch-adjacent surface).
export async function isCompetitionWatchPublic(): Promise<boolean> {
  if (!isWatchPublic()) return false
  return isCompetitionPublicationEnabled()
}
