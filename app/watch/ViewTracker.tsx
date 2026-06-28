'use client'

import { useEffect, useRef } from 'react'
import { recordWatchView } from './actions'

// Fires one view record when the detail/player page actually mounts in the
// browser -- not on RSC prefetch -- so a card hovered in the grid doesn't
// inflate counts. Server-side dedup (per viewer, per day) handles refreshes.
export function ViewTracker({ applicationId, round }: { applicationId: string; round: string }) {
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    void recordWatchView(applicationId, round)
  }, [applicationId, round])
  return null
}
