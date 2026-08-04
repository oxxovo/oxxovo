'use server'

import { isWatchNavVisible } from '@/lib/watch-nav'

// Whether the landing header shows its Watch link. The landing is a client
// component and the rule reads through the service role, so it comes across as one
// boolean -- no counts, no season id, nothing the header does not need.
export async function getWatchNavVisible(): Promise<boolean> {
  return isWatchNavVisible()
}
