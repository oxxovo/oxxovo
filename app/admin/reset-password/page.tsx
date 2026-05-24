import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { ResetPasswordForm } from './ResetPasswordForm'

export default async function ResetPasswordPage() {
  // Recovery flow leaves a valid Supabase session in cookies. If a user lands
  // here without one (link expired, opened in wrong browser, etc.) send them
  // back to login — updateUser would fail anyway.
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login?error=recovery_expired')
  }

  return (
    <main className="min-h-screen bg-[#0a0608] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-[10px] tracking-[0.3em] text-[#ff8844] font-bold mb-2">
            OXXOVO
          </div>
          <h1 className="text-2xl font-black">Set a new password</h1>
          <p className="text-sm text-white/40 mt-2">
            Signed in as <span className="text-white/70">{user.email}</span>
          </p>
        </div>

        <ResetPasswordForm />
      </div>
    </main>
  )
}
