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

// Postiz settings.__type 매핑 (플랫폼별 provider 식별자).
// 값은 GET /integrations 의 provider 식별자와 일치해야 함. IG 는 연결 방식상
// 'instagram-standalone' 으로 보고됨(2026-06 실측). 나머지는 동일.
const SETTINGS_TYPE: Record<PromoChannel, string> = {
  instagram: 'instagram-standalone',
  tiktok: 'tiktok',
  youtube: 'youtube',
  x: 'x',
}

// Postiz 게시 종류 (피드 영상 = post, 스토리 = story). 홍보영상은 피드.
type PostType = 'post' | 'story'

// 업로드된 media 참조. /posts 의 value[].image 는 객체 배열을 요구.
export type PostizMedia = { id: string; path: string }

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
  // multipart(FormData) 면 Content-Type 을 직접 지정하지 않는다(boundary 자동).
  const isForm = typeof FormData !== 'undefined' && init?.body instanceof FormData
  // Postiz 인증: Authorization 헤더에 키를 직접 (Bearer 접두 없음).
  const res = await fetch(base + path, {
    ...init,
    headers: {
      Authorization: key,
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
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

// R2 영상 URL 을 Postiz 에 업로드. Postiz /upload 는 multipart(file 필드)만 받으므로
// 원본 바이트를 내려받아 재업로드한다(2026-06 실측). 응답: { id, path }.
export async function uploadMedia(videoUrl: string): Promise<PostizMedia> {
  const dl = await fetch(videoUrl)
  if (!dl.ok) throw new Error(`postiz upload: source fetch ${dl.status}`)
  const bytes = await dl.arrayBuffer()
  const contentType = dl.headers.get('content-type') || 'video/mp4'
  const name = videoUrl.split('/').pop()?.split('?')[0] || 'video.mp4'

  const form = new FormData()
  form.append('file', new Blob([bytes], { type: contentType }), name)

  const res = await postizFetch('/upload', { method: 'POST', body: form })
  const json = (await res.json()) as { id?: string; path?: string }
  if (!json.id || !json.path) throw new Error('postiz upload: missing id/path in response')
  return { id: json.id, path: json.path }
}

// 4채널 예약/즉시 게시. scheduledAt(ISO-8601) 없으면 즉시(now).
export async function publishPost(args: {
  channels: PromoChannel[]
  mediaUrl: string
  caption: string
  scheduledAt?: string
}): Promise<{ postIds: string[]; channels: PromoChannel[] }> {
  const chans = await getPostizChannelIds(args.channels)
  const media = await uploadMedia(args.mediaUrl)
  const postType: PostType = 'post' // 홍보영상은 피드(Reel/영상 자동 감지).

  // /posts 바디는 2026-06 실측(400 응답)으로 확정한 모양:
  //   top-level: shortLink(boolean), tags(array)
  //   value[].image: media 객체 배열 [{ id, path }]
  //   settings: __type(provider) + post_type
  const body = {
    type: args.scheduledAt ? 'schedule' : 'now',
    date: args.scheduledAt ?? new Date().toISOString(),
    shortLink: false,
    tags: [] as string[],
    posts: chans.map((c) => ({
      integration: { id: c.integrationId },
      value: [{ content: args.caption, image: [media] }],
      settings: { __type: SETTINGS_TYPE[c.channel], post_type: postType },
    })),
  }

  const res = await postizFetch('/posts', { method: 'POST', body: JSON.stringify(body) })
  // 2026-06 실측: 성공 응답은 채널당 한 엔트리 배열 [{ postId, integration }].
  const json = (await res.json()) as Array<{ postId?: string; integration?: string }>
  const arr = Array.isArray(json) ? json : []
  // integration id -> channel 역매핑으로 실제 성공 채널을 기록.
  const byIntegration = new Map(chans.map((c) => [c.integrationId, c.channel]))
  const postIds = arr.map((r) => r.postId ?? 'unknown')
  const postedChannels = arr
    .map((r) => (r.integration ? byIntegration.get(r.integration) : undefined))
    .filter((c): c is PromoChannel => !!c)
  return {
    postIds,
    channels: postedChannels.length ? postedChannels : args.channels,
  }
}
