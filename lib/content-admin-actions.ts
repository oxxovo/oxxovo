// Core of the /admin/contents server actions, with the Supabase client and the
// acting admin INJECTED. app/admin/contents/actions.ts is a thin 'use server'
// wrapper (requireAdmin + createSupabaseAdmin + revalidatePath); everything
// that decides anything is here so tests can drive it with a fake client.
//
// Rules this file owns:
//  * actor: every RPC gets the real admin's id + email (p_actor_email). The
//    RPCs refuse an empty email (actor_required) and write it to
//    app.actor_email, which is what contents_history records. Never 'db:...'.
//  * probe rows: [release] and [requeue] are refused for source_ref `probe-*`,
//    by looking the row up -- not by trusting anything the browser sent. A row
//    that cannot be looked up is refused too (fail-closed).
import { mapContentRpcError } from '@/lib/content-errors'
import {
  PROBE_BLOCK_MESSAGE,
  checkExternalUrl,
  describeActionError,
  isOversize,
  isProbeRef,
  isSwitchOpen,
  parsePositiveInt,
  releaseConfirmLines,
  type DispatchSwitches,
  type PreviousVersion,
} from '@/lib/content-admin'
import { MASTER_DISPATCH_KEY, dispatchSwitchKey, isContentKind } from '@/lib/content-kinds'

export type AdminLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>
}
export type Actor = { id: string; email: string }
export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const REASON_MAX = 2000

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error }
}

function actorOk(actor: Actor): boolean {
  return UUID.test(actor.id) && actor.email.trim() !== ''
}

async function callRpc(
  admin: AdminLike,
  actor: Actor,
  fn: string,
  args: Record<string, unknown>,
): Promise<ActionResult> {
  if (!actorOk(actor)) return fail(describeActionError('actor_required'))
  const { error } = await admin.rpc(fn, { ...args, p_actor_id: actor.id, p_actor_email: actor.email })
  if (error) return fail(describeActionError(mapContentRpcError(error.message).code))
  return { ok: true }
}

// ---- probe guard -----------------------------------------------------------
async function guardContent(admin: AdminLike, contentId: string): Promise<ActionResult> {
  const { data, error } = await admin.from('contents').select('source_ref').eq('id', contentId).maybeSingle()
  if (error || !data) return fail('대상을 확인할 수 없어 중단했습니다')
  if (isProbeRef((data as { source_ref?: unknown }).source_ref)) return fail(PROBE_BLOCK_MESSAGE)
  return { ok: true }
}

// ---- content buttons -------------------------------------------------------
function contentButton(fn: string, probeGuarded: boolean) {
  return async (admin: AdminLike, actor: Actor, contentId: string): Promise<ActionResult> => {
    if (!UUID.test(contentId)) return fail(describeActionError('not_found'))
    if (probeGuarded) {
      const g = await guardContent(admin, contentId)
      if (!g.ok) return g
    }
    return callRpc(admin, actor, fn, { p_content_id: contentId })
  }
}

export const holdContent = contentButton('content_hold', false)
export const hideContent = contentButton('content_hide', false)
export const unhideContent = contentButton('content_unhide', false)
// [release] is the one that can lead to a real post, so it is probe-guarded.
export const releaseContent = contentButton('content_release', true)

export async function returnContent(
  admin: AdminLike,
  actor: Actor,
  contentId: string,
  reason: string,
): Promise<ActionResult> {
  if (!UUID.test(contentId)) return fail(describeActionError('not_found'))
  const r = reason.trim()
  if (r === '') return fail(describeActionError('reason_required'))
  if (r.length > REASON_MAX) return fail(`사유는 ${REASON_MAX}자 이하여야 합니다`)
  return callRpc(admin, actor, 'content_return', { p_content_id: contentId, p_reason: r })
}

export async function updateContentMeta(
  admin: AdminLike,
  actor: Actor,
  contentId: string,
  meta: { title?: string; description?: string; caption?: string },
): Promise<ActionResult> {
  if (!UUID.test(contentId)) return fail(describeActionError('not_found'))
  // undefined -> null = "leave unchanged"; '' = clear (RPC contract).
  return callRpc(admin, actor, 'content_update_meta', {
    p_content_id: contentId,
    p_title: meta.title ?? null,
    p_description: meta.description ?? null,
    p_caption: meta.caption ?? null,
  })
}

export async function setContentPublishAt(
  admin: AdminLike,
  actor: Actor,
  contentId: string,
  publishAtIso: string,
): Promise<ActionResult> {
  if (!UUID.test(contentId)) return fail(describeActionError('not_found'))
  const t = new Date(publishAtIso)
  if (Number.isNaN(t.getTime())) return fail('시각 형식이 올바르지 않습니다')
  return callRpc(admin, actor, 'content_set_publish_at', { p_content_id: contentId, p_publish_at: t.toISOString() })
}

// ---- distribution buttons --------------------------------------------------
type DistRow = { content_id: string; platform: string; status: string }

async function loadDist(admin: AdminLike, distId: string): Promise<DistRow | null> {
  const { data, error } = await admin
    .from('content_distributions')
    .select('content_id, platform, status')
    .eq('id', distId)
    .maybeSingle()
  return error || !data ? null : (data as DistRow)
}

export async function requeueDist(admin: AdminLike, actor: Actor, distId: string): Promise<ActionResult> {
  if (!UUID.test(distId)) return fail(describeActionError('not_found'))
  const d = await loadDist(admin, distId)
  if (!d) return fail('대상을 확인할 수 없어 중단했습니다')
  const g = await guardContent(admin, d.content_id)
  if (!g.ok) return g
  return callRpc(admin, actor, 'dist_requeue', { p_dist_id: distId })
}

export async function markDistPosted(
  admin: AdminLike,
  actor: Actor,
  distId: string,
  rawUrl: string,
): Promise<ActionResult> {
  if (!UUID.test(distId)) return fail(describeActionError('not_found'))
  const d = await loadDist(admin, distId)
  if (!d) return fail('대상을 확인할 수 없어 중단했습니다')
  const chk = checkExternalUrl(d.platform, rawUrl, d.status.startsWith('skipped_'))
  if (!chk.ok) return fail(chk.error)
  return callRpc(admin, actor, 'dist_mark_posted', { p_dist_id: distId, p_external_url: chk.url })
}

// ---- [release] preflight ---------------------------------------------------
// Read fresh when the button is pressed (not at page load), so the confirmation
// shows the switches as they are NOW. Advisory only: the dispatcher re-reads
// them itself before every post.
export async function preflightRelease(
  admin: AdminLike,
  contentId: string,
): Promise<ActionResult<{ lines: string[] }>> {
  if (!UUID.test(contentId)) return fail(describeActionError('not_found'))
  const { data: c, error } = await admin
    .from('contents')
    .select('id, title, kind, source, source_ref, source_version')
    .eq('id', contentId)
    .maybeSingle()
  if (error || !c) return fail('대상을 확인할 수 없어 중단했습니다')
  const row = c as { title: string; kind: string; source: string; source_ref: string; source_version: number }
  if (isProbeRef(row.source_ref)) return fail(PROBE_BLOCK_MESSAGE)
  if (!isContentKind(row.kind)) return fail('알 수 없는 kind 입니다')

  const { data: dists } = await admin
    .from('content_distributions')
    .select('platform, status')
    .eq('content_id', contentId)
  // What will actually be queued: queued rows, plus cancelled ones [release] revives.
  const platforms = ((dists ?? []) as { platform: string; status: string }[])
    .filter((d) => d.status === 'queued' || d.status === 'cancelled')
    .map((d) => d.platform)

  const { data: prior } = await admin
    .from('contents')
    .select('id, source_version')
    .eq('source', row.source)
    .eq('source_ref', row.source_ref)
    .lt('source_version', row.source_version)
  const priorRows = (prior ?? []) as { id: string; source_version: number }[]
  const previous: PreviousVersion[] = []
  if (priorRows.length > 0) {
    const { data: pd } = await admin
      .from('content_distributions')
      .select('content_id, platform, status, external_url')
      .in('content_id', priorRows.map((p) => p.id))
    const verOf = new Map(priorRows.map((p) => [p.id, p.source_version]))
    for (const d of (pd ?? []) as { content_id: string; platform: string; status: string; external_url: string | null }[]) {
      previous.push({ version: verOf.get(d.content_id) ?? 0, platform: d.platform, status: d.status, url: d.external_url })
    }
  }

  const keys = [MASTER_DISPATCH_KEY, dispatchSwitchKey('news'), dispatchSwitchKey('entertainment'), 'content_dispatch_max_bytes_default']
  const { data: cfg, error: cfgErr } = await admin.from('platform_config').select('key, value').in('key', keys)
  let switches: DispatchSwitches | null = null
  let maxBytes: number | null = null
  if (!cfgErr && cfg) {
    const m = new Map((cfg as { key: string; value: string }[]).map((r) => [r.key, r.value]))
    switches = {
      master: isSwitchOpen(m.get(MASTER_DISPATCH_KEY)),
      news: isSwitchOpen(m.get(dispatchSwitchKey('news'))),
      entertainment: isSwitchOpen(m.get(dispatchSwitchKey('entertainment'))),
    }
    maxBytes = parsePositiveInt(m.get('content_dispatch_max_bytes_default'))
  }

  const { data: assets } = await admin
    .from('content_assets')
    .select('role, bytes')
    .eq('content_id', contentId)
    .in('role', ['main_16x9', 'main_9x16'])
  let oversize: { bytes: number; max: number } | null = null
  for (const a of (assets ?? []) as { role: string; bytes: number | string | null }[]) {
    if (maxBytes !== null && isOversize(a.bytes, maxBytes)) {
      const b = Number(a.bytes)
      if (!oversize || b > oversize.bytes) oversize = { bytes: b, max: maxBytes }
    }
  }

  return { ok: true, lines: releaseConfirmLines({ title: row.title, kind: row.kind, platforms, switches, previous, oversize }) }
}
