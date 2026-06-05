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

const PLATFORM_DISPLAY_NAMES: Record<string, string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  instagram: 'Instagram',
  tiktok: 'TikTok',
}

// English brand names in both ko/en — platform names are universally recognized
// in their English form (matches lib/seasons.ts formatModelName pattern).
export function formatVideoPlatforms(platforms: string[]): string {
  return platforms.map((p) => PLATFORM_DISPLAY_NAMES[p] ?? p).join(' · ')
}
