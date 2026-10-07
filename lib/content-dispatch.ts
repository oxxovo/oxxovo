// The dispatch tick (design SS5-3): what one cron run does. Pure orchestration:
// the database, the clock, the mailer and Postiz are all injected, so the
// switch / guard / time-budget behaviour is tested without any of them.
//
// Order, and why it is this order:
//   1  sweep    -- zombie `sending` rows -> unknown. BEFORE the switches: an
//                  incident (switches off) must not let zombies pile up.
//   1b alert    -- unknown/failed rows nobody has been told about yet.
//   1c notify   -- import notices (held / scheduled contents). Same rule as 1b, see
//                  lib/content-notify.ts.
//   2  early exit -- master off, or no DBA open -> nothing else happens.
//                  (Without this every tick would download + upload a video and
//                  then undo it at the recheck: duplicates in the Postiz library.)
//   3  loop     -- ONE row at a time: claim, process, next. Never claim a batch:
//                  rows claimed at the start of a slow tick would age past the
//                  sweep threshold without ever being processed.
//   4  prepare  -- download, verify sha256 + size, upload to Postiz. Not a post.
//   5  recheck  -- fresh read of switches and of the content row, right before
//   6  stop     -- POST /posts. Anything closed/unreadable -> stopped_by_switch
//                  (back to queued, NOT failed: it must go out once resumed).
//   7  publish  -- one call per channel, always type:'now'.
//
// FAIL-CLOSED everywhere: unreadable config, a missing per_tick, an unexpected
// state = send nothing.
import {
  dbaOfKind,
  openKinds,
  pickAssetRole,
  type ContentKind,
  type Dba,
  type Platform,
} from '@/lib/content-kinds'
import { runContentNotices, type NotifiableContent } from '@/lib/content-notify'
import { readDispatchState, type ConfigReader } from '@/lib/dispatch-switch'
import { PostizConfigError, PostizHttpError, PostizMediaError } from '@/lib/postiz'
import type { PostizMedia, PromoChannel } from '@/lib/postiz'

// The route file declares `export const maxDuration = 300` as a literal (Next
// reads it statically, so it cannot import this). content-dispatch.test.ts
// reads the route file and fails if the two differ. Everything time-related
// below is computed from THIS number; no second figure is written anywhere.
export const DISPATCH_MAX_DURATION_SEC = 300
// A `sending` row older than maxDuration + margin cannot belong to a live tick.
export const SWEEP_MARGIN_SEC = 60
// Stop claiming this long before the function would be killed.
export const TICK_SAFETY_SEC = 30

// ★GUESSES, not measurements. Nobody has measured an R2 download + Postiz
// upload yet (no test channel exists, design SS5-7). Replace with the first
// real send's numbers; both are overridable in platform_config without a deploy.
export const DEFAULT_ITEM_BUDGET_SEC = 120

export const KEY_PER_TICK = 'content_dispatch_per_tick'
export const KEY_MAX_ATTEMPTS = 'content_dispatch_max_attempts'
export const KEY_BACKOFF_BASE = 'content_dispatch_backoff_base_minutes'
export const KEY_ITEM_BUDGET = 'content_dispatch_item_budget_seconds'
// Memory ceiling for one asset, NOT a business limit: the file is held in memory
// and copied once more into the multipart Blob (~2x). The value (100MB, set
// 2026-10-05) is unmeasured and the function's memory limit is unverified. The
// DB key is the ONLY place the number lives -- no code default (HQ 2026-10-06);
// missing/invalid = dispatch sends nothing, like per_tick.
export const KEY_MAX_BYTES = 'content_dispatch_max_bytes_default'
const CONFIG_KEYS = [KEY_PER_TICK, KEY_MAX_ATTEMPTS, KEY_BACKOFF_BASE, KEY_ITEM_BUDGET, KEY_MAX_BYTES] as const

export type ClaimedDist = {
  dist_id: string
  content_id: string
  platform: Platform
  account: string | null
  attempts: number
  kind: ContentKind
  form: string
  language: string
  title: string
  caption: string | null
}

export type DispatchAsset = {
  role: string
  url: string | null
  sha256: string | null
  bytes: number | null
}

export type ContentState = { status: string; rights_status: string; publish_at: string; kind: string }

export type AlertableDist = {
  id: string
  platform: string
  status: string
  last_error: string | null
  attempts: number
  title: string
  source_ref: string
}

export type MarkResult = 'sent' | 'failed' | 'failed_terminal' | 'unknown' | 'stopped_by_switch'
export type MarkArgs = {
  distId: string
  result: MarkResult
  httpStatus: number | null
  error: string | null
  externalId: string | null
  captionSent: string | null
  backoffBaseMinutes: number | null
}

export type DispatchDeps = {
  nowMs(): number
  readConfig: ConfigReader
  sweep(thresholdSec: number): Promise<number>
  listAlertable(): Promise<AlertableDist[]>
  markAlerted(ids: string[]): Promise<void>
  listNotifiable(): Promise<NotifiableContent[]>
  markNotified(ids: string[]): Promise<void>
  sendAlert(subject: string, html: string): Promise<boolean>
  alertDaily(key: string, subject: string, html: string): Promise<boolean>
  claimOne(kinds: ContentKind[], maxAttempts: number | null): Promise<ClaimedDist | null>
  loadAssets(contentId: string): Promise<DispatchAsset[]>
  loadContentState(contentId: string): Promise<ContentState | null>
  mark(args: MarkArgs): Promise<void>
  postiz: {
    prepare(url: string, opts: { expectedSha256?: string; maxBytes?: number }): Promise<PostizMedia>
    publish(args: { channels: PromoChannel[]; media: PostizMedia; caption: string }): Promise<{ postIds: string[] }>
  }
}

export type RowOutcome = MarkResult | 'mark_failed'

export type TickReport = {
  stage: 'unreadable' | 'master_closed' | 'no_open_dba' | 'config' | 'ran'
  swept: number
  alerted: number
  notified: number
  processed: number
  rows: { dist_id: string; outcome: RowOutcome }[]
  stopped: string | null
  warnings: string[]
}

const POS_INT = /^[1-9][0-9]{0,8}$/
const parsePosInt = (v: string | undefined): number | null => (v !== undefined && POS_INT.test(v) ? Number(v) : null)

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

function alertHtml(rows: AlertableDist[]): string {
  const items = rows
    .map(
      (r) =>
        `<li><b>${esc(r.status)}</b> ${esc(r.platform)} -- ${esc(r.title)} (${esc(r.source_ref)}) attempts=${r.attempts}` +
        `${r.last_error ? ` -- ${esc(r.last_error)}` : ''}<br>dist ${esc(r.id)}</li>`,
    )
    .join('')
  return (
    `<p>These distributions need a human. <b>unknown</b> = we do not know whether it went out: check the platform before re-sending.` +
    ` <b>failed</b> = it did not go out.</p><ul>${items}</ul>`
  )
}

export async function runDispatchTick(deps: DispatchDeps): Promise<TickReport> {
  const report: TickReport = { stage: 'ran', swept: 0, alerted: 0, notified: 0, processed: 0, rows: [], stopped: null, warnings: [] }
  const tickStart = deps.nowMs()

  // 1. sweep -- regardless of switches.
  try {
    report.swept = await deps.sweep(DISPATCH_MAX_DURATION_SEC + SWEEP_MARGIN_SEC)
  } catch (e) {
    report.warnings.push(`sweep_failed:${e instanceof Error ? e.message : String(e)}`)
  }

  // 1b. alerts -- regardless of switches. alerted_at is written only after the
  // mail was accepted, so a failed send is retried next tick.
  try {
    const pending = await deps.listAlertable()
    if (pending.length > 0) {
      const ok = await deps.sendAlert(`[OXXOVO] ${pending.length} content distribution(s) need attention`, alertHtml(pending))
      if (ok) {
        await deps.markAlerted(pending.map((p) => p.id))
        report.alerted = pending.length
      } else {
        report.warnings.push('alert_not_sent')
      }
    }
  } catch (e) {
    report.warnings.push(`alert_failed:${e instanceof Error ? e.message : String(e)}`)
  }

  // 1c. import notices -- regardless of switches; never allowed to break the tick.
  try {
    const n = await runContentNotices({ list: deps.listNotifiable, send: deps.sendAlert, mark: deps.markNotified })
    report.notified = n.marked
    report.warnings.push(...n.warnings)
  } catch (e) {
    report.warnings.push(`notify_crashed:${e instanceof Error ? e.message : String(e)}`)
  }

  // 2. early exit
  const st = await readDispatchState(deps.readConfig, CONFIG_KEYS)
  if (st.state === 'unreadable') return { ...report, stage: 'unreadable' }
  if (st.state === 'master_closed') return { ...report, stage: 'master_closed' }
  if (st.openDbas.length === 0) return { ...report, stage: 'no_open_dba' }

  const perTick = parsePosInt(st.config.get(KEY_PER_TICK))
  const maxBytes = parsePosInt(st.config.get(KEY_MAX_BYTES))
  if (perTick === null || maxBytes === null) {
    // Silent non-sending is the failure mode to avoid: say so, once a day.
    const bad = perTick === null ? KEY_PER_TICK : KEY_MAX_BYTES
    await deps
      .alertDaily(
        'content_dispatch_config',
        `[OXXOVO] content dispatch is OPEN but ${bad} is missing/invalid`,
        `<p>Dispatch switches are on, but <code>${bad}</code> is not a positive integer, so nothing is sent.</p>`,
      )
      .catch(() => false)
    return { ...report, stage: 'config', stopped: `config:${bad}` }
  }
  const optional = (key: string, fallback: number | null, name: string): number | null => {
    const raw = st.config.get(key)
    if (raw === undefined) return fallback
    const n = parsePosInt(raw)
    if (n === null) {
      report.warnings.push(`config_invalid_ignored:${name}`)
      return fallback
    }
    return n
  }
  // No max_attempts key = no retries (dist_claim treats NULL as 0).
  const maxAttempts = optional(KEY_MAX_ATTEMPTS, null, KEY_MAX_ATTEMPTS)
  const backoff = optional(KEY_BACKOFF_BASE, null, KEY_BACKOFF_BASE)
  const itemBudgetSec = optional(KEY_ITEM_BUDGET, DEFAULT_ITEM_BUDGET_SEC, KEY_ITEM_BUDGET) as number

  const kinds = openKinds(st.openDbas)
  const deadline = tickStart + (DISPATCH_MAX_DURATION_SEC - TICK_SAFETY_SEC) * 1000
  const seen = new Set<string>()

  // 3. loop
  while (report.processed < perTick) {
    if (deadline - deps.nowMs() < itemBudgetSec * 1000) {
      report.stopped = 'time_budget'
      break
    }
    let row: ClaimedDist | null
    try {
      row = await deps.claimOne(kinds, maxAttempts)
    } catch (e) {
      report.stopped = `claim_failed:${e instanceof Error ? e.message : String(e)}`
      break
    }
    if (!row) break
    // A row coming back twice in one tick means a requeue loop. Stop.
    if (seen.has(row.dist_id)) {
      report.stopped = 'row_reclaimed_in_same_tick'
      break
    }
    seen.add(row.dist_id)
    report.processed++
    const outcome = await processOne(deps, row, { maxBytes, backoff })
    report.rows.push({ dist_id: row.dist_id, outcome: outcome.result })
    if (outcome.stop) {
      report.stopped = outcome.stop
      break
    }
  }
  return report
}

type RowResult = { result: RowOutcome; stop?: string }

async function processOne(
  deps: DispatchDeps,
  row: ClaimedDist,
  cfg: { maxBytes: number; backoff: number | null },
): Promise<RowResult> {
  const caption = row.caption && row.caption.trim() !== '' ? row.caption : row.title

  const mark = async (
    result: MarkResult,
    extra: Partial<Pick<MarkArgs, 'httpStatus' | 'error' | 'externalId'>> = {},
  ): Promise<boolean> => {
    try {
      await deps.mark({
        distId: row.dist_id,
        result,
        httpStatus: extra.httpStatus ?? null,
        error: extra.error ?? null,
        externalId: extra.externalId ?? null,
        captionSent: result === 'sent' || result === 'failed' ? caption : null,
        backoffBaseMinutes: result === 'failed' ? cfg.backoff : null,
      })
      return true
    } catch (e) {
      // A row left `sending` is swept to `unknown` and alerted: loud, not lost.
      console.error('[content-dispatch] dist_mark failed', row.dist_id, e instanceof Error ? e.message : e)
      return false
    }
  }
  const finish = async (
    result: MarkResult,
    extra: Parameters<typeof mark>[1] = {},
    stop?: string,
  ): Promise<RowResult> => {
    if (!(await mark(result, extra))) return { result: 'mark_failed', stop: 'mark_failed' }
    return { result, stop }
  }

  // ---- before anything leaves the building ---------------------------------
  let media: PostizMedia
  try {
    const assets = await deps.loadAssets(row.content_id)
    const role = pickAssetRole(row.platform, assets.map((a) => a.role))
    const asset = role ? assets.find((a) => a.role === role) : undefined
    // Import already decided skipped_no_asset with the same function; reaching
    // here without an asset is an anomaly, not a normal skip.
    if (!asset) return await finish('failed_terminal', { error: 'no_asset_for_platform' })
    if (!asset.url || !asset.sha256) return await finish('failed_terminal', { error: 'asset_incomplete' })
    if (asset.bytes !== null && asset.bytes > cfg.maxBytes) {
      return await finish('failed_terminal', { error: `oversize_for_dispatch:${asset.bytes}>${cfg.maxBytes}` })
    }
    media = await deps.postiz.prepare(asset.url, { expectedSha256: asset.sha256, maxBytes: cfg.maxBytes })
  } catch (e) {
    if (e instanceof PostizMediaError) {
      // Same bytes would give the same answer: do not retry.
      if (e.code === 'hash_mismatch' || e.code === 'oversize') return await finish('failed_terminal', { error: e.code })
      return await finish('failed', { error: e.message.slice(0, 300) })
    }
    // Nothing was posted, so this is a plain retryable failure, never `unknown`.
    return await finish('failed', {
      error: (e instanceof Error ? e.message : String(e)).slice(0, 300),
      httpStatus: e instanceof PostizHttpError ? e.status : null,
    })
  }

  // ---- 5/6. recheck, fresh --------------------------------------------------
  const dba: Dba = dbaOfKind(row.kind)
  const now = await readDispatchState(deps.readConfig, [])
  if (now.state !== 'ok' || !now.openDbas.includes(dba)) {
    const why = now.state === 'ok' ? `dispatch_switch_closed:${dba}` : `dispatch_switch_${now.state}`
    return await finish('stopped_by_switch', { error: why }, 'switch_closed_at_recheck')
  }
  let cs: ContentState | null
  try {
    cs = await deps.loadContentState(row.content_id)
  } catch {
    cs = null
  }
  if (!cs) return await finish('stopped_by_switch', { error: 'content_unreadable' }, 'content_unreadable_at_recheck')
  if (cs.status !== 'scheduled' || cs.rights_status !== 'cleared' || Date.parse(cs.publish_at) > deps.nowMs()) {
    return await finish('stopped_by_switch', {
      error: `content_changed:${cs.status}/${cs.rights_status}`,
    })
  }

  // ---- 7. publish -----------------------------------------------------------
  try {
    const r = await deps.postiz.publish({ channels: [row.platform as PromoChannel], media, caption })
    const id = r.postIds[0]
    // 2xx without a usable post id: it may well have gone out. Do not guess.
    if (!id || id === 'unknown') return await finish('unknown', { error: 'empty_or_unidentified_response' })
    return await finish('sent', { externalId: id })
  } catch (e) {
    if (e instanceof PostizHttpError && e.status >= 400 && e.status < 500) {
      return await finish('failed', { error: e.message.slice(0, 300), httpStatus: e.status })
    }
    if (e instanceof PostizConfigError) {
      // Raised before any request was made.
      return await finish('failed', { error: e.message.slice(0, 300) })
    }
    // 5xx, timeout, network: the request may have been accepted.
    return await finish('unknown', {
      error: (e instanceof Error ? e.message : String(e)).slice(0, 300),
      httpStatus: e instanceof PostizHttpError ? e.status : null,
    })
  }
}
