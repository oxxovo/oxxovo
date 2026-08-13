'use client'

// /profile email notifications card. The consent itself is recorded at signup
// (app/login/actions.ts recordEmailConsent, app/privacy Section 11 / app/terms
// Section 12) -- this card shows that status and lets the user withdraw it
// (unsubscribe). It does not re-collect consent; see actions.ts for why.

import { useEffect, useState, useTransition } from 'react'
import { useAdminLang } from '@/lib/admin-i18n'
import { loadEmailConsent, unsubscribeEmail, type EmailConsentData } from './actions'

const DICT = {
  ko: {
    title: '이메일 알림',
    intro:
      '대회 진행 안내와 다음 시즌 대회 안내를 이메일로 받고 계십니다. 신청·계정 관련 필수 안내는 이 설정과 무관하게 계속 발송됩니다.',
    status_on: (d: string) => `수신 동의 상태 (${d}).`,
    status_off: '대회 안내 이메일 수신을 해지했습니다.',
    unsub: '수신 해지',
    unsubscribing: '해지 중…',
    err_unauthenticated: '로그인이 필요합니다.',
    err_failed: '처리 실패',
  },
  en: {
    title: 'Email Notifications',
    intro:
      'You are subscribed to competition updates and future season announcements by email. Required notices about your own application or account are sent regardless of this setting.',
    status_on: (d: string) => `Subscribed (${d}).`,
    status_off: 'You have unsubscribed from tournament announcement emails.',
    unsub: 'Unsubscribe',
    unsubscribing: 'Unsubscribing…',
    err_unauthenticated: 'Please sign in.',
    err_failed: 'Failed',
  },
}

function fmt(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function EmailConsentCard() {
  const lang = useAdminLang()
  const t = DICT[lang]
  const [data, setData] = useState<EmailConsentData | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    loadEmailConsent().then((r) => {
      if (cancelled || !r.ok) return
      setData(r.data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Nothing to show for accounts with no consent record at all (created
  // before this shipped, never logged in since -- see reports/
  // email_optin_migration_2026-08-11.sql).
  if (!data || !data.consentAt) return null

  const handleUnsubscribe = () => {
    setError('')
    startTransition(async () => {
      const r = await unsubscribeEmail()
      if (!r.ok) {
        setError(r.error === 'unauthenticated' ? t.err_unauthenticated : `${t.err_failed}${r.detail ? `: ${r.detail}` : ''}`)
        return
      }
      setData({ optIn: false, consentAt: data.consentAt })
    })
  }

  return (
    <section className="mt-6 border rounded-lg p-6 border-white/10 bg-white/[.02]">
      <h2 className="text-xs uppercase tracking-[0.2em] font-bold mb-4 text-[#b66cff]">{t.title}</h2>
      <p className="text-xs text-white/60 mb-4 leading-relaxed">{t.intro}</p>

      <p className="text-[11px] text-white/50">
        {data.optIn ? t.status_on(fmt(data.consentAt)) : t.status_off}
      </p>

      {data.optIn && (
        <button
          type="button"
          onClick={handleUnsubscribe}
          disabled={pending}
          className="mt-3 px-4 py-2 rounded border border-white/15 text-white/70 text-xs font-semibold hover:border-[#8b22ff]/50 hover:text-white transition disabled:opacity-50"
        >
          {pending ? t.unsubscribing : t.unsub}
        </button>
      )}

      {error && <p className="mt-2 text-[11px] text-[#ff8888]">{error}</p>}
    </section>
  )
}
