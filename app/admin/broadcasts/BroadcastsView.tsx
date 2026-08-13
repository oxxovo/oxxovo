'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminLang } from '@/lib/admin-i18n'
import { AdminPageHeader } from '../AdminPageHeader'
import {
  previewBroadcastRecipients,
  queueBroadcast,
  cancelBroadcast,
  type BroadcastSegment,
  type SeasonOption,
  type BroadcastCampaignRow,
} from './actions'

const SEGMENT_LABEL: Record<BroadcastSegment, { ko: string; en: string }> = {
  all: { ko: '전체 회원', en: 'All members' },
  not_selected: { ko: '미진출(예선 결과 안내 수신자)', en: "Not selected (received the 'not selected' email)" },
  founding: { ko: 'Founding Creator', en: 'Founding Creators' },
  season: { ko: '시즌별 지원자', en: 'Season applicants' },
}

const DICT = {
  ko: {
    title: '참가자 연락처 발송 콘솔',
    subtitle: '세그먼트별로 대상을 골라 캠페인을 큐잉합니다. 대상은 직접 추가/편집할 수 없습니다 — 세그먼트가 정본입니다.',
    compose_title: '새 캠페인',
    f_segment: '누구에게',
    f_season: '시즌',
    f_subject: '제목',
    f_body: '본문 (텍스트)',
    body_hint: '핵심 문구는 반드시 여기 텍스트로 — 이미지가 안 보여도 이 내용은 남습니다.',
    f_poster: '포스터 이미지 URL (R2, 선택)',
    f_video: '홍보영상 링크 (선택)',
    f_schedule: '발송 시점',
    when_now: '다음 틱에 즉시',
    when_schedule: '예약',
    next_btn: '다음: 확인',
    next_btn_busy: '대상 계산 중…',
    review_title: '보내기 전 확인',
    review_count: (n: number) => `이 캠페인은 지금 ${n}명에게 나갑니다.`,
    review_recompute: '실제 발송 시점에 동의 상태를 한 번 더 확인합니다 — 그 사이 해지한 사람은 자동으로 제외됩니다.',
    review_cancel_note: '발송 시작 후에도 취소할 수 있습니다 — 처리 중이던 다음 수신자부터 멈춥니다. 이미 발송된 메일은 되돌릴 수 없습니다.',
    preview_label: '받는 모습 미리보기',
    images_on: '이미지 표시',
    images_off: '이미지 차단(수신자 절반이 이렇게 봅니다)',
    images_blocked_placeholder: '[이미지 차단됨]',
    back_btn: '← 수정',
    confirm_btn: (n: number) => `발송 대기열에 추가 — ${n}명에게`,
    confirm_btn_busy: '큐잉 중…',
    empty_segment: '이 세그먼트에 지금 보낼 수 있는 동의된 수신자가 없습니다.',
    err_generic: '실패',
    queued_ok: (n: number) => `큐에 추가했습니다 (${n}명). broadcast-tick이 처리합니다.`,
    list_title: '캠페인',
    col_segment: '대상',
    col_subject: '제목',
    col_progress: '진행',
    col_status: '상태',
    col_actions: '',
    status_draft: '초안',
    status_queued: '대기 중',
    status_sending: '발송 중(이월)',
    status_done: '완료',
    status_failed: '실패',
    status_canceled: '취소됨',
    progress: (done: number, total: number, remaining: number) =>
      `${done}/${total} 처리됨 · ${remaining}통 남음`,
    cancel_btn: '취소',
    cancel_confirm: '이 캠페인을 취소할까요? 처리 중이던 다음 수신자부터 멈추고, 이미 나간 메일은 되돌릴 수 없습니다.',
    cancel_ok: '취소했습니다.',
  },
  en: {
    title: 'Recipient Broadcast Console',
    subtitle: 'Pick a segment and queue a campaign. Recipients cannot be added or edited by hand — the segment is the source of truth.',
    compose_title: 'New campaign',
    f_segment: 'Send to',
    f_season: 'Season',
    f_subject: 'Subject',
    f_body: 'Body (text)',
    body_hint: 'The core message must live here as text -- this survives even if images are blocked.',
    f_poster: 'Poster image URL (R2, optional)',
    f_video: 'Promo video link (optional)',
    f_schedule: 'When',
    when_now: 'ASAP, next tick',
    when_schedule: 'Schedule',
    next_btn: 'Next: Review',
    next_btn_busy: 'Counting recipients…',
    review_title: 'Review before sending',
    review_count: (n: number) => `This campaign will go to ${n} people right now.`,
    review_recompute: 'Consent is re-checked again at actual send time -- anyone who unsubscribed since is automatically excluded.',
    review_cancel_note: 'You can cancel even after sending starts -- it stops before the next recipient in the queue. Mail already sent cannot be recalled.',
    preview_label: 'Preview as received',
    images_on: 'Images shown',
    images_off: 'Images blocked (about half of recipients see it this way)',
    images_blocked_placeholder: '[image blocked]',
    back_btn: '← Edit',
    confirm_btn: (n: number) => `Queue for sending — to ${n} people`,
    confirm_btn_busy: 'Queuing…',
    empty_segment: 'No consenting recipients in this segment right now.',
    err_generic: 'Failed',
    queued_ok: (n: number) => `Queued (${n} recipients). broadcast-tick will process it.`,
    list_title: 'Campaigns',
    col_segment: 'Segment',
    col_subject: 'Subject',
    col_progress: 'Progress',
    col_status: 'Status',
    col_actions: '',
    status_draft: 'Draft',
    status_queued: 'Queued',
    status_sending: 'Sending (carrying over)',
    status_done: 'Done',
    status_failed: 'Failed',
    status_canceled: 'Canceled',
    progress: (done: number, total: number, remaining: number) =>
      `${done}/${total} processed · ${remaining} remaining`,
    cancel_btn: 'Cancel',
    cancel_confirm: 'Cancel this campaign? It stops before the next recipient in the queue -- mail already sent cannot be recalled.',
    cancel_ok: 'Canceled.',
  },
}

type Step = 'compose' | 'review'

export function BroadcastsView({
  seasons,
  initialCampaigns,
}: {
  seasons: SeasonOption[]
  initialCampaigns: BroadcastCampaignRow[]
}) {
  const lang = useAdminLang()
  const t = DICT[lang]
  const router = useRouter()

  const [segment, setSegment] = useState<BroadcastSegment>('all')
  const [seasonId, setSeasonId] = useState<string>(seasons[0]?.id ?? '')
  const [subject, setSubject] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [posterImageUrl, setPosterImageUrl] = useState('')
  const [promoVideoUrl, setPromoVideoUrl] = useState('')
  const [scheduleMode, setScheduleMode] = useState<'now' | 'schedule'>('now')
  const [scheduledAt, setScheduledAt] = useState('')

  const [step, setStep] = useState<Step>('compose')
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [imagesOn, setImagesOn] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [campaigns, setCampaigns] = useState(initialCampaigns)

  const paragraphs = bodyText.split('\n').map((l) => l.trim()).filter(Boolean)

  const handleReview = async () => {
    setMsg(null)
    if (!subject.trim() || !bodyText.trim()) {
      setMsg({ ok: false, text: t.err_generic })
      return
    }
    setBusy(true)
    try {
      const r = await previewBroadcastRecipients({
        segment,
        seasonId: segment === 'season' ? seasonId || null : null,
      })
      setPreviewCount(r.count)
      setStep('review')
    } catch (e) {
      setMsg({ ok: false, text: `${t.err_generic}: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setBusy(false)
    }
  }

  const handleQueue = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const r = await queueBroadcast({
        segment,
        seasonId: segment === 'season' ? seasonId || null : null,
        subject,
        bodyText,
        posterImageUrl: posterImageUrl || null,
        promoVideoUrl: promoVideoUrl || null,
        scheduledAt: scheduleMode === 'schedule' && scheduledAt ? new Date(scheduledAt).toISOString() : null,
      })
      if (!r.ok) {
        setMsg({ ok: false, text: `${t.err_generic}: ${r.error}` })
        return
      }
      setMsg({ ok: true, text: t.queued_ok(r.recipientCount) })
      setSubject('')
      setBodyText('')
      setPosterImageUrl('')
      setPromoVideoUrl('')
      setStep('compose')
      setPreviewCount(null)
      router.refresh()
    } catch (e) {
      setMsg({ ok: false, text: `${t.err_generic}: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setBusy(false)
    }
  }

  const handleCancel = async (id: string) => {
    if (!confirm(t.cancel_confirm)) return
    const r = await cancelBroadcast(id)
    if (r.ok) {
      setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'canceled' } : c)))
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <AdminPageHeader title={t.title} subtitle={t.subtitle} />

      {step === 'compose' ? (
        <section className="border border-white/10 rounded p-5 bg-white/[.02] mb-10">
          <h2 className="text-xs uppercase tracking-[0.2em] text-[#ff8844] font-bold mb-4">
            {t.compose_title}
          </h2>
          <div className="space-y-4">
            <Labeled label={t.f_segment}>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value as BroadcastSegment)}
                className={inputCls}
              >
                {(Object.keys(SEGMENT_LABEL) as BroadcastSegment[]).map((s) => (
                  <option key={s} value={s}>
                    {SEGMENT_LABEL[s][lang]}
                  </option>
                ))}
              </select>
            </Labeled>

            {segment === 'season' && (
              <Labeled label={t.f_season}>
                <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)} className={inputCls}>
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (#{s.season_number})
                    </option>
                  ))}
                </select>
              </Labeled>
            )}

            <Labeled label={t.f_subject}>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} />
            </Labeled>

            <Labeled label={t.f_body}>
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={6}
                className={`${inputCls} resize-y`}
              />
              <p className="mt-1 text-[11px] text-white/40">{t.body_hint}</p>
            </Labeled>

            <Labeled label={t.f_poster}>
              <input
                value={posterImageUrl}
                onChange={(e) => setPosterImageUrl(e.target.value)}
                placeholder="https://...r2.dev/....jpg"
                className={inputCls}
              />
            </Labeled>

            <Labeled label={t.f_video}>
              <input
                value={promoVideoUrl}
                onChange={(e) => setPromoVideoUrl(e.target.value)}
                placeholder="https://..."
                className={inputCls}
              />
            </Labeled>

            <Labeled label={t.f_schedule}>
              <div className="flex items-center gap-3 text-[12px]">
                <label className="flex items-center gap-1.5 text-white/60">
                  <input type="radio" checked={scheduleMode === 'now'} onChange={() => setScheduleMode('now')} />
                  {t.when_now}
                </label>
                <label className="flex items-center gap-1.5 text-white/60">
                  <input type="radio" checked={scheduleMode === 'schedule'} onChange={() => setScheduleMode('schedule')} />
                  {t.when_schedule}
                </label>
                {scheduleMode === 'schedule' && (
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="px-2 py-1 bg-[#100608] border border-white/10 rounded text-[12px] text-white"
                  />
                )}
              </div>
            </Labeled>

            {msg && !msg.ok && <p className="text-[12px] text-[#ff8888]">{msg.text}</p>}

            <button
              type="button"
              onClick={handleReview}
              disabled={busy || !subject.trim() || !bodyText.trim()}
              className="px-4 py-2.5 rounded bg-[#ff4444]/80 text-white text-xs font-bold uppercase tracking-wider hover:bg-[#ff4444] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? t.next_btn_busy : t.next_btn}
            </button>
          </div>
        </section>
      ) : (
        <section className="border border-[#ff8844]/40 rounded p-5 bg-[#ff8844]/[.04] mb-10">
          <h2 className="text-xs uppercase tracking-[0.2em] text-[#ff8844] font-bold mb-4">
            {t.review_title}
          </h2>

          <p className="text-lg font-bold text-white mb-1">
            {previewCount === 0 ? t.empty_segment : t.review_count(previewCount ?? 0)}
          </p>
          <p className="text-[12px] text-white/50 mb-1">{t.review_recompute}</p>
          <p className="text-[12px] text-[#ffb488] mb-5">{t.review_cancel_note}</p>

          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-wider text-white/40">{t.preview_label}</span>
              <label className="flex items-center gap-1.5 text-[11px] text-white/50">
                <input type="checkbox" checked={imagesOn} onChange={(e) => setImagesOn(e.target.checked)} />
                {imagesOn ? t.images_on : t.images_off}
              </label>
            </div>

            {/* Approximation of lib/email/templates/AdminBroadcast.tsx -- same
                content, rendered plainly to prove the copy survives with
                images off. */}
            <div className="bg-white text-[#1a1a1f] rounded-lg overflow-hidden max-w-md">
              <div className="px-6 pt-6 pb-2 border-b border-[#ececef]">
                <span className="text-[10px] tracking-[0.3em] text-[#8b22ff] font-bold">OXXOVO</span>
              </div>
              <div className="px-6 py-6">
                <h3 className="text-[20px] font-extrabold text-[#0a0608] mb-3">{subject || '(subject)'}</h3>
                {paragraphs.length === 0 && <p className="text-[13px] text-[#999]">(body)</p>}
                {paragraphs.map((line, i) => (
                  <p key={i} className="text-[14px] leading-relaxed mb-3">
                    {line}
                  </p>
                ))}
                {posterImageUrl && (
                  imagesOn ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={posterImageUrl} alt="" className="w-full rounded mb-3" />
                  ) : (
                    <div className="w-full aspect-video rounded mb-3 bg-[#f0f0f2] border border-dashed border-[#ccc] grid place-items-center text-[11px] text-[#999]">
                      {t.images_blocked_placeholder}
                    </div>
                  )
                )}
                {promoVideoUrl && (
                  <p className="text-[13px] font-bold text-[#8b22ff]">
                    {lang === 'ko' ? '영상 보기 →' : 'Watch the video →'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {msg && !msg.ok && <p className="mb-3 text-[12px] text-[#ff8888]">{msg.text}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep('compose')}
              className="px-4 py-2.5 rounded border border-white/15 text-white/70 text-xs font-bold uppercase tracking-wider hover:text-white transition"
            >
              {t.back_btn}
            </button>
            <button
              type="button"
              onClick={handleQueue}
              disabled={busy || !previewCount}
              className="px-4 py-2.5 rounded bg-[#ff4444]/80 text-white text-xs font-bold uppercase tracking-wider hover:bg-[#ff4444] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? t.confirm_btn_busy : t.confirm_btn(previewCount ?? 0)}
            </button>
          </div>
        </section>
      )}

      {msg?.ok && <p className="mb-6 text-[12px] text-emerald-300">{msg.text}</p>}

      <section>
        <h2 className="text-xs uppercase tracking-[0.2em] text-[#ff8844] font-bold mb-3">{t.list_title}</h2>
        {campaigns.length === 0 ? (
          <p className="text-white/40 text-xs">—</p>
        ) : (
          <div className="space-y-2">
            {campaigns.map((c) => {
              const done = c.sent_count + c.skipped_count + c.failed_count
              const remaining = Math.max(0, c.recipient_count - done)
              return (
                <div
                  key={c.id}
                  className="border border-white/10 rounded px-4 py-3 bg-white/[.02] flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white/90 truncate">{c.subject}</div>
                    <div className="mt-0.5 text-[11px] text-white/40">
                      {SEGMENT_LABEL[c.segment as BroadcastSegment]?.[lang] ?? c.segment} ·{' '}
                      {t.progress(done, c.recipient_count, remaining)}
                    </div>
                  </div>
                  <StatusBadge status={c.status} t={t} />
                  {(c.status === 'queued' || c.status === 'sending') && (
                    <button
                      type="button"
                      onClick={() => handleCancel(c.id)}
                      className="shrink-0 text-[11px] text-white/40 hover:text-[#ff8888] transition"
                    >
                      {t.cancel_btn}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function StatusBadge({ status, t }: { status: string; t: (typeof DICT)['en'] }) {
  const label =
    status === 'draft' ? t.status_draft
    : status === 'queued' ? t.status_queued
    : status === 'sending' ? t.status_sending
    : status === 'done' ? t.status_done
    : status === 'failed' ? t.status_failed
    : status === 'canceled' ? t.status_canceled
    : status

  const cls =
    status === 'sending' ? 'bg-[#ff8844]/15 text-[#ff8844]'
    : status === 'done' ? 'bg-emerald-500/15 text-emerald-300'
    : status === 'canceled' ? 'bg-white/10 text-white/40'
    : status === 'failed' ? 'bg-red-500/15 text-red-300'
    : 'bg-white/5 text-white/50'

  return (
    <span className={`shrink-0 text-[10px] uppercase tracking-wider px-2 py-1 rounded ${cls}`}>{label}</span>
  )
}

const inputCls =
  'w-full px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none'

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{label}</div>
      {children}
    </div>
  )
}
