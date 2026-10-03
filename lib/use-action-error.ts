'use client'

// One place for "run a server action and tell the admin when it failed".
//
// The admin screens kept doing `const res = await action(); if (res.ok) refresh()`
// with no else, so a failed write looked like a click that did nothing (found
// 2026-10-03: the watch_as_home toggle was dead for weeks and the only trace was a
// Vercel log line). run() sets `error` for BOTH a {ok:false} result and a thrown
// error, and returns the result only on success -- callers keep their own
// success handling and just render <p role="alert">{error}</p>.
//
// UI feedback only: it never retries, never reverts server state, and does not
// know about any particular action.

import { useCallback, useState } from 'react'

export type ActionResultLike = { ok: boolean; error?: string }

export function useActionError() {
  const [error, setError] = useState<string | null>(null)

  const clear = useCallback(() => setError(null), [])

  // Resolves to the success member of the action's result union (so callers can read
  // e.g. res.staffPick without a cast), or null once the failure has been shown.
  const run = useCallback(async <T extends ActionResultLike>(fn: () => Promise<T>): Promise<Extract<T, { ok: true }> | null> => {
    setError(null)
    try {
      const res = await fn()
      if (!res.ok) {
        setError(res.error ?? 'failed')
        return null
      }
      return res as Extract<T, { ok: true }>
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return null
    }
  }, [])

  return { error, run, clear }
}
