'use server'

// Whether the current season's APPLICATION round is studio-based (studio_round
// 'application' or 'both'). When true, /apply is an entry funnel into /studio
// (external-URL entry retired); when false it keeps the external-URL form.
// studio_round lives on the base seasons table, read server-side.

import { getSeasonStudioConfig } from '@/lib/studio'

export async function getStudioApplicationFlag(seasonId: string): Promise<boolean> {
  try {
    const cfg = await getSeasonStudioConfig(seasonId)
    return cfg.round === 'application' || cfg.round === 'both'
  } catch {
    // Fail safe to the external form if the season/config can't be read.
    return false
  }
}
