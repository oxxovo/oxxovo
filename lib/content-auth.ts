// The bearer secret decides `source` (design SS3-1). One secret per source,
// env name computed from the registry: CONTENT_IMPORT_SECRET_<SOURCE UPPERCASE>
// (a new source is a registry line, not new auth code).
//
// Fail-closed: a source whose secret is unset or shorter than MIN_SECRET_LEN
// can never match -- an empty env var must not turn into "Bearer " matching.
// Comparison is constant-time over fixed-length digests.
import { createHash, timingSafeEqual } from 'node:crypto'
import { CONTENT_SOURCES, type ContentSource } from '@/lib/content-kinds'

const MIN_SECRET_LEN = 32

export function secretEnvName(source: ContentSource): string {
  return `CONTENT_IMPORT_SECRET_${source.toUpperCase()}`
}

function digest(s: string): Buffer {
  return createHash('sha256').update(s, 'utf8').digest()
}

export function resolveSource(
  authorization: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): ContentSource | null {
  if (!authorization) return null
  const m = /^Bearer (\S+)$/.exec(authorization.trim())
  if (!m) return null
  const presented = digest(m[1])

  const matched: ContentSource[] = []
  // No early return: every configured source is compared so timing does not
  // reveal which source's secret was close.
  for (const source of CONTENT_SOURCES) {
    const secret = env[secretEnvName(source)]
    if (!secret || secret.length < MIN_SECRET_LEN) continue
    if (timingSafeEqual(presented, digest(secret))) matched.push(source)
  }
  // The same secret configured for two sources is a deploy mistake that would
  // let one source act as the other. Refuse rather than pick one.
  return matched.length === 1 ? matched[0] : null
}
