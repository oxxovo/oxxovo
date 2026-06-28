'use client'

import { useState } from 'react'

// Save / Report on the detail action row. UI placeholders this phase (like the
// top-bar search/notifications): Save has no watch_saves table yet, and video-
// level Report has no backend; both are wired to local state so the row matches
// the spec. Signed-out clicks bounce to login.
function goLogin() {
  window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
}

const base =
  'inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-white/75 transition hover:border-white/40 disabled:opacity-50'

export function SaveButton({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [saved, setSaved] = useState(false)
  return (
    <button
      type="button"
      onClick={() => (isLoggedIn ? setSaved((s) => !s) : goLogin())}
      aria-pressed={saved}
      className={base}
    >
      <span aria-hidden>{saved ? '✓' : '⊕'}</span>
      {saved ? 'Saved' : 'Save'}
    </button>
  )
}

export function VideoReportButton({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [reported, setReported] = useState(false)
  return (
    <button
      type="button"
      onClick={() => (isLoggedIn ? setReported(true) : goLogin())}
      disabled={reported}
      className={base}
    >
      <span aria-hidden>⚑</span>
      {reported ? 'Reported' : 'Report'}
    </button>
  )
}
