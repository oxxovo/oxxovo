'use client'

import { useState } from 'react'
import { useT } from '@/lib/admin-i18n'

// Native share sheet when available (mobile), else copy the link to clipboard.
export function ShareButton() {
  const t = useT()
  const [copied, setCopied] = useState(false)

  async function share() {
    const url = window.location.href
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ url })
      } catch {
        /* user cancelled */
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-white/75 transition hover:border-white/40"
    >
      <span aria-hidden>↗</span>
      {copied ? t.watch.share_copied : t.watch.share_share}
    </button>
  )
}
