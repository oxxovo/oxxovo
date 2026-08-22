'use client'

// Admin-granted Studio test access (HQ 2026-08-22). Lets an admin let a
// specific, non-admin account into Studio ahead of real registration for
// this season -- watermark/E2E/subtitle/parity work needs a normal
// participant's-eye view, not the admin bypass's. Season-scoped,
// expiry-REQUIRED (studio_test_access.expires_at NOT NULL at the DB level --
// see lib/studio-test-access.ts) so this cannot repeat the 2026-08-13
// incident (a test-only switch left on with nothing tracking it).

import { useEffect, useState, useTransition } from 'react'
import { useAdminLang } from '@/lib/admin-i18n'
import {
  listStudioTestAccessAction,
  grantStudioTestAccessAction,
  revokeStudioTestAccessAction,
} from './actions'
import type { StudioTestAccessListRow } from '@/lib/studio-test-access'

const T = {
  ko: {
    heading: 'Studio 테스트 접근',
    sub: '등록·멤버십 없이도 이 시즌의 Studio를 쓸 수 있게 특정 계정에 기한부로 허락합니다.',
    email_label: '계정 이메일',
    email_ph: 'test@example.com',
    expires_label: '만료 시각 (필수)',
    note_label: '사유 (선택)',
    note_ph: '예: 워터마크 실기기 테스트',
    grant: '허락',
    granting: '처리 중…',
    col_email: '계정',
    col_granted_by: '허락한 관리자',
    col_granted_at: '허락 시각',
    col_expires_at: '만료 시각',
    col_note: '사유',
    col_status: '상태',
    col_action: '',
    status_active: '활성',
    status_expired: '만료됨',
    status_revoked: '해제됨',
    revoke: '해제',
    revoking: '처리 중…',
    empty: '부여된 테스트 접근이 없습니다.',
    err_user_not_found: '해당 이메일 계정을 찾을 수 없습니다.',
    err_expiry_required: '만료 시각을 입력하세요.',
    err_expiry_in_past: '만료 시각은 미래여야 합니다.',
    err_already_active: '이미 이 계정에 활성 부여가 있습니다 — 먼저 해제하세요.',
    err_failed: '처리하지 못했습니다.',
  },
  en: {
    heading: 'Studio test access',
    sub: 'Let a specific account use this season\'s Studio without registration or membership, for a fixed window.',
    email_label: 'Account email',
    email_ph: 'test@example.com',
    expires_label: 'Expires at (required)',
    note_label: 'Note (optional)',
    note_ph: 'e.g. watermark real-device test',
    grant: 'Grant',
    granting: 'Working…',
    col_email: 'Account',
    col_granted_by: 'Granted by',
    col_granted_at: 'Granted at',
    col_expires_at: 'Expires at',
    col_note: 'Note',
    col_status: 'Status',
    col_action: '',
    status_active: 'Active',
    status_expired: 'Expired',
    status_revoked: 'Revoked',
    revoke: 'Revoke',
    revoking: 'Working…',
    empty: 'No test access granted.',
    err_user_not_found: 'No account with that email.',
    err_expiry_required: 'Set an expiry time.',
    err_expiry_in_past: 'Expiry must be in the future.',
    err_already_active: 'This account already has an active grant — revoke it first.',
    err_failed: 'Could not complete that.',
  },
}

export function StudioTestAccess({ seasonId }: { seasonId: string }) {
  const lang = useAdminLang()
  const t = T[lang]
  const [rows, setRows] = useState<StudioTestAccessListRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [email, setEmail] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const load = () => {
    listStudioTestAccessAction(seasonId).then((r) => {
      setRows(r)
      setLoaded(true)
    })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonId])

  const errText = (reason: string): string => {
    switch (reason) {
      case 'user_not_found': return t.err_user_not_found
      case 'expiry_required': return t.err_expiry_required
      case 'expiry_in_past': return t.err_expiry_in_past
      case 'already_active': return t.err_already_active
      default: return t.err_failed
    }
  }

  const handleGrant = () => {
    setError(null)
    startTransition(async () => {
      const res = await grantStudioTestAccessAction({
        seasonId,
        email: email.trim(),
        // <input type="datetime-local"> has no timezone -- interpreted as the
        // admin's own browser-local time, which is fine here (this is an
        // internal ops tool, not a participant-facing schedule column).
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : '',
        note: note.trim() || undefined,
      })
      if (!res.ok) {
        setError(errText(res.reason))
        return
      }
      setEmail('')
      setExpiresAt('')
      setNote('')
      load()
    })
  }

  const handleRevoke = (id: string) => {
    setRevokingId(id)
    startTransition(async () => {
      await revokeStudioTestAccessAction(id, seasonId)
      setRevokingId(null)
      load()
    })
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

  const statusLabel = (s: StudioTestAccessListRow['status']) =>
    s === 'active' ? t.status_active : s === 'expired' ? t.status_expired : t.status_revoked

  const statusClass = (s: StudioTestAccessListRow['status']) =>
    s === 'active'
      ? 'text-emerald-400'
      : s === 'expired'
        ? 'text-amber-400'
        : 'text-white/35'

  return (
    <section className="mt-10 pt-8 border-t border-white/10">
      <h2 className="text-xs uppercase tracking-[0.2em] text-[#b66cff] font-bold mb-1">
        {t.heading}
      </h2>
      <p className="text-xs text-white/40 mb-4">{t.sub}</p>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.email_ph}
          className="sm:col-span-2 px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#8b22ff] focus:outline-none"
        />
        <input
          type="datetime-local"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#8b22ff] focus:outline-none"
        />
        <button
          type="button"
          onClick={handleGrant}
          disabled={pending || !email.trim() || !expiresAt}
          className="px-4 py-2 rounded bg-[#8b22ff] text-white text-xs font-bold uppercase tracking-wider hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? t.granting : t.grant}
        </button>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t.note_ph}
          className="sm:col-span-4 px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#8b22ff] focus:outline-none"
        />
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded border border-[#ff4444]/30 bg-[#ff4444]/10 text-xs text-[#ff8888]">
          {error}
        </div>
      )}

      {loaded && rows.length === 0 ? (
        <p className="text-xs text-white/35">{t.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/40 text-left border-b border-white/10">
                <th className="py-2 pr-3 font-medium">{t.col_email}</th>
                <th className="py-2 pr-3 font-medium">{t.col_granted_by}</th>
                <th className="py-2 pr-3 font-medium">{t.col_granted_at}</th>
                <th className="py-2 pr-3 font-medium">{t.col_expires_at}</th>
                <th className="py-2 pr-3 font-medium">{t.col_note}</th>
                <th className="py-2 pr-3 font-medium">{t.col_status}</th>
                <th className="py-2 font-medium">{t.col_action}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5 text-white/70">
                  <td className="py-2 pr-3">{r.email}</td>
                  <td className="py-2 pr-3 text-white/40">{r.grantedByEmail ?? '—'}</td>
                  <td className="py-2 pr-3 text-white/40">{fmt(r.granted_at)}</td>
                  <td className="py-2 pr-3 text-white/40">{fmt(r.expires_at)}</td>
                  <td className="py-2 pr-3 text-white/40">{r.note ?? '—'}</td>
                  <td className={`py-2 pr-3 font-bold ${statusClass(r.status)}`}>
                    {statusLabel(r.status)}
                  </td>
                  <td className="py-2">
                    {r.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(r.id)}
                        disabled={pending && revokingId === r.id}
                        className="px-2.5 py-1 rounded border border-[#ff4444]/40 text-[#ff8888] text-[11px] font-bold uppercase tracking-wider hover:bg-[#ff4444]/10 transition disabled:opacity-40"
                      >
                        {pending && revokingId === r.id ? t.revoking : t.revoke}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
