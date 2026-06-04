import { NextRequest, NextResponse } from 'next/server'
import {
  getCurrentSeasonId,
  getSeasonById,
  getActiveApplicationCount,
  isApplicationClosed,
  isCapacityFull,
} from '@/lib/seasons'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getUserOrNull } from '@/lib/user-auth'
import { sendApplicationReceived, sendWaitlisted } from '@/lib/email/send'

const STATEMENT_MIN = 150
const STATEMENT_MAX = 250

// Error codes — client maps via t.profile.apply_err_* (옥소보 saveWinnerInfo 패턴).
// Server holds state/decision, client holds wording (단일 i18n 진실원천).
export type ApplyErrorCode =
  | 'unauthenticated'
  | 'missing_field'
  | 'agreements_required'
  | 'statement_length'
  | 'duration_range'
  | 'season_not_found'
  | 'season_closed'
  | 'already_applied'
  | 'server_error'

export type ApplyResponse =
  | { success: true; status: 'pending' | 'waitlist'; season_id: string }
  | { error: ApplyErrorCode; detail?: string }

// All DB writes go through createSupabaseAdmin() (service_role). See
// feedback_server_side_anon_rls_trap memory for the 2026-05-29 catch.

export async function POST(request: NextRequest): Promise<NextResponse<ApplyResponse>> {
  try {
    // A-1: must be signed in to apply. Identity (email + user_id) comes from
    // the verified cookie session — never trust a client-supplied email.
    const user = await getUserOrNull()
    if (!user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    const body = await request.json()

    const required = [
      'creator_name',
      'free_entry_url',
      'video_duration_seconds',
      'ai_service',
      'creator_statement',
    ] as const
    for (const k of required) {
      const v = body[k]
      if (v === undefined || v === null || v === '') {
        return NextResponse.json(
          { error: 'missing_field', detail: k },
          { status: 400 },
        )
      }
    }

    if (!body.agreed_to_rules || !body.agreed_to_privacy || !body.agreed_to_integrity_notice) {
      return NextResponse.json({ error: 'agreements_required' }, { status: 400 })
    }

    const stmtLen = String(body.creator_statement).length
    if (stmtLen < STATEMENT_MIN || stmtLen > STATEMENT_MAX) {
      return NextResponse.json({ error: 'statement_length' }, { status: 400 })
    }

    const seasonId: string =
      typeof body.season_id === 'string' && body.season_id.length > 0
        ? body.season_id
        : getCurrentSeasonId()

    const season = await getSeasonById(seasonId)
    if (!season) {
      return NextResponse.json({ error: 'season_not_found' }, { status: 503 })
    }

    if (isApplicationClosed(season)) {
      return NextResponse.json({ error: 'season_closed' }, { status: 403 })
    }

    const dur = Number(body.video_duration_seconds)
    const minSec = season.application_video_min_seconds
    const maxSec = season.application_video_max_seconds
    if (!Number.isFinite(dur) || dur < minSec || dur > maxSec) {
      return NextResponse.json({ error: 'duration_range' }, { status: 400 })
    }

    const currentCount = await getActiveApplicationCount(season.id)
    const resolvedStatus: 'pending' | 'waitlist' = isCapacityFull(season, currentCount)
      ? 'waitlist'
      : 'pending'

    const admin = createSupabaseAdmin()
    const { data: inserted, error: insertErr } = await admin
      .from('genesis_applications')
      .insert({
        user_id: user.id,
        email: user.email,
        creator_name: body.creator_name,
        country: body.country ?? null,
        channel_url: body.channel_url ?? null,
        free_entry_url: body.free_entry_url,
        video_duration_seconds: dur,
        ai_service: body.ai_service,
        creator_statement: body.creator_statement,
        agreed_to_rules: body.agreed_to_rules,
        agreed_to_privacy: body.agreed_to_privacy,
        agreed_to_integrity_notice: body.agreed_to_integrity_notice,
        season_id: season.id,
        status: resolvedStatus,
      })
      .select('id')
      .single()

    if (insertErr) {
      console.error('[apply] insert failed:', insertErr.code, insertErr.message)
      // 23505 = unique_violation. With UNIQUE(season_id, user_id) (Phase 1)
      // this means the signed-in user already applied to this season.
      if (insertErr.code === '23505') {
        return NextResponse.json({ error: 'already_applied' }, { status: 409 })
      }
      return NextResponse.json({ error: 'server_error' }, { status: 500 })
    }

    const insertedId = inserted?.id ?? null

    // Fire the appropriate notification. Errors here are logged into
    // email_logs by the helper itself; we don't fail the apply request even
    // if Resend hiccups, since the application is already persisted.
    const emailCommon = {
      toEmail: user.email,
      country: body.country ?? null,
      creatorName: body.creator_name,
      seasonName: season.display_name,
      maxApplicants: season.max_applicants,
      applicationId: insertedId,
      seasonId: season.id,
    }
    if (resolvedStatus === 'waitlist') {
      sendWaitlisted(emailCommon).catch((e) =>
        console.error('[apply] sendWaitlisted error:', e),
      )
    } else {
      sendApplicationReceived({
        ...emailCommon,
        applicationCount: currentCount + 1,
      }).catch((e) =>
        console.error('[apply] sendApplicationReceived error:', e),
      )
    }

    return NextResponse.json({
      success: true,
      status: resolvedStatus,
      season_id: season.id,
    })
  } catch (e) {
    console.error('[apply] unexpected error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
