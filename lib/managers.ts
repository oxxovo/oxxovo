import 'server-only'

// Manager (staff) management -- SERVER ONLY. Super-admin (TK) operations.
//
// profiles.role: user(default) / manager / admin(super=TK).
//   - promote: 기가입 유저(role user/NULL)를 manager 로 승격.
//   - demote : manager 를 user 로 강등.
// admin(super) 행은 절대 건드리지 않는다(TK 보호). 매니저 추가/제거는 슈퍼만 할 수
// 있으며(앱 게이트 requireAdmin), 이 lib 은 mutation 을 service-role 로 수행한다.
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { findUserByEmail } from '@/lib/credits'

export type StaffRole = 'admin' | 'manager'
export type StaffMember = { id: string; email: string; role: StaffRole }

// All staff (admin + manager). admin 먼저, 그 다음 email 정렬. email 은 profiles 에서.
export async function listStaff(): Promise<StaffMember[]> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('profiles')
    .select('id, email, role')
    .in('role', ['admin', 'manager'])
  if (error) throw new Error('listStaff: ' + error.message)

  const rows = (data ?? []) as { id: string; email: string | null; role: StaffRole }[]
  return rows
    .map((r) => ({ id: r.id, email: r.email ?? r.id, role: r.role }))
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'admin' ? -1 : 1
      return a.email.localeCompare(b.email)
    })
}

// Staff notification recipients (admin + manager emails). Used to fan inbound
// email escalations out to everyone who handles ops. Never throws -- returns []
// on error so the caller still falls back to the ops mailbox.
export async function getStaffEmails(): Promise<string[]> {
  try {
    const staff = await listStaff()
    return staff.map((s) => s.email).filter((e) => e.includes('@'))
  } catch (e) {
    console.error('[managers] getStaffEmails failed:', e instanceof Error ? e.message : e)
    return []
  }
}

export type PromoteResult =
  | { ok: true; email: string }
  | {
      ok: false
      error: 'user_not_found' | 'already_admin' | 'already_manager' | 'failed'
      detail?: string
    }

// Promote an existing signed-up user (by email) to manager. Refuses to change an
// admin's role, and is a no-op signal if already a manager.
export async function promoteToManager(email: string): Promise<PromoteResult> {
  const user = await findUserByEmail(email)
  if (!user) return { ok: false, error: 'user_not_found' }

  const admin = createSupabaseAdmin()
  const { data: prof, error: readErr } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (readErr) return { ok: false, error: 'failed', detail: readErr.message }

  const role = (prof?.role ?? null) as string | null
  if (role === 'admin') return { ok: false, error: 'already_admin' }
  if (role === 'manager') return { ok: false, error: 'already_manager' }

  const { error } = await admin.from('profiles').update({ role: 'manager' }).eq('id', user.id)
  if (error) return { ok: false, error: 'failed', detail: error.message }
  return { ok: true, email: user.email }
}

export type DemoteResult =
  | { ok: true }
  | { ok: false; error: 'not_a_manager' | 'failed'; detail?: string }

// Demote a manager back to 'user'. Refuses to touch admins (super protection)
// and refuses if the target isn't currently a manager.
export async function demoteManager(userId: string): Promise<DemoteResult> {
  const admin = createSupabaseAdmin()
  const { data: prof, error: readErr } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  if (readErr) return { ok: false, error: 'failed', detail: readErr.message }
  if (prof?.role !== 'manager') return { ok: false, error: 'not_a_manager' }

  const { error } = await admin.from('profiles').update({ role: 'user' }).eq('id', userId)
  if (error) return { ok: false, error: 'failed', detail: error.message }
  return { ok: true }
}
