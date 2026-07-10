import { NextRequest, NextResponse } from 'next/server'
import {
  getCurrentSeason,
  getSeasonById,
  getActiveApplicationCount,
  isApplicationClosed,
  isBeforeApplicationOpen,
  isCapacityFull,
} from '@/lib/seasons'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getUserOrNull } from '@/lib/user-auth'
import { checkApplyGate } from '@/lib/membership'
import { sendApplicationReceived, sendWaitlisted } from '@/lib/email/send'
import { parseVideoUrl } from '@/lib/video-url'
import { moderateSubmission } from '@/lib/moderation'
import { upsertCreatorProfile } from '@/lib/profile'

const STATEMENT_MIN = 150
const STATEMENT_MAX = 250
// Public, creator-authored video title + description (separate from the graded
// creator_statement). Shown on Watch.
const TITLE_MAX = 100
const DESCRIPTION_MAX = 600

// Error codes — client maps via t.profile.apply_err_* (옥소보 saveWinnerInfo 패턴).
// Server holds state/decision, client holds wording (단일 i18n 진실원천).
export type ApplyErrorCode =
  | 'unauthenticated'
  | 'membership_required'
  | 'missing_field'
  | 'agreements_required'
  | 'statement_length'
  | 'title_length'
  | 'description_length'
  | 'duration_range'
  | 'season_not_found'
  | 'season_not_open'
  | 'season_closed'
  | 'already_applied_this_season'
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

    // P3 membership gate. Fail-OPEN: when the membership switch is off (current
    // season-0 dark launch) this returns ok and the flow is unchanged. Only a
    // confirmed non-active-creator with the gate ON is blocked here.
    const gate = await checkApplyGate(user.id)
    if (!gate.ok) {
      return NextResponse.json({ error: 'membership_required' }, { status: 403 })
    }

    const body = await request.json()

    const required = [
      'creator_name',
      'free_entry_url',
      'video_duration_seconds',
      'ai_service',
      'creator_statement',
      'video_title',
      'video_description',
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
    if (String(body.video_title).length > TITLE_MAX) {
      return NextResponse.json({ error: 'title_length' }, { status: 400 })
    }
    if (String(body.video_description).length > DESCRIPTION_MAX) {
      return NextResponse.json({ error: 'description_length' }, { status: 400 })
    }

    // An explicit season_id in the body wins (lets an applicant act on a
    // specific season); otherwise resolve the current season dynamically from
    // the application window — no env pin (see [[project-weekly-season-system]]).
    const season =
      typeof body.season_id === 'string' && body.season_id.length > 0
        ? await getSeasonById(body.season_id)
        : await getCurrentSeason()
    if (!season) {
      return NextResponse.json({ error: 'season_not_found' }, { status: 503 })
    }

    if (isBeforeApplicationOpen(season)) {
      return NextResponse.json({ error: 'season_not_open' }, { status: 403 })
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
        video_title: String(body.video_title).trim(),
        video_description: String(body.video_description).trim(),
        agreed_to_rules: body.agreed_to_rules,
        agreed_to_privacy: body.agreed_to_privacy,
        agreed_to_integrity_notice: body.agreed_to_integrity_notice,
        season_id: season.id,
        status: resolvedStatus,
        // Content safety: not public until the AI scan approves (below).
        moderation_status: 'pending',
      })
      .select('id')
      .single()

    if (insertErr) {
      console.error('[apply] insert failed:', insertErr.code, insertErr.message)
      // 23505 = unique_violation. Fires on UNIQUE(season_id, user_id) (Phase 1)
      // or UNIQUE(season_id, lower(email)) (email-unique-fix) — either way the
      // applicant already applied to THIS season. (The old global
      // genesis_applications_email_unique — a real weekly-reapply blocker — was
      // dropped in genesis_email_unique_fix_2026-06.sql.)
      if (insertErr.code === '23505') {
        return NextResponse.json({ error: 'already_applied_this_season' }, { status: 409 })
      }
      return NextResponse.json({ error: 'server_error' }, { status: 500 })
    }

    const insertedId = inserted?.id ?? null

    // Mirror account-level identity to profiles so future submissions prefill it
    // (profile/work split). Non-fatal: genesis already holds the snapshot.
    await upsertCreatorProfile(user.id, { creatorName: body.creator_name, country: body.country }).catch(() => {})

    // AI pre-moderation (Patent 3): scan the public text (title + description +
    // statement) + the YouTube thumbnail (the external video itself can't be
    // fetched). Sets moderation_status so the video is public only when
    // approved. Failure -> stays 'pending' (not public), reviewable in the admin
    // queue. Non-fatal to the apply request.
    if (insertedId) {
      try {
        const parsed = parseVideoUrl(body.free_entry_url)
        const thumb = parsed.kind === 'youtube'
          ? `https://img.youtube.com/vi/${parsed.videoId}/hqdefault.jpg`
          : null
        const scanText = [body.video_title, body.video_description, body.creator_statement]
          .filter(Boolean)
          .join('\n')
        const mod = await moderateSubmission({ text: scanText, imageUrl: thumb })
        await admin
          .from('genesis_applications')
          .update({
            moderation_status: mod.status,
            moderation_flags: mod.categories.length ? mod.categories : null,
            moderation_checked_at: new Date().toISOString(),
          })
          .eq('id', insertedId)
      } catch (e) {
        console.error('[apply] moderation error (stays pending):', e)
      }
    }

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
