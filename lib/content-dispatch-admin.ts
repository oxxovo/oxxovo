// Real dependencies for runDispatchTick (lib/content-dispatch.ts): Supabase RPCs
// and reads through the service role, Resend, Postiz. Kept apart from the
// orchestration so the orchestration is testable without any of them.
import 'server-only'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { adminConfigReader } from '@/lib/config-reader'
import { prepareMedia, publishPrepared } from '@/lib/postiz'
import { sendAdminAlert } from '@/lib/email/admin-alert'
import { sendAdminAlertOnceDaily } from '@/lib/admin-alert-dedup'
import { listNotifiableContents, markContentsNotified } from '@/lib/content-notify'
import type { AlertableDist, ClaimedDist, ContentState, DispatchAsset, DispatchDeps } from '@/lib/content-dispatch'

const ALERT_LIMIT = 50

export function realDispatchDeps(): DispatchDeps {
  const admin = createSupabaseAdmin()
  return {
    nowMs: () => Date.now(),
    readConfig: adminConfigReader(),

    async sweep(thresholdSec) {
      const { data, error } = await admin.rpc('dist_sweep_unknown', { p_threshold_seconds: thresholdSec })
      if (error) throw new Error(error.message)
      return Number((data as { count?: number } | null)?.count ?? 0)
    },

    async listAlertable() {
      // unknown / failed rows nobody was told about (alerted_at IS NULL). The
      // trigger clears alerted_at on every status change, so a row that moves
      // on and fails again is announced again.
      const { data, error } = await admin
        .from('content_distributions')
        .select('id, platform, status, last_error, attempts, contents(title, source_ref)')
        .in('status', ['unknown', 'failed'])
        .is('alerted_at', null)
        .order('created_at', { ascending: true })
        .limit(ALERT_LIMIT)
      if (error) throw new Error(error.message)
      return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => {
        const c = (Array.isArray(r.contents) ? r.contents[0] : r.contents) as { title?: string; source_ref?: string } | null
        return {
          id: String(r.id),
          platform: String(r.platform),
          status: String(r.status),
          last_error: (r.last_error as string | null) ?? null,
          attempts: Number(r.attempts ?? 0),
          title: c?.title ?? '(unknown)',
          source_ref: c?.source_ref ?? '(unknown)',
        } satisfies AlertableDist
      })
    },

    async markAlerted(ids) {
      if (ids.length === 0) return
      const { error } = await admin.from('content_distributions').update({ alerted_at: new Date().toISOString() }).in('id', ids)
      if (error) throw new Error(error.message)
    },

    listNotifiable: () => listNotifiableContents(admin),
    markNotified: (ids) => markContentsNotified(admin, ids),

    sendAlert: (subject, html) => sendAdminAlert(subject, html),
    alertDaily: (key, subject, html) => sendAdminAlertOnceDaily(key, subject, html),

    async claimOne(kinds, maxAttempts) {
      const { data, error } = await admin.rpc('dist_claim', {
        p_open_kinds: kinds,
        p_limit_n: 1,
        p_max_attempts: maxAttempts,
      })
      if (error) throw new Error(error.message)
      const arr = (data ?? []) as ClaimedDist[]
      return arr.length > 0 ? arr[0] : null
    },

    async loadAssets(contentId) {
      const { data, error } = await admin.from('content_assets').select('role, url, sha256, bytes').eq('content_id', contentId)
      if (error) throw new Error(error.message)
      return ((data ?? []) as Array<Record<string, unknown>>).map((a) => ({
        role: String(a.role),
        url: (a.url as string | null) ?? null,
        sha256: (a.sha256 as string | null) ?? null,
        bytes: a.bytes === null || a.bytes === undefined ? null : Number(a.bytes),
      })) satisfies DispatchAsset[]
    },

    async loadContentState(contentId) {
      const { data, error } = await admin.from('contents').select('status, rights_status, publish_at, kind').eq('id', contentId).maybeSingle()
      if (error) throw new Error(error.message)
      return (data as ContentState | null) ?? null
    },

    async mark(a) {
      const { error } = await admin.rpc('dist_mark', {
        p_dist_id: a.distId,
        p_result: a.result,
        p_http_status: a.httpStatus,
        p_error: a.error,
        p_external_id: a.externalId,
        p_caption_sent: a.captionSent,
        p_backoff_base_minutes: a.backoffBaseMinutes,
      })
      if (error) throw new Error(error.message)
    },

    postiz: {
      prepare: (url, opts) => prepareMedia(url, opts),
      publish: (args) => publishPrepared(args),
    },
  }
}
