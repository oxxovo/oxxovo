'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/admin-i18n'
import { setCommentHidden } from './actions'
import { AdminExternalLink } from '../AdminExternalLink'

export type ModComment = {
  id: string
  authorName: string | null
  body: string
  status: 'visible' | 'hidden'
  reportCount: number
  applicationId: string
  round: string
  createdAt: string
}

export function ModerationRow({ c }: { c: ModComment }) {
  const t = useT()
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
      <td className="py-3 pr-3 text-xs font-bold text-white whitespace-nowrap">
        {c.authorName ?? t.comments.author_fallback}
      </td>
      <td className="py-3 pr-3 text-sm text-white/80">
        <p className="whitespace-pre-wrap">{c.body}</p>
        <AdminExternalLink
          href={`/watch/${c.applicationId}?round=${c.round}`}
          className="text-[11px] text-[#b66cff] hover:underline"
        >
          {t.comments.view_video}
        </AdminExternalLink>
      </td>
      <td className="py-3 pr-3 text-xs whitespace-nowrap">
        <span className={hidden ? 'text-amber-400' : 'text-emerald-400'}>
          {hidden ? t.comments.status_hidden : t.comments.status_visible}
        </span>
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
          {hidden ? t.comments.unhide_btn : t.comments.hide_btn}
        </button>
      </td>
    </tr>
  )
}
