'use client'

import Link from 'next/link'
import { useT } from '@/lib/admin-i18n'
import { AdminPageHeader } from '../AdminPageHeader'

export function NewSeasonHeader() {
  const t = useT()
  return (
    <>
      <Link href="/admin/seasons" className="text-xs text-[#ff8844] hover:underline">
        {t.season_new.back}
      </Link>
      <div className="mt-3">
        <AdminPageHeader title={t.season_new.title} subtitle={t.season_new.description} />
      </div>
    </>
  )
}

export function EditSeasonHeader({
  id,
  name,
  seasonNumber,
  updatedAt,
  showSaved,
}: {
  id: string
  name: string
  seasonNumber: number
  updatedAt: string
  showSaved: boolean
}) {
  const t = useT()
  const formattedDate = new Date(updatedAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <>
      <div className="mb-8">
        <Link href="/admin/seasons" className="text-xs text-[#ff8844] hover:underline">
          {t.season_edit.back}
        </Link>
        <div className="mt-3">
          <AdminPageHeader
            title={
              <>
                {t.season_edit.title_prefix} {name}{' '}
                <span className="text-white/30 font-normal">
                  · {t.season_edit.season_label(seasonNumber)}
                </span>
              </>
            }
            right={
              <span className="text-xs text-white/40">
                {t.season_edit.last_updated(formattedDate)}
              </span>
            }
          />
        </div>
        <Link
          href={`/admin/seasons/${id}/main-results`}
          className="inline-block px-3 py-1.5 rounded border border-[#8b22ff]/40 bg-[#8b22ff]/[.08] text-xs font-bold text-[#d4a7ff] hover:brightness-110 transition"
        >
          {t.main_results.page_title} →
        </Link>
      </div>

      {showSaved && (
        <div className="mb-6 px-4 py-3 rounded border border-emerald-500/30 bg-emerald-500/10 text-sm text-emerald-300">
          {t.season_edit.saved_banner}
        </div>
      )}
    </>
  )
}

export function DangerZoneHeading() {
  const t = useT()
  return (
    <h2 className="text-xs uppercase tracking-[0.2em] text-[#ff8888] font-bold mb-4">
      {t.season_edit.danger_zone}
    </h2>
  )
}
