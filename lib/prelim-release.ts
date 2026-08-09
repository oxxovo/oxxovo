// ⑤E -- what an operator needs to know about the prelim release, as a rule
// rather than a query. Pure; no database.
//
// ★THE DEFECT THIS EXISTS FOR. The admin panel that shows the hold is built from
// `watch_hold = true`, and it renders nothing when that set is empty. So the
// moment the release succeeds -- the moment there is something to report -- the
// panel disappears. After 11/4 an operator has no surface anywhere that says the
// cohort went out, when it went out, or how many entries followed it. Measured
// 2026-08-08: `prelim_released_at` is read in lib/watch-hold.ts and nowhere else
// in app/.
//
// The counts below are the two questions the rehearsal has to be able to answer,
// and both are derivable from columns that already exist.

export type PrelimEntry = {
  watch_hold: boolean | null
  // Stamped by the bulk release on every row it freed.
  watch_hold_released_at: string | null
  free_entry_url: string | null
  // render_jobs.finalized_at for this entry's PRELIM render, joined by
  // studio_application_render_id. Null for entries that never went through
  // Studio, and for accepted submissions whose file has not landed yet.
  finalizedAt: string | null
}

export type PrelimEntryClass =
  | 'held' // still invisible
  | 'late' // became watchable AFTER the cohort went out
  | 'cohort' // went out with everybody else
  | 'other' // has no prelim film, or the season has not released

export function classifyPrelimEntry(
  e: PrelimEntry,
  releasedAt: string | null,
): PrelimEntryClass {
  if (e.watch_hold) return 'held'
  if (!releasedAt) return 'other'
  if (!e.free_entry_url?.trim()) return 'other'

  const released = Date.parse(releasedAt)
  const finalized = e.finalizedAt ? Date.parse(e.finalizedAt) : NaN

  // ★'late' is tested BEFORE 'cohort', and the order is the whole judgment.
  //
  // A submission accepted before the deadline can finalize up to the processing
  // buffer later. If the release runs while such an entry is still rendering, the
  // bulk update clears its hold and stamps watch_hold_released_at -- so by the
  // stamp it looks like part of the cohort, while its film actually appeared
  // hours after everyone else's. The operator's question is "what showed up after
  // the cohort went out", and that entry is a yes. So the FILM's timestamp
  // outranks the release stamp whenever both are present.
  if (!Number.isNaN(finalized) && finalized > released) return 'late'
  if (e.watch_hold_released_at) return 'cohort'

  // Public, with a film, before the release and not part of it: the season's hold
  // was off when this entry was submitted. Not a straggler and not a cohort
  // member -- counting it as either would misreport the release.
  return 'other'
}

export type PrelimReleaseCounts = { held: number; cohort: number; late: number }

export function countPrelimEntries(
  entries: PrelimEntry[],
  releasedAt: string | null,
): PrelimReleaseCounts {
  const counts: PrelimReleaseCounts = { held: 0, cohort: 0, late: 0 }
  for (const e of entries) {
    const c = classifyPrelimEntry(e, releasedAt)
    if (c !== 'other') counts[c]++
  }
  return counts
}
