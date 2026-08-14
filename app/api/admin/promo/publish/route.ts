// admin 홍보영상 수동 발행 -- Postiz 4채널(IG/TikTok/YouTube/X). server-only route.
// admin 인증(쿠키 세션 + profiles.role='admin'). caption/channels는 요청 바디로 받지
// 않는다 -- promo_videos에 저장된 값(updatePromoMetaAction으로 저장)이 유일한 소스,
// 그래야 승인 시점에 검수한 문구/채널과 실제 게시되는 것이 항상 같다.
// approved=true 가 아니면 거부(publishPromoVideo 내부 게이트) -- 자동(cron)에만
// 게이트가 걸리면 수동이 우회로가 되므로 여기도 반드시 통과한다.

import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { isPostizEnabled } from '@/lib/postiz'
import { publishPromoVideo } from '@/lib/promo-publish'

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
  let body: { promoVideoId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  const { promoVideoId } = body
  if (!promoVideoId) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  // 4. 발행 -- 승인/캡션/채널 전부 publishPromoVideo가 DB에서 읽어 검사한다.
  const result = await publishPromoVideo(promoVideoId, 'manual')
  if (!result.ok) {
    const status =
      result.error === 'not_approved'
        ? 409
        : result.error === 'not_found'
          ? 404
          : result.error === 'no_video' || result.error === 'no_channels'
            ? 400
            : 502
    return NextResponse.json({ error: result.error }, { status })
  }
  return NextResponse.json({ ok: true, postIds: result.postIds, channels: result.channels })
}
