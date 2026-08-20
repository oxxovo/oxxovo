'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAdminLang } from '@/lib/admin-i18n'
import { completeOnboarding } from './actions'

// Mandatory first-time nickname setup (TK 2026-08-19). Reached only from
// app/auth/callback when profiles.display_name is unset -- see that route for
// the redirect and lib/nickname.ts for why auto-generation was removed.
const COPY = {
  ko: {
    title: '닉네임을 정해주세요',
    desc: '작품·댓글·랭킹에 공개로 표시되는 이름입니다. 한 번 출품하면 그 시즌 동안 바꿀 수 없습니다.',
    label: '닉네임',
    placeholder: '2~30자',
    identityLabel: '공개 방식',
    asNickname: '닉네임으로 공개',
    asRealName: '실명으로 공개',
    realNameLabel: '실명',
    realNamePlaceholder: '작품·홍보 영상·랭킹에 표시될 이름',
    // TK 2026-08-19: warning copy pending 제니3 -- placeholder only, do not
    // ship this exact sentence without their sign-off.
    realNameWarning: '실명이 작품 화면·홍보 영상·랭킹에 공개됩니다. (문구 확정 대기)',
    submit: '시작하기',
    submitting: '저장 중…',
    errTooShort: '2자 이상 입력하세요.',
    errTooLong: '30자 이하로 입력하세요.',
    errInvalidChars: '문자, 숫자, 공백, . _ - 만 사용할 수 있습니다.',
    errBanned: '사용할 수 없는 단어가 포함되어 있습니다.',
    errTaken: '이미 사용 중인 닉네임입니다.',
    errRealNameRequired: '실명을 입력해 주세요.',
    errFail: '저장에 실패했습니다. 다시 시도해 주세요.',
  },
  en: {
    title: 'Choose your nickname',
    desc: 'This is your public name on your work, comments, and rankings. Once you submit, it locks for the season.',
    label: 'Nickname',
    placeholder: '2-30 characters',
    identityLabel: 'Show as',
    asNickname: 'Nickname',
    asRealName: 'Real name',
    realNameLabel: 'Real name',
    realNamePlaceholder: 'Shown on your work, promo videos, and rankings',
    realNameWarning: 'Your real name will be shown on your work, promo videos, and rankings. (copy pending)',
    submit: 'Continue',
    submitting: 'Saving…',
    errTooShort: 'Use at least 2 characters.',
    errTooLong: 'Use 30 characters or fewer.',
    errInvalidChars: 'Only letters, numbers, spaces, and . _ - are allowed.',
    errBanned: 'That nickname contains a word that is not allowed.',
    errTaken: 'That nickname is already taken.',
    errRealNameRequired: 'Please enter your real name.',
    errFail: 'Save failed. Please try again.',
  },
}

function OnboardingInner() {
  const lang = useAdminLang()
  const c = COPY[lang === 'ko' ? 'ko' : 'en']
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') && params.get('next')!.startsWith('/') ? params.get('next')! : '/profile'

  const [nickname, setNickname] = useState('')
  const [displayIdentity, setDisplayIdentity] = useState<'nickname' | 'real_name'>('nickname')
  const [realName, setRealName] = useState('')
  const [pending, setPending] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const errMap: Record<string, string> = {
    too_short: c.errTooShort,
    too_long: c.errTooLong,
    invalid_chars: c.errInvalidChars,
    banned_word: c.errBanned,
    taken: c.errTaken,
    real_name_required: c.errRealNameRequired,
    failed: c.errFail,
    unauthenticated: c.errFail,
  }

  async function submit() {
    setErr(null)
    setPending(true)
    const res = await completeOnboarding({ nickname, displayIdentity, realName })
    setPending(false)
    if (res.ok) {
      router.push(next)
      return
    }
    setErr(errMap[res.error] ?? c.errFail)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0a0508] px-4">
      <div className="w-full max-w-md border border-white/10 bg-white/[.02] rounded-lg p-6">
        <h1 className="text-lg font-bold text-white mb-1">{c.title}</h1>
        <p className="text-xs text-white/50 mb-5 leading-relaxed">{c.desc}</p>

        <label className="block text-xs uppercase tracking-[0.2em] font-bold text-[#b66cff] mb-2">{c.label}</label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder={c.placeholder}
          maxLength={30}
          className="w-full px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#8b22ff] focus:outline-none transition mb-5"
        />

        <label className="block text-xs uppercase tracking-[0.2em] font-bold text-[#b66cff] mb-2">
          {c.identityLabel}
        </label>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setDisplayIdentity('nickname')}
            className={`flex-1 px-3 py-2 rounded text-sm font-bold border transition ${
              displayIdentity === 'nickname'
                ? 'border-[#8b22ff] bg-[#8b22ff]/20 text-white'
                : 'border-white/10 text-white/60'
            }`}
          >
            {c.asNickname}
          </button>
          <button
            type="button"
            onClick={() => setDisplayIdentity('real_name')}
            className={`flex-1 px-3 py-2 rounded text-sm font-bold border transition ${
              displayIdentity === 'real_name'
                ? 'border-[#8b22ff] bg-[#8b22ff]/20 text-white'
                : 'border-white/10 text-white/60'
            }`}
          >
            {c.asRealName}
          </button>
        </div>

        {displayIdentity === 'real_name' && (
          <div className="mb-5">
            <p className="text-xs text-[#ffb84d] mb-2 leading-relaxed">{c.realNameWarning}</p>
            <input
              type="text"
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
              placeholder={c.realNamePlaceholder}
              maxLength={80}
              className="w-full px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#8b22ff] focus:outline-none transition"
            />
          </div>
        )}

        {err && <p className="text-xs text-[#ff8888] mb-3">{err}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={pending || !nickname.trim()}
          className="w-full px-4 py-2 rounded bg-[#8b22ff] text-sm font-bold text-white hover:bg-[#7a1de0] transition disabled:opacity-50"
        >
          {pending ? c.submitting : c.submit}
        </button>
      </div>
    </main>
  )
}

export default function OnboardingNicknamePage() {
  // useSearchParams requires a Suspense boundary in Next 16.
  return (
    <Suspense fallback={null}>
      <OnboardingInner />
    </Suspense>
  )
}
