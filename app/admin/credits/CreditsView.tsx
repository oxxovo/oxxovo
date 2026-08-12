'use client'

import { useState, useTransition } from 'react'
import { useAdminLang } from '@/lib/admin-i18n'
import { AdminPageHeader } from '../AdminPageHeader'
import {
  grantCreditsAction,
  lookupBalanceAction,
  type GrantActionState,
  type BalanceActionState,
} from './actions'

export type LedgerDisplayRow = {
  id: string
  email: string
  amount: number
  type: 'purchase' | 'admin_adjust' | 'generation_charge' | 'refund'
  reason: string | null
  actorEmail: string | null
  createdAt: string
}

const DICT = {
  ko: {
    title: '크레딧',
    subtitle: '스튜디오 생성 크레딧 원장. 잔액 = 거래 합계(SUM). 모든 지급은 사유 필수 + 감사 기록.',
    grant_title: '프로모 크레딧 지급',
    grant_hint: 'Stripe 충전 전, 테스트/데모용 무료 크레딧을 특정 계정에 직접 부여합니다. (type=admin_adjust)',
    f_email: '대상 계정 이메일',
    f_amount: '크레딧 수량',
    f_reason: '사유 (필수 — 감사 기록)',
    reason_ph: '예: 베타 테스터 데모 지급, 시즌0 운영 보상…',
    grant_btn: '크레딧 지급',
    granting: '지급 중…',
    grant_ok: (email: string, amt: number, bal: number) =>
      `${email}에게 ${amt} 크레딧 지급 완료. 새 잔액: ${bal}`,
    err_reason_required: '사유는 필수입니다.',
    err_amount_invalid: '수량은 0보다 큰 정수여야 합니다.',
    err_user_not_found: '해당 이메일의 계정을 찾을 수 없습니다.',
    err_failed: '지급 실패',
    lookup_title: '잔액 조회',
    lookup_btn: '조회',
    looking: '조회 중…',
    lookup_result: (email: string, bal: number) => `${email}: ${bal} 크레딧`,
    ledger_title: '최근 거래 (최대 100건)',
    col_when: '시간',
    col_account: '계정',
    col_type: '유형',
    col_amount: '수량',
    col_reason: '사유',
    col_actor: '처리자',
    empty: '거래 내역이 없습니다.',
    type_admin_adjust: '프로모 지급',
    type_generation_charge: '생성 차감',
    type_refund: '환불',
    type_purchase: '구매',
  },
  en: {
    title: 'Credits',
    subtitle: 'Studio generation credit ledger. Balance = SUM of transactions. Every grant requires a reason + audit.',
    grant_title: 'Grant promo credits',
    grant_hint: 'Before Stripe top-ups, hand free credits to a specific account for testing/demo. (type=admin_adjust)',
    f_email: 'Target account email',
    f_amount: 'Credit amount',
    f_reason: 'Reason (required — audit)',
    reason_ph: 'e.g. beta tester demo grant, Season 0 ops comp…',
    grant_btn: 'Grant credits',
    granting: 'Granting…',
    grant_ok: (email: string, amt: number, bal: number) =>
      `Granted ${amt} credits to ${email}. New balance: ${bal}`,
    err_reason_required: 'Reason is required.',
    err_amount_invalid: 'Amount must be a positive whole number.',
    err_user_not_found: 'No account found for that email.',
    err_failed: 'Grant failed',
    lookup_title: 'Balance lookup',
    lookup_btn: 'Look up',
    looking: 'Looking up…',
    lookup_result: (email: string, bal: number) => `${email}: ${bal} credits`,
    ledger_title: 'Recent transactions (up to 100)',
    col_when: 'When',
    col_account: 'Account',
    col_type: 'Type',
    col_amount: 'Amount',
    col_reason: 'Reason',
    col_actor: 'By',
    empty: 'No transactions yet.',
    type_admin_adjust: 'Promo grant',
    type_generation_charge: 'Generation charge',
    type_refund: 'Refund',
    type_purchase: 'Purchase',
  },
}

type Dict = (typeof DICT)['en']

export function CreditsView({ rows }: { rows: LedgerDisplayRow[] }) {
  const lang = useAdminLang()
  const t = DICT[lang]

  return (
    <div className="p-8 max-w-5xl">
      <AdminPageHeader title={t.title} subtitle={t.subtitle} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <GrantForm t={t} />
        <BalanceLookup t={t} />
      </div>

      <Ledger t={t} rows={rows} />
    </div>
  )
}

function typeLabel(t: Dict, type: LedgerDisplayRow['type']): string {
  switch (type) {
    case 'admin_adjust':
      return t.type_admin_adjust
    case 'generation_charge':
      return t.type_generation_charge
    case 'refund':
      return t.type_refund
    case 'purchase':
      return t.type_purchase
    default:
      return type
  }
}

function GrantForm({ t }: { t: Dict }) {
  const [email, setEmail] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<GrantActionState | null>(null)

  const errText = (s: GrantActionState): string => {
    switch (s.errorKey) {
      case 'reason_required':
        return t.err_reason_required
      case 'amount_invalid':
        return t.err_amount_invalid
      case 'user_not_found':
        return t.err_user_not_found
      default:
        return `${t.err_failed}${s.errorMessage ? `: ${s.errorMessage}` : ''}`
    }
  }

  const canSubmit = email.trim() !== '' && reason.trim() !== '' && Number(amount) > 0 && !pending

  const handleSubmit = () => {
    setResult(null)
    startTransition(async () => {
      const r = await grantCreditsAction({ email: email.trim(), amount: Number(amount), reason })
      setResult(r)
      if (r.ok) {
        setAmount('')
        setReason('')
      }
    })
  }

  return (
    <section className="border border-white/10 rounded p-5 bg-white/[.02]">
      <h2 className="text-xs uppercase tracking-[0.2em] text-[#ff8844] font-bold mb-1">
        {t.grant_title}
      </h2>
      <p className="text-[11px] text-white/40 mb-4">{t.grant_hint}</p>

      <div className="space-y-3">
        <Labeled label={t.f_email}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            placeholder="creator@example.com"
          />
        </Labeled>
        <Labeled label={t.f_amount}>
          <input
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputCls}
            placeholder="100"
          />
        </Labeled>
        <Labeled label={t.f_reason}>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className={`${inputCls} resize-y`}
            placeholder={t.reason_ph}
          />
        </Labeled>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full px-3 py-2 rounded bg-[#ff4444]/80 text-white text-xs font-bold uppercase tracking-wider hover:bg-[#ff4444] transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? t.granting : t.grant_btn}
        </button>

        {result?.ok && (
          <p className="text-[11px] text-emerald-300">
            {t.grant_ok(result.grantedTo ?? '', result.amount ?? 0, result.newBalance ?? 0)}
          </p>
        )}
        {result && !result.ok && (
          <p className="text-[11px] text-[#ff8888]">{errText(result)}</p>
        )}
      </div>
    </section>
  )
}

function BalanceLookup({ t }: { t: Dict }) {
  const [email, setEmail] = useState('')
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<BalanceActionState | null>(null)

  const handleLookup = () => {
    setResult(null)
    startTransition(async () => {
      const r = await lookupBalanceAction(email.trim())
      setResult(r)
    })
  }

  return (
    <section className="border border-white/10 rounded p-5 bg-white/[.02]">
      <h2 className="text-xs uppercase tracking-[0.2em] text-[#ff8844] font-bold mb-4">
        {t.lookup_title}
      </h2>
      <div className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
          placeholder="creator@example.com"
        />
        <button
          type="button"
          onClick={handleLookup}
          disabled={pending || email.trim() === ''}
          className="w-full px-3 py-2 rounded border border-[#ff8844]/40 text-[#ff8844] text-xs font-bold uppercase tracking-wider hover:bg-[#ff8844]/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? t.looking : t.lookup_btn}
        </button>
        {result?.ok && (
          <p className="text-sm text-white/90">{t.lookup_result(result.email ?? '', result.balance ?? 0)}</p>
        )}
        {result && !result.ok && <p className="text-[11px] text-[#ff8888]">{t.err_user_not_found}</p>}
      </div>
    </section>
  )
}

function Ledger({ t, rows }: { t: Dict; rows: LedgerDisplayRow[] }) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-[0.2em] text-[#ff8844] font-bold mb-3">
        {t.ledger_title}
      </h2>
      <div className="border border-white/10 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/[.03] text-[10px] uppercase tracking-wider text-white/40">
              <th className="text-left font-medium px-4 py-2.5">{t.col_when}</th>
              <th className="text-left font-medium px-4 py-2.5">{t.col_account}</th>
              <th className="text-left font-medium px-4 py-2.5">{t.col_type}</th>
              <th className="text-right font-medium px-4 py-2.5">{t.col_amount}</th>
              <th className="text-left font-medium px-4 py-2.5">{t.col_reason}</th>
              <th className="text-left font-medium px-4 py-2.5">{t.col_actor}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-white/40 text-xs">
                  {t.empty}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="px-4 py-2.5 text-white/60 text-xs whitespace-nowrap">
                  {new Date(r.createdAt).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </td>
                <td className="px-4 py-2.5 text-white/90">{r.email}</td>
                <td className="px-4 py-2.5 text-white/70 text-xs">{typeLabel(t, r.type)}</td>
                <td
                  className={`px-4 py-2.5 text-right font-mono ${
                    r.amount >= 0 ? 'text-emerald-300' : 'text-[#ff8888]'
                  }`}
                >
                  {r.amount >= 0 ? `+${r.amount}` : r.amount}
                </td>
                <td className="px-4 py-2.5 text-white/60 text-xs max-w-xs truncate" title={r.reason ?? ''}>
                  {r.reason ?? '—'}
                </td>
                <td className="px-4 py-2.5 text-white/40 text-xs">{r.actorEmail ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

const inputCls =
  'w-full px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none'

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{label}</div>
      {children}
    </div>
  )
}
