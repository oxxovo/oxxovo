import { requireAdmin } from '@/lib/admin-auth'
import { listStaff } from '@/lib/managers'
import { ManagersView } from './ManagersView'

// Super-admin only (TK). 매니저 추가/제거. requireAdmin = admin role 만 통과하므로
// 매니저는 이 페이지에 접근할 수 없다(다른 매니저 추가 불가).
export default async function ManagersPage() {
  const admin = await requireAdmin()
  const staff = await listStaff()
  return <ManagersView staff={staff} selfId={admin.id} />
}
