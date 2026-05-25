'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

// All public-site users authenticate via oxxovo_token (the Supabase Auth
// access token stored in localStorage — see app/api/auth/login/route.ts).
// Server actions accept that token, verify it via auth.getUser(), and only
// then touch the DB with the service-role client.

export type ProfileApplication = {
  id: string
  season_id: string
  season_name: string
  season_number: number
  // Prize context — used by the winner celebration card on /profile to show
  // the actual dollar amount the awarded rank earns for this specific season.
  season_total_prize_pool: number
  season_prize_first: number
  season_prize_second: number
  season_prize_third: number
  creator_name: string
  email: string
  country: string | null
  channel_url: string | null
  free_entry_url: string | null
  ai_service: string | null
  creator_statement: string | null
  status: string
  award_rank: number | null
  winner_phone: string | null
  winner_address: string | null
  winner_messenger: string | null
  winner_info_completed_at: string | null
  created_at: string
}

export type ProfileData = {
  email: string
  applications: ProfileApplication[]
}

type LoadResult =
  | { ok: true; data: ProfileData }
  | { ok: false; error: 'invalid_token' | 'load_failed'; detail?: string }

export async function loadProfileData(token: string): Promise<LoadResult> {
  if (!token) return { ok: false, error: 'invalid_token' }
  const admin = createSupabaseAdmin()

  // Verify the JWT via the auth endpoint — getUser() rejects forged or
  // expired tokens for us.
  const { data: userData, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !userData?.user?.email) {
    return { ok: false, error: 'invalid_token', detail: authErr?.message }
  }
  // Supabase Auth normalizes emails to lowercase. The public /apply form
  // saves whatever the applicant typed, so we must match case-insensitively
  // to find rows like "HelloVegas@gmail.com" from a lowercase auth.user.email.
  const email = userData.user.email.toLowerCase()

  const { data, error: queryErr } = await admin
    .from('genesis_applications')
    .select(
      'id, season_id, creator_name, email, country, channel_url, free_entry_url, ai_service, creator_statement, status, award_rank, winner_phone, winner_address, winner_messenger, winner_info_completed_at, created_at, seasons(name, season_number, total_prize_pool, prize_first, prize_second, prize_third)',
    )
    .ilike('email', email)
    .order('created_at', { ascending: false })

  if (queryErr) {
    return { ok: false, error: 'load_failed', detail: queryErr.message }
  }

  type SeasonRow = {
    name: string
    season_number: number
    total_prize_pool: number
    prize_first: number
    prize_second: number
    prize_third: number
  }
  type Row = {
    id: string
    season_id: string
    creator_name: string
    email: string
    country: string | null
    channel_url: string | null
    free_entry_url: string | null
    ai_service: string | null
    creator_statement: string | null
    status: string
    award_rank: number | null
    winner_phone: string | null
    winner_address: string | null
    winner_messenger: string | null
    winner_info_completed_at: string | null
    created_at: string
    // Supabase types the FK join as an array even for many-to-one relations.
    seasons: SeasonRow[] | SeasonRow | null
  }

  const applications: ProfileApplication[] = (data ?? []).map((r: Row) => {
    const seasonObj = Array.isArray(r.seasons) ? r.seasons[0] : r.seasons
    return {
      id: r.id,
      season_id: r.season_id,
      season_name: seasonObj?.name ?? '—',
      season_number: seasonObj?.season_number ?? 0,
      season_total_prize_pool: Number(seasonObj?.total_prize_pool ?? 0),
      season_prize_first: Number(seasonObj?.prize_first ?? 0),
      season_prize_second: Number(seasonObj?.prize_second ?? 0),
      season_prize_third: Number(seasonObj?.prize_third ?? 0),
      creator_name: r.creator_name,
      email: r.email,
      country: r.country,
      channel_url: r.channel_url,
      free_entry_url: r.free_entry_url,
      ai_service: r.ai_service,
      creator_statement: r.creator_statement,
      status: r.status,
      award_rank: r.award_rank,
      winner_phone: r.winner_phone,
      winner_address: r.winner_address,
      winner_messenger: r.winner_messenger,
      winner_info_completed_at: r.winner_info_completed_at,
      created_at: r.created_at,
    }
  })

  return { ok: true, data: { email, applications } }
}

export type SaveWinnerInfoInput = {
  token: string
  applicationId: string
  phone: string
  address: string
  messenger?: string
}

type SaveResult =
  | { ok: true }
  | {
      ok: false
      error:
        | 'invalid_token'
        | 'phone_required'
        | 'address_required'
        | 'not_found'
        | 'not_owner'
        | 'not_awarded'
        | 'save_failed'
      detail?: string
    }

export async function saveWinnerInfo(input: SaveWinnerInfoInput): Promise<SaveResult> {
  const admin = createSupabaseAdmin()

  // 1. Verify the caller via their access token.
  const { data: userData, error: authErr } = await admin.auth.getUser(input.token)
  if (authErr || !userData?.user?.email) {
    return { ok: false, error: 'invalid_token', detail: authErr?.message }
  }
  // Same case-insensitive treatment as loadProfileData — auth.email is
  // lowercase, the form-submitted email may not be.
  const callerEmail = userData.user.email.toLowerCase()

  // 2. Basic validation.
  const phone = (input.phone ?? '').trim()
  const address = (input.address ?? '').trim()
  const messenger = (input.messenger ?? '').trim()
  if (phone.length < 3) return { ok: false, error: 'phone_required' }
  if (address.length < 3) return { ok: false, error: 'address_required' }

  // 3. Verify the targeted row is theirs AND in 'awarded' state.
  //    Looking up by row id (not email) prevents accidental cross-season writes
  //    when one applicant is awarded in multiple seasons.
  const { data: row, error: lookupErr } = await admin
    .from('genesis_applications')
    .select('id, email, status')
    .eq('id', input.applicationId)
    .single()
  if (lookupErr || !row) return { ok: false, error: 'not_found' }
  if ((row.email ?? '').toLowerCase() !== callerEmail) {
    return { ok: false, error: 'not_owner' }
  }
  if (row.status !== 'awarded') return { ok: false, error: 'not_awarded' }

  // 4. Update.
  const { error: updateErr } = await admin
    .from('genesis_applications')
    .update({
      winner_phone: phone,
      winner_address: address,
      winner_messenger: messenger || null,
      winner_info_completed_at: new Date().toISOString(),
    })
    .eq('id', input.applicationId)

  if (updateErr) return { ok: false, error: 'save_failed', detail: updateErr.message }

  // 5. Invalidate admin cache so /admin/contacts reflects the new info on next visit.
  revalidatePath('/admin/contacts')
  revalidatePath(`/admin/applications/${input.applicationId}`)
  revalidatePath('/admin/applications')

  return { ok: true }
}
