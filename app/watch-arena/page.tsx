// /watch-arena was the preview route for the arena redesign. That design is now
// the live /watch, so this route permanently (308) redirects there, preserving
// any query string (season/sort/round/etc.) so old preview links keep working.

import { notFound, permanentRedirect } from 'next/navigation'
import { isWatchPublic } from '@/lib/watch-gate'

export const dynamic = 'force-dynamic'

export default async function WatchArenaRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // Pre-launch: Watch is not publicly reachable in production (patent novelty).
  // 404 before redirecting, so this alias cannot leak into /watch either.
  if (!isWatchPublic()) notFound()
  const sp = await searchParams
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') qs.set(k, v)
    else if (Array.isArray(v) && v[0] != null) qs.set(k, v[0])
  }
  const query = qs.toString()
  permanentRedirect(query ? `/watch?${query}` : '/watch')
}
