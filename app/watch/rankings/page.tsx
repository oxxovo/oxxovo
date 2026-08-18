// /watch/rankings -- Championship Points ranking info page (PREVIEW, HQ
// 2026-08-18, 3rd pass on this feature). Reached via the sidebar/mobile
// "전체 랭킹 보기" link in ArenaShell, opens in a new tab.
//
// Scope THIS round: an announcement page only -- why the ranking is blank,
// when it opens, and what changes after that, plus a longer blank ranking
// table (same row markup as the sidebar's 3 rows). Real ranking calculation,
// the up-to-#500 list, and the per-creator public score/judge-note page are
// explicitly deferred to before 2027 Q1 -- not built here; this page is
// itself the placeholder those will eventually replace.
//
// Copy: HQ was explicit ("네가 지어내지 마라") -- the three explanation
// sections carry no invented prose. Their labels are HQ's own words
// ("왜 비어 있는지 · 언제 열리는지 · 그 뒤 어떻게 바뀌는지"), and the body
// under each is a plain "pending" marker. Swap PendingSection's body for
// 제니3's real copy once it lands; nothing else here should need to change.
//
// Reveal date and row count are read from platform_config, never hardcoded
// (HQ: "박지 마라") -- see reports/championship_points_rankings_page_2026-08-18.sql.
// Until that migration runs, both fall back to a neutral "not configured"
// state / a safe default row count rather than a fabricated date.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isWatchPublic } from '@/lib/watch-gate'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { RankRow } from '../ArenaShell'

export const dynamic = 'force-dynamic'

// Only used if the platform_config row is missing (e.g. this preview running
// before the migration below has been applied) -- never the source of truth.
const FALLBACK_PLACEHOLDER_ROWS = 20

async function getRankingRevealConfig() {
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('platform_config')
    .select('key, value')
    .in('key', ['championship_points_reveal_at', 'championship_points_placeholder_rows'])
  const m = new Map((data ?? []).map((r) => [r.key as string, r.value as string]))

  const revealAtRaw = m.get('championship_points_reveal_at') ?? null

  const rowsRaw = m.get('championship_points_placeholder_rows')
  const parsedRows = rowsRaw != null ? Number(rowsRaw) : NaN
  const rows = Number.isFinite(parsedRows) && parsedRows > 0 ? Math.floor(parsedRows) : FALLBACK_PLACEHOLDER_ROWS

  return { revealAtRaw, rows }
}

export default async function RankingsInfoPage() {
  // Same pre-launch gate as /watch itself -- this is a sub-page of Watch.
  if (!isWatchPublic()) notFound()

  const { revealAtRaw, rows } = await getRankingRevealConfig()
  const revealDate = revealAtRaw ? new Date(revealAtRaw) : null
  const revealLabel =
    revealDate && !Number.isNaN(revealDate.getTime())
      ? revealDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', timeZone: 'UTC' })
      : null

  return (
    <main className="min-h-screen bg-[#070512] px-6 py-10 text-[#f4f0ff]">
      <div className="mx-auto max-w-xl">
        <Link href="/watch" className="text-[12px] font-bold text-[#a855ff]/80 hover:text-[#a855ff]">
          ← WATCH
        </Link>

        <h1 className="mt-4 text-[22px] font-black uppercase tracking-wide text-white">Creator Ranking</h1>
        <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
          {revealLabel ?? '공개 시점 설정 대기'} · Championship Points
        </p>

        <div className="mt-6 space-y-3">
          <PendingSection label="왜 비어 있는지" />
          <PendingSection label="언제 열리는지" />
          <PendingSection label="그 뒤 어떻게 바뀌는지" />
        </div>

        <div className="mt-8 rounded-lg border border-[#8b22ff]/50 bg-[#8b22ff]/[.12] px-4 py-4">
          {Array.from({ length: rows }, (_, i) => (
            <RankRow key={i} rank={i + 1} />
          ))}
        </div>
      </div>
    </main>
  )
}

// One labeled slot per required explanation. Label = HQ's own phrasing
// (verbatim, nominalized); body = an explicit "not written yet" marker, not
// invented copy. Swap the body text for 제니3's real sentence once it lands.
function PendingSection({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[.03] px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#a855ff]/80">{label}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-white/35">제니3 문안 대기 -- 아직 작성되지 않음</p>
    </div>
  )
}
