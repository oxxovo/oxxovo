import { createSupabaseServer } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { ActivateView, type ActivateMode } from './ActivateView'

// Partner activation landing. The invitee arrives here after the magic-link
// callback established their session. We read their partner_status server-side
// (service role, after verifying the session user) and hand the right mode to
// the client view.
export default async function PartnerActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error: linkError } = await searchParams

  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let mode: ActivateMode = 'not_signed_in'
  let tier: string | null = null

  if (linkError) {
    mode = 'error'
  } else if (user) {
    const db = createSupabaseAdmin()
    const { data: profile } = await db
      .from('profiles')
      .select('partner_status, partner_tier')
      .eq('id', user.id)
      .maybeSingle()
    tier = (profile?.partner_tier as string | null) ?? null
    const status = profile?.partner_status
    if (status === 'active') mode = 'active'
    else if (status === 'invited') mode = 'invited'
    else mode = 'not_invited'
  }

  return <ActivateView mode={mode} tier={tier} linkError={linkError ?? null} />
}
