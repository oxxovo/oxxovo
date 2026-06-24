'use client'

// /profile SMS opt-in card (A2P 10DLC / TCPA). Self-contained ko/en copy.
// Optional phone + an explicitly UN-checked consent box (TCPA: consent must be
// affirmative and never a condition of service). The disclosure text shown here
// must stay consistent with SMS_CONSENT_DISCLOSURE in actions.ts (the snapshot
// stored as consent proof).

import { useEffect, useState, useTransition } from 'react'
import { useAdminLang } from '@/lib/admin-i18n'
import { loadSmsConsent, saveSmsConsent, type SaveSmsConsentResult } from './actions'

const DICT = {
  ko: {
    title: 'SMS 알림 (선택)',
    intro:
      '대회 소식(예선 오픈·마감·결과)을 문자로 받아보려면 전화번호를 입력하고 아래 동의에 체크하세요. 선택 사항이며 OXXOVO 이용에 필수가 아닙니다.',
    phone_label: '휴대폰 번호',
    phone_ph: '+82 10 1234 5678',
    disclosure_pre:
      'OXXOVO로부터 대회 관련 SMS 문자(예선 오픈·마감·결과)를 정기적으로 받는 데 동의합니다. 메시지 빈도는 상황에 따라 다르며, 통신 요금이 부과될 수 있습니다. 수신 거부는 ',
    disclosure_mid: ' 회신, 도움말은 ',
    disclosure_post: ' 회신. 동의는 OXXOVO 이용 조건이 아닙니다.',
    save: '저장',
    saving: '저장 중…',
    saved_optin: (d: string) => `SMS 수신 동의 완료 (${d}). 언제든 STOP으로 해지할 수 있습니다.`,
    saved_optout: 'SMS 수신을 해지했습니다.',
    err_phone_required: '동의하려면 전화번호를 입력하세요.',
    err_phone_invalid: '전화번호 형식이 올바르지 않습니다. 국가번호를 포함해 입력하세요.',
    err_unauthenticated: '로그인이 필요합니다.',
    err_failed: '저장 실패',
    current_optin: (d: string) => `현재 SMS 수신 동의 상태 (${d}).`,
  },
  en: {
    title: 'SMS Notifications (optional)',
    intro:
      'To get tournament updates (round openings, deadlines, results) by text, enter your phone number and check the box below. This is optional and not required to use OXXOVO.',
    phone_label: 'Mobile phone number',
    phone_ph: '+1 555 123 4567',
    disclosure_pre:
      'I agree to receive recurring SMS text messages from OXXOVO about tournament updates (round openings, deadlines, results). Message frequency varies. Message and data rates may apply. Reply ',
    disclosure_mid: ' to opt out, ',
    disclosure_post: ' for help. Consent is not a condition of using OXXOVO.',
    save: 'Save',
    saving: 'Saving…',
    saved_optin: (d: string) => `SMS consent saved (${d}). You can opt out anytime by replying STOP.`,
    saved_optout: 'You have opted out of SMS.',
    err_phone_required: 'Enter a phone number to opt in.',
    err_phone_invalid: 'That phone number looks invalid. Include the country code.',
    err_unauthenticated: 'Please sign in.',
    err_failed: 'Save failed',
    current_optin: (d: string) => `Currently opted in to SMS (${d}).`,
  },
}

function fmt(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function SmsConsentCard() {
  const lang = useAdminLang()
  const t = DICT[lang]
  const [phone, setPhone] = useState('')
  const [optIn, setOptIn] = useState(false)
  const [consentAt, setConsentAt] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<SaveSmsConsentResult | null>(null)

  useEffect(() => {
    let cancelled = false
    loadSmsConsent().then((r) => {
      if (cancelled || !r.ok) return
      setPhone(r.data.phone)
      setOptIn(r.data.optIn)
      setConsentAt(r.data.consentAt)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const errText = (r: SaveSmsConsentResult): string => {
    if (r.ok) return ''
    switch (r.error) {
      case 'phone_required':
        return t.err_phone_required
      case 'phone_invalid':
        return t.err_phone_invalid
      case 'unauthenticated':
        return t.err_unauthenticated
      default:
        return `${t.err_failed}${r.detail ? `: ${r.detail}` : ''}`
    }
  }

  const handleSave = () => {
    setResult(null)
    startTransition(async () => {
      const r = await saveSmsConsent({ phone: phone.trim(), optIn })
      setResult(r)
      if (r.ok) setConsentAt(r.consentAt)
    })
  }

  return (
    <section className="mt-6 border rounded-lg p-6 border-white/10 bg-white/[.02]">
      <h2 className="text-xs uppercase tracking-[0.2em] font-bold mb-4 text-[#b66cff]">{t.title}</h2>
      <p className="text-xs text-white/60 mb-4 leading-relaxed">{t.intro}</p>

      <div className="space-y-4">
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-white/60 mb-1.5">{t.phone_label}</div>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t.phone_ph}
            className="w-full px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#8b22ff] focus:outline-none transition"
          />
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={optIn}
            onChange={(e) => setOptIn(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#8b22ff] flex-shrink-0"
          />
          <span className="text-xs text-white/70 leading-relaxed">
            {t.disclosure_pre}
            <span className="text-white font-bold">STOP</span>
            {t.disclosure_mid}
            <span className="text-white font-bold">HELP</span>
            {t.disclosure_post}
          </span>
        </label>

        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="px-5 py-2.5 rounded bg-gradient-to-br from-[#7d23ff] to-[#6220dc] text-white font-bold text-sm hover:brightness-110 transition disabled:opacity-50"
        >
          {pending ? t.saving : t.save}
        </button>

        {result?.ok && (
          <p className="text-[11px] text-emerald-300">
            {result.optIn ? t.saved_optin(fmt(result.consentAt)) : t.saved_optout}
          </p>
        )}
        {result && !result.ok && <p className="text-[11px] text-[#ff8888]">{errText(result)}</p>}

        {!result && optIn && consentAt && (
          <p className="text-[10px] text-white/40">{t.current_optin(fmt(consentAt))}</p>
        )}
      </div>
    </section>
  )
}
