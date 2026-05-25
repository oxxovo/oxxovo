'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useT } from '@/lib/admin-i18n'

export type ContactRow = {
  id: string
  season_id: string
  season_label: string
  creator_name: string
  email: string
  award_rank: number | null
  winner_phone: string | null
  winner_address: string | null
  winner_messenger: string | null
  winner_info_completed_at: string | null
}

type SeasonOption = {
  id: string
  name: string
  season_number: number
  status: string
}

export function ContactsView({
  seasons,
  selectedSeasonScope,
  contacts,
}: {
  seasons: SeasonOption[]
  selectedSeasonScope: string // 'all' or a season id
  contacts: ContactRow[]
}) {
  const t = useT()
  const router = useRouter()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter((c) => {
      const hay = `${c.creator_name} ${c.email}`.toLowerCase()
      return hay.includes(q)
    })
  }, [contacts, query])

  const handleSeasonChange = (newScope: string) => {
    const params = new URLSearchParams()
    if (newScope !== 'all') params.set('season', newScope)
    const qs = params.toString()
    router.push(`/admin/contacts${qs ? `?${qs}` : ''}`)
  }

  const handleCsvExport = () => {
    const header = [
      t.contacts.col_season,
      t.contacts.col_name,
      t.contacts.col_email,
      t.contacts.col_award,
      t.contacts.col_phone,
      t.contacts.col_address,
      t.contacts.col_messenger,
      t.contacts.col_filled_at,
    ]
    const rows = filtered.map((c) => [
      c.season_label,
      c.creator_name,
      c.email,
      c.award_rank == null ? '' : `${c.award_rank}`,
      c.winner_phone ?? '',
      c.winner_address ?? '',
      c.winner_messenger ?? '',
      c.winner_info_completed_at
        ? new Date(c.winner_info_completed_at).toISOString()
        : '',
    ])
    downloadCsv(
      [header, ...rows],
      `oxxovo-winner-contacts-${selectedSeasonScope}-${todayStamp()}.csv`,
    )
  }

  return (
    <div className="p-8 max-w-7xl">
      <header className="mb-6">
        <h1 className="text-3xl font-black mb-1">{t.contacts.title}</h1>
        <p className="text-sm text-white/40">{t.contacts.subtitle}</p>
      </header>

      <div className="flex flex-wrap items-end gap-3 mb-6">
        <label className="block">
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
            {t.contacts.season_select_label}
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
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">&nbsp;</div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.contacts.search_placeholder}
            className="w-full px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none"
          />
        </label>

        <button
          type="button"
          onClick={handleCsvExport}
          disabled={filtered.length === 0}
          className="px-4 py-2 rounded border border-[#ff8844]/40 text-[#ff8844] text-xs font-bold uppercase tracking-wider hover:bg-[#ff8844]/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t.contacts.csv_export}
        </button>
      </div>

      <div className="border border-white/10 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/50 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-bold">{t.contacts.col_season}</th>
              <th className="text-left px-4 py-3 font-bold">{t.contacts.col_name}</th>
              <th className="text-left px-4 py-3 font-bold">{t.contacts.col_email}</th>
              <th className="text-center px-4 py-3 font-bold">{t.contacts.col_award}</th>
              <th className="text-left px-4 py-3 font-bold">{t.contacts.col_phone}</th>
              <th className="text-left px-4 py-3 font-bold">{t.contacts.col_address}</th>
              <th className="text-left px-4 py-3 font-bold">{t.contacts.col_messenger}</th>
              <th className="text-left px-4 py-3 font-bold">{t.contacts.col_filled_at}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((c) => {
              const filled = !!c.winner_info_completed_at
              return (
                <tr key={c.id} className="hover:bg-white/[.03]">
                  <td className="px-4 py-3 text-white/60 text-xs">{c.season_label}</td>
                  <td className="px-4 py-3 font-bold">{c.creator_name}</td>
                  <td className="px-4 py-3 text-white/70">{c.email}</td>
                  <td className="px-4 py-3 text-center">
                    {c.award_rank ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold border bg-[#ff4444]/15 text-[#ff8888] border-[#ff4444]/30">
                        {c.award_rank}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/80">{c.winner_phone || t.contacts.not_filled}</td>
                  <td className="px-4 py-3 text-white/80 max-w-xs truncate" title={c.winner_address ?? undefined}>
                    {c.winner_address || t.contacts.not_filled}
                  </td>
                  <td className="px-4 py-3 text-white/80">{c.winner_messenger || t.contacts.not_filled}</td>
                  <td className="px-4 py-3 text-xs text-white/50">
                    {filled ? (
                      new Date(c.winner_info_completed_at!).toLocaleString(undefined, {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold border bg-white/5 text-white/40 border-white/10">
                        {t.contacts.pending_badge}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-white/40 text-sm">
                  {t.contacts.empty}
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
