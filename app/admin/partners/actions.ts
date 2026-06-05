'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getTierConfigs, logPartnerStatusEvent } from '@/lib/partners'
import { sendPartnerInvitation } from '@/lib/email/send'

const APP_URL = process.env.APP_URL ?? 'https://oxxovo.com'

export type PartnerActionState = {
  ok: boolean
  messageKey?: 'suspended' | 'restored' | 'invited' | 'escrow_paid'
  errorMessage?: string
}

// Beta policy: prize-pool escrow is confirmed manually by an admin. Marking it
// paid also publishes the tournament (draft -> active) so it becomes publicly
// visible per isSeasonPubliclyVisible. Only applies to a pending partner season.
export async function markEscrowPaid(seasonId: string): Promise<PartnerActionState> {
  await requireAdmin()
  const db = createSupabaseAdmin()
  const { data, error } = await db
    .from('seasons')
    .update({
      prize_pool_escrow_status: 'paid',
      prize_pool_escrow_paid_at: new Date().toISOString(),
      status: 'active', // publish — gate in isSeasonPubliclyVisible now passes
      updated_at: new Date().toISOString(),
    })
    .eq('id', seasonId)
    .eq('host_type', 'partner')
    .eq('prize_pool_escrow_status', 'pending') // idempotent guard
    .select('id')
    .maybeSingle()
  if (error) return { ok: false, errorMessage: error.message }
  if (!data) {
    return { ok: false, errorMessage: 'No matching pending partner tournament (already paid?).' }
  }

  revalidatePath('/admin/partners')
  revalidatePath('/')
  return { ok: true, messageKey: 'escrow_paid' }
}

// Read a profile's current partner_tier so status events carry a tier snapshot.
async function readTier(userId: string): Promise<string | null> {
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('profiles')
    .select('partner_tier')
    .eq('id', userId)
    .maybeSingle()
  return (data?.partner_tier as string | null) ?? null
}

export async function suspendPartner(
  userId: string,
  reason: string,
): Promise<PartnerActionState> {
  const admin = await requireAdmin()
  const trimmed = reason.trim()
  if (!trimmed) {
    return { ok: false, errorMessage: 'Suspend reason is required.' }
  }
  const db = createSupabaseAdmin()
  const { error } = await db
    .from('profiles')
    .update({ partner_status: 'suspended', updated_at: new Date().toISOString() })
    .eq('id', userId)
    .eq('partner_status', 'active') // only an active partner can be suspended
  if (error) return { ok: false, errorMessage: error.message }

  await logPartnerStatusEvent({
    userId,
    event: 'suspended',
    reason: trimmed,
    actorId: admin.id,
    tier: await readTier(userId),
  })

  revalidatePath('/admin/partners')
  return { ok: true, messageKey: 'suspended' }
}

export async function restorePartner(
  userId: string,
  reason: string,
): Promise<PartnerActionState> {
  const admin = await requireAdmin()
  const trimmed = reason.trim()
  if (!trimmed) {
    return { ok: false, errorMessage: 'Restore reason is required.' }
  }
  const db = createSupabaseAdmin()
  const { error } = await db
    .from('profiles')
    .update({ partner_status: 'active', updated_at: new Date().toISOString() })
    .eq('id', userId)
    .eq('partner_status', 'suspended') // only a suspended partner can be restored
  if (error) return { ok: false, errorMessage: error.message }

  await logPartnerStatusEvent({
    userId,
    event: 'restored',
    reason: trimmed,
    actorId: admin.id,
    tier: await readTier(userId),
  })

  revalidatePath('/admin/partners')
  return { ok: true, messageKey: 'restored' }
}

// Locate an existing auth user by email (case-insensitive). Returns the user
// id or null. supabase-js has no getUserByEmail, so we page through listUsers.
async function findAuthUserId(email: string): Promise<string | null> {
  const db = createSupabaseAdmin()
  const target = email.trim().toLowerCase()
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error('listUsers: ' + error.message)
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === target)
    if (hit) return hit.id
    if (data.users.length < 200) return null
  }
  return null
}

export async function invitePartner(input: {
  email: string
  tier: string
  note: string
}): Promise<PartnerActionState> {
  const admin = await requireAdmin()
  const email = input.email.trim().toLowerCase()
  const note = input.note.trim()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, errorMessage: 'A valid email is required.' }
  }
  if (!note) {
    return { ok: false, errorMessage: 'Invite reason is required.' }
  }
  // Validate tier against member_tier_config — never trust a client-sent tier.
  const tiers = await getTierConfigs()
  if (!tiers.some((t) => t.tier === input.tier)) {
    return { ok: false, errorMessage: `Unknown tier: ${input.tier}` }
  }
  const tier = input.tier

  const db = createSupabaseAdmin()

  // 1. Resolve (or create) the auth user, and generate the accept magic link.
  //    Existing user -> magiclink; new email -> invite (creates the account).
  let userId: string | null
  let acceptUrl: string
  try {
    userId = await findAuthUserId(email)
    // Magic link lands on the partner auth callback, which exchanges the PKCE
    // code for a session (same pattern as /admin/auth/callback) and forwards
    // to /partner/activate.
    const redirectTo = `${APP_URL}/partner/auth/callback`
    const { data, error } = userId
      ? await db.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } })
      : await db.auth.admin.generateLink({ type: 'invite', email, options: { redirectTo } })
    if (error) return { ok: false, errorMessage: error.message }
    acceptUrl = data.properties?.action_link ?? redirectTo
    // For a brand-new invite, generateLink creates the user; capture its id.
    userId = userId ?? data.user?.id ?? null
  } catch (e) {
    return { ok: false, errorMessage: e instanceof Error ? e.message : 'Link generation failed' }
  }
  if (!userId) {
    return { ok: false, errorMessage: 'Could not resolve a user id for the invite.' }
  }

  // 2. Upsert the profile partner fields. id+email suffice for a new row;
  //    role/cumulative/etc. fall back to their column defaults. On conflict,
  //    only the partner_* columns are updated.
  const { error: upsertErr } = await db.from('profiles').upsert(
    {
      id: userId,
      email,
      partner_status: 'invited',
      partner_source: 'invitation',
      partner_invited_by: admin.id,
      partner_invited_at: new Date().toISOString(),
      partner_invite_note: note,
      partner_tier: tier,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )
  if (upsertErr) return { ok: false, errorMessage: upsertErr.message }

  // 3. Audit + email (non-fatal if the email fails — invite state is set).
  await logPartnerStatusEvent({
    userId,
    event: 'invited',
    reason: note,
    actorId: admin.id,
    tier,
  })
  try {
    await sendPartnerInvitation({
      toEmail: email,
      country: null, // unknown at invite time; defaults to English
      recipientName: null,
      tier,
      acceptUrl,
    })
  } catch (e) {
    console.error('[invitePartner] email send error:', e)
  }

  revalidatePath('/admin/partners')
  return { ok: true, messageKey: 'invited' }
}
