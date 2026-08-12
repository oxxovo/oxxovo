'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useT } from '@/lib/admin-i18n'
import { AdminPageHeader } from '../AdminPageHeader'

export type EmailLogRow = {
  id: string
  application_id: string | null
  season_id: string | null
  to_email: string
  template_key: string
  language: 'ko' | 'en'
  subject: string
  status: 'sent' | 'failed' | 'skipped' | 'queued'
  error_message: string | null
  metadata: Record<string, unknown> | null
  sent_at: string
}

type SeasonOption = {
  id: string
  name: string
  season_number: number
  status: string
}

type Stats = {
  total: number
  sent: number
  failed: number
  skipped: number
}

const TEMPLATE_KEYS = [
  'pre_registered',
  'application_received',
  'waitlisted',
  'selected_top50',
  'not_selected',
  'main_round_start',
  'submission_deadline',
  'results_announced',
  'awarded_contact_request',
] as const

const STATUS_KEYS = ['sent', 'failed', 'skipped', 'queued'] as const

const STATUS_STYLES: Record<string, string> = {
  sent: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  failed: 'bg-[#ff4444]/15 text-[#ff8888] border-[#ff4444]/30',
  skipped: 'bg-white/10 text-white/50 border-white/15',
  queued: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
}

export function EmailsView({
  seasons,
  selectedSeasonScope,
  rows,
  stats,
  page,
  pageSize,
  totalCount,
}: {
  seasons: SeasonOption[]
  selectedSeasonScope: string
  rows: EmailLogRow[]
  stats: Stats
  page: number
  pageSize: number
  totalCount: number
}) {
  const t = useT()
  const router = useRouter()
  const [template, setTemplate] = useState<string>('all')
  const [status, setStatus] = useState<string>('all')
  const [language, setLanguage] = useState<string>('all')
  const [query, setQuery] = useState('')

  const templateLabel = (key: string): string => {
    const k = key as (typeof TEMPLATE_KEYS)[number]
    switch (k) {
      case 'pre_registered':
        return t.emails.template_pre_registered
      case 'application_received':
        return t.emails.template_application_received
      case 'waitlisted':
        return t.emails.template_waitlisted
      case 'selected_top50':
        return t.emails.template_selected_top50
      case 'not_selected':
        return t.emails.template_not_selected
      case 'main_round_start':
        return t.emails.template_main_round_start
      case 'submission_deadline':
        return t.emails.template_submission_deadline
      case 'results_announced':
        return t.emails.template_results_announced
      case 'awarded_contact_request':
        return t.emails.template_awarded_contact_request
      default:
        return key
    }
  }

  const statusLabel = (key: string): string => {
    const k = key as (typeof STATUS_KEYS)[number]
    switch (k) {
      case 'sent':
        return t.emails.status_sent
      case 'failed':
        return t.emails.status_failed
      case 'skipped':
        return t.emails.status_skipped
      case 'queued':
        return t.emails.status_queued
      default:
        return key
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (template !== 'all' && r.template_key !== template) return false
      if (status !== 'all' && r.status !== status) return false
      if (language !== 'all' && r.language !== language) return false
      if (q) {
        const hay = `${r.to_email} ${r.subject}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, template, status, language, query])

  const handleSeasonChange = (newScope: string) => {
    const params = new URLSearchParams()
    if (newScope !== 'all') params.set('season', newScope)
    const qs = params.toString()
    router.push(`/admin/emails${qs ? `?${qs}` : ''}`)
  }

  const goToPage = (next: number) => {
    const params = new URLSearchParams()
    if (selectedSeasonScope !== 'all') params.set('season', selectedSeasonScope)
    if (next > 1) params.set('page', String(next))
    const qs = params.toString()
    router.push(`/admin/emails${qs ? `?${qs}` : ''}`)
  }

  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalCount)
  const hasPrev = page > 1
  const hasNext = page * pageSize < totalCount

  return (
    <div className="p-8 max-w-7xl">
      <AdminPageHeader title={t.emails.title} subtitle={t.emails.subtitle} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label={t.emails.stat_total} value={stats.total} />
        <StatCard label={t.emails.stat_sent} value={stats.sent} accent="emerald" />
        <StatCard label={t.emails.stat_failed} value={stats.failed} accent="red" />
        <StatCard label={t.emails.stat_skipped} value={stats.skipped} accent="muted" />
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-5">
        <label className="block">
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
            {t.emails.season_select_label}
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

        <label className="block">
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
            {t.emails.template_label}
          </div>
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none"
          >
            <option value="all">{t.emails.template_all}</option>
            {TEMPLATE_KEYS.map((k) => (
              <option key={k} value={k}>
                {templateLabel(k)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
            {t.emails.status_label}
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none"
          >
            <option value="all">{t.emails.status_all}</option>
            {STATUS_KEYS.map((k) => (
              <option key={k} value={k}>
                {statusLabel(k)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
            {t.emails.language_label}
          </div>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none"
          >
            <option value="all">{t.emails.language_all}</option>
            <option value="ko">한국어</option>
            <option value="en">English</option>
          </select>
        </label>

        <label className="block flex-1 min-w-[240px]">
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">&nbsp;</div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.emails.search_placeholder}
            className="w-full px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none"
          />
        </label>
      </div>

      <p className="text-xs text-white/30 mb-3">{t.emails.retry_note}</p>

      <div className="border border-white/10 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/50 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-bold">{t.emails.col_sent_at}</th>
              <th className="text-left px-4 py-3 font-bold">{t.emails.col_template}</th>
              <th className="text-left px-4 py-3 font-bold">{t.emails.col_recipient}</th>
              <th className="text-center px-3 py-3 font-bold">{t.emails.col_lang}</th>
              <th className="text-center px-3 py-3 font-bold">{t.emails.col_status}</th>
              <th className="text-left px-4 py-3 font-bold">{t.emails.col_subject}</th>
              <th className="text-left px-4 py-3 font-bold">{t.emails.col_meta}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((r) => {
              const reminderHour =
                r.metadata && typeof r.metadata === 'object'
                  ? (r.metadata as Record<string, unknown>).reminder_hour
                  : undefined
              const reason =
                r.metadata && typeof r.metadata === 'object'
                  ? (r.metadata as Record<string, unknown>).reason
                  : undefined
              return (
                <tr key={r.id} className="hover:bg-white/[.03]">
                  <td className="px-4 py-3 text-white/60 text-xs whitespace-nowrap">
                    {new Date(r.sent_at).toLocaleString(undefined, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td className="px-4 py-3 text-white/80 text-xs">
                    {templateLabel(r.template_key)}
                  </td>
                  <td className="px-4 py-3 text-white/70 text-xs">{r.to_email}</td>
                  <td className="px-3 py-3 text-center text-white/60 text-xs">
                    {r.language}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold border ${
                        STATUS_STYLES[r.status] ?? STATUS_STYLES.skipped
                      }`}
                    >
                      {statusLabel(r.status)}
                    </span>
                  </td>
                  <td
                    className="px-4 py-3 text-white/70 text-xs max-w-md truncate"
                    title={r.error_message ? `${r.subject} — ${r.error_message}` : r.subject}
                  >
                    {r.subject}
                    {r.error_message && (
                      <span className="block text-[#ff8888] mt-0.5">{r.error_message}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/50 text-xs">
                    {reminderHour != null && (
                      <span className="inline-block bg-white/5 px-2 py-0.5 rounded mr-1">
                        {String(reminderHour)}h
                      </span>
                    )}
                    {reason != null && (
                      <span className="inline-block bg-white/5 px-2 py-0.5 rounded">
                        {String(reason)}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-white/40 text-sm">
                  {t.emails.empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="text-xs text-white/40">
          {t.emails.pager_label(start, end, totalCount)}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => goToPage(page - 1)}
            disabled={!hasPrev}
            className="px-3 py-1.5 rounded border border-white/10 text-xs text-white/70 hover:bg-white/[.04] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t.emails.pager_prev}
          </button>
          <button
            type="button"
            onClick={() => goToPage(page + 1)}
            disabled={!hasNext}
            className="px-3 py-1.5 rounded border border-white/10 text-xs text-white/70 hover:bg-white/[.04] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t.emails.pager_next}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: 'emerald' | 'red' | 'muted'
}) {
  const accentCls =
    accent === 'emerald'
      ? 'text-emerald-300'
      : accent === 'red'
        ? 'text-[#ff8888]'
        : accent === 'muted'
          ? 'text-white/50'
          : 'text-white'
  return (
    <div className="border border-white/10 rounded-md bg-[#100608] px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className={`text-2xl font-black mt-1 ${accentCls}`}>{value.toLocaleString()}</div>
    </div>
  )
}
