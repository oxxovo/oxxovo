'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useActionError } from '@/lib/use-action-error'
import { AdminPageHeader } from '../AdminPageHeader'
import {
  DBA_LABEL,
  PROBE_BLOCK_MESSAGE,
  STATUS_FILTER_LABEL,
  formatMB,
  formatPT,
  isProbeRef,
  isRightsWaiting,
  ptWallToIso,
  remainingLabel,
  type DbaFilter,
  type DispatchSwitches,
  type StatusFilter,
} from '@/lib/content-admin'
import {
  BUTTON_TEXT,
  CONTENT_STATUS_TEXT,
  DIST_STATUS_TEXT,
  HELD_REASON_TEXT,
  SCREEN_TEXT,
} from '@/lib/content-admin-text'
import type { ContentKind, Dba } from '@/lib/content-kinds'
import {
  holdContentAction,
  hideContentAction,
  unhideContentAction,
  releaseContentAction,
  returnContentAction,
  updateContentMetaAction,
  setContentPublishAtAction,
  requeueDistAction,
  markDistPostedAction,
  preflightReleaseAction,
} from './actions'

export type DistRow = {
  id: string
  platform: string
  status: string
  attempts: number
  lastError: string | null
  externalUrl: string | null
  publishedAt: string | null
}

export type ContentRow = {
  id: string
  kind: string
  dba: Dba
  sourceRef: string
  version: number
  title: string
  description: string | null
  caption: string | null
  rightsStatus: string
  rightsReason: string | null
  status: string
  heldReason: string | null
  publishAt: string
  returnedReason: string | null
  videoUrl: string | null
  posterUrl: string | null
  oversizeBytes: number | null
  dists: DistRow[]
}

type Props = {
  rows: ContentRow[]
  nowIso: string
  filters: { dba: DbaFilter; kind: ContentKind | 'all'; status: StatusFilter; showProbe: boolean }
  links: { dba: Record<string, string>; status: Record<string, string>; kind: Record<string, string>; probeToggle: string }
  banner: {
    configUnreadable: boolean
    missingRequired: string[]
    missingRetry: string[]
    switches: DispatchSwitches | null
  }
  loadError: string | null
  limit: number
  truncated: boolean
}

// A value the table does not know is shown raw, never hidden (a new DB status must be visible).
const statusText = (s: string) => (CONTENT_STATUS_TEXT as Record<string, string>)[s] ?? s
const distText = (s: string) => (DIST_STATUS_TEXT as Record<string, string>)[s] ?? s

function heldReasonText(c: ContentRow): string | null {
  if (c.status !== 'held') return null
  const calc = isRightsWaiting({ status: c.status, rights_status: c.rightsStatus, held_reason: c.heldReason })
    ? HELD_REASON_TEXT.rightsNotCleared(c.rightsStatus)
    : null
  const stored =
    c.heldReason === 'late_for_slot'
      ? HELD_REASON_TEXT.late_for_slot
      : c.heldReason === 'manual'
        ? HELD_REASON_TEXT.manual
        : c.heldReason
  // Both on purpose (design SS8): the computed reason and the stored one can differ.
  return (
    [calc && HELD_REASON_TEXT.computed(calc), stored && HELD_REASON_TEXT.stored(stored)].filter(Boolean).join(' / ') ||
    HELD_REASON_TEXT.none
  )
}

const pill = 'px-2.5 py-1 rounded text-xs border transition'
const btn = `${pill} border-white/15 text-white/80 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed`

export function ContentsView(p: Props) {
  const { banner } = p
  return (
    <div className="p-8">
      <AdminPageHeader title={SCREEN_TEXT.title} subtitle={SCREEN_TEXT.subtitle} />
      <div className="space-y-5">
        {(banner.configUnreadable || banner.missingRequired.length > 0) && (
          <div role="alert" className="border border-[#ff4444]/60 bg-[#ff4444]/10 rounded p-3 text-sm text-[#ff8888]">
            <b>{SCREEN_TEXT.noConfigTitle}</b>{' '}
            {banner.configUnreadable
              ? SCREEN_TEXT.configUnreadable
              : SCREEN_TEXT.missingKeys(banner.missingRequired.join(', '))}
          </div>
        )}
        {banner.missingRetry.length > 0 && !banner.configUnreadable && (
          <div className="border border-[#ff8844]/40 bg-[#ff8844]/5 rounded p-3 text-xs text-[#ffaa66]">
            {SCREEN_TEXT.noRetryConfig(banner.missingRetry.join(', '))}
          </div>
        )}
        <SwitchLine s={banner.switches} />

        <div className="space-y-2">
          <FilterRow label={SCREEN_TEXT.filterDba}>
            {(['all', 'entertainment', 'news'] as const).map((v) => (
              <Chip key={v} href={p.links.dba[v]} active={p.filters.dba === v}>
                {v === 'all' ? STATUS_FILTER_LABEL.all : DBA_LABEL[v]}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label={SCREEN_TEXT.filterStatus}>
            {(Object.keys(STATUS_FILTER_LABEL) as StatusFilter[]).map((v) => (
              <Chip key={v} href={p.links.status[v]} active={p.filters.status === v}>
                {STATUS_FILTER_LABEL[v]}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label={SCREEN_TEXT.filterKind}>
            {Object.keys(p.links.kind).map((v) => (
              <Chip key={v} href={p.links.kind[v]} active={p.filters.kind === v}>
                {v === 'all' ? STATUS_FILTER_LABEL.all : v}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label={SCREEN_TEXT.filterTestRows}>
            <Chip href={p.links.probeToggle} active={p.filters.showProbe}>
              {p.filters.showProbe ? SCREEN_TEXT.probeShown : SCREEN_TEXT.probeHidden}
            </Chip>
            {p.filters.showProbe && <span className="text-xs text-white/40">{SCREEN_TEXT.probeNote}</span>}
          </FilterRow>
        </div>

        {p.loadError && (
          <div role="alert" className="border border-[#ff4444]/60 bg-[#ff4444]/10 rounded p-3 text-sm text-[#ff8888]">
            {SCREEN_TEXT.loadFailed(p.loadError)}
          </div>
        )}
        {p.truncated && <div className="text-xs text-[#ffaa66]">{SCREEN_TEXT.truncated(p.limit)}</div>}
        {!p.loadError && p.rows.length === 0 && (
          <div className="text-sm text-white/40 py-10 text-center">{SCREEN_TEXT.empty}</div>
        )}

        <div className="space-y-4">
          {p.rows.map((c) => (
            <Card key={c.id} c={c} nowIso={p.nowIso} switches={banner.switches} />
          ))}
        </div>
      </div>
    </div>
  )
}

function SwitchLine({ s }: { s: DispatchSwitches | null }) {
  if (!s) return <div className="text-xs text-[#ffaa66]">{SCREEN_TEXT.switchesUnreadable}</div>
  const f = (on: boolean) =>
    on ? <b className="text-[#66dd88]">{SCREEN_TEXT.open}</b> : <b className="text-[#ff8888]">{SCREEN_TEXT.closed}</b>
  return (
    <div className="text-xs text-white/60">
      {SCREEN_TEXT.switchLine} — {SCREEN_TEXT.master} {f(s.master)} · {DBA_LABEL.entertainment} {f(s.entertainment)} ·{' '}
      {DBA_LABEL.news} {f(s.news)}
    </div>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="w-14 shrink-0 text-[11px] text-white/40">{label}</span>
      {children}
    </div>
  )
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`${pill} ${active ? 'bg-[#ff4444]/20 border-[#ff4444]/50 text-white font-bold' : 'border-white/10 text-white/60 hover:text-white'}`}
    >
      {children}
    </Link>
  )
}

function Card({ c, nowIso, switches }: { c: ContentRow; nowIso: string; switches: DispatchSwitches | null }) {
  const router = useRouter()
  const { error, run, clear } = useActionError()
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState<string[] | null>(null)
  const [editing, setEditing] = useState<'meta' | 'time' | null>(null)
  const probe = isProbeRef(c.sourceRef)
  const reason = heldReasonText(c)
  const postedDists = c.dists.filter((d) => d.status === 'posted')

  async function go<T extends { ok: boolean; error?: string }>(fn: () => Promise<T>): Promise<boolean> {
    setBusy(true)
    const res = await run(fn)
    setBusy(false)
    if (res) router.refresh()
    return !!res
  }

  async function onRelease() {
    clear()
    setBusy(true)
    const res = await run(() => preflightReleaseAction(c.id))
    setBusy(false)
    if (res) setModal(res.lines)
  }

  async function onReturn() {
    const r = window.prompt(SCREEN_TEXT.returnPrompt)
    if (r === null) return
    await go(() => returnContentAction(c.id, r))
  }

  return (
    <div className={`border rounded p-4 space-y-3 ${probe ? 'border-white/10 bg-white/[.02]' : 'border-[#ff4444]/15 bg-[#100608]'}`}>
      <div className="flex flex-wrap items-start gap-4">
        {c.videoUrl ? (
          <video
            src={c.videoUrl}
            poster={c.posterUrl ?? undefined}
            controls
            preload="none"
            className="w-48 max-h-44 rounded bg-black shrink-0"
          />
        ) : (
          <div className="w-48 h-28 rounded bg-white/5 text-white/30 text-xs flex items-center justify-center shrink-0">{SCREEN_TEXT.noVideo}</div>
        )}
        <div className="flex-1 min-w-[16rem] space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-white">{c.title}</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-white/10">{statusText(c.status)}</span>
            <span className="text-[11px] text-white/50">{c.kind} · {DBA_LABEL[c.dba]} · v{c.version}</span>
            {probe && <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#ff8844]/20 text-[#ffaa66]">{SCREEN_TEXT.testRow}</span>}
          </div>
          <div className="text-[11px] text-white/40 break-all">{c.sourceRef}</div>
          <div className="text-xs text-white/70">
            {SCREEN_TEXT.dispatchScheduled(formatPT(c.publishAt), remainingLabel(c.publishAt, new Date(nowIso)))}
          </div>
          {c.rightsStatus !== 'cleared' && (
            <div className="text-xs text-[#ffaa66]">{SCREEN_TEXT.rights(c.rightsStatus, c.rightsReason)}</div>
          )}
          {reason && <div className="text-xs text-[#ffaa66]">{SCREEN_TEXT.holdReason(reason)}</div>}
          {c.returnedReason && c.status === 'returned' && (
            <div className="text-xs text-[#ff8888]">{SCREEN_TEXT.returnReason(c.returnedReason)}</div>
          )}
          {(c.status === 'returned' || c.status === 'hidden') && postedDists.length > 0 && (
            <div className="text-xs text-[#ff8888]">{SCREEN_TEXT.alreadyDispatched}</div>
          )}
        </div>
      </div>

      {c.dists.length > 0 ? (
        <ul className="space-y-1.5">
          {c.dists.map((d) => (
            <DistLine key={d.id} d={d} probe={probe} busy={busy} go={go} />
          ))}
        </ul>
      ) : (
        <div className="text-xs text-white/40">{SCREEN_TEXT.noChannels}</div>
      )}

      {editing === 'meta' && <MetaEditor c={c} busy={busy} go={go} onClose={() => setEditing(null)} />}
      {editing === 'time' && <TimeEditor c={c} busy={busy} go={go} onClose={() => setEditing(null)} />}

      <div className="flex items-center gap-2 flex-wrap">
        {c.status === 'scheduled' && (
          <>
            <button className={btn} disabled={busy} onClick={() => go(() => holdContentAction(c.id))}>{BUTTON_TEXT.hold}</button>
            <button className={btn} disabled={busy} onClick={() => go(() => hideContentAction(c.id))}>{BUTTON_TEXT.hide}</button>
            <button className={btn} disabled={busy} onClick={onReturn}>{BUTTON_TEXT.return}</button>
          </>
        )}
        {c.status === 'held' && (
          <>
            <button
              className={`${btn} ${probe ? '' : 'border-[#ff4444]/50 text-[#ff8888]'}`}
              disabled={busy || probe}
              title={probe ? PROBE_BLOCK_MESSAGE : undefined}
              onClick={onRelease}
            >
              {BUTTON_TEXT.dispatch}
            </button>
            <button className={btn} disabled={busy} onClick={onReturn}>{BUTTON_TEXT.return}</button>
          </>
        )}
        {c.status === 'returned' && (
          <button className={btn} disabled={busy} onClick={() => go(() => holdContentAction(c.id))} title={SCREEN_TEXT.restoreTitle}>
            {BUTTON_TEXT.restoreToHold}
          </button>
        )}
        {c.status === 'hidden' && (
          <>
            <button className={btn} disabled={busy} onClick={() => go(() => unhideContentAction(c.id))}>{BUTTON_TEXT.unhide}</button>
            <button className={btn} disabled={busy} onClick={onReturn}>{BUTTON_TEXT.return}</button>
          </>
        )}
        <button className={btn} disabled={busy} onClick={() => setEditing(editing === 'meta' ? null : 'meta')}>{BUTTON_TEXT.editMetadata}</button>
        {(c.status === 'scheduled' || c.status === 'held') && (
          <button className={btn} disabled={busy} onClick={() => setEditing(editing === 'time' ? null : 'time')}>{BUTTON_TEXT.editDispatchTime}</button>
        )}
        {probe && c.status === 'held' && <span className="text-xs text-[#ffaa66]">{PROBE_BLOCK_MESSAGE}</span>}
        {c.status === 'held' && !probe && c.oversizeBytes !== null && (
          <span className="text-xs text-[#ffaa66]">{SCREEN_TEXT.oversize(formatMB(c.oversizeBytes))}</span>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-[#ff8888]">{error}</p>}

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-[#100608] border border-[#ff4444]/40 rounded p-5 max-w-md w-full space-y-3">
            <div className="text-sm font-bold text-white">{SCREEN_TEXT.queueDialogTitle}</div>
            <div className="text-sm text-white/80 space-y-1.5">
              {modal.map((l, i) => (
                <p key={i}>{l}</p>
              ))}
            </div>
            {switches === null && <p className="text-xs text-[#ffaa66]">{SCREEN_TEXT.switchStateUnreadable}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button className={btn} disabled={busy} onClick={() => setModal(null)}>{BUTTON_TEXT.cancel}</button>
              <button
                className={`${btn} border-[#ff4444]/60 text-[#ff8888]`}
                disabled={busy}
                onClick={async () => {
                  await go(() => releaseContentAction(c.id))
                  setModal(null) // a failure shows under the card
                }}
              >
                {BUTTON_TEXT.addToQueue}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type Go = <T extends { ok: boolean; error?: string }>(fn: () => Promise<T>) => Promise<boolean>

function DistLine({ d, probe, busy, go }: { d: DistRow; probe: boolean; busy: boolean; go: Go }) {
  const canMark = d.status === 'unknown' || d.status === 'failed' || d.status.startsWith('skipped_')
  const canRequeue = d.status === 'unknown' || d.status === 'failed'
  return (
    <li className="flex items-center gap-2 flex-wrap text-xs">
      <span className="w-20 text-white/60">{d.platform}</span>
      <span className={d.status === 'unknown' || d.status === 'failed' ? 'text-[#ffaa66] font-bold' : 'text-white/80'}>
        {distText(d.status)}
      </span>
      {d.attempts > 0 && <span className="text-white/40">{SCREEN_TEXT.attempts(d.attempts)}</span>}
      {d.externalUrl && (
        <a href={d.externalUrl} target="_blank" rel="noreferrer noopener" className="text-[#ff8844] underline break-all">
          {d.externalUrl}
        </a>
      )}
      {d.lastError && <span className="text-[#ff8888] break-all">{d.lastError}</span>}
      {canMark && (
        <button
          className={btn}
          disabled={busy}
          onClick={async () => {
            const needsUrl = d.status.startsWith('skipped_')
            const url = window.prompt(SCREEN_TEXT.markDispatchedPrompt(d.platform, needsUrl), '')
            if (url === null) return
            await go(() => markDistPostedAction(d.id, url))
          }}
        >
          {BUTTON_TEXT.markDispatched}
        </button>
      )}
      {canRequeue && (
        <button
          className={btn}
          disabled={busy || probe}
          title={probe ? PROBE_BLOCK_MESSAGE : undefined}
          onClick={async () => {
            const msg =
              d.status === 'unknown'
                ? SCREEN_TEXT.redispatchUnknown(d.platform)
                : SCREEN_TEXT.redispatchFailed(d.platform)
            if (!window.confirm(msg)) return
            await go(() => requeueDistAction(d.id))
          }}
        >
          {BUTTON_TEXT.redispatch}
        </button>
      )}
    </li>
  )
}

function MetaEditor({ c, busy, go, onClose }: { c: ContentRow; busy: boolean; go: Go; onClose: () => void }) {
  const [title, setTitle] = useState(c.title)
  const [description, setDescription] = useState(c.description ?? '')
  const [caption, setCaption] = useState(c.caption ?? '')
  const input = 'w-full bg-black/40 border border-white/15 rounded px-2 py-1.5 text-sm'
  return (
    <div className="border border-white/10 rounded p-3 space-y-2">
      <label className="block text-[11px] text-white/50">{SCREEN_TEXT.labelTitle}<input className={input} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="block text-[11px] text-white/50">{SCREEN_TEXT.labelDescription}<textarea className={input} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <label className="block text-[11px] text-white/50">{SCREEN_TEXT.labelCaption}<textarea className={input} rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} /></label>
      <div className="flex gap-2">
        <button
          className={btn}
          disabled={busy}
          onClick={async () => {
            // Only what changed: undefined = leave as is, '' = clear.
            const meta: { title?: string; description?: string; caption?: string } = {}
            if (title !== c.title) meta.title = title
            if (description !== (c.description ?? '')) meta.description = description
            if (caption !== (c.caption ?? '')) meta.caption = caption
            if (await go(() => updateContentMetaAction(c.id, meta))) onClose()
          }}
        >
          {BUTTON_TEXT.save}
        </button>
        <button className={btn} onClick={onClose}>{BUTTON_TEXT.close}</button>
      </div>
    </div>
  )
}

function TimeEditor({ c, busy, go, onClose }: { c: ContentRow; busy: boolean; go: Go; onClose: () => void }) {
  const [v, setV] = useState('')
  // The picker's value is a wall-clock time with no zone; the screen is PT, so it is read as PT.
  const iso = v === '' ? null : ptWallToIso(v)
  return (
    <div className="border border-white/10 rounded p-3 space-y-2">
      <label className="block text-[11px] text-white/50">
        {SCREEN_TEXT.labelNewDispatchTime}
        <input type="datetime-local" className="block mt-1 bg-black/40 border border-white/15 rounded px-2 py-1.5 text-sm" value={v} onChange={(e) => setV(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <button
          className={btn}
          disabled={busy || iso === null}
          onClick={async () => {
            if (iso !== null && (await go(() => setContentPublishAtAction(c.id, iso)))) onClose()
          }}
        >
          {BUTTON_TEXT.save}
        </button>
        <button className={btn} onClick={onClose}>{BUTTON_TEXT.close}</button>
      </div>
    </div>
  )
}
