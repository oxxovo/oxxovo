import type { MetadataRoute } from 'next'
import { isWatchPublic } from '@/lib/watch-gate'

// Robots policy. Pre-launch the Watch surface is kept out of crawlers' index --
// belt-and-suspenders with the 404 gate (the Watch pages already 404 in
// production before launch, see lib/watch-gate). VERCEL_ENV is fixed per
// deployment, so this evaluates correctly at build time for each environment;
// at launch, when isWatchPublic() flips true, the disallow is dropped
// automatically. "/watch" also covers /watch/[id] and /watch-arena by prefix.
export default function robots(): MetadataRoute.Robots {
  if (isWatchPublic()) {
    return { rules: { userAgent: '*', allow: '/' } }
  }
  return { rules: { userAgent: '*', disallow: '/watch' } }
}
