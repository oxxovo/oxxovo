'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import {
  grantPromoCredits,
  findUserByEmail,
  getBalance,
} from '@/lib/credits'

export type GrantActionState = {
  ok: boolean
  errorKey?: 'reason_required' | 'amount_invalid' | 'user_not_found' | 'failed'
  errorMessage?: string
  grantedTo?: string
  amount?: number
  newBalance?: number
}

// Admin promo grant. reason required + the inserted ledger row is the audit
// record (actor = this admin). Looks up the target account by email.
export async function grantCreditsAction(input: {
  email: string
  amount: number
  reason: string
}): Promise<GrantActionState> {
  const admin = await requireAdmin()

  const reason = (input.reason ?? '').trim()
  if (!reason) return { ok: false, errorKey: 'reason_required' }
  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, errorKey: 'amount_invalid' }

  const user = await findUserByEmail(input.email)
  if (!user) return { ok: false, errorKey: 'user_not_found' }

  const res = await grantPromoCredits({
    userId: user.id,
    amountCredits: amount,
    reason,
    actorId: admin.id,
  })
  if (!res.ok) {
    if (res.errorMessage === 'reason_required') return { ok: false, errorKey: 'reason_required' }
    if (res.errorMessage === 'amount_invalid') return { ok: false, errorKey: 'amount_invalid' }
    return { ok: false, errorKey: 'failed', errorMessage: res.errorMessage }
  }

  revalidatePath('/admin/credits')
  return {
    ok: true,
    grantedTo: user.email,
    amount: Math.round(amount),
    newBalance: res.newBalance,
  }
}

export type BalanceActionState = {
  ok: boolean
  errorKey?: 'user_not_found'
  email?: string
  balance?: number
}

export async function lookupBalanceAction(email: string): Promise<BalanceActionState> {
  await requireAdmin()
  const user = await findUserByEmail(email)
  if (!user) return { ok: false, errorKey: 'user_not_found' }
  const balance = await getBalance(user.id)
  return { ok: true, email: user.email, balance }
}
