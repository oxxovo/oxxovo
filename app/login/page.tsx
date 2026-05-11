'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async () => {
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
      setError(data.error || 'Login failed.')
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-[#030305] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-[#8b22ff] mb-2">OXXOVO</h1>
          <p className="text-white/50 text-sm">Log in to your account</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/95 text-black"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[#1a1a1f] text-white border border-white/10"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3 rounded-lg bg-[#8b22ff] hover:bg-[#7a1de8] text-white font-bold disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </div>
        <p className="text-center text-white/40 text-sm mt-6">
          Don't have an account?{' '}
          <a href="/signup" className="text-[#8b22ff] hover:underline">Sign up</a>
        </p>
      </div>
    </main>
  )
}