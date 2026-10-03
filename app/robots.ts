import type { MetadataRoute } from 'next'
import { isWatchPublic } from '@/lib/watch-gate'

// Robots policy — two independent pre-launch gates, most-restrictive first:
//
//  1. Whole-site gate (SITE_PUBLIC_ENABLED=false): kept here as a backstop
//     even though the site-wide rewrite-to-/coming-soon branch itself was
//     removed from proxy.ts (HQ 2026-08-19, public launch) -- if this env var
//     is ever literally 'false' again, crawlers still get told to stay out.
//  2. Watch-only gate (isWatchPublic()): the pre-existing narrower policy — the
//     Watch surface 404s in production before launch (lib/watch-gate), so keep
//     /watch out of the index even when the rest of the site is public.
//
// Both flip back to allow-all automatically when their switch is lifted.
//
// Deliberate non-coupling to Competition Publication (HQ 2026-10-03, option B):
// while competition_publication_enabled is false, /watch answers 404 (lib/watch-gate's
// isCompetitionWatchPublic) yet this file still says Allow. That is intended, not drift:
// a crawler that can fetch the URL sees the 404 and drops any already-indexed copy,
// whereas Disallow stops the re-crawl and can leave stale entries listed. Reopening the
// competition then needs no robots change. Revisit (couple it to the DB switch, which
// also means making this route dynamic -- it is prerendered at build time) only if
// Search Console shows /watch URLs indexed that should come out.
// "/watch" also covers /watch/[id] and /watch-arena by prefix.
// `host` names the canonical domain (www.oxxovo.ai — every other host 308s there);
// it is only meaningful once something is indexable, so the total block omits it.
export default function robots(): MetadataRoute.Robots {
  if (process.env.SITE_PUBLIC_ENABLED === 'false') {
    return { rules: { userAgent: '*', disallow: '/' } }
  }
  if (isWatchPublic()) {
    return { rules: { userAgent: '*', allow: '/' }, host: 'https://www.oxxovo.ai' }
  }
  return { rules: { userAgent: '*', disallow: '/watch' }, host: 'https://www.oxxovo.ai' }
}
