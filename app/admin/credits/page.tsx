import { requireAdmin } from '@/lib/admin-auth'
import { listRecentTransactions, getEmailMap } from '@/lib/credits'
import { CreditsView, type LedgerDisplayRow } from './CreditsView'

export default async function CreditsPage() {
  await requireAdmin()

  const txns = await listRecentTransactions(100)

  // Resolve emails for both the account and the granting admin (actor).
  const ids = new Set<string>()
  for (const t of txns) {
    ids.add(t.user_id)
    if (t.actor_id) ids.add(t.actor_id)
  }
  const emailMap = await getEmailMap([...ids])

  const rows: LedgerDisplayRow[] = txns.map((t) => ({
    id: t.id,
    email: emailMap.get(t.user_id) ?? t.user_id,
    amount: Number(t.amount_credits),
    type: t.type,
    reason: t.reason,
    actorEmail: t.actor_id ? emailMap.get(t.actor_id) ?? t.actor_id : null,
    createdAt: t.created_at,
  }))

  return <CreditsView rows={rows} />
}
