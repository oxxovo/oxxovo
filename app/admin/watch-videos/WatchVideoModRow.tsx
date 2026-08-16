'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/admin-i18n'
import { setWatchHidden, approveModeration } from '@/app/watch/actions'
import { AdminExternalLink } from '../AdminExternalLink'

export type ModVideo = {
  id: string
  displayName: string | null
  status: string
  moderationStatus: string
  moderationFlags: string[]
  watchHidden: boolean
  watchHiddenReason: string | null
  reportCount: number
  prelimUrl: string | null
  mainUrl: string | null
}

export function WatchVideoModRow({ v }: { v: ModVideo }) {
  const t = useT()
  const router = useRouter()
  const [pending, start] = useTransition()

  function toggleHide() {
    start(async () => {
      const res = await setWatchHidden(v.id, !v.watchHidden)
      if (res.ok) router.refresh()
    })
  }

  function approve() {
    start(async () => {
      const res = await approveModeration(v.id)
      if (res.ok) router.refresh()
    })
  }

  return (
    <tr className="border-b border-white/5 align-top">
      <td className="py-3 pr-3 text-xs text-white/50 whitespace-nowrap">{v.reportCount}</td>
      <td className="py-3 pr-3 text-xs font-bold text-white whitespace-nowrap">
        {v.displayName ?? t.watch_videos.creator_fallback}
      </td>
      <td className="py-3 pr-3 text-xs">
        <div className="flex flex-wrap gap-1">
          {v.moderationStatus === 'flagged' && (
            <span className="rounded bg-[#ff4444]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#ff8888]">
              {t.watch_videos.ai_flagged}
            </span>
          )}
          {v.moderationStatus === 'pending' && (
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">{t.watch_videos.scanning}</span>
          )}
          {v.watchHidden && (
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
              {t.watch_videos.hidden_badge}
            </span>
          )}
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40">{v.status}</span>
        </div>
        {v.moderationFlags.length > 0 && (
          <p className="mt-1 text-[10px] text-white/40">{v.moderationFlags.join(', ')}</p>
        )}
        {v.watchHiddenReason && <p className="mt-1 text-[10px] text-white/40">{v.watchHiddenReason}</p>}
      </td>
      <td className="py-3 pr-3 text-[11px] whitespace-nowrap">
        {v.prelimUrl && (
          <AdminExternalLink href={`/watch/${v.id}?round=application`} className="block text-[#b66cff] hover:underline">
            {t.watch_videos.prelim_link}
          </AdminExternalLink>
        )}
        {v.mainUrl && (
          <AdminExternalLink href={`/watch/${v.id}?round=main`} className="block text-[#b66cff] hover:underline">
            {t.watch_videos.main_link}
          </AdminExternalLink>
        )}
      </td>
      <td className="py-3 whitespace-nowrap">
        <div className="flex gap-2">
          {v.moderationStatus !== 'approved' && (
            <button
              type="button"
              onClick={approve}
              disabled={pending}
              className="rounded bg-emerald-500/90 px-3 py-1 text-xs font-bold text-black transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {t.watch_videos.approve_btn}
            </button>
          )}
          <button
            type="button"
            onClick={toggleHide}
            disabled={pending}
            className={`rounded px-3 py-1 text-xs font-bold transition disabled:opacity-50 ${
              v.watchHidden
                ? 'border border-white/20 text-white/70 hover:border-white/40'
                : 'bg-amber-500/90 text-black hover:bg-amber-400'
            }`}
          >
            {v.watchHidden ? t.watch_videos.unhide_btn : t.watch_videos.hide_btn}
          </button>
        </div>
      </td>
    </tr>
  )
}
