'use client'

import { useT } from '@/lib/admin-i18n'
import { AdminPageHeader } from '../AdminPageHeader'
import { WatchVideoModRow, type ModVideo } from './WatchVideoModRow'
import { PrelimHoldPanel, type HeldSeason } from './PrelimHoldPanel'

export function WatchVideosView({ rows, heldSeasons }: { rows: ModVideo[]; heldSeasons: HeldSeason[] }) {
  const t = useT()

  return (
    <main className="min-h-screen bg-[#030305] text-white px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <AdminPageHeader title={t.watch_videos.title} subtitle={t.watch_videos.subtitle} />

        <PrelimHoldPanel seasons={heldSeasons} />

        {rows.length === 0 ? (
          <p className="mt-10 text-sm text-white/40">{t.watch_videos.empty}</p>
        ) : (
          <table className="mt-8 w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/40">
                <th className="py-2 pr-3 font-semibold">{t.watch_videos.col_reports}</th>
                <th className="py-2 pr-3 font-semibold">{t.watch_videos.col_creator}</th>
                <th className="py-2 pr-3 font-semibold">{t.watch_videos.col_flags}</th>
                <th className="py-2 pr-3 font-semibold">{t.watch_videos.col_video}</th>
                <th className="py-2 font-semibold">{t.watch_videos.col_action}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <WatchVideoModRow key={v.id} v={v} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}
