// Whether the landing offers a way into Watch.
//
// This used to be `const WATCH_NAV_ENABLED = false` in LandingView, with a comment
// saying to flip it once Season 0 entries start arriving. Two problems with that,
// and neither is the hardcoding:
//
//  1. It answered a question that was ALREADY answered elsewhere. In production
//     /watch returns notFound() unless isWatchPublic() (lib/watch-gate) -- an env
//     switch TK sets at launch. A separate hand-flipped constant on the landing is
//     a second gate on the same fact, free to disagree: forget it and the header
//     links to a 404; flip it early and it links to a 404.
//  2. "Once entries start arriving" is data. A human deciding when data has
//     arrived is a human who can be wrong, or busy, or asleep at the moment the
//     first film lands.
//
// So the rule is derived, not declared: show the link when Watch would actually
// serve, AND when the CURRENT season has something public in it.
//
// The season scope is not decoration. There are 51 public videos in the database
// right now and all 51 are season_test (measured 2026-08-04 through getWatchVideos
// itself) -- an unscoped "are there videos" would have switched the link on today,
// on pipeline-test data. Scoped to the current season it stays off until a real
// entry is public, and "public" already accounts for the fairness hold: held prelim
// entries fail isPublicRow, so during a hold the count is zero and the link stays
// away instead of pointing at an empty grid.

import 'server-only'
import { isWatchPublic } from './watch-gate'
import { getCurrentSeason } from './seasons'
import { getCurrentCompetitionStats } from './watch'

// The rule alone. Both inputs are facts, not preferences, which is why there is no
// override argument here -- see the note at the bottom of the module.
export function watchNavVisible(input: { publicSurface: boolean; currentSeasonEntries: number }): boolean {
  if (!input.publicSurface) return false
  return input.currentSeasonEntries > 0
}

// Fail-closed: any failure to establish both facts hides the link. A missing link
// is a smaller wrong than a link to a 404 or an empty page.
export async function isWatchNavVisible(): Promise<boolean> {
  try {
    if (!isWatchPublic()) return false
    const season = await getCurrentSeason()
    if (!season) return false
    // Already cached and tagged (WATCH_LIST_TAG, lib/watch-cache) because /watch's
    // own hero reads it, so this adds no query the site was not already making --
    // and a hold release refreshes the link at the same instant it refreshes Watch.
    const stats = await getCurrentCompetitionStats(season.id)
    return watchNavVisible({ publicSurface: true, currentSeasonEntries: stats.entries })
  } catch {
    return false
  }
}

// If head office ever needs to hide the link while Watch is genuinely public and
// full -- a case that does not exist today -- the switch would be a
// `watch_nav_enabled` platform_config row (default true), read the way
// lib/watch-home.ts reads watch_as_home, ANDed into the rule above. It is written
// down here rather than built: an override with no case behind it is a constant
// nobody can explain later.
