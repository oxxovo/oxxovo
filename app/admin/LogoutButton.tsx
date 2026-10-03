'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { useT } from '@/lib/admin-i18n'

export function LogoutButton() {
  const router = useRouter()
  const t = useT()
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  const handleLogout = async () => {
    setLoading(true)
    setFailed(false)
    const supabase = createSupabaseBrowser()
    // signOut() reports failure through its return value, not by throwing. Navigating to
    // the login page anyway would look like a clean logout while the session lives on.
    const { error } = await supabase.auth.signOut().catch((e) => ({ error: e }))
    if (error) {
      setLoading(false)
      setFailed(true)
      return
    }
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <div className="shrink-0">
      <button
        onClick={handleLogout}
        disabled={loading}
        className="px-3 py-1.5 text-xs text-white/60 hover:text-[#ff4444] border border-white/10 hover:border-[#ff4444]/40 rounded transition disabled:opacity-50"
      >
        {loading ? t.layout.signing_out : t.layout.sign_out}
      </button>
      {failed && (
        <p role="alert" className="mt-1 text-[11px] text-[#ff8888]">
          {t.layout.action_failed}
        </p>
      )}
    </div>
  )
}
