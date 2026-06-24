'use client'

import { useState, useTransition } from 'react'
import { useAdminLang } from '@/lib/admin-i18n'
import { type StaffMember } from '@/lib/managers'
import {
  promoteAction,
  demoteAction,
  type PromoteActionState,
  type DemoteActionState,
} from './actions'

const DICT = {
  ko: {
    title: '매니저',
    subtitle:
      '운영진 권한 관리(슈퍼 전용). 매니저는 신청·메시지·연락처·이메일 로그 조회와 홍보영상만 가능하고, 시즌·정산·매니저 관리는 슈퍼(대표)만 가능합니다.',
    add_title: '매니저 추가',
    add_hint: '대상은 먼저 일반 가입을 마친 계정이어야 합니다. 이메일로 검색해 승격합니다.',
    f_email: '대상 계정 이메일',
    add_btn: '매니저로 승격',
    adding: '승격 중…',
    add_ok: (email: string) => `${email} 님을 매니저로 승격했습니다.`,
    err_email_required: '이메일을 입력하세요.',
    err_user_not_found: '해당 이메일로 가입한 계정을 찾을 수 없습니다. 먼저 일반 가입을 안내하세요.',
    err_already_admin: '이미 슈퍼 권한(대표) 계정입니다.',
    err_already_manager: '이미 매니저입니다.',
    err_failed: '처리 실패',
    list_title: '현재 운영진',
    col_email: '이메일',
    col_role: '권한',
    col_action: '관리',
    role_admin: '슈퍼 (대표)',
    role_manager: '매니저',
    self: '나',
    demote_btn: '강등',
    demoting: '강등 중…',
    demote_confirm: (email: string) => `${email} 님을 매니저에서 강등합니다. 계속할까요?`,
    err_not_a_manager: '매니저가 아닙니다.',
    empty: '운영진이 없습니다.',
  },
  en: {
    title: 'Managers',
    subtitle:
      'Operational role management (super only). Managers can view applications, messages, contacts, email logs and run promo. Seasons, payouts, and manager management are super (owner) only.',
    add_title: 'Add a manager',
    add_hint: 'The person must already have a normal account. Search by email to promote.',
    f_email: 'Target account email',
    add_btn: 'Promote to manager',
    adding: 'Promoting…',
    add_ok: (email: string) => `Promoted ${email} to manager.`,
    err_email_required: 'Enter an email.',
    err_user_not_found: 'No account found for that email. Ask them to sign up first.',
    err_already_admin: 'That account is already a super (owner).',
    err_already_manager: 'Already a manager.',
    err_failed: 'Failed',
    list_title: 'Current staff',
    col_email: 'Email',
    col_role: 'Role',
    col_action: 'Manage',
    role_admin: 'Super (owner)',
    role_manager: 'Manager',
    self: 'you',
    demote_btn: 'Demote',
    demoting: 'Demoting…',
    demote_confirm: (email: string) => `Demote ${email} from manager. Continue?`,
    err_not_a_manager: 'Not a manager.',
    empty: 'No staff yet.',
  },
}

type Dict = (typeof DICT)['en']

export function ManagersView({ staff, selfId }: { staff: StaffMember[]; selfId: string }) {
  const lang = useAdminLang()
  const t = DICT[lang]
  // Local copy so the table updates immediately after promote/demote.
  const [rows, setRows] = useState<StaffMember[]>(staff)

  return (
    <div className="p-8 max-w-4xl">
      <header className="mb-8">
        <h1 className="text-3xl font-black">{t.title}</h1>
        <p className="mt-1 text-sm text-white/50 max-w-2xl">{t.subtitle}</p>
      </header>

      <div className="mb-10">
        <AddManager t={t} onAdded={(m) => setRows((r) => dedupeSorted([...r, m]))} />
      </div>

      <StaffList t={t} rows={rows} selfId={selfId} onDemoted={(id) => setRows((r) => r.filter((m) => m.id !== id))} />
    </div>
  )
}

// Keep the table admin-first then email-sorted, no duplicate ids.
function dedupeSorted(list: StaffMember[]): StaffMember[] {
  const byId = new Map<string, StaffMember>()
  for (const m of list) byId.set(m.id, m)
  return [...byId.values()].sort((a, b) => {
    if (a.role !== b.role) return a.role === 'admin' ? -1 : 1
    return a.email.localeCompare(b.email)
  })
}

function AddManager({ t, onAdded }: { t: Dict; onAdded: (m: StaffMember) => void }) {
  const [email, setEmail] = useState('')
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<PromoteActionState | null>(null)

  const errText = (s: PromoteActionState): string => {
    switch (s.errorKey) {
      case 'email_required':
        return t.err_email_required
      case 'user_not_found':
        return t.err_user_not_found
      case 'already_admin':
        return t.err_already_admin
      case 'already_manager':
        return t.err_already_manager
      default:
        return `${t.err_failed}${s.errorMessage ? `: ${s.errorMessage}` : ''}`
    }
  }

  const handleSubmit = () => {
    setResult(null)
    startTransition(async () => {
      const r = await promoteAction(email.trim())
      setResult(r)
      if (r.ok && r.email) {
        onAdded({ id: `pending:${r.email}`, email: r.email, role: 'manager' })
        setEmail('')
      }
    })
  }

  return (
    <section className="border border-white/10 rounded p-5 bg-white/[.02]">
      <h2 className="text-xs uppercase tracking-[0.2em] text-[#ff8844] font-bold mb-1">{t.add_title}</h2>
      <p className="text-[11px] text-white/40 mb-4">{t.add_hint}</p>

      <div className="space-y-3 max-w-md">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{t.f_email}</div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            placeholder="person@example.com"
          />
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending || email.trim() === ''}
          className="px-4 py-2 rounded bg-[#ff4444]/80 text-white text-xs font-bold uppercase tracking-wider hover:bg-[#ff4444] transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? t.adding : t.add_btn}
        </button>

        {result?.ok && <p className="text-[11px] text-emerald-300">{t.add_ok(result.email ?? '')}</p>}
        {result && !result.ok && <p className="text-[11px] text-[#ff8888]">{errText(result)}</p>}
      </div>
    </section>
  )
}

function StaffList({
  t,
  rows,
  selfId,
  onDemoted,
}: {
  t: Dict
  rows: StaffMember[]
  selfId: string
  onDemoted: (id: string) => void
}) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-[0.2em] text-[#ff8844] font-bold mb-3">{t.list_title}</h2>
      <div className="border border-white/10 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/[.03] text-[10px] uppercase tracking-wider text-white/40">
              <th className="text-left font-medium px-4 py-2.5">{t.col_email}</th>
              <th className="text-left font-medium px-4 py-2.5">{t.col_role}</th>
              <th className="text-right font-medium px-4 py-2.5">{t.col_action}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-white/40 text-xs">
                  {t.empty}
                </td>
              </tr>
            )}
            {rows.map((m) => (
              <StaffRow key={m.id} t={t} m={m} isSelf={m.id === selfId} onDemoted={onDemoted} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function StaffRow({
  t,
  m,
  isSelf,
  onDemoted,
}: {
  t: Dict
  m: StaffMember
  isSelf: boolean
  onDemoted: (id: string) => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleDemote = () => {
    if (!window.confirm(t.demote_confirm(m.email))) return
    setError(null)
    startTransition(async () => {
      const r: DemoteActionState = await demoteAction(m.id)
      if (r.ok) onDemoted(m.id)
      else setError(r.errorKey === 'not_a_manager' ? t.err_not_a_manager : `${t.err_failed}${r.errorMessage ? `: ${r.errorMessage}` : ''}`)
    })
  }

  return (
    <tr className="border-t border-white/5">
      <td className="px-4 py-2.5 text-white/90">
        {m.email}
        {isSelf && <span className="ml-2 text-[10px] text-white/40">({t.self})</span>}
      </td>
      <td className="px-4 py-2.5">
        <span
          className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
            m.role === 'admin' ? 'bg-[#ff8844]/15 text-[#ff8844]' : 'bg-white/10 text-white/70'
          }`}
        >
          {m.role === 'admin' ? t.role_admin : t.role_manager}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right">
        {m.role === 'manager' ? (
          <>
            <button
              type="button"
              onClick={handleDemote}
              disabled={pending || m.id.startsWith('pending:')}
              className="px-3 py-1.5 rounded border border-[#ff8888]/40 text-[#ff8888] text-[11px] font-bold uppercase tracking-wider hover:bg-[#ff8888]/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {pending ? t.demoting : t.demote_btn}
            </button>
            {error && <p className="text-[11px] text-[#ff8888] mt-1">{error}</p>}
          </>
        ) : (
          <span className="text-white/20 text-xs">—</span>
        )}
      </td>
    </tr>
  )
}

const inputCls =
  'w-full px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none'
