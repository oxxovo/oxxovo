import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { ResetPasswordCard } from './ResetPasswordCard'

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

  return <ResetPasswordCard email={user.email ?? ''} />
}
