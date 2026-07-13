import type { MetadataRoute } from 'next'
import { isWatchPublic } from '@/lib/watch-gate'

// Robots policy — two independent pre-launch gates, most-restrictive first:
//
//  1. Whole-site gate (SITE_PUBLIC_ENABLED=false): until the patent is filed the
//     ENTIRE site is hidden (proxy.ts rewrites every page to /coming-soon). Ask
//     crawlers to stay out completely. Single env switch, no date logic.
//  2. Watch-only gate (isWatchPublic()): the pre-existing narrower policy — the
//     Watch surface 404s in production before launch (lib/watch-gate), so keep
//     /watch out of the index even when the rest of the site is public.
//
// Both flip back to allow-all automatically when their switch is lifted.
// "/watch" also covers /watch/[id] and /watch-arena by prefix.
export default function robots(): MetadataRoute.Robots {
  if (process.env.SITE_PUBLIC_ENABLED === 'false') {
    return { rules: { userAgent: '*', disallow: '/' } }
  }
  if (isWatchPublic()) {
    return { rules: { userAgent: '*', allow: '/' } }
  }
  return { rules: { userAgent: '*', disallow: '/watch' } }
}
