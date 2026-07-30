// Public live-stats endpoint for the Watch "Current Competition" status bar.
// The client (LiveStatusBar) polls this every ~20s so the country count + the
// Triple-AI judging progress tick in place as real submissions land and get
// scored. Aggregate counts only -- no per-entry data, no scores -- so it is safe
// to expose unauthenticated. All reads go through the
// service-role path in getCurrentCompetitionStats (anon has no grant on
// genesis_applications -- see [[feedback-server-side-anon-rls-trap]]).

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentCompetitionStats, getJudgingProgress } from '@/lib/watch'
import { getCurrentSeason, getCurrentSeasonId, getSeasonById } from '@/lib/seasons'
import { isWatchPublic } from '@/lib/watch-gate'

// Run at request time -- these are live counts, never prerendered/cached.
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Pre-launch: Watch is not publicly reachable in production (patent novelty).
  if (!isWatchPublic()) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  // The Hero passes the season it rendered with; fall back to the resolved
  // current season if the param is missing (keeps the two in lock-step). Resolve
  // the FULL season so the judging bar can track the live round -- otherwise the
  // poll would always report prelim progress and overwrite the round-aware value
  // the server rendered (a finished prelim would show "41/41" during the main
  // round). Mirrors ArenaWatch's inMainRound. (TK 2026-07-14)
  const seasonParam = request.nextUrl.searchParams.get('season')
  const season = seasonParam ? await getSeasonById(seasonParam) : await getCurrentSeason()
  const seasonId = season?.id ?? seasonParam ?? getCurrentSeasonId()
  const mainStart = season?.main_round_start_at ? Date.parse(season.main_round_start_at) : null
  const inMainRound = mainStart != null && Date.now() >= mainStart

  const [stats, judging] = await Promise.all([
    getCurrentCompetitionStats(seasonId),
    getJudgingProgress(seasonId, inMainRound ? 'main' : 'application'),
  ])
  return NextResponse.json(
    { seasonId, ...stats, judgingScored: judging.scored, judgingTotal: judging.total },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
