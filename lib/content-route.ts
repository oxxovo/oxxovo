// Shared plumbing for the /api/contents/* route handlers.
import 'server-only'
import { NextResponse } from 'next/server'
import { resolveSource } from '@/lib/content-auth'
import { mapContentRpcError } from '@/lib/content-errors'
import type { ContentSource } from '@/lib/content-kinds'

const MAX_BODY_CHARS = 1_000_000

export function jsonError(status: number, code: string): NextResponse {
  return NextResponse.json({ error: code }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export function jsonOk(status: number, body: unknown): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

// 401 with no hint about WHY (unset secret, wrong secret and malformed header
// look the same from outside).
export function authenticate(request: Request): { source: ContentSource } | { response: NextResponse } {
  const source = resolveSource(request.headers.get('authorization'))
  if (!source) return { response: jsonError(401, 'unauthorized') }
  return { source }
}

export async function readJsonBody(request: Request): Promise<{ body: unknown } | { response: NextResponse }> {
  let text: string
  try {
    text = await request.text()
  } catch {
    return { response: jsonError(400, 'body_unreadable') }
  }
  if (text.length > MAX_BODY_CHARS) return { response: jsonError(413, 'body_too_large') }
  try {
    return { body: JSON.parse(text) }
  } catch {
    return { response: jsonError(400, 'json_invalid') }
  }
}

// Logs the raw RPC message (it may carry constraint names) and answers with
// the mapped, safe code only.
export function rpcErrorResponse(route: string, source: ContentSource, message: string | undefined): NextResponse {
  const mapped = mapContentRpcError(message)
  if (mapped.status >= 500 && mapped.status !== 503) {
    console.error(`[${route}] rpc error source=${source}:`, message)
  }
  return jsonError(mapped.status, mapped.code)
}

// Reject keys we do not know (design: unknown fields are errors, not ignored).
export function onlyKeys(body: Record<string, unknown>, allowed: readonly string[]): string | null {
  for (const k of Object.keys(body)) if (!allowed.includes(k)) return `unknown_field:${k}`
  return null
}

// Raw platform_config text, uncached. Import and presign decisions must see
// the value the RPC will see; getPlatformConfigMap() is cached and typed.
export async function readRawConfig(
  admin: { from: (t: string) => any }, // eslint-disable-line @typescript-eslint/no-explicit-any
  keys: readonly string[],
): Promise<Map<string, string> | null> {
  const { data, error } = await admin.from('platform_config').select('key, value').in('key', keys as string[])
  if (error || !data) return null
  return new Map((data as { key: string; value: string }[]).map((r) => [r.key, r.value]))
}
