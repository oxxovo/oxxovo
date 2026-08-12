// ★ONE MAPPING, NOT THREE BRANCHES.
//
// The three Studio lane tables do not agree on where the claim time lives, and
// the fix for that is not a fourth column. generation_jobs already sets
// worker_started_at at claim and nowhere else, so it IS the claim time; adding a
// claimed_at beside it would leave two columns meaning the same thing and no way
// to tell which one anything trusts -- that ambiguity is itself the drift.
// render_jobs and studio_music_assets carry claimed_at.
//
// So the disagreement is recorded once, as data, instead of becoming a
// conditional repeated at every read. Same discipline as resolving the worker
// repo path in one place rather than at each script.
//
// ★No imports, by design: this is schema fact, and it has to stay loadable
// without dragging in the server-only sweep that uses it.
export const CLAIM_COLUMN = {
  generation_jobs: 'worker_started_at',
  render_jobs: 'claimed_at',
  studio_music_assets: 'claimed_at',
} as const

export type StudioLeaseTable = keyof typeof CLAIM_COLUMN
