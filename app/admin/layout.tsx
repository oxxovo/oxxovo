import { ReactNode } from 'react'
import { getAdminOrNull } from '@/lib/admin-auth'
import { AdminShell } from './AdminShell'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await getAdminOrNull()

  // /admin/login still mounts this layout; we render children without the chrome
  // when there's no admin session (login page handles its own UI).
  if (!admin) {
    return <>{children}</>
  }

  return <AdminShell admin={admin}>{children}</AdminShell>
}
