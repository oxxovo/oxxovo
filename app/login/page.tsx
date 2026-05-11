'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })

    const data = await res.json()

    if (res.ok) {
      router.push('/')
    } else {
      setError(data.error || 'Invalid email or password.')
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-[#030305] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-[#8b22ff] mb-2">OXXOVO</h1>
          <p className="text-white/50 text-sm">Welcome back</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm text-white/60 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-[#8b22ff]" />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" required className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-[#8b22ff]" />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-gradient-to-br from-[#7d23ff] to-[#6220dc] py-3 rounded-lg font-bold text-white hover:brightness-110 disabled:opacity-50">
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
        <p className="text-center text-white/40 text-sm mt-6">
          Don't have an account?{' '}
          <a href="/signup" className="text-[#8b22ff] hover:underline">Sign up</a>
        </p>
      </div>
    </main>
  )
}