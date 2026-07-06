// Public live-stats endpoint for the Watch Hero "Current Competition" block.
// The client (LiveStatus) polls this every ~20s so ENTRIES/CREATORS/COUNTRIES
// tick up as real submissions land. Aggregate counts only -- no per-entry data,
// no scores -- so it is safe to expose unauthenticated. All reads go through the
// service-role path in getCurrentCompetitionStats (anon has no grant on
// genesis_applications -- see [[feedback-server-side-anon-rls-trap]]).

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentCompetitionStats, getJudgingProgress } from '@/lib/watch'
import { getCurrentSeason, getCurrentSeasonId } from '@/lib/seasons'

// Run at request time -- these are live counts, never prerendered/cached.
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // The Hero passes the season it rendered with; fall back to the resolved
  // current season if the param is missing (keeps the two in lock-step).
  let seasonId = request.nextUrl.searchParams.get('season')
  if (!seasonId) {
    const season = await getCurrentSeason()
    seasonId = season?.id ?? getCurrentSeasonId()
  }

  const [stats, judging] = await Promise.all([
    getCurrentCompetitionStats(seasonId),
    getJudgingProgress(seasonId),
  ])
  return NextResponse.json(
    { seasonId, ...stats, judgingScored: judging.scored, judgingTotal: judging.total },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
