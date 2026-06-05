'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { logPartnerStatusEvent } from '@/lib/partners'

export type ActivateState = {
  ok: boolean
  status?: 'activated' | 'already_active'
  errorMessage?: string
}

// Called from the activation page after the invitee agrees to the partner
// terms. The user is authenticated via the magic-link session (cookie); we
// verify their id from that session, then flip invited -> active with the
// service-role client. Idempotent if already active.
export async function activatePartner(agreedToTerms: boolean): Promise<ActivateState> {
  if (!agreedToTerms) {
    return { ok: false, errorMessage: 'You must agree to the partner terms.' }
  }

  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, errorMessage: 'Not signed in. Please use the invite link again.' }
  }

  const db = createSupabaseAdmin()
  const { data: profile, error: readErr } = await db
    .from('profiles')
    .select('partner_status, partner_tier')
    .eq('id', user.id)
    .maybeSingle()
  if (readErr) return { ok: false, errorMessage: readErr.message }
  if (!profile) return { ok: false, errorMessage: 'Profile not found.' }

  if (profile.partner_status === 'active') {
    return { ok: true, status: 'already_active' }
  }
  if (profile.partner_status !== 'invited') {
    return {
      ok: false,
      errorMessage: `This account is not in an invited state (current: ${profile.partner_status}).`,
    }
  }

  const { error: updErr } = await db
    .from('profiles')
    .update({
      partner_status: 'active',
      partner_activated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
    .eq('partner_status', 'invited') // guard against a concurrent change
  if (updErr) return { ok: false, errorMessage: updErr.message }

  await logPartnerStatusEvent({
    userId: user.id,
    event: 'activated',
    reason: null,
    actorId: user.id, // self-accept
    tier: (profile.partner_tier as string | null) ?? null,
  })

  revalidatePath('/admin/partners')
  return { ok: true, status: 'activated' }
}
