// admin 홍보영상 자동게시 -- Postiz 4채널(IG/TikTok/YouTube/X) 예약/즉시 게시.
// server-only route. admin 인증(쿠키 세션 + profiles.role='admin'). 서버 권위:
// 영상 URL/채널 id 는 DB/platform_config 에서 서버가 해석, 클라이언트 신뢰 X.
// 조건부: POSTIZ_API_KEY 없으면 503(자동게시 비활성, 생성/아카이브는 별개).

import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { isPostizEnabled, publishPost, PROMO_CHANNELS, type PromoChannel } from '@/lib/postiz'

export async function POST(req: Request) {
  // 1. admin 인증 (쿠키 세션 + profiles.role).
  const supa = await createSupabaseServer()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createSupabaseAdmin()
  const { data: prof } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (prof?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // 2. 조건부 활성 -- 키 없으면 자동게시만 비활성.
  if (!isPostizEnabled()) return NextResponse.json({ error: 'postiz_disabled' }, { status: 503 })

  // 3. 입력 검증.
  let body: { promoVideoId?: string; channels?: string[]; caption?: string; scheduledAt?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  const { promoVideoId, channels, caption, scheduledAt } = body
  if (
    !promoVideoId ||
    !Array.isArray(channels) ||
    channels.length === 0 ||
    channels.some((c) => !PROMO_CHANNELS.includes(c as PromoChannel))
  ) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  // 4. 게시할 영상 URL 은 서버가 DB 에서 조회 (클라이언트가 URL 을 못 넘김).
  const { data: pv, error } = await admin
    .from('promo_videos')
    .select('id, video_url, status')
    .eq('id', promoVideoId)
    .single()
  if (error || !pv) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!pv.video_url) return NextResponse.json({ error: 'no_video' }, { status: 409 })

  // 5. Postiz 게시 + 결과 기록.
  try {
    const r = await publishPost({
      channels: channels as PromoChannel[],
      mediaUrl: pv.video_url as string,
      caption: caption ?? '',
      scheduledAt: scheduledAt || undefined,
    })
    await admin
      .from('promo_videos')
      .update({
        postiz_post_id: r.postId,
        posted_channels: r.channels,
        posted_at: new Date().toISOString(),
      })
      .eq('id', promoVideoId)
    return NextResponse.json({ ok: true, postId: r.postId, channels: r.channels })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'publish_failed', detail }, { status: 502 })
  }
}
