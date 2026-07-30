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
