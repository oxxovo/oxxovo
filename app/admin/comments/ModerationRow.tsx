'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setCommentHidden } from './actions'

export type ModComment = {
  id: string
  authorName: string
  body: string
  status: 'visible' | 'hidden'
  reportCount: number
  applicationId: string
  round: string
  createdAt: string
}

export function ModerationRow({ c }: { c: ModComment }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const hidden = c.status === 'hidden'

  function toggle() {
    start(async () => {
      const res = await setCommentHidden(c.id, !hidden)
      if (res.ok) router.refresh()
    })
  }

  return (
    <tr className="border-b border-white/5 align-top">
      <td className="py-3 pr-3 text-xs text-white/50 whitespace-nowrap">{c.reportCount}</td>
      <td className="py-3 pr-3 text-xs font-bold text-white whitespace-nowrap">{c.authorName}</td>
      <td className="py-3 pr-3 text-sm text-white/80">
        <p className="whitespace-pre-wrap">{c.body}</p>
        <a
          href={`/watch/${c.applicationId}?round=${c.round}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-[#b66cff] hover:underline"
        >
          view video →
        </a>
      </td>
      <td className="py-3 pr-3 text-xs whitespace-nowrap">
        <span className={hidden ? 'text-amber-400' : 'text-emerald-400'}>{c.status}</span>
      </td>
      <td className="py-3 whitespace-nowrap">
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className={`rounded px-3 py-1 text-xs font-bold transition disabled:opacity-50 ${
            hidden
              ? 'border border-white/20 text-white/70 hover:border-white/40'
              : 'bg-amber-500/90 text-black hover:bg-amber-400'
          }`}
        >
          {hidden ? 'Unhide' : 'Hide'}
        </button>
      </td>
    </tr>
  )
}
