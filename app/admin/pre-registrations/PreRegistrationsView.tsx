'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useT } from '@/lib/admin-i18n'
import { AdminPageHeader } from '../AdminPageHeader'

export type PreRegRow = {
  id: string
  email: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  referrer: string | null
  season_id: string | null
  season_label: string
  status: string
  created_at: string
}

type SeasonOption = {
  id: string
  name: string
  season_number: number
  status: string
}

export function PreRegistrationsView({
  seasons,
  selectedSeasonScope,
  rows,
}: {
  seasons: SeasonOption[]
  selectedSeasonScope: string // 'all' or a season id
  rows: PreRegRow[]
}) {
  const t = useT()
  const router = useRouter()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const hay =
        `${r.email} ${r.utm_source ?? ''} ${r.utm_medium ?? ''} ${r.utm_campaign ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [rows, query])

  const handleSeasonChange = (newScope: string) => {
    const params = new URLSearchParams()
    if (newScope !== 'all') params.set('season', newScope)
    const qs = params.toString()
    router.push(`/admin/pre-registrations${qs ? `?${qs}` : ''}`)
  }

  const handleCsvExport = () => {
    const header = [
      t.pre_reg.col_email,
      t.pre_reg.col_season,
      t.pre_reg.col_utm_source,
      t.pre_reg.col_utm_medium,
      t.pre_reg.col_utm_campaign,
      t.pre_reg.col_referrer,
      t.pre_reg.col_status,
      t.pre_reg.col_created_at,
    ]
    const csvRows = filtered.map((r) => [
      r.email,
      r.season_label,
      r.utm_source ?? '',
      r.utm_medium ?? '',
      r.utm_campaign ?? '',
      r.referrer ?? '',
      r.status,
      new Date(r.created_at).toISOString(),
    ])
    downloadCsv(
      [header, ...csvRows],
      `oxxovo-pre-registrations-${selectedSeasonScope}-${todayStamp()}.csv`,
    )
  }

  return (
    <div className="p-8 max-w-7xl">
      <AdminPageHeader title={t.pre_reg.title} subtitle={t.pre_reg.subtitle} />

      <div className="flex flex-wrap items-end gap-3 mb-6">
        <label className="block">
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
            {t.pre_reg.season_select_label}
          </div>
          <select
            value={selectedSeasonScope}
            onChange={(e) => handleSeasonChange(e.target.value)}
            className="px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none"
          >
            <option value="all">{t.applications.segment_all}</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (#{s.season_number})
              </option>
            ))}
          </select>
        </label>

        <label className="block flex-1 min-w-[240px]">
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
            {t.pre_reg.count_label(filtered.length)}
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.pre_reg.search_placeholder}
            className="w-full px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none"
          />
        </label>

        <button
          type="button"
          onClick={handleCsvExport}
          disabled={filtered.length === 0}
          className="px-4 py-2 rounded border border-[#ff8844]/40 text-[#ff8844] text-xs font-bold uppercase tracking-wider hover:bg-[#ff8844]/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t.pre_reg.csv_export}
        </button>
      </div>

      <div className="border border-white/10 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/50 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-bold">{t.pre_reg.col_email}</th>
              <th className="text-left px-4 py-3 font-bold">{t.pre_reg.col_season}</th>
              <th className="text-left px-4 py-3 font-bold">{t.pre_reg.col_utm_source}</th>
              <th className="text-left px-4 py-3 font-bold">{t.pre_reg.col_utm_medium}</th>
              <th className="text-left px-4 py-3 font-bold">{t.pre_reg.col_utm_campaign}</th>
              <th className="text-left px-4 py-3 font-bold">{t.pre_reg.col_created_at}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-white/[.03]">
                <td className="px-4 py-3 font-bold">{r.email}</td>
                <td className="px-4 py-3 text-white/60 text-xs">{r.season_label}</td>
                <td className="px-4 py-3 text-white/70">{r.utm_source || '—'}</td>
                <td className="px-4 py-3 text-white/70">{r.utm_medium || '—'}</td>
                <td className="px-4 py-3 text-white/70 max-w-xs truncate" title={r.utm_campaign ?? undefined}>
                  {r.utm_campaign || '—'}
                </td>
                <td className="px-4 py-3 text-xs text-white/50">
                  {new Date(r.created_at).toLocaleString(undefined, {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-white/40 text-sm">
                  {t.pre_reg.empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadCsv(rows: string[][], filename: string) {
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function todayStamp(): string {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}
