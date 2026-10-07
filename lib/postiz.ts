import 'server-only'
import { createHash } from 'node:crypto'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

// OXXOVO 자동게시 클라이언트 (Postiz cloud). 전자동화 비전: 생성된 홍보영상을
// IG / TikTok / YouTube / X 4채널에 즉시 게시.
//
// 조건부 활성: POSTIZ_API_KEY 가 있을 때만 동작. 없으면 isPostizEnabled()=false
// 라 생성/아카이브 기능은 그대로 두고 자동게시만 비활성.
//
// env (server-only, 하드코딩 금지):
//   POSTIZ_API_KEY  -- Postiz Settings > Developers > Public API 에서 발급
//   POSTIZ_API_URL  -- 생략 시 cloud 기본값. self-host 시 {backend}/public/v1
// 채널 integration id 는 platform_config (postiz_channel_*) 에서 동적 조회.
//
// ★Phase 1 (design SS5-3, SS5-6): 게시는 두 단계로 쪼개져 있다.
//   prepareMedia()    -- 내려받기 -> (선택) 해시·크기 검증 -> Postiz 업로드. 아직 게시 아님.
//   publishPrepared() -- POST /posts. 항상 type:'now'.
// 두 호출 사이에 호출자가 스위치를 다시 읽는다(가드). 예약(scheduledAt)은 받지
// 않는다: Postiz 안에 미래 시각으로 맡기면 우리 스위치를 꺼도 계속 나가고
// 우리 코드로 회수할 수 없다(긴급 정지 무력화).

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

// ---- YouTube settings (content dispatch only) --------------------------------
// Postiz's YouTube provider REQUIRES `title` (2-100 chars) and `type`
// (public | unlisted | private) -- https://docs.postiz.com/public-api/providers/youtube
// The promo path never sent them; the content dispatch path does, through the
// optional `youtube` argument below. The promo path is deliberately unchanged.
export const YOUTUBE_VISIBILITIES = ['private', 'unlisted', 'public'] as const
export type YoutubeVisibility = (typeof YOUTUBE_VISIBILITIES)[number]
export type YoutubeSettings = { title: string; visibility: YoutubeVisibility }

// FAIL-CLOSED: anything that is not exactly one of the three words (a missing
// key, a typo, '', 'Public ' with junk) is `private`. A missing setting must
// never publish a video.
export function parseYoutubeVisibility(raw: unknown): YoutubeVisibility {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return (YOUTUBE_VISIBILITIES as readonly string[]).includes(v) ? (v as YoutubeVisibility) : 'private'
}

export const YOUTUBE_TITLE_MIN = 2
export const YOUTUBE_TITLE_MAX = 100

// The content title as a YouTube title: control characters and line breaks ->
// space, `<` and `>` removed (YouTube rejects them), whitespace collapsed,
// cut to 100 CODE POINTS (not UTF-16 units, so a surrogate pair is never
// split). null = unusable (< 2 chars): the caller must not send, and must not
// invent a title.
export function youtubeTitle(raw: string): string | null {
  const cleaned = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const cut = Array.from(cleaned).slice(0, YOUTUBE_TITLE_MAX).join('').trim()
  return Array.from(cut).length >= YOUTUBE_TITLE_MIN ? cut : null
}

// 업로드된 media 참조. /posts 의 value[].image 는 객체 배열을 요구.
export type PostizMedia = { id: string; path: string }

// HTTP status is carried so callers can tell 4xx (not accepted) from 5xx
// (outcome unknown). A network error / timeout has no status at all.
export class PostizHttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'PostizHttpError'
    this.status = status
  }
}

// Thrown by prepareMedia when the bytes are not what was approved. Nothing was
// uploaded when this is thrown.
export class PostizMediaError extends Error {
  readonly code: 'hash_mismatch' | 'oversize' | 'source_fetch_failed'
  constructor(code: 'hash_mismatch' | 'oversize' | 'source_fetch_failed', message: string) {
    super(message)
    this.name = 'PostizMediaError'
    this.code = code
  }
}

// The channel id lookup failed BEFORE any request to Postiz, so nothing was
// posted. Distinct from a network error (outcome unknown): callers can retry.
export class PostizConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PostizConfigError'
  }
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

async function postizFetch(path: string, init?: RequestInit, timeoutMs = 60_000): Promise<Response> {
  const { key, base } = postizConfig()
  // multipart(FormData) 면 Content-Type 을 직접 지정하지 않는다(boundary 자동).
  const isForm = typeof FormData !== 'undefined' && init?.body instanceof FormData
  // Postiz 인증: Authorization 헤더에 키를 직접 (Bearer 접두 없음).
  const res = await fetch(base + path, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Authorization: key,
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new PostizHttpError(res.status, `postiz ${path} -> ${res.status}: ${text.slice(0, 300)}`)
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
  if (error) throw new PostizConfigError('postiz channels: ' + error.message)
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value as string]))
  return channels.map((c) => {
    const id = map.get(`postiz_channel_${c}`)
    if (!id) {
      throw new PostizConfigError(`postiz: channel id missing for "${c}" (set platform_config.postiz_channel_${c})`)
    }
    return { channel: c, integrationId: id }
  })
}

export type PrepareOptions = {
  // Lowercase hex sha256 of the approved file. A mismatch aborts BEFORE upload
  // (a changed file must not reach the outside, design SS5-3 4b).
  expectedSha256?: string
  // The file is held in memory (and copied once more into the multipart Blob),
  // so this is a MEMORY ceiling, not a business limit. Checked on the
  // Content-Length header first and again on the bytes actually received.
  maxBytes?: number
}

// R2 영상 URL 을 Postiz 에 업로드. Postiz /upload 는 multipart(file 필드)만 받으므로
// 원본 바이트를 내려받아 재업로드한다(2026-06 실측). 응답: { id, path }.
// 아직 게시가 아니다.
export async function prepareMedia(videoUrl: string, opts: PrepareOptions = {}): Promise<PostizMedia> {
  const dl = await fetch(videoUrl, { signal: AbortSignal.timeout(100_000) })
  if (!dl.ok) throw new PostizMediaError('source_fetch_failed', `postiz upload: source fetch ${dl.status}`)
  if (opts.maxBytes !== undefined) {
    const declared = Number(dl.headers.get('content-length'))
    if (Number.isFinite(declared) && declared > opts.maxBytes) {
      await dl.body?.cancel().catch(() => {})
      throw new PostizMediaError('oversize', `postiz upload: ${declared} bytes > ${opts.maxBytes}`)
    }
  }
  const bytes = await dl.arrayBuffer()
  if (opts.maxBytes !== undefined && bytes.byteLength > opts.maxBytes) {
    throw new PostizMediaError('oversize', `postiz upload: ${bytes.byteLength} bytes > ${opts.maxBytes}`)
  }
  if (opts.expectedSha256 !== undefined) {
    const actual = createHash('sha256').update(Buffer.from(bytes)).digest('hex')
    if (actual !== opts.expectedSha256) {
      throw new PostizMediaError('hash_mismatch', 'postiz upload: sha256 does not match the approved file')
    }
  }
  const contentType = dl.headers.get('content-type') || 'video/mp4'
  const name = videoUrl.split('/').pop()?.split('?')[0] || 'video.mp4'

  const form = new FormData()
  form.append('file', new Blob([bytes], { type: contentType }), name)

  const res = await postizFetch('/upload', { method: 'POST', body: form }, 100_000)
  const json = (await res.json()) as { id?: string; path?: string }
  if (!json.id || !json.path) throw new Error('postiz upload: missing id/path in response')
  return { id: json.id, path: json.path }
}

export type PublishPreparedArgs = {
  channels: PromoChannel[]
  media: PostizMedia
  caption: string
  // Only the content dispatch passes this. Without it the youtube entry is
  // built exactly as before (promo path unchanged).
  youtube?: YoutubeSettings
}

// POST /posts. 항상 즉시(type:'now'). 예약을 받지 않는다 -- 런타임에서도 거부한다
// (타입을 우회하는 호출자가 있어도 긴급 정지의 전제가 깨지지 않게).
export function buildPostBody(
  chans: { channel: PromoChannel; integrationId: string }[],
  media: PostizMedia,
  caption: string,
  youtube?: YoutubeSettings,
) {
  const postType: PostType = 'post' // 피드(Reel/영상 자동 감지).
  // Validated BEFORE any request is built, so a bad title cannot reach Postiz.
  let ytSettings: { title: string; type: YoutubeVisibility } | null = null
  if (youtube && chans.some((c) => c.channel === 'youtube')) {
    const title = youtubeTitle(youtube.title)
    if (!title) throw new PostizConfigError('postiz: youtube title unusable (needs 2-100 characters)')
    // Re-parsed here too: whatever the caller typed, only the three words pass.
    ytSettings = { title, type: parseYoutubeVisibility(youtube.visibility) }
  }
  // /posts 바디는 2026-06 실측(400 응답)으로 확정한 모양:
  //   top-level: shortLink(boolean), tags(array)
  //   value[].image: media 객체 배열 [{ id, path }]
  //   settings: __type(provider) + post_type
  return {
    type: 'now' as const,
    date: new Date().toISOString(),
    shortLink: false,
    tags: [] as string[],
    posts: chans.map((c) => ({
      integration: { id: c.integrationId },
      value: [{ content: caption, image: [media] }],
      settings:
        c.channel === 'youtube' && ytSettings
          ? { __type: SETTINGS_TYPE[c.channel], post_type: postType, ...ytSettings }
          : { __type: SETTINGS_TYPE[c.channel], post_type: postType },
    })),
  }
}

export async function publishPrepared(
  args: PublishPreparedArgs,
): Promise<{ postIds: string[]; channels: PromoChannel[] }> {
  if ((args as { scheduledAt?: unknown }).scheduledAt !== undefined) {
    throw new Error('postiz: scheduling is not allowed (always type:now; schedule is owned by publish_at + cron)')
  }
  const chans = await getPostizChannelIds(args.channels)
  const body = buildPostBody(chans, args.media, args.caption, args.youtube)

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
