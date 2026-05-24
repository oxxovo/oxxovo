'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createSupabaseBrowser()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs uppercase tracking-wider text-white/40 mb-2">
          Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 bg-[#100608] border border-white/10 rounded text-white text-sm focus:border-[#ff8844] focus:outline-none transition"
          autoComplete="email"
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-white/40 mb-2">
          Password
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 bg-[#100608] border border-white/10 rounded text-white text-sm focus:border-[#ff8844] focus:outline-none transition"
          autoComplete="current-password"
        />
      </div>

      {error && (
        <div className="px-3 py-2 rounded border border-[#ff4444]/30 bg-[#ff4444]/10 text-xs text-[#ff8888]">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded bg-gradient-to-br from-[#ff4444] to-[#cc3333] hover:brightness-110 text-white font-bold text-sm uppercase tracking-wider transition disabled:opacity-50"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
