'use client'

// /profile email language card (HQ 2026-08-31). The only retrofit path for
// accounts that never applied (so never saw the /apply form's language field)
// and the place to change what was picked there. Reads/writes profiles.locale
// directly -- see lib/profile.ts getLocaleForUser/saveLocaleForUser and
// reports/email_locale_explicit_design_2026-08-31.md.

// TODO(copy, HQ 2026-08-31): title/intro are a placeholder, same status as the
// /apply field label -- needs 제니3's confirmed wording (see
// feedback_copy_not_my_call memory). Do not ship as final without checking.

import { useEffect, useState, useTransition } from 'react'
import { useAdminLang } from '@/lib/admin-i18n'
import { loadLocale, saveLocale } from './actions'

const DICT = {
  ko: {
    title: '이메일 언어',
    intro: 'OXXOVO가 보내는 이메일을 어느 언어로 받을지 선택하세요.',
    save: '저장',
    saving: '저장 중…',
    saved: '저장되었습니다.',
    err_unauthenticated: '로그인이 필요합니다.',
    err_failed: '저장 실패',
  },
  en: {
    title: 'Email Language',
    intro: 'Choose which language OXXOVO sends your emails in.',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved.',
    err_unauthenticated: 'Please sign in.',
    err_failed: 'Save failed',
  },
}

export function LocaleCard() {
  const lang = useAdminLang()
  const t = DICT[lang]
  const [locale, setLocale] = useState<'ko' | 'en' | null>(null)
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    loadLocale().then((r) => {
      if (cancelled || !r.ok) return
      setLocale(r.locale)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handlePick = (code: 'ko' | 'en') => {
    setLocale(code)
    setSaved(false)
    setError('')
    startTransition(async () => {
      const r = await saveLocale(code)
      if (!r.ok) {
        setError(r.error === 'unauthenticated' ? t.err_unauthenticated : `${t.err_failed}${r.detail ? `: ${r.detail}` : ''}`)
        return
      }
      setSaved(true)
    })
  }

  return (
    <section className="mt-6 border rounded-lg p-6 border-white/10 bg-white/[.02]">
      <h2 className="text-xs uppercase tracking-[0.2em] font-bold mb-4 text-[#b66cff]">{t.title}</h2>
      <p className="text-xs text-white/60 mb-4 leading-relaxed">{t.intro}</p>

      <div className="flex gap-3" role="radiogroup" aria-label={t.title}>
        {(['ko', 'en'] as const).map((code) => (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={locale === code}
            onClick={() => handlePick(code)}
            disabled={pending}
            className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
              locale === code
                ? 'border-[#8b22ff] bg-[#8b22ff]/10 text-white'
                : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20'
            }`}
          >
            {code === 'ko' ? '한국어' : 'English'}
          </button>
        ))}
      </div>

      {pending && <p className="mt-3 text-[11px] text-white/40">{t.saving}</p>}
      {!pending && saved && <p className="mt-3 text-[11px] text-emerald-300">{t.saved}</p>}
      {error && <p className="mt-3 text-[11px] text-[#ff8888]">{error}</p>}
    </section>
  )
}
