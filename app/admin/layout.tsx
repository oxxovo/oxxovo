import { ReactNode } from 'react'
import { getAdminOrNull } from '@/lib/admin-auth'
import { isMemberHostedEnabled } from '@/lib/member-hosted'
import { AdminShell } from './AdminShell'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await getAdminOrNull()

  // /admin/login still mounts this layout; we render children without the chrome
  // when there's no admin session (login page handles its own UI).
  if (!admin) {
    return <>{children}</>
  }

  // Hide member-hosted nav when the program is off (master switch).
  const memberHostedEnabled = await isMemberHostedEnabled()

  return (
    <AdminShell admin={admin} memberHostedEnabled={memberHostedEnabled}>
      {children}
    </AdminShell>
  )
}
