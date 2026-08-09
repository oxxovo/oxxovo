// /admin/music -- library curation: `active` on/off over the track catalogue.
//
// ★NOT AN INDEPENDENT SCREEN, and the empty state says so. This is step [3] of the
// library pipeline and it sits on [2.5]'s score-ordered output
// (reports/lane_c_music_c_plan_design_2026-08-07.md §6). Measured 2026-08-08:
// studio_music_assets has 0 rows, so today this page renders an honest empty state
// naming what it is waiting for. It is built now because `active` is the one
// participant-facing switch on the path and it is orthogonal to both pending inputs
// (the grid values and the score).
//
// ★The score's PRODUCER already exists -- the worker's screenMusic (src/music-screen.ts,
// fb42108) returns a 0-100 score per track. What is missing is a column to persist it
// in, which is 지수 본체's migration. So the ordering here is by title until that lands;
// lib/music-curation-order.ts already handles the score and is tested on it.
//
// ★NO GENRE / MOOD FILTER. The grid axes are 제니3·본부's and their values are not
// decided; `mood` is shown as the column it is today, not as an axis.

import { requireAdmin } from '@/lib/admin-auth'
import { listMusicForCuration, type CurationFilter } from '@/lib/music-curation'
import { MusicCurationView } from './MusicCurationView'

export const dynamic = 'force-dynamic'

const FILTERS: CurationFilter[] = ['all', 'active', 'withheld']

export default async function MusicCurationPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string; q?: string }>
}) {
  await requireAdmin()

  const sp = await searchParams
  const filter: CurationFilter = FILTERS.includes(sp.filter as CurationFilter)
    ? (sp.filter as CurationFilter)
    : 'all'
  const pageNum = Number(sp.page)
  const page = Number.isFinite(pageNum) && pageNum >= 1 ? Math.floor(pageNum) : 1

  const data = await listMusicForCuration({ page, filter, q: sp.q })

  return <MusicCurationView data={data} filter={filter} q={(sp.q ?? '').trim()} />
}
