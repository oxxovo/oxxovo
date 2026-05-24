'use client'

import { useT } from '@/lib/admin-i18n'
import { ResetPasswordForm } from './ResetPasswordForm'

export function ResetPasswordCard({ email }: { email: string }) {
  const t = useT()
  return (
    <main className="min-h-screen bg-[#0a0608] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-[10px] tracking-[0.3em] text-[#ff8844] font-bold mb-2">
            {t.reset_password.brand_tag}
          </div>
          <h1 className="text-2xl font-black">{t.reset_password.title}</h1>
          <p className="text-sm text-white/40 mt-2">
            {t.reset_password.signed_in_as_prefix}
            <span className="text-white/70">{email}</span>
          </p>
        </div>

        <ResetPasswordForm />
      </div>
    </main>
  )
}
