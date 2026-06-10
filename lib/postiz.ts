import 'server-only'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

// OXXOVO 자동게시 클라이언트 (Postiz cloud). 전자동화 비전: 생성된 홍보영상을
// IG / TikTok / YouTube / X 4채널에 예약/즉시 게시.
//
// 조건부 활성: POSTIZ_API_KEY 가 있을 때만 동작. 없으면 isPostizEnabled()=false
// 라 생성/아카이브 기능은 그대로 두고 자동게시만 비활성.
//
// env (server-only, 하드코딩 금지):
//   POSTIZ_API_KEY  -- Postiz Settings > Developers > Public API 에서 발급
//   POSTIZ_API_URL  -- 생략 시 cloud 기본값. self-host 시 {backend}/public/v1
// 채널 integration id 는 platform_config (postiz_channel_*) 에서 동적 조회.

const DEFAULT_BASE = 'https://api.postiz.com/public/v1'

export const PROMO_CHANNELS = ['instagram', 'tiktok', 'youtube', 'x'] as const
export type PromoChannel = (typeof PROMO_CHANNELS)[number]

// Postiz settings.__type 매핑 (플랫폼별 식별자).
const SETTINGS_TYPE: Record<PromoChannel, string> = {
  instagram: 'instagram',
  tiktok: 'tiktok',
  youtube: 'youtube',
  x: 'x',
}

export function isPostizEnabled(): boolean {
  return !!process.env.POSTIZ_API_KEY
}

function postizConfig(): { key: string; base: string } {
  const key = process.env.POSTIZ_API_KEY
  if (!key) throw new Error('postiz: POSTIZ_API_KEY not set')
  const base = process.env.POSTIZ_API_URL || DEFAULT_BASE
  return { key, base }
}

async function postizFetch(path: string, init?: RequestInit): Promise<Response> {
  const { key, base } = postizConfig()
  // Postiz 인증: Authorization 헤더에 키를 직접 (Bearer 접두 없음).
  const res = await fetch(base + path, {
    ...init,
    headers: {
      Authorization: key,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`postiz ${path} -> ${res.status}: ${text.slice(0, 300)}`)
  }
  return res
}

// 채널 integration id 를 platform_config 에서 조회. 키 형식: postiz_channel_<channel>.
// TK 가 가입 후 GET /integrations 로 확인한 id 를 platform_config 에 넣어둠.
export async function getPostizChannelIds(
  channels: PromoChannel[],
): Promise<{ channel: PromoChannel; integrationId: string }[]> {
  const admin = createSupabaseAdmin()
  const keys = channels.map((c) => `postiz_channel_${c}`)
  const { data, error } = await admin
    .from('platform_config')
    .select('key, value')
    .in('key', keys)
  if (error) throw new Error('postiz channels: ' + error.message)
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value as string]))
  return channels.map((c) => {
    const id = map.get(`postiz_channel_${c}`)
    if (!id) {
      throw new Error(`postiz: channel id missing for "${c}" (set platform_config.postiz_channel_${c})`)
    }
    return { channel: c, integrationId: id }
  })
}

// R2 영상 URL 을 Postiz 에 업로드. 반환 형식은 키 발급 후 실측으로 확정 (id/path/url).
// NOTE: 키 받으면 GET /integrations + 실제 /upload 응답으로 아래 파싱 검증.
export async function uploadMedia(videoUrl: string): Promise<string> {
  const res = await postizFetch('/upload', {
    method: 'POST',
    body: JSON.stringify({ url: videoUrl }),
  })
  const json = (await res.json()) as { id?: string; path?: string; url?: string }
  const ref = json.id ?? json.path ?? json.url
  if (!ref) throw new Error('postiz upload: no media reference in response')
  return ref
}

// 4채널 예약/즉시 게시. scheduledAt(ISO-8601) 없으면 즉시(now).
export async function publishPost(args: {
  channels: PromoChannel[]
  mediaUrl: string
  caption: string
  scheduledAt?: string
}): Promise<{ postId: string; channels: PromoChannel[] }> {
  const chans = await getPostizChannelIds(args.channels)
  const media = await uploadMedia(args.mediaUrl)

  const body = {
    type: args.scheduledAt ? 'schedule' : 'now',
    date: args.scheduledAt ?? new Date().toISOString(),
    posts: chans.map((c) => ({
      integration: { id: c.integrationId },
      value: [{ content: args.caption, image: [media] }],
      settings: { __type: SETTINGS_TYPE[c.channel] },
    })),
  }

  const res = await postizFetch('/posts', { method: 'POST', body: JSON.stringify(body) })
  const json = (await res.json()) as { id?: string } | Array<{ id?: string }>
  const postId = Array.isArray(json) ? (json[0]?.id ?? 'unknown') : (json.id ?? 'unknown')
  return { postId, channels: args.channels }
}
