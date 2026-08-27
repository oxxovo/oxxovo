// Pure badge-copy maps, split out of lib/lobby.ts (2026-08-27, HQ build-break
// fix). No runtime imports -- that is the point: LobbySection.tsx and
// tournament/page.tsx are Client Components, and lib/lobby.ts carries a
// dynamic `import('./supabase-admin')` inside fetchWinnerCounts. Once
// LobbySection.tsx started importing MODE_BADGE/PHASE_BADGE as real values
// (not types) from './lobby', that pulled lib/lobby.ts's whole module graph
// -- dynamic import included -- into the client bundle, and 'server-only'
// (inside supabase-admin.ts) fails the build the moment it is reachable from
// any client-tagged module (same failure mode as the c86a4a9/lib/seasons.ts
// break fixed earlier the same day, see lib/season-fixture.ts's own header).
// Types are import type only -- erased at compile time, no runtime edge.
import type { LobbyMode, LobbyCard } from './lobby'

// ★Consolidated 2026-08-23 (Jenny3): these were two literal copies, one per
// file. PHASE_BADGE already drifted once -- a KR label patch landed on
// LobbySection.tsx first and tournament/page.tsx kept the stale English text
// until a second pass caught it. MODE_BADGE was still English-only in both
// when this moved, but the same drift is coming: COMING SOON/OPEN/LIVE/ENDED
// are public copy on both surfaces and are next in line for KR text. Fixing
// it here once, before that lands, means there is no second copy left to miss.
export const MODE_BADGE: Record<LobbyMode, { label: string; cls: string }> = {
  upcoming: { label: 'COMING SOON', cls: 'bg-white/10 text-white/70 border-white/20' },
  accepting: { label: 'OPEN', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
  live: { label: 'LIVE', cls: 'bg-[#ff4444]/20 text-[#ff8888] border-[#ff4444]/50' },
  ended: { label: 'ENDED', cls: 'bg-white/5 text-white/40 border-white/10' },
}

// ★C-4 (Jenny3, 2026-08-10). `mode` still collapses main_live / voting /
// awaiting_results into one 'live' -- this only overrides the badge for the
// two sub-phases that have their own copy; every other 'live' phase falls
// through to MODE_BADGE.live.
export const PHASE_BADGE: Partial<Record<LobbyCard['phase'], { label: string; cls: string }>> = {
  voting: { label: '관객 투표 중', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
  awaiting_results: { label: '최종 집계 중', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
}
