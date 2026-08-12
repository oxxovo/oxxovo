// Curation reads + the `active` write. SERVER ONLY.
//
// ★WHAT THIS IS AND IS NOT. Curation is the [3] step of the library pipeline
// (reports/lane_c_music_c_plan_design_2026-08-07.md §6) and it is NOT an
// independent screen: it is `active` on/off laid over [2.5]'s score-ordered
// output. The ordering rule -- including the score slot that [2.5] will fill --
// lives in lib/music-curation-order.ts, where a test can execute it.
//
// ★`active` IS THE PARTICIPANT-FACING SWITCH, which is why this file is small and
// careful. listMusicAssets offers a library row only when `active === true`, so
// every toggle here changes what 500 participants can choose from. It is also the
// only write on the whole curation path.
//
// ★MEASURED 2026-08-08, and it simplifies the toggle: `studio_music_assets.active`
// is NOT NULL (an insert of null is refused by the column), so `active` is a real
// boolean and curation has no third "undecided" state to represent. The picker's
// `=== true` comparison stays as defence behind that constraint -- see
// e2e/music-boundary.mjs section 5.
//
// ★NOT HERE: genre / mood filtering. The grid axes are 제니3·본부's and the values
// are not decided, so there is nothing to filter on and inventing an interim
// vocabulary would be a second thing to migrate away from. `mood` is displayed as
// the column it is today, not as a grid axis.

import 'server-only'
import { createSupabaseAdmin } from './supabase-admin'
import {
  MUSIC_CURATION_PAGE_SIZE,
  musicCurationOrderTerms,
  type CurationSortRow,
} from './music-curation-order'

export type CurationFilter = 'all' | 'active' | 'withheld'

export type CurationTrack = CurationSortRow & {
  id: string
  title: string | null
  mood: string | null
  source: string
  status: string
  active: boolean
  url: string | null
  durationSeconds: number | null
  licenseType: string | null
  provider: string | null
  /** A row with no v1m signature can never be offered, whatever `active` says. */
  signed: boolean
}

export type CurationPage = {
  tracks: CurationTrack[]
  /** Rows matching the current filter. */
  total: number
  /** Catalogue-wide counts, independent of the filter -- the numbers that matter. */
  libraryTotal: number
  activeTotal: number
  withheldTotal: number
  unsignedTotal: number
  page: number
  pageCount: number
  pageSize: number
}

/**
 * One page of the library, in curation order.
 *
 * ★LIBRARY ROWS ONLY. Participant AI tracks live in the same table and are not
 * curated -- they belong to the participant who paid for them, and `active` has no
 * meaning for them (the picker ignores it on the ai branch). Showing them here
 * would invite an operator to switch off someone's own track.
 */
export async function listMusicForCuration(opts: {
  page?: number
  filter?: CurationFilter
  q?: string
} = {}): Promise<CurationPage> {
  const admin = createSupabaseAdmin()
  const filter: CurationFilter = opts.filter ?? 'all'
  const pageSize = MUSIC_CURATION_PAGE_SIZE
  const q = (opts.q ?? '').trim()

  const base = () => {
    let sel = admin.from('studio_music_assets').select(
      // ★Every column named here is one listMusicAssets or the worker's
      // seedLibraryTrack already reads or writes. Nothing speculative: an
      // unmigrated column would make PostgREST refuse this select SILENTLY.
      'id, title, mood, source, status, active, url, duration_seconds, license_type, provider, cryptobind_signature, screening_score',
      { count: 'exact' },
    ).eq('source', 'library')
    if (filter === 'active') sel = sel.eq('active', true)
    if (filter === 'withheld') sel = sel.eq('active', false)
    // PostgREST `or` inside ilike needs the value escaped for commas/parens; the
    // title search is a plain contains, so a simple guard is enough.
    if (q) sel = sel.ilike('title', `%${q.replace(/[,()*]/g, ' ')}%`)
    return sel
  }

  const counted = async (build: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const { count, error } = await build
    if (error) throw new Error('listMusicForCuration count: ' + error.message)
    return count ?? 0
  }

  const total = await counted(base().range(0, 0))
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, Math.floor(opts.page ?? 1)), pageCount)
  const from = (page - 1) * pageSize

  let query = base().range(from, from + pageSize - 1)
  for (const term of musicCurationOrderTerms()) {
    query = query.order(term.column, { ascending: term.ascending, nullsFirst: term.nullsFirst })
  }
  const { data, error } = await query
  if (error) throw new Error('listMusicForCuration: ' + error.message)

  // Catalogue-wide counts. ★These are the numbers the operator is actually working
  // toward (1,000 active), and they must not move with the filter -- a count that
  // changes when you click a tab cannot be worked against a target.
  const libraryTotal = await counted(
    admin.from('studio_music_assets').select('id', { count: 'exact' }).eq('source', 'library').range(0, 0),
  )
  const activeTotal = await counted(
    admin.from('studio_music_assets').select('id', { count: 'exact' }).eq('source', 'library').eq('active', true).range(0, 0),
  )
  const unsignedTotal = await counted(
    admin
      .from('studio_music_assets')
      .select('id', { count: 'exact' })
      .eq('source', 'library')
      .is('cryptobind_signature', null)
      .range(0, 0),
  )

  const tracks: CurationTrack[] = (data ?? []).map((r) => ({
    id: String(r.id),
    title: (r.title as string | null) ?? null,
    mood: (r.mood as string | null) ?? null,
    source: String(r.source),
    status: String(r.status),
    active: r.active === true,
    url: (r.url as string | null) ?? null,
    durationSeconds: r.duration_seconds === null || r.duration_seconds === undefined ? null : Number(r.duration_seconds),
    licenseType: (r.license_type as string | null) ?? null,
    provider: (r.provider as string | null) ?? null,
    signed: !!r.cryptobind_signature,
    // ★The score is REAL as of 2026-08-09 -- the column existed and this mapping was
    // still hard-coded to null, so the ordering rule was running over a field that was
    // always absent and could only ever produce title order.
    // ★`?? null`, never `?? 0`: a track nobody screened must sort after the tracks that
    // were screened and rejected, not among them ([[feedback-absent-is-not-zero]]).
    reviewScore: r.screening_score === null || r.screening_score === undefined ? null : Number(r.screening_score),
  }))

  return {
    tracks,
    total,
    libraryTotal,
    activeTotal,
    withheldTotal: libraryTotal - activeTotal,
    unsignedTotal,
    page,
    pageCount,
    pageSize,
  }
}

export type SetActiveResult =
  | { ok: true; changed: number }
  | { ok: false; error: string; detail?: string }

/**
 * Switch `active` on a set of LIBRARY tracks.
 *
 * ★Scoped to source='library' in the statement itself, not merely in the UI that
 * calls it. An id list arriving from a browser is an id list, and the one thing
 * that must never happen here is switching off a participant's own AI track.
 *
 * ★RETURNING is not optional. Supabase's update reports no row count unless rows
 * are selected back ([[feedback-supabase-sql-editor-traps]] is about the SQL editor,
 * but the client has the same shape): without `.select()` an update that matched
 * NOTHING is indistinguishable from one that matched everything, and the screen
 * would report success either way.
 */
export async function setMusicActive(ids: string[], active: boolean): Promise<SetActiveResult> {
  const clean = [...new Set((ids ?? []).map((s) => String(s)).filter(Boolean))]
  if (!clean.length) return { ok: false, error: 'no_ids' }

  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('studio_music_assets')
    .update({ active, updated_at: new Date().toISOString() })
    .in('id', clean)
    .eq('source', 'library')
    .select('id')
  if (error) return { ok: false, error: 'failed', detail: error.message }

  const changed = (data ?? []).length
  // ★A partial match is reported, not swallowed. It means some id was not a library
  // row (or is gone), and the operator's mental model of what they just did is wrong.
  if (changed !== clean.length) {
    return { ok: false, error: 'partial', detail: `${changed}/${clean.length} rows updated` }
  }
  return { ok: true, changed }
}
