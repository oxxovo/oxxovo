'use client'

import { useSearchParams } from 'next/navigation'
import { useT } from '@/lib/admin-i18n'
import { LoginForm } from './LoginForm'

export default function AdminLoginPage() {
  const t = useT()
  const params = useSearchParams()
  const errorParam = params.get('error')
  const reason = params.get('reason')
  const redirect = params.get('redirect') ?? '/admin'

  const errorMessage =
    errorParam === 'not_admin'
      ? t.login.err_not_admin
      : errorParam === 'recovery_expired'
        ? t.login.err_recovery_expired
        : errorParam === 'callback_failed'
          ? t.login.err_callback_failed(reason)
          : errorParam === 'missing_code'
            ? t.login.err_missing_code
            : null

  return (
    <main className="min-h-screen bg-[#0a0608] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-[10px] tracking-[0.3em] text-[#ff8844] font-bold mb-2">
            {t.login.brand_tag}
          </div>
          <h1 className="text-2xl font-black">{t.login.title}</h1>
          <p className="text-sm text-white/40 mt-2">{t.login.subtitle}</p>
        </div>

        {errorMessage && (
          <div className="mb-5 px-4 py-3 rounded border border-[#ff4444]/30 bg-[#ff4444]/10 text-sm text-[#ff8888]">
            {errorMessage}
          </div>
        )}

        <LoginForm redirectTo={redirect} />
      </div>
    </main>
  )
}
