import { NextRequest, NextResponse } from 'next/server'

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
    if (stmtLen < 150 || stmtLen > 250) {
      return NextResponse.json(
        { error: 'Creator statement must be 150–250 characters.' },
        { status: 400 }
      )
    }

    const dur = Number(body.video_duration_seconds)
    if (!Number.isFinite(dur) || dur < 15 || dur > 30) {
      return NextResponse.json(
        { error: 'Video duration must be between 15 and 30 seconds.' },
        { status: 400 }
      )
    }

    const key = 'sb_publishable_jqaYD8CyZLZLK3mpCPjHMQ_f79qUrjl'

    const res = await fetch('https://qrnkovokjmimagrwjebs.supabase.co/rest/v1/genesis_applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
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
        status: 'pending',
      }),
    })

    const text = await res.text()
    console.log('APPLY STATUS:', res.status)
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

    return NextResponse.json({ success: true })
  } catch (e) {
    console.log('APPLY ERROR:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
