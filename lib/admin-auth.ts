import { redirect } from 'next/navigation'
import { createSupabaseServer } from './supabase-server'

// Operational roles. profiles.role is user(default) / manager / admin(super=TK).
//   - manager : 조회(applications/messages/contacts/emails 로그)·promo. READ-ONLY.
//   - admin   : 슈퍼(TK). 위 + 시즌/상금/일정·정산·매니저 관리·신청 상태/수상 변경.
// is_admin() (DB) = admin only; is_staff() (DB) = admin OR manager.
//
// Guard map:
//   requireAdmin / getAdminOrNull  = admin only (super). 기존 의미 그대로 — 모든
//                                    쓰기/정산/시즌/매니저관리 콜사이트가 계속 사용.
//   requireStaff / getStaffOrNull  = admin OR manager. 매니저가 보는 조회 페이지용.
export type StaffRole = 'admin' | 'manager'

export type AdminProfile = {
  id: string
  email: string
  role: StaffRole
}

const STAFF_ROLES = new Set<string>(['admin', 'manager'])

// Internal: the caller's profile (id/email/role) or null if unauthenticated.
// role is returned raw (may be 'user' / null for non-staff) — callers filter.
async function fetchProfile(): Promise<{ id: string; email: string; role: string | null } | null> {
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

  if (!profile) return null
  return profile as { id: string; email: string; role: string | null }
}

// Super-admin guard (admin only = TK). Use on super-only operations:
// seasons/prizes/schedule, credits (정산), manager management, application
// status/award mutations. Redirects to /admin/login if unauthenticated or not admin.
export async function requireAdmin(): Promise<AdminProfile> {
  const profile = await fetchProfile()
  if (!profile) redirect('/admin/login')
  if (profile.role !== 'admin') redirect('/admin/login?error=not_admin')
  return profile as AdminProfile
}

// Staff guard (admin OR manager). Use on read pages managers may access:
// applications view, messages, contacts, emails log, promo.
// Redirects to /admin/login if unauthenticated or not staff.
export async function requireStaff(): Promise<AdminProfile> {
  const profile = await fetchProfile()
  if (!profile) redirect('/admin/login')
  if (!STAFF_ROLES.has(profile.role ?? '')) redirect('/admin/login?error=not_admin')
  return profile as AdminProfile
}

// Null-returning variants — use where you handle the unauthenticated state
// yourself (layout, server actions that must not redirect).
export async function getAdminOrNull(): Promise<AdminProfile | null> {
  const profile = await fetchProfile()
  if (!profile || profile.role !== 'admin') return null
  return profile as AdminProfile
}

export async function getStaffOrNull(): Promise<AdminProfile | null> {
  const profile = await fetchProfile()
  if (!profile || !STAFF_ROLES.has(profile.role ?? '')) return null
  return profile as AdminProfile
}
