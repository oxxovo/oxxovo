'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useT } from '@/lib/admin-i18n'

export type ApplicationRow = {
  id: string
  season_id: string
  email: string
  creator_name: string
  country: string | null
  channel_url: string | null
  free_entry_url: string | null
  video_duration_seconds: number | null
  ai_service: string | null
  creator_statement: string | null
  status: string
  award_rank: number | null
  admin_notes: string | null
  created_at: string
  winner_info_completed_at: string | null
}

type SeasonOption = {
  id: string
  name: string
  season_number: number
  status: string
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-white/10 text-white/70 border-white/20',
  waitlist: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  verifying: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  eligible: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  selected: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  awarded: 'bg-[#ff4444]/15 text-[#ff8888] border-[#ff4444]/30',
  rejected: 'bg-white/5 text-white/40 border-white/10',
}

type Segment = 'all' | 'pending' | 'selected' | 'waitlist' | 'awarded' | 'rejected'
type Sort = 'submitted_desc' | 'submitted_asc' | 'score_desc' | 'name_asc'

export function ApplicationsView({
  seasons,
  selectedSeasonId,
  applications,
}: {
  seasons: SeasonOption[]
  selectedSeasonId: string | null
  applications: ApplicationRow[]
}) {
  const t = useT()
  const router = useRouter()
  const [segment, setSegment] = useState<Segment>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('submitted_desc')

  const countsByStatus = useMemo(() => {
    const m: Record<string, number> = {}
    for (const a of applications) m[a.status] = (m[a.status] ?? 0) + 1
    return m
  }, [applications])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let rows = applications
    if (segment === 'selected') rows = rows.filter((a) => a.status === 'selected')
    else if (segment === 'pending') rows = rows.filter((a) => a.status === 'pending')
    else if (segment === 'waitlist') rows = rows.filter((a) => a.status === 'waitlist')
    else if (segment === 'awarded') rows = rows.filter((a) => a.status === 'awarded')
    else if (segment === 'rejected') rows = rows.filter((a) => a.status === 'rejected')

    if (q) {
      rows = rows.filter((a) => {
        const hay = `${a.creator_name} ${a.email} ${a.channel_url ?? ''}`.toLowerCase()
        return hay.includes(q)
      })
    }

    const sorted = [...rows]
    if (sort === 'submitted_desc') {
      sorted.sort((a, b) => b.created_at.localeCompare(a.created_at))
    } else if (sort === 'submitted_asc') {
      sorted.sort((a, b) => a.created_at.localeCompare(b.created_at))
    } else if (sort === 'name_asc') {
      sorted.sort((a, b) => a.creator_name.localeCompare(b.creator_name))
    }
    // sort === 'score_desc' is a no-op for Phase 2 (scoring lands in Phase 3)
    return sorted
  }, [applications, segment, query, sort])

  const handleSeasonChange = (newId: string) => {
    const params = new URLSearchParams()
    params.set('season', newId)
    router.push(`/admin/applications?${params.toString()}`)
  }

  const handleCsvExport = () => {
    const header = [
      t.applications.col_name,
      t.applications.col_email,
      t.applications.col_status,
      t.applications.col_score,
      t.applications.col_submitted,
    ]
    const rows = filtered.map((a) => [
      a.creator_name,
      a.email,
      a.status,
      t.applications.score_pending,
      new Date(a.created_at).toISOString(),
    ])
    downloadCsv(
      [header, ...rows],
      `oxxovo-applications-${selectedSeasonId ?? 'unknown'}-${todayStamp()}.csv`,
    )
  }

  return (
    <div className="p-8 max-w-7xl">
      <header className="mb-6">
        <h1 className="text-3xl font-black mb-1">{t.applications.title}</h1>
        <p className="text-sm text-white/40">{t.applications.subtitle}</p>
      </header>

      {/* Top controls: season + search + sort + CSV */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <label className="block">
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
            {t.applications.season_select_label}
          </div>
          <select
            value={selectedSeasonId ?? ''}
            onChange={(e) => handleSeasonChange(e.target.value)}
            className="px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none"
          >
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
            placeholder={t.applications.search_placeholder}
            className="w-full px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none"
          />
        </label>

        <label className="block">
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
            {t.applications.sort_label}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none"
          >
            <option value="submitted_desc">{t.applications.sort_submitted_desc}</option>
            <option value="submitted_asc">{t.applications.sort_submitted_asc}</option>
            <option value="score_desc">{t.applications.sort_score_desc}</option>
            <option value="name_asc">{t.applications.sort_name_asc}</option>
          </select>
        </label>

        <button
          type="button"
          onClick={handleCsvExport}
          disabled={filtered.length === 0}
          className="px-4 py-2 rounded border border-[#ff8844]/40 text-[#ff8844] text-xs font-bold uppercase tracking-wider hover:bg-[#ff8844]/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t.applications.csv_export}
        </button>
      </div>

      {/* Segment tabs */}
      <div className="flex flex-wrap gap-1 mb-5 border-b border-white/10">
        <Segment label={t.applications.segment_all} count={applications.length} active={segment === 'all'} onClick={() => setSegment('all')} t={t} />
        <Segment label={t.applications.segment_pending} count={countsByStatus.pending ?? 0} active={segment === 'pending'} onClick={() => setSegment('pending')} t={t} />
        <Segment label={t.applications.segment_top50} count={countsByStatus.selected ?? 0} active={segment === 'selected'} onClick={() => setSegment('selected')} t={t} />
        <Segment label={t.applications.segment_waitlist} count={countsByStatus.waitlist ?? 0} active={segment === 'waitlist'} onClick={() => setSegment('waitlist')} t={t} />
        <Segment label={t.applications.segment_awarded} count={countsByStatus.awarded ?? 0} active={segment === 'awarded'} onClick={() => setSegment('awarded')} t={t} />
        <Segment label={t.applications.segment_rejected} count={countsByStatus.rejected ?? 0} active={segment === 'rejected'} onClick={() => setSegment('rejected')} t={t} />
      </div>

      {/* Table */}
      <div className="border border-white/10 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/50 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-bold">{t.applications.col_name}</th>
              <th className="text-left px-4 py-3 font-bold">{t.applications.col_email}</th>
              <th className="text-left px-4 py-3 font-bold">{t.applications.col_country}</th>
              <th className="text-left px-4 py-3 font-bold">{t.applications.col_status}</th>
              <th className="text-left px-4 py-3 font-bold">{t.applications.col_ai_service}</th>
              <th className="text-right px-4 py-3 font-bold">{t.applications.col_score}</th>
              <th className="text-left px-4 py-3 font-bold">{t.applications.col_submitted}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((a) => (
              <tr key={a.id} className="hover:bg-white/[.03] cursor-pointer" onClick={() => router.push(`/admin/applications/${a.id}`)}>
                <td className="px-4 py-3 font-bold">
                  <Link href={`/admin/applications/${a.id}`} className="hover:text-[#ff8844]">
                    {a.creator_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-white/70">{a.email}</td>
                <td className="px-4 py-3 text-white/60">{a.country ?? '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold border ${
                      STATUS_STYLES[a.status] ?? STATUS_STYLES.pending
                    }`}
                  >
                    {a.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/70">{a.ai_service ?? '—'}</td>
                <td className="px-4 py-3 text-right text-white/50">{t.applications.score_pending}</td>
                <td className="px-4 py-3 text-white/50 text-xs">
                  {new Date(a.created_at).toLocaleString(undefined, {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-white/40 text-sm">
                  {t.applications.empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Segment({
  label,
  count,
  active,
  onClick,
  t,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
  t: ReturnType<typeof useT>
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-xs font-bold uppercase tracking-wider transition border-b-2 -mb-px ${
        active
          ? 'text-[#ff8844] border-[#ff8844]'
          : 'text-white/50 border-transparent hover:text-white/80'
      }`}
    >
      {label} <span className="text-white/40 font-normal">{t.applications.segment_count(count)}</span>
    </button>
  )
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadCsv(rows: string[][], filename: string) {
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n')
  // BOM for Excel UTF-8 (한글 깨짐 방지)
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
