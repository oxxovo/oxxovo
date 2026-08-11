'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { useAdminLang } from '@/lib/admin-i18n'

// Signup consent notice shown above "Send login link" (see app/privacy Section
// 11, app/terms Section 12). TK-confirmed copy, 2026-08-11 -- must stay
// consistent with EMAIL_CONSENT_DISCLOSURE in app/login/actions.ts (the
// snapshot stored as consent proof). Only shown here -- the actual write
// happens at app/auth/callback/route.ts once the recipient has proven they
// control the mailbox by opening the link, not when this form is submitted.
const CONSENT_DICT = {
  ko: {
    text: 'OXXOVO 회원으로 가입하시면, 대회 진행 안내와 다음 시즌 대회 안내를 이메일 또는 휴대폰(문자)으로 받으시게 됩니다. 수신을 원하지 않으시면 언제든지 설정에서 해제하실 수 있습니다.',
    by: '계속 진행하면 ',
    terms: '이용약관',
    and: ' 및 ',
    privacy: '개인정보처리방침',
    end: '에 동의하는 것입니다.',
  },
  en: {
    text: 'By creating an OXXOVO account, you agree to receive competition updates and announcements about future seasons by email or text message. You can opt out at any time in your settings.',
    by: 'By continuing, you agree to our ',
    terms: 'Terms of Service',
    and: ' and ',
    privacy: 'Privacy Policy',
    end: '.',
  },
}

// Magic-link login for public-site users (no password). Sending an OTP link
// both signs in existing users and creates an account for new ones
// (shouldCreateUser), so /signup is no longer a separate flow.
// The link lands on /auth/callback, which exchanges the code for a cookie
// session and redirects to `next` (or /profile).
function LoginInner() {
  const params = useSearchParams()
  const nextPath = params.get('redirect') ?? params.get('next') ?? '/profile'
  const errorParam = params.get('error')
  const reason = params.get('reason')
  // Opt-in password sign-in (?pw=1). Kept out of the default UX: real users use
  // the magic link. This exists for accounts whose mailbox isn't reachable (demo/
  // support) so login is REUSABLE -- immune to the single-use link consumption a
  // prefetch/scanner can cause. Standard Supabase email+password; no new secret.
  const pwMode = params.get('pw') === '1'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const lang = useAdminLang()
  const ct = CONSENT_DICT[lang]

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createSupabaseBrowser()
    const { error: pwError } = await supabase.auth.signInWithPassword({ email, password })
    if (pwError) {
      setLoading(false)
      setError(pwError.message)
      return
    }
    // Full navigation so the server picks up the freshly-set cookie session.
    const safeNext = nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/profile'
    window.location.assign(safeNext)
  }

  const callbackError =
    errorParam === 'callback_failed'
      ? `Login link could not be verified${reason ? `: ${reason}` : '.'}`
      : errorParam === 'missing_code'
        ? 'That login link was invalid or already used.'
        : null

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createSupabaseBrowser()
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo, shouldCreateUser: true },
    })

    setLoading(false)
    if (otpError) {
      setError(otpError.message)
      return
    }
    // Consent is recorded when the emailed link is actually opened
    // (app/auth/callback/route.ts), not here -- this only sent the link.
    setSent(true)
  }

  return (
    <main className="min-h-screen bg-[#030305] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-[#8b22ff] mb-2">OXXOVO</h1>
          <p className="text-white/50 text-sm">
            {sent ? 'Check your email' : 'Log in or sign up'}
          </p>
        </div>

        {callbackError && !sent && (
          <div className="mb-5 px-4 py-3 rounded-lg border border-[#ff4444]/30 bg-[#ff4444]/10 text-sm text-[#ff8888]">
            {callbackError}
          </div>
        )}

        {pwMode ? (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-2">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full px-4 py-3 rounded-lg bg-white/95 text-black"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-2">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-lg bg-white/95 text-black"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-[#8b22ff] hover:bg-[#7a1de8] text-white font-bold disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : sent ? (
          <div className="space-y-4 text-center">
            <p className="text-white/70 text-sm leading-relaxed">
              We sent a login link to{' '}
              <span className="text-white font-semibold">{email}</span>. Open it
              on this device to continue. The link expires shortly — check your
              spam folder if it doesn&apos;t arrive.
            </p>
            <button
              type="button"
              onClick={() => {
                setSent(false)
                setError('')
              }}
              className="text-[#8b22ff] hover:underline text-sm"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-2">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full px-4 py-3 rounded-lg bg-white/95 text-black"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <p className="text-white/40 text-[11px] leading-relaxed">
              {ct.text}
            </p>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-[#8b22ff] hover:bg-[#7a1de8] text-white font-bold disabled:opacity-50"
            >
              {loading ? 'Sending link…' : 'Send login link'}
            </button>
            <p className="text-center text-white/40 text-xs mt-2">
              No password needed — we&apos;ll email you a secure link.
              <br />
              {ct.by}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#8b22ff] hover:underline">
                {ct.terms}
              </a>
              {ct.and}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#8b22ff] hover:underline">
                {ct.privacy}
              </a>
              {ct.end}
            </p>
          </form>
        )}
      </div>
    </main>
  )
}

export default function LoginPage() {
  // useSearchParams requires a Suspense boundary in Next 16.
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  )
}
