'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

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

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

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

        {sent ? (
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
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-[#8b22ff] hover:bg-[#7a1de8] text-white font-bold disabled:opacity-50"
            >
              {loading ? 'Sending link…' : 'Send login link'}
            </button>
            <p className="text-center text-white/40 text-xs mt-2">
              No password needed — we&apos;ll email you a secure link.
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
