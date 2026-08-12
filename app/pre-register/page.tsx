'use client'

import { useState } from 'react'
import Link from 'next/link'

// UTM + referrer are read straight from the live URL at submit time — this
// runs only on user interaction (client), so window is always available and
// no effect/state or useSearchParams Suspense boundary is needed.
function readAttribution() {
  const params = new URLSearchParams(window.location.search)
  return {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    // Only keep an external referrer — same-origin navigations aren't useful.
    referrer:
      document.referrer && !document.referrer.startsWith(window.location.origin)
        ? document.referrer
        : null,
  }
}

export default function PreRegisterPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<'registered' | 'already_registered' | null>(null)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/pre-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...readAttribution() }),
      })
      const data = await res.json()
      if (res.ok) {
        setDone(data.status === 'already_registered' ? 'already_registered' : 'registered')
      } else {
        setError(data.error || 'Something went wrong.')
      }
    } catch {
      setError('Network error. Please try again.')
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-[#030305] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          {/* Same as /login: the wordmark existed but was not a link, so a visitor
              who arrived here from the landing CTA was stranded -- and this is the
              CTA target whenever the application window is not open, which is most
              of a season. Wiring the wordmark keeps the centred card intact. */}
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-black text-[#8b22ff] mb-2">OXXOVO</h1>
          </Link>
          <p className="text-white/50 text-sm">
            Be the first to know when applications open.
          </p>
        </div>

        {done ? (
          <div className="bg-white/5 border border-white/10 rounded-lg px-6 py-8 text-center">
            <div className="text-2xl mb-3">✅</div>
            <p className="text-white font-bold mb-1">
              {done === 'already_registered'
                ? "You're already on the list."
                : "You're pre-registered."}
            </p>
            <p className="text-white/50 text-sm">
              We&rsquo;ll email you the moment applications open.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-[#8b22ff]"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-br from-[#7d23ff] to-[#6220dc] py-3 rounded-lg font-bold text-white hover:brightness-110 disabled:opacity-50"
            >
              {loading ? 'Registering…' : 'Notify me'}
            </button>
          </form>
        )}

        <p className="text-center text-white/25 text-xs mt-8">
          By pre-registering, you agree to our{' '}
          <a href="/terms" className="hover:underline">Terms of Service</a>{' '}
          and{' '}
          <a href="/privacy" className="hover:underline">Privacy Policy</a>
        </p>
      </div>
    </main>
  )
}
