'use client'

import { useState, useTransition } from 'react'
import { reportWatchVideo } from './actions'
import { useT } from '@/lib/admin-i18n'

// Save / Report on the detail action row. Save is still a UI placeholder (no
// watch_saves table yet, like the top-bar search/notifications). Report is wired
// to the real backend (watch_video_reports -> admin moderation queue).
function goLogin() {
  window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
}

const base =
  'inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-white/75 transition hover:border-white/40 disabled:opacity-50'

export function SaveButton({ isLoggedIn }: { isLoggedIn: boolean }) {
  const t = useT()
  const [saved, setSaved] = useState(false)
  return (
    <button
      type="button"
      onClick={() => (isLoggedIn ? setSaved((s) => !s) : goLogin())}
      aria-pressed={saved}
      className={base}
    >
      <span aria-hidden>{saved ? '✓' : '⊕'}</span>
      {saved ? t.watch.save_saved : t.watch.save_save}
    </button>
  )
}

export function VideoReportButton({
  applicationId,
  round,
  isLoggedIn,
}: {
  applicationId: string
  round: string
  isLoggedIn: boolean
}) {
  const t = useT()
  const [reported, setReported] = useState(false)
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      onClick={() => {
        if (!isLoggedIn) return goLogin()
        start(async () => {
          const res = await reportWatchVideo(applicationId, round)
          if (res.ok) setReported(true)
          else if (res.error === 'auth') goLogin()
        })
      }}
      disabled={reported || pending}
      className={base}
    >
      <span aria-hidden>⚑</span>
      {reported ? t.watch.report_reported : t.watch.report_report}
    </button>
  )
}
