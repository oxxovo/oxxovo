// Test-only stand-in for `next/cache`, resolved by scripts/test-hooks.mjs.
//
// The real module is part of the Next server runtime and does not resolve from a
// plain `node --test` / harness process. Without this, importing lib/watch.ts
// (which wraps the public list in unstable_cache) fails at module load, so a
// harness could only inspect the watch_hold COLUMN -- i.e. measure its own copy
// of the rule instead of the query participants actually get served.
//
// unstable_cache passes straight through: caching is a performance concern, and
// a harness wants the uncached truth anyway. The invalidation helpers are no-ops.
export const unstable_cache = (fn) => fn
export const revalidateTag = () => {}
export const revalidatePath = () => {}
