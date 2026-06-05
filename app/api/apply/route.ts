import { NextRequest, NextResponse } from 'next/server'
import {
  getCurrentSeason,
  getSeasonById,
  getActiveApplicationCount,
  isApplicationClosed,
  isCapacityFull,
} from '@/lib/seasons'
import { sendApplicationReceived, sendWaitlisted } from '@/lib/email/send'

const STATEMENT_MIN = 150
const STATEMENT_MAX = 250
const SUPABASE_URL = 'https://qrnkovokjmimagrwjebs.supabase.co'
const SUPABASE_KEY = 'sb_publishable_jqaYD8CyZLZLK3mpCPjHMQ_f79qUrjl'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const required = [
      'email',
      'creator_name',
      'free_entry_url',
      'video_duration_seconds',
      'ai_service',
      'creator_statement',
    ] as const
    for (const k of required) {
      const v = body[k]
      if (v === undefined || v === null || v === '') {
        return NextResponse.json({ error: `Missing field: ${k}` }, { status: 400 })
      }
    }

    if (!body.agreed_to_rules || !body.agreed_to_privacy || !body.agreed_to_integrity_notice) {
      return NextResponse.json({ error: 'All three agreements are required.' }, { status: 400 })
    }

    const stmtLen = String(body.creator_statement).length
    if (stmtLen < STATEMENT_MIN || stmtLen > STATEMENT_MAX) {
      return NextResponse.json(
        { error: `Creator statement must be ${STATEMENT_MIN}–${STATEMENT_MAX} characters.` },
        { status: 400 }
      )
    }

    // An explicit season_id in the body wins (lets an applicant act on a
    // specific season); otherwise resolve the current season dynamically from
    // the application window — no env pin (see [[project-weekly-season-system]]).
    const season =
      typeof body.season_id === 'string' && body.season_id.length > 0
        ? await getSeasonById(body.season_id)
        : await getCurrentSeason()
    if (!season) {
      return NextResponse.json(
        { error: 'Season configuration not found. Please try again later.' },
        { status: 503 }
      )
    }

    if (isApplicationClosed(season)) {
      return NextResponse.json(
        { error: `${season.name} — applications are closed.` },
        { status: 403 }
      )
    }

    const dur = Number(body.video_duration_seconds)
    const minSec = season.application_video_min_seconds
    const maxSec = season.application_video_max_seconds
    if (!Number.isFinite(dur) || dur < minSec || dur > maxSec) {
      return NextResponse.json(
        { error: `Video duration must be between ${minSec} and ${maxSec} seconds.` },
        { status: 400 }
      )
    }

    const currentCount = await getActiveApplicationCount(season.id)
    const resolvedStatus: 'pending' | 'waitlist' = isCapacityFull(season, currentCount)
      ? 'waitlist'
      : 'pending'

    const res = await fetch(`${SUPABASE_URL}/rest/v1/genesis_applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        // Return the inserted row so we can pass application_id to email_logs.
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        email: body.email,
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
      }),
    })

    const text = await res.text()
    console.log('APPLY STATUS:', res.status, 'RESOLVED:', resolvedStatus)
    console.log('APPLY RESPONSE:', text)

    if (!res.ok) {
      if (text.includes('duplicate key') || text.includes('23505')) {
        return NextResponse.json(
          { error: 'This email has already submitted an application.' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: text }, { status: res.status })
    }

    // Pull the inserted id out of the PostgREST representation response. If
    // parsing fails, log without applicationId — dedup loses its anchor but
    // the email still goes out.
    let insertedId: string | null = null
    try {
      const parsed = JSON.parse(text)
      const row = Array.isArray(parsed) ? parsed[0] : parsed
      if (row && typeof row.id === 'string') insertedId = row.id
    } catch {
      // ignore — email send proceeds without applicationId
    }

    // Fire the appropriate notification. Errors here are logged into
    // email_logs by the helper itself; we don't fail the apply request even
    // if Resend hiccups, since the application is already persisted.
    const emailCommon = {
      toEmail: body.email,
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
        // Newly inserted is the (currentCount + 1)th applicant.
        applicationCount: currentCount + 1,
      }).catch((e) =>
        console.error('[apply] sendApplicationReceived error:', e),
      )
    }

    return NextResponse.json({ success: true, status: resolvedStatus, season_id: season.id })
  } catch (e) {
    console.log('APPLY ERROR:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
