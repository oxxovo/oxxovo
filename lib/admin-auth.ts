import { redirect } from 'next/navigation'
import { createSupabaseServer } from './supabase-server'

export type AdminProfile = {
  id: string
  email: string
  role: 'admin'
}

// Server-side admin guard. Use in admin server components / route handlers.
// Redirects to /admin/login if unauthenticated or not admin.
export async function requireAdmin(): Promise<AdminProfile> {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    redirect('/admin/login?error=not_admin')
  }

  return profile as AdminProfile
}

// Same as requireAdmin but returns null instead of redirecting.
// Use in places where you want to handle the unauthenticated state yourself.
export async function getAdminOrNull(): Promise<AdminProfile | null> {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') return null
  return profile as AdminProfile
}
