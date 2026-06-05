'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useAdminLang } from '@/lib/admin-i18n'
import type { PartnerProfile, TierConfig, PartnerTournamentRow } from '@/lib/partners'
import { suspendPartner, restorePartner, invitePartner, markEscrowPaid } from './actions'

type TabKey = 'active' | 'eligible' | 'invite' | 'tournaments'

const DICT = {
  ko: {
    title: '파트너 호스트',
    subtitle: 'Member Hosted Tournament 파트너 관리',
    tabs: { active: '활성 파트너', eligible: '자격자', invite: '초대', tournaments: '토너먼트' },
    col: {
      email: '이메일',
      tier: '등급',
      top50: 'Top 50',
      wins: '수상',
      hosted: '주최',
      status: '상태',
      activated: '활성일',
    },
    status: { active: '활성', suspended: '정지됨', auto_eligible: '자격', invited: '초대됨' },
    suspend: '정지',
    restore: '복구',
    cancel: '취소',
    confirm: '확인',
    reasonPlaceholder: '사유 (필수)',
    suspendTitle: '파트너 정지 — 사유 입력',
    restoreTitle: '파트너 복구 — 사유 입력',
    emptyActive: '활성/정지 파트너가 없습니다.',
    emptyEligible: '자격 보유 회원이 없습니다.',
    eligibleNote: '누적 성과로 자동 자격을 획득한 회원입니다 (조회 전용).',
    invite: {
      heading: '파트너 초대',
      note: '미가입자도 이메일로 초대할 수 있습니다 — 매직링크 가입 시 초대 상태가 자동 연결됩니다.',
      email: '이메일',
      emailPh: 'creator@example.com',
      tier: '등급 (직접 지정)',
      reason: '초대 사유 (필수)',
      reasonPh: '예: 시즌 0 1위, 커뮤니티 기여도 높음',
      submit: '초대 발송',
      sending: '발송 중…',
      cap: (cap: number, perSeason: number | null) =>
        `정원 ${cap}명 · 시즌당 ${perSeason == null ? '무제한' : perSeason + '회'}`,
    },
    tour: {
      empty: '파트너 토너먼트가 없습니다.',
      colHost: '호스트',
      colTheme: '테마',
      colPool: '상금풀',
      colMax: '정원',
      colStatus: '상태',
      colEscrow: '에스크로',
      markPaid: 'Paid 처리 & 공개',
      escrow: { not_required: '불필요', pending: '대기', paid: '완료', refunded: '환불' } as Record<string, string>,
    },
    toast: {
      suspended: '정지되었습니다',
      restored: '복구되었습니다',
      invited: '초대를 발송했습니다',
      escrowPaid: '에스크로 완료 — 공개됨',
    },
  },
  en: {
    title: 'Partner hosts',
    subtitle: 'Member Hosted Tournament partner management',
    tabs: { active: 'Active partners', eligible: 'Eligible', invite: 'Invite', tournaments: 'Tournaments' },
    col: {
      email: 'Email',
      tier: 'Tier',
      top50: 'Top 50',
      wins: 'Wins',
      hosted: 'Hosted',
      status: 'Status',
      activated: 'Activated',
    },
    status: { active: 'Active', suspended: 'Suspended', auto_eligible: 'Eligible', invited: 'Invited' },
    suspend: 'Suspend',
    restore: 'Restore',
    cancel: 'Cancel',
    confirm: 'Confirm',
    reasonPlaceholder: 'Reason (required)',
    suspendTitle: 'Suspend partner — enter reason',
    restoreTitle: 'Restore partner — enter reason',
    emptyActive: 'No active or suspended partners.',
    emptyEligible: 'No eligible members.',
    eligibleNote: 'Members who auto-qualified from cumulative results (read-only).',
    invite: {
      heading: 'Invite a partner',
      note: 'You can invite by email even if the person is not registered — the invite links automatically when they sign in via magic link.',
      email: 'Email',
      emailPh: 'creator@example.com',
      tier: 'Tier (assign directly)',
      reason: 'Invite reason (required)',
      reasonPh: 'e.g. Season 0 winner, strong community contribution',
      submit: 'Send invite',
      sending: 'Sending…',
      cap: (cap: number, perSeason: number | null) =>
        `${cap} applicants · ${perSeason == null ? 'unlimited' : perSeason + '/season'} per season`,
    },
    tour: {
      empty: 'No partner tournaments.',
      colHost: 'Host',
      colTheme: 'Theme',
      colPool: 'Prize pool',
      colMax: 'Cap',
      colStatus: 'Status',
      colEscrow: 'Escrow',
      markPaid: 'Mark paid & publish',
      escrow: { not_required: 'N/A', pending: 'Pending', paid: 'Paid', refunded: 'Refunded' } as Record<string, string>,
    },
    toast: {
      suspended: 'Suspended',
      restored: 'Restored',
      invited: 'Invitation sent',
      escrowPaid: 'Escrow confirmed — published',
    },
  },
} as const

function tierBadgeStyle(tier: string | null): string {
  switch (tier) {
    case 'gold':
      return 'bg-amber-400/15 text-amber-300 border-amber-400/30'
    case 'silver':
      return 'bg-slate-300/15 text-slate-200 border-slate-300/30'
    case 'bronze':
      return 'bg-orange-700/20 text-orange-300 border-orange-600/30'
    default:
      return 'bg-white/5 text-white/50 border-white/10'
  }
}

export function PartnersView({
  active,
  suspended,
  eligible,
  tiers,
  tournaments,
}: {
  active: PartnerProfile[]
  suspended: PartnerProfile[]
  eligible: PartnerProfile[]
  tiers: TierConfig[]
  tournaments: PartnerTournamentRow[]
}) {
  const lang = useAdminLang()
  const tx = DICT[lang]
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('active')
  const [toast, setToast] = useState<string | null>(null)

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
    router.refresh()
  }

  // active + suspended share tab 1 (suspended can be restored from here).
  const tab1Rows = [...active, ...suspended]

  return (
    <div className="p-8 max-w-7xl">
      <header className="mb-6">
        <h1 className="text-3xl font-black mb-1">{tx.title}</h1>
        <p className="text-sm text-white/40">{tx.subtitle}</p>
      </header>

      <div className="flex gap-1 mb-6 border-b border-white/10">
        {(['active', 'eligible', 'invite', 'tournaments'] as TabKey[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
              tab === k
                ? 'border-[#ff8844] text-white'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            {tx.tabs[k]}
            {k === 'active' && tab1Rows.length > 0 && (
              <span className="ml-2 text-[11px] text-white/40">{tab1Rows.length}</span>
            )}
            {k === 'eligible' && eligible.length > 0 && (
              <span className="ml-2 text-[11px] text-white/40">{eligible.length}</span>
            )}
            {k === 'tournaments' && tournaments.length > 0 && (
              <span className="ml-2 text-[11px] text-white/40">{tournaments.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'active' && (
        <PartnerTable rows={tab1Rows} tx={tx} onDone={flash} actionable />
      )}
      {tab === 'eligible' && (
        <>
          <p className="text-xs text-white/40 mb-3">{tx.eligibleNote}</p>
          <PartnerTable rows={eligible} tx={tx} onDone={flash} actionable={false} />
        </>
      )}
      {tab === 'invite' && <InviteForm tiers={tiers} tx={tx} onDone={flash} />}
      {tab === 'tournaments' && (
        <TournamentsTable rows={tournaments} tx={tx} onDone={flash} />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#1a0c12] border border-[#ff8844]/40 text-[#ffb088] text-sm px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

function PartnerTable({
  rows,
  tx,
  onDone,
  actionable,
}: {
  rows: PartnerProfile[]
  tx: (typeof DICT)['ko'] | (typeof DICT)['en']
  onDone: (msg: string) => void
  actionable: boolean
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-white/30 py-10 text-center">
        {actionable ? tx.emptyActive : tx.emptyEligible}
      </p>
    )
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-white/40 bg-white/[.03]">
            <th className="px-4 py-3 font-semibold">{tx.col.email}</th>
            <th className="px-4 py-3 font-semibold">{tx.col.tier}</th>
            <th className="px-4 py-3 font-semibold text-right">{tx.col.top50}</th>
            <th className="px-4 py-3 font-semibold text-right">{tx.col.wins}</th>
            <th className="px-4 py-3 font-semibold text-right">{tx.col.hosted}</th>
            <th className="px-4 py-3 font-semibold">{tx.col.status}</th>
            {actionable && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <PartnerRow key={r.id} row={r} tx={tx} onDone={onDone} actionable={actionable} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PartnerRow({
  row,
  tx,
  onDone,
  actionable,
}: {
  row: PartnerProfile
  tx: (typeof DICT)['ko'] | (typeof DICT)['en']
  onDone: (msg: string) => void
  actionable: boolean
}) {
  const [mode, setMode] = useState<'suspend' | 'restore' | null>(null)
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  const statusKey = row.partner_status as keyof typeof tx.status
  const isSuspended = row.partner_status === 'suspended'

  const submit = () => {
    setErr(null)
    startTransition(async () => {
      const res =
        mode === 'suspend'
          ? await suspendPartner(row.id, reason)
          : await restorePartner(row.id, reason)
      if (!res.ok) {
        setErr(res.errorMessage ?? 'Failed')
        return
      }
      setMode(null)
      setReason('')
      onDone(mode === 'suspend' ? tx.toast.suspended : tx.toast.restored)
    })
  }

  return (
    <>
      <tr className="border-t border-white/5 hover:bg-white/[.02]">
        <td className="px-4 py-3 text-white/90">{row.email}</td>
        <td className="px-4 py-3">
          <span className={`inline-block text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${tierBadgeStyle(row.partner_tier)}`}>
            {row.partner_tier ?? '—'}
          </span>
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-white/70">{row.cumulative_top50}</td>
        <td className="px-4 py-3 text-right tabular-nums text-white/70">{row.cumulative_wins}</td>
        <td className="px-4 py-3 text-right tabular-nums text-white/70">{row.hosted_count}</td>
        <td className="px-4 py-3">
          <span className={`text-xs ${isSuspended ? 'text-[#ff6666]' : 'text-emerald-400'}`}>
            {tx.status[statusKey] ?? row.partner_status}
          </span>
        </td>
        {actionable && (
          <td className="px-4 py-3 text-right">
            {mode === null && (
              <button
                type="button"
                onClick={() => setMode(isSuspended ? 'restore' : 'suspend')}
                className={`text-xs font-semibold px-3 py-1.5 rounded border transition ${
                  isSuspended
                    ? 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10'
                    : 'border-[#ff4444]/30 text-[#ff8888] hover:bg-[#ff4444]/10'
                }`}
              >
                {isSuspended ? tx.restore : tx.suspend}
              </button>
            )}
          </td>
        )}
      </tr>
      {actionable && mode !== null && (
        <tr className="border-t border-white/5 bg-white/[.02]">
          <td colSpan={7} className="px-4 py-3">
            <div className="flex flex-col gap-2">
              <span className="text-xs text-white/60">
                {mode === 'suspend' ? tx.suspendTitle : tx.restoreTitle}
              </span>
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={tx.reasonPlaceholder}
                  className="flex-1 bg-[#0a0608] border border-white/15 rounded px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-[#ff8844]/50 outline-none"
                />
                <button
                  type="button"
                  disabled={pending || !reason.trim()}
                  onClick={submit}
                  className="text-xs font-semibold px-4 py-2 rounded bg-[#ff8844] text-[#1a0c12] disabled:opacity-40"
                >
                  {tx.confirm}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setMode(null)
                    setReason('')
                    setErr(null)
                  }}
                  className="text-xs font-semibold px-4 py-2 rounded border border-white/15 text-white/60 hover:text-white"
                >
                  {tx.cancel}
                </button>
              </div>
              {err && <span className="text-xs text-[#ff6666]">{err}</span>}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function TournamentsTable({
  rows,
  tx,
  onDone,
}: {
  rows: PartnerTournamentRow[]
  tx: (typeof DICT)['ko'] | (typeof DICT)['en']
  onDone: (msg: string) => void
}) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  if (rows.length === 0) {
    return <p className="text-sm text-white/30 py-10 text-center">{tx.tour.empty}</p>
  }

  const markPaid = (id: string) => {
    setErr(null)
    setPendingId(id)
    startTransition(async () => {
      const res = await markEscrowPaid(id)
      setPendingId(null)
      if (!res.ok) {
        setErr(res.errorMessage ?? 'Failed')
        return
      }
      onDone(tx.toast.escrowPaid)
    })
  }

  return (
    <div>
      {err && <p className="text-xs text-[#ff6666] mb-3">{err}</p>}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-white/40 bg-white/[.03]">
              <th className="px-4 py-3 font-semibold">{tx.tour.colTheme}</th>
              <th className="px-4 py-3 font-semibold">{tx.tour.colHost}</th>
              <th className="px-4 py-3 font-semibold text-right">{tx.tour.colPool}</th>
              <th className="px-4 py-3 font-semibold text-right">{tx.tour.colMax}</th>
              <th className="px-4 py-3 font-semibold">{tx.tour.colStatus}</th>
              <th className="px-4 py-3 font-semibold">{tx.tour.colEscrow}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/[.02]">
                <td className="px-4 py-3 text-white/90">{r.display_name}</td>
                <td className="px-4 py-3 text-white/60">{r.host_email ?? '—'}</td>
                <td className="px-4 py-3 text-right tabular-nums text-white/70">
                  ${Number(r.total_prize_pool).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-white/70">
                  {r.max_applicants.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-white/60 text-xs">{r.status}</td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs ${
                      r.prize_pool_escrow_status === 'paid'
                        ? 'text-emerald-400'
                        : r.prize_pool_escrow_status === 'pending'
                          ? 'text-[#ffb088]'
                          : 'text-white/40'
                    }`}
                  >
                    {tx.tour.escrow[r.prize_pool_escrow_status] ?? r.prize_pool_escrow_status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {r.prize_pool_escrow_status === 'pending' && (
                    <button
                      type="button"
                      disabled={pendingId === r.id}
                      onClick={() => markPaid(r.id)}
                      className="text-xs font-semibold px-3 py-1.5 rounded border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40"
                    >
                      {tx.tour.markPaid}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function InviteForm({
  tiers,
  tx,
  onDone,
}: {
  tiers: TierConfig[]
  tx: (typeof DICT)['ko'] | (typeof DICT)['en']
  onDone: (msg: string) => void
}) {
  const [email, setEmail] = useState('')
  const [tier, setTier] = useState(tiers[0]?.tier ?? '')
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  const selectedTier = tiers.find((t) => t.tier === tier) ?? null

  const submit = () => {
    setErr(null)
    startTransition(async () => {
      const res = await invitePartner({ email, tier, note })
      if (!res.ok) {
        setErr(res.errorMessage ?? 'Failed')
        return
      }
      setEmail('')
      setNote('')
      onDone(tx.toast.invited)
    })
  }

  return (
    <div className="max-w-xl">
      <h2 className="text-lg font-bold mb-1">{tx.invite.heading}</h2>
      <p className="text-xs text-white/40 mb-5">{tx.invite.note}</p>

      <div className="space-y-4">
        <label className="block">
          <span className="block text-xs text-white/50 mb-1.5">{tx.invite.email}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={tx.invite.emailPh}
            className="w-full bg-[#0a0608] border border-white/15 rounded px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-[#ff8844]/50 outline-none"
          />
        </label>

        <label className="block">
          <span className="block text-xs text-white/50 mb-1.5">{tx.invite.tier}</span>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="w-full bg-[#0a0608] border border-white/15 rounded px-3 py-2.5 text-sm text-white focus:border-[#ff8844]/50 outline-none"
          >
            {tiers.map((t) => (
              <option key={t.tier} value={t.tier}>
                {t.tier}
              </option>
            ))}
          </select>
          {selectedTier && (
            <span className="block text-[11px] text-white/35 mt-1.5">
              {tx.invite.cap(selectedTier.max_applications_cap, selectedTier.max_tournaments_per_season)}
            </span>
          )}
        </label>

        <label className="block">
          <span className="block text-xs text-white/50 mb-1.5">{tx.invite.reason}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={tx.invite.reasonPh}
            rows={3}
            className="w-full bg-[#0a0608] border border-white/15 rounded px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-[#ff8844]/50 outline-none resize-none"
          />
        </label>

        {err && <p className="text-xs text-[#ff6666]">{err}</p>}

        <button
          type="button"
          disabled={pending || !email.trim() || !note.trim() || !tier}
          onClick={submit}
          className="w-full bg-[#ff8844] text-[#1a0c12] font-bold text-sm py-3 rounded-lg disabled:opacity-40 hover:bg-[#ff9955] transition"
        >
          {pending ? tx.invite.sending : tx.invite.submit}
        </button>
      </div>
    </div>
  )
}
