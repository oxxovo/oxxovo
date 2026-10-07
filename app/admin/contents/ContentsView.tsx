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
  isProbeRef,
  isRightsWaiting,
  remainingLabel,
  type DbaFilter,
  type DispatchSwitches,
  type StatusFilter,
} from '@/lib/content-admin'
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

const STATUS_TEXT: Record<string, string> = { scheduled: '예약', held: '정지', returned: '반송', hidden: '숨김' }
const DIST_TEXT: Record<string, string> = {
  queued: '대기', sending: '송출 중', posted: '송출됨', failed: '실패', unknown: '⚠️ 확인 필요',
  cancelled: '취소', skipped_no_asset: '건너뜀(에셋 없음)', skipped_oversize: '건너뜀(용량 초과)',
}

function heldReasonText(c: ContentRow): string | null {
  if (c.status !== 'held') return null
  const calc = isRightsWaiting({ status: c.status, rights_status: c.rightsStatus, held_reason: c.heldReason })
    ? `권리 미확정(${c.rightsStatus})`
    : null
  const stored = c.heldReason === 'late_for_slot' ? '슬롯을 놓침' : c.heldReason === 'manual' ? '수동 정지' : c.heldReason
  // Both on purpose (design SS8): the computed reason and the stored one can differ.
  return [calc && `계산: ${calc}`, stored && `저장: ${stored}`].filter(Boolean).join(' / ') || '사유 없음(버전 2 이상 등)'
}

const pill = 'px-2.5 py-1 rounded text-xs border transition'
const btn = `${pill} border-white/15 text-white/80 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed`

export function ContentsView(p: Props) {
  const { banner } = p
  return (
    <div className="p-8">
      <AdminPageHeader title="콘텐츠 송출" subtitle="수입된 콘텐츠의 상태·송출 대기열을 관리합니다. [송출]은 대기열에 넣는 버튼이며, 실제 게시는 5분 크론이 합니다." />
      <div className="space-y-5">
        {(banner.configUnreadable || banner.missingRequired.length > 0) && (
          <div role="alert" className="border border-[#ff4444]/60 bg-[#ff4444]/10 rounded p-3 text-sm text-[#ff8888]">
            <b>송출 설정 없음 — 지금은 아무것도 송출되지 않습니다.</b>{' '}
            {banner.configUnreadable
              ? '설정을 읽지 못했습니다.'
              : `없는 키: ${banner.missingRequired.join(', ')}`}
          </div>
        )}
        {banner.missingRetry.length > 0 && !banner.configUnreadable && (
          <div className="border border-[#ff8844]/40 bg-[#ff8844]/5 rounded p-3 text-xs text-[#ffaa66]">
            재시도 설정이 없어 실패한 송출은 자동 재시도 없이 바로 &quot;조치 필요&quot;가 됩니다 ({banner.missingRetry.join(', ')}).
          </div>
        )}
        <SwitchLine s={banner.switches} />

        <div className="space-y-2">
          <FilterRow label="DBA">
            {(['all', 'entertainment', 'news'] as const).map((v) => (
              <Chip key={v} href={p.links.dba[v]} active={p.filters.dba === v}>
                {v === 'all' ? '전체' : DBA_LABEL[v]}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="상태">
            {(Object.keys(STATUS_FILTER_LABEL) as StatusFilter[]).map((v) => (
              <Chip key={v} href={p.links.status[v]} active={p.filters.status === v}>
                {STATUS_FILTER_LABEL[v]}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="kind">
            {Object.keys(p.links.kind).map((v) => (
              <Chip key={v} href={p.links.kind[v]} active={p.filters.kind === v}>
                {v === 'all' ? '전체' : v}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="시험 행">
            <Chip href={p.links.probeToggle} active={p.filters.showProbe}>
              {p.filters.showProbe ? 'probe- 행 보는 중 (끄기)' : 'probe- 행 숨김 (보기)'}
            </Chip>
            {p.filters.showProbe && <span className="text-xs text-white/40">시험 행은 [송출]·[다시 보냄]이 막혀 있습니다.</span>}
          </FilterRow>
        </div>

        {p.loadError && (
          <div role="alert" className="border border-[#ff4444]/60 bg-[#ff4444]/10 rounded p-3 text-sm text-[#ff8888]">
            목록을 불러오지 못했습니다: {p.loadError}
          </div>
        )}
        {p.truncated && (
          <div className="text-xs text-[#ffaa66]">최근 {p.limit}건까지만 읽었습니다. 필터를 좁히세요.</div>
        )}
        {!p.loadError && p.rows.length === 0 && <div className="text-sm text-white/40 py-10 text-center">해당하는 콘텐츠가 없습니다.</div>}

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
  if (!s) return <div className="text-xs text-[#ffaa66]">송출 스위치 상태를 읽지 못했습니다.</div>
  const f = (on: boolean) => (on ? <b className="text-[#66dd88]">열림</b> : <b className="text-[#ff8888]">닫힘</b>)
  return (
    <div className="text-xs text-white/60">
      송출 스위치 — 마스터 {f(s.master)} · 엔터 {f(s.entertainment)} · 데일리 {f(s.news)}
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
    const r = window.prompt('반송 사유를 입력하세요 (필수, 2000자 이하)')
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
          <div className="w-48 h-28 rounded bg-white/5 text-white/30 text-xs flex items-center justify-center shrink-0">영상 없음</div>
        )}
        <div className="flex-1 min-w-[16rem] space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-white">{c.title}</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-white/10">{STATUS_TEXT[c.status] ?? c.status}</span>
            <span className="text-[11px] text-white/50">{c.kind} · {DBA_LABEL[c.dba]} · v{c.version}</span>
            {probe && <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#ff8844]/20 text-[#ffaa66]">시험 행</span>}
          </div>
          <div className="text-[11px] text-white/40 break-all">{c.sourceRef}</div>
          <div className="text-xs text-white/70">
            송출 예정 {new Date(c.publishAt).toLocaleString('ko-KR')} ({remainingLabel(c.publishAt, new Date(nowIso))})
          </div>
          {c.rightsStatus !== 'cleared' && (
            <div className="text-xs text-[#ffaa66]">권리 {c.rightsStatus}{c.rightsReason ? ` — ${c.rightsReason}` : ''}</div>
          )}
          {reason && <div className="text-xs text-[#ffaa66]">정지 사유 — {reason}</div>}
          {c.returnedReason && c.status === 'returned' && <div className="text-xs text-[#ff8888]">반송 사유 — {c.returnedReason}</div>}
          {(c.status === 'returned' || c.status === 'hidden') && postedDists.length > 0 && (
            <div className="text-xs text-[#ff8888]">이미 송출됨 — 각 플랫폼에서 직접 삭제해야 합니다.</div>
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
        <div className="text-xs text-white/40">송출 채널 없음 (사이트 전용)</div>
      )}

      {editing === 'meta' && <MetaEditor c={c} busy={busy} go={go} onClose={() => setEditing(null)} />}
      {editing === 'time' && <TimeEditor c={c} busy={busy} go={go} onClose={() => setEditing(null)} />}

      <div className="flex items-center gap-2 flex-wrap">
        {c.status === 'scheduled' && (
          <>
            <button className={btn} disabled={busy} onClick={() => go(() => holdContentAction(c.id))}>정지</button>
            <button className={btn} disabled={busy} onClick={() => go(() => hideContentAction(c.id))}>숨김</button>
            <button className={btn} disabled={busy} onClick={onReturn}>반송</button>
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
              송출
            </button>
            <button className={btn} disabled={busy} onClick={onReturn}>반송</button>
          </>
        )}
        {c.status === 'returned' && (
          <button className={btn} disabled={busy} onClick={() => go(() => holdContentAction(c.id))} title="오반송 복구 — 정지 상태로 돌아갑니다">
            정지로 복구
          </button>
        )}
        {c.status === 'hidden' && (
          <>
            <button className={btn} disabled={busy} onClick={() => go(() => unhideContentAction(c.id))}>되살리기</button>
            <button className={btn} disabled={busy} onClick={onReturn}>반송</button>
          </>
        )}
        <button className={btn} disabled={busy} onClick={() => setEditing(editing === 'meta' ? null : 'meta')}>메타 수정</button>
        {(c.status === 'scheduled' || c.status === 'held') && (
          <button className={btn} disabled={busy} onClick={() => setEditing(editing === 'time' ? null : 'time')}>송출 시각 수정</button>
        )}
        {probe && c.status === 'held' && <span className="text-xs text-[#ffaa66]">{PROBE_BLOCK_MESSAGE}</span>}
        {c.status === 'held' && !probe && c.oversizeBytes !== null && (
          <span className="text-xs text-[#ffaa66]">영상 {formatMB(c.oversizeBytes)} — 송출 상한 초과, 송출에서 실패합니다</span>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-[#ff8888]">{error}</p>}

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-[#100608] border border-[#ff4444]/40 rounded p-5 max-w-md w-full space-y-3">
            <div className="text-sm font-bold text-white">송출 대기열에 넣기</div>
            <div className="text-sm text-white/80 space-y-1.5">
              {modal.map((l, i) => (
                <p key={i}>{l}</p>
              ))}
            </div>
            {switches === null && <p className="text-xs text-[#ffaa66]">스위치 상태를 읽지 못했습니다.</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button className={btn} disabled={busy} onClick={() => setModal(null)}>취소</button>
              <button
                className={`${btn} border-[#ff4444]/60 text-[#ff8888]`}
                disabled={busy}
                onClick={async () => {
                  await go(() => releaseContentAction(c.id))
                  setModal(null) // a failure shows under the card
                }}
              >
                대기열에 넣기
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
        {DIST_TEXT[d.status] ?? d.status}
      </span>
      {d.attempts > 0 && <span className="text-white/40">시도 {d.attempts}</span>}
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
            const url = window.prompt(
              `${d.platform}에 올라간 것을 직접 확인하셨습니까?\n게시물 URL을 입력하세요${needsUrl ? ' (이 채널은 필수)' : ' (비워도 됩니다)'}.`,
              '',
            )
            if (url === null) return
            await go(() => markDistPostedAction(d.id, url))
          }}
        >
          나갔음
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
                ? `${d.platform}: 이미 올라갔는지 모르는 상태입니다. SNS를 먼저 확인하셨습니까? 올라가 있으면 중복 게시됩니다. 다시 보낼까요?`
                : `${d.platform}: 다시 보냅니다. 계속할까요?`
            if (!window.confirm(msg)) return
            await go(() => requeueDistAction(d.id))
          }}
        >
          다시 보냄
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
      <label className="block text-[11px] text-white/50">제목<input className={input} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="block text-[11px] text-white/50">설명<textarea className={input} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <label className="block text-[11px] text-white/50">캡션 (SNS에 나가는 문구)<textarea className={input} rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} /></label>
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
          저장
        </button>
        <button className={btn} onClick={onClose}>닫기</button>
      </div>
    </div>
  )
}

function TimeEditor({ c, busy, go, onClose }: { c: ContentRow; busy: boolean; go: Go; onClose: () => void }) {
  const [v, setV] = useState('')
  return (
    <div className="border border-white/10 rounded p-3 space-y-2">
      <label className="block text-[11px] text-white/50">
        새 송출 시각 (이 브라우저의 현지 시각 기준 · 현재+최소 리드 시간 이후여야 합니다)
        <input type="datetime-local" className="block mt-1 bg-black/40 border border-white/15 rounded px-2 py-1.5 text-sm" value={v} onChange={(e) => setV(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <button
          className={btn}
          disabled={busy || v === ''}
          onClick={async () => {
            if (await go(() => setContentPublishAtAction(c.id, new Date(v).toISOString()))) onClose()
          }}
        >
          저장
        </button>
        <button className={btn} onClick={onClose}>닫기</button>
      </div>
    </div>
  )
}
