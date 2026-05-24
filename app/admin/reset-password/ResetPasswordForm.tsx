'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

const MIN_LENGTH = 8

export function ResetPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const supabase = createSupabaseBrowser()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setDone(true)
    setLoading(false)

    // Recovery session already gives admin access; jump to dashboard.
    setTimeout(() => {
      router.push('/admin')
      router.refresh()
    }, 1200)
  }

  if (done) {
    return (
      <div className="px-4 py-5 rounded border border-emerald-500/30 bg-emerald-500/10 text-sm text-emerald-300 text-center">
        Password updated. Redirecting…
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs uppercase tracking-wider text-white/40 mb-2">
          New password
        </label>
        <input
          type="password"
          required
          minLength={MIN_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 bg-[#100608] border border-white/10 rounded text-white text-sm focus:border-[#ff8844] focus:outline-none transition"
          autoComplete="new-password"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-white/40 mb-2">
          Confirm password
        </label>
        <input
          type="password"
          required
          minLength={MIN_LENGTH}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full px-4 py-3 bg-[#100608] border border-white/10 rounded text-white text-sm focus:border-[#ff8844] focus:outline-none transition"
          autoComplete="new-password"
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
        {loading ? 'Updating…' : 'Set new password'}
      </button>
    </form>
  )
}
