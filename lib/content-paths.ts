// Public address of a content kind (design SS7-1): the slug lives in
// platform_config `content_path_<kind>`, never in code. No slug row = that
// kind's public surface does not exist (404) -- fail-closed, so an address
// that is not decided yet cannot be reached by accident, and deciding it later
// is one INSERT, no deploy.
//
// Pure: no env, no DB. contentUrl() is the ONLY function that builds a public
// address; nothing else concatenates a path.
import { CONTENT_KINDS, type ContentKind } from '@/lib/content-kinds'

// A slug becomes a top-level path segment (app/[section]), so it must never
// shadow a real route. This list is checked against app/ by a unit test: add a
// folder under app/ and that test fails until the folder is listed here.
//  - `c` is the permanent-address prefix (/c/<id>), reserved so a slug can
//    never break it.
//  - the underscore folders (_actions, _components, _landing) are private
//    folders, not routes, and are skipped by the test.
export const RESERVED_SLUGS: readonly string[] = [
  'c',
  // existing app/ routes
  'about', 'admin', 'api', 'apply', 'auth', 'faq', 'fonts', 'guidelines', 'host', 'lobby-preview',
  'login', 'membership', 'partner', 'pre-register', 'privacy', 'profile', 'rules', 'signup',
  'studio', 'terms', 'tournament', 'watch', 'watch-arena', 'welcome',
  // Next.js / platform conventions that resolve at the top level
  '_next', 'favicon', 'favicon.ico', 'robots', 'robots.txt', 'sitemap', 'sitemap.xml',
  'manifest', 'icon', 'apple-icon', 'opengraph-image', 'public', 'static',
]
// Deliberately NOT reserved: words the product might want as a section name
// (news, movies, ...). Reserving a guess would block the very slug TK picks;
// a real collision is caught by the app/ test above as soon as the route exists.

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/

export function contentPathKey(kind: ContentKind): string {
  return `content_path_${kind}`
}

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && !RESERVED_SLUGS.includes(slug)
}

export type ContentPaths = Partial<Record<ContentKind, string>>

// rows = platform_config rows for the content_path_* keys. A missing row, an
// invalid slug or a slug shared by two kinds all mean "no public path":
// guessing which kind a shared slug meant would publish the wrong thing.
export function parseContentPaths(rows: readonly { key: string; value: unknown }[]): ContentPaths {
  const byKey = new Map(rows.map((r) => [r.key, String(r.value ?? '').trim()]))
  const candidate: ContentPaths = {}
  for (const kind of CONTENT_KINDS) {
    const v = byKey.get(contentPathKey(kind))
    if (v !== undefined && isValidSlug(v)) candidate[kind] = v
  }
  const count = new Map<string, number>()
  for (const slug of Object.values(candidate)) count.set(slug, (count.get(slug) ?? 0) + 1)
  const out: ContentPaths = {}
  for (const kind of CONTENT_KINDS) {
    const slug = candidate[kind]
    if (slug && count.get(slug) === 1) out[kind] = slug
  }
  return out
}

// null = this kind has no public surface.
export function contentUrl(kind: ContentKind, id: string, paths: ContentPaths): string | null {
  const slug = paths[kind]
  return slug ? `/${slug}/${id}` : null
}

// The reverse lookup for app/[section]: the segment must name exactly one kind.
export function kindForSlug(slug: string, paths: ContentPaths): ContentKind | null {
  for (const kind of CONTENT_KINDS) if (paths[kind] === slug) return kind
  return null
}

// Permanent, id-only address: never changes even if the slug does.
export function permanentPath(id: string): string {
  return `/c/${id}`
}
