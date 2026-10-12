// Page banners: 8 of them (home + the 7 sections), supplied as text-free 16:9 images of
// at least 1920x1080 by their DBAs (Jenny2). The image is NOT in the code: its address
// lives in platform_config `banner_<page>` as JSON {"url","width","height"}, so a
// banner is replaced by writing one row and uploading one file -- no commit, no deploy
// (same idea as content_path_<kind>). Wording for a missing/invalid banner: there is
// none. It falls back to the default (a gradient) with no error shown.
//
// Pure parsing here; the one DB read is readBanners() at the bottom (server only).
import type { PageId } from '@/lib/site-nav'

export const BANNER_PAGES: readonly PageId[] = [
  'home', 'tournament', 'entertainment', 'daily', 'market', 'education', 'jobs', 'games',
]

export const BANNER_MIN_WIDTH = 1920
export const BANNER_MIN_HEIGHT = 1080
// 16:9 within 2% (the import path uses the same tolerance for video).
const RATIO = 16 / 9
const RATIO_TOLERANCE = 0.02

export function bannerKey(page: PageId): string {
  return `banner_${page}`
}

export type Banner = { url: string; width: number; height: number }

// value (the platform_config text) -> a usable banner, or null. Everything that is not
// clearly valid is null: bad JSON, a non-https or foreign-host URL, a size below
// 1920x1080, a ratio off 16:9. `allowedOrigin` = the R2 public base's origin.
export function parseBanner(value: unknown, allowedOrigin: string | null): Banner | null {
  if (typeof value !== 'string' || value.trim() === '' || !allowedOrigin) return null
  let o: unknown
  try {
    o = JSON.parse(value)
  } catch {
    return null
  }
  if (typeof o !== 'object' || o === null) return null
  const { url, width, height } = o as Record<string, unknown>
  if (typeof url !== 'string' || typeof width !== 'number' || typeof height !== 'number') return null
  if (!Number.isInteger(width) || !Number.isInteger(height)) return null
  if (width < BANNER_MIN_WIDTH || height < BANNER_MIN_HEIGHT) return null
  if (Math.abs(width / height / RATIO - 1) > RATIO_TOLERANCE) return null
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' || u.origin !== allowedOrigin || u.username || u.password) return null
  return { url: u.toString(), width, height }
}

export type BannerMap = Partial<Record<PageId, Banner>>

// Rows = platform_config {key,value}. A page without a valid row is simply absent.
export function parseBanners(rows: readonly { key: string; value: unknown }[], allowedOrigin: string | null): BannerMap {
  const byKey = new Map(rows.map((r) => [r.key, r.value]))
  const out: BannerMap = {}
  for (const page of BANNER_PAGES) {
    const b = parseBanner(byKey.get(bannerKey(page)), allowedOrigin)
    if (b) out[page] = b
  }
  return out
}

export function originOf(base: string | undefined | null): string | null {
  if (!base) return null
  try {
    const u = new URL(base)
    return u.protocol === 'https:' ? u.origin : null
  } catch {
    return null
  }
}
