'use server'

import { getCurrentSeason } from '@/lib/seasons'
import { resolveSeasonStage } from '@/lib/season-stage'
import type { BannerContent } from '@/lib/watch'

// The current season's lifecycle stage, for client components (the landing).
//
// It exists because lib/season-stage is server-only -- it reads finalists and
// winners through the service role -- and the landing is a client component. The
// action returns only BannerContent: a stage name and three strings. No roster, no
// counts, nothing that isn't already on the public banner.
//
// Deliberately NOT a second stage machine. Same resolver, same instant, same
// answer as /watch. If the landing ever needs to say something /watch doesn't,
// that belongs in getBannerStage (lib/watch.ts), not here.
export async function getCurrentSeasonStage(): Promise<BannerContent> {
  const season = await getCurrentSeason()
  if (!season) return { stage: 'accepting' }
  const { content } = await resolveSeasonStage(season, season.id)
  return content
}
