// Watch list cache tag + invalidation helper.
//
// /watch rebuilds the whole public grid on every request (getWatchVideos runs
// 6 full-table selects, twice per render because getWatchSeasonGroups reuses
// it). That is fine at today's volume and NOT fine at the prelim release
// moment, when the entire cohort refreshes /watch at once
// ([[project-prelim-load-structure]]). The reads are wrapped in unstable_cache
// so a herd collapses onto one query per TTL window.
//
// Cache Components (`use cache`) is the Next 16 successor, but it is an
// app-wide flag (cacheComponents in next.config) that changes the default
// rendering model for every route -- not something to switch on weeks before
// launch. Per next/dist/docs/01-app/02-guides/caching-without-cache-components,
// unstable_cache is the documented path for a project that has not opted in.
//
// This module deliberately imports nothing from lib/watch: lib/watch imports
// the tag from here, so keeping it dependency-free avoids an import cycle.

import { revalidateTag } from 'next/cache'

// Every cached read of the public Watch list carries this tag.
export const WATCH_LIST_TAG = 'watch-list'

// Seconds a cached list may be served before it is refreshed. Short enough that
// a new submission shows up quickly, long enough that a release-moment herd
// hits the DB once instead of 500 times.
export const WATCH_LIST_TTL = 60

// Call after any mutation that changes WHICH videos are public or how they are
// labelled (hold release, hide/unhide, moderation, staff pick). Deliberately
// NOT called on likes/views: those fire constantly and would defeat the cache
// exactly when it is needed; their counts simply lag by up to WATCH_LIST_TTL.
//
// Next 16 requires the second argument -- the single-arg form is deprecated
// (next/dist/docs/.../revalidateTag.md). 'max' marks the tag stale and serves
// stale-while-revalidate, which is what we want at the release moment: the
// first request after the release still gets the old list while the fresh one
// loads behind it, instead of 500 simultaneous blocking cache misses.
// updateTag() would expire immediately but is Server-Action-only, and the cron
// release path is a Route Handler.
export function revalidateWatchList(): void {
  revalidateTag(WATCH_LIST_TAG, 'max')
}
