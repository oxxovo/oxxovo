// Video URL parsing + validation + display formatting.
// Single source of truth — validate(url) === OK implies embed/href is usable.
// Instagram is intentionally returned as href-only (Meta embed needs an app token).
// Module is client-safe: no process.env, no node-only imports.

export type VideoPlatform = 'youtube' | 'vimeo' | 'instagram' | 'tiktok'

// Regexes use bounded quantifiers ({6,}, \d{6,}, [^/]+ followed by literal /video/)
// to avoid catastrophic backtracking. No nested or overlapping repeats.
const YT_PATTERNS: RegExp[] = [
  /[?&]v=([A-Za-z0-9_-]{6,})/,
  /youtu\.be\/([A-Za-z0-9_-]{6,})/,
  /youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/,
  /youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/,
]
const VIMEO_PATTERN = /vimeo\.com\/(?:video\/)?(\d{6,})/
const TIKTOK_PATTERN = /tiktok\.com\/@[^/]+\/video\/(\d{6,})/
const INSTAGRAM_PATTERN = /instagram\.com\/(?:reel|p|reels|tv)\//i

export type ParsedVideo =
  | { kind: 'empty' }
  | { kind: 'youtube'; platform: 'youtube'; videoId: string; embedSrc: string; href: string }
  | { kind: 'vimeo'; platform: 'vimeo'; videoId: string; embedSrc: string; href: string }
  | { kind: 'tiktok'; platform: 'tiktok'; videoId: string; embedSrc: string; href: string }
  | { kind: 'instagram'; platform: 'instagram'; href: string }
  | { kind: 'external'; href: string }

export function parseVideoUrl(url: string | null | undefined): ParsedVideo {
  if (!url || typeof url !== 'string' || url.trim() === '') return { kind: 'empty' }
  const trimmed = url.trim()

  for (const pattern of YT_PATTERNS) {
    const m = trimmed.match(pattern)
    if (m?.[1]) {
      return {
        kind: 'youtube',
        platform: 'youtube',
        videoId: m[1],
        embedSrc: `https://www.youtube.com/embed/${m[1]}`,
        href: trimmed,
      }
    }
  }

  const vm = trimmed.match(VIMEO_PATTERN)
  if (vm?.[1]) {
    return {
      kind: 'vimeo',
      platform: 'vimeo',
      videoId: vm[1],
      embedSrc: `https://player.vimeo.com/video/${vm[1]}`,
      href: trimmed,
    }
  }

  const tk = trimmed.match(TIKTOK_PATTERN)
  if (tk?.[1]) {
    return {
      kind: 'tiktok',
      platform: 'tiktok',
      videoId: tk[1],
      embedSrc: `https://www.tiktok.com/embed/v2/${tk[1]}`,
      href: trimmed,
    }
  }

  if (INSTAGRAM_PATTERN.test(trimmed)) {
    return { kind: 'instagram', platform: 'instagram', href: trimmed }
  }

  return { kind: 'external', href: trimmed }
}

// The platforms parseVideoUrl can actually recognise. Kept beside the parser it
// describes: adding a platform above without adding it here would make the
// predicate below quietly wrong.
export const PARSEABLE_PLATFORMS: readonly VideoPlatform[] = [
  'youtube',
  'vimeo',
  'instagram',
  'tiktok',
]

// Does this season accept an external video URL at all?
//
// A season whose allowed_video_platforms contains none of the parseable
// platforms can never produce a valid validateVideoUrl() result, whatever the
// input -- season_0 is exactly that case (['studio'], set 2026-08-04), because
// Studio entries arrive through submitRender/submitGeneration and never through
// a URL field. Screens call this to decide whether to render a URL input at all,
// so the screen and the server gate in /api/apply derive from the SAME column
// instead of from two lists that drift.
//
// ★Fail-closed. The column is typed string[], but the value reaches us from the
// seasons_public view via select('*') -- "the view did not expose the column" is
// a real runtime state, and it must never read as "everything is allowed".
export function acceptsExternalUrl(allowedPlatforms: string[] | null | undefined): boolean {
  if (!Array.isArray(allowedPlatforms)) return false
  return allowedPlatforms.some((p) => (PARSEABLE_PLATFORMS as readonly string[]).includes(p))
}

export type VideoUrlValidation =
  | { valid: true; platform: VideoPlatform; embedSrc: string | null; href: string }
  | { valid: false; error: 'empty' | 'unknown_platform' | 'not_allowed' }

// allowedPlatforms typed as string[] so callers can pass seasons.allowed_video_platforms
// directly without casting. Unknown values are filtered out by the platform match.
export function validateVideoUrl(
  url: string | null | undefined,
  allowedPlatforms: string[],
): VideoUrlValidation {
  const parsed = parseVideoUrl(url)
  if (parsed.kind === 'empty') return { valid: false, error: 'empty' }
  if (parsed.kind === 'external') return { valid: false, error: 'unknown_platform' }

  if (!allowedPlatforms.includes(parsed.platform)) {
    return { valid: false, error: 'not_allowed' }
  }

  const embedSrc = parsed.kind === 'instagram' ? null : parsed.embedSrc
  return { valid: true, platform: parsed.platform, embedSrc, href: parsed.href }
}

export const PLATFORM_DISPLAY_NAMES: Record<string, string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  // Not a parseable URL platform -- it is the in-platform source. It appears in
  // allowed_video_platforms (season_0 = ['studio']), so anything that prints
  // that column needs a name for it or the screen shows lowercase "studio".
  studio: 'OXXOVO Studio',
}

// The full closed set seasons.allowed_video_platforms may contain -- every
// PARSEABLE_PLATFORMS entry (an external URL host validateVideoUrl can
// recognise) plus 'studio' (the in-platform source, never a URL). Exported so
// the admin edit form's checkbox list and the zod schema's enum both read
// from this ONE list rather than each hardcoding their own copy of it.
export const ALLOWED_VIDEO_PLATFORM_VALUES = [...PARSEABLE_PLATFORMS, 'studio'] as const
export type AllowedVideoPlatform = (typeof ALLOWED_VIDEO_PLATFORM_VALUES)[number]

// DB column is plain string[] (defensive -- a stray/legacy value must not
// crash a read). The admin edit form's zod schema is the narrower closed
// enum, so a row read from the DB needs filtering down to it first. Drops
// anything unrecognized rather than throwing -- fail-closed, same posture as
// acceptsExternalUrl above.
export function filterKnownVideoPlatforms(list: string[] | null | undefined): AllowedVideoPlatform[] {
  if (!Array.isArray(list)) return []
  return list.filter((p): p is AllowedVideoPlatform =>
    (ALLOWED_VIDEO_PLATFORM_VALUES as readonly string[]).includes(p),
  )
}

// English brand names in both ko/en — platform names are universally recognized
// in their English form (matches lib/seasons.ts formatModelName pattern).
export function formatVideoPlatforms(platforms: string[]): string {
  return platforms.map((p) => PLATFORM_DISPLAY_NAMES[p] ?? p).join(' · ')
}

// Sample URLs, purely to fill an input's placeholder. Display data like
// PLATFORM_DISPLAY_NAMES above -- it does NOT decide what is allowed, so a
// platform missing here costs an example, never an acceptance.
const PLATFORM_URL_EXAMPLES: Record<string, string> = {
  youtube: 'https://youtube.com/watch?v=…',
  vimeo: 'https://vimeo.com/…',
  instagram: 'https://instagram.com/reel/…',
  tiktok: 'https://tiktok.com/@user/video/…',
}

// Placeholder built from whatever the season actually allows. Two examples at
// most: the field is one line, and the label already carries the full list.
export function formatVideoUrlPlaceholder(platforms: string[]): string {
  const examples = platforms.map((p) => PLATFORM_URL_EXAMPLES[p]).filter(Boolean).slice(0, 2)
  return examples.length ? examples.join('  or  ') : 'https://…'
}
