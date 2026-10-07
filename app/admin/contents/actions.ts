'use server'

// /admin/contents server actions. Thin: the deciding logic is in
// lib/content-admin-actions.ts (injected client, tested). Every action starts
// with requireAdmin() and passes THAT admin's id + email to the RPC -- the
// audit trail (contents_history.actor) is the real person, never 'db:postgres'.
//
// [release] only moves held -> scheduled with publish_at = now(); the 5-minute
// cron posts through the same switch/DBA guards. It is not a direct post.

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import {
  holdContent,
  hideContent,
  unhideContent,
  releaseContent,
  returnContent,
  updateContentMeta,
  setContentPublishAt,
  requeueDist,
  markDistPosted,
  preflightRelease,
  type ActionResult,
  type Actor,
} from '@/lib/content-admin-actions'

async function ctx() {
  const admin = await requireAdmin()
  const actor: Actor = { id: admin.id, email: admin.email }
  return { client: createSupabaseAdmin(), actor }
}

function done<T extends ActionResult>(r: T): T {
  if (r.ok) revalidatePath('/admin/contents')
  return r
}

export async function holdContentAction(contentId: string): Promise<ActionResult> {
  const { client, actor } = await ctx()
  return done(await holdContent(client, actor, contentId))
}
export async function hideContentAction(contentId: string): Promise<ActionResult> {
  const { client, actor } = await ctx()
  return done(await hideContent(client, actor, contentId))
}
export async function unhideContentAction(contentId: string): Promise<ActionResult> {
  const { client, actor } = await ctx()
  return done(await unhideContent(client, actor, contentId))
}
export async function releaseContentAction(contentId: string): Promise<ActionResult> {
  const { client, actor } = await ctx()
  return done(await releaseContent(client, actor, contentId))
}
export async function returnContentAction(contentId: string, reason: string): Promise<ActionResult> {
  const { client, actor } = await ctx()
  return done(await returnContent(client, actor, contentId, reason))
}
export async function updateContentMetaAction(
  contentId: string,
  meta: { title?: string; description?: string; caption?: string },
): Promise<ActionResult> {
  const { client, actor } = await ctx()
  return done(await updateContentMeta(client, actor, contentId, meta))
}
export async function setContentPublishAtAction(contentId: string, publishAtIso: string): Promise<ActionResult> {
  const { client, actor } = await ctx()
  return done(await setContentPublishAt(client, actor, contentId, publishAtIso))
}
export async function requeueDistAction(distId: string): Promise<ActionResult> {
  const { client, actor } = await ctx()
  return done(await requeueDist(client, actor, distId))
}
export async function markDistPostedAction(distId: string, url: string): Promise<ActionResult> {
  const { client, actor } = await ctx()
  return done(await markDistPosted(client, actor, distId, url))
}
export async function preflightReleaseAction(contentId: string): Promise<ActionResult<{ lines: string[] }>> {
  const { client } = await ctx()
  return preflightRelease(client, contentId)
}
