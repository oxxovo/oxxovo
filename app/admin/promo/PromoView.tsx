'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminLang } from '@/lib/admin-i18n'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { AdminPageHeader } from '../AdminPageHeader'
import { PROMO_TIMEZONES, normalizePromoTime, nextPublishSlot, type PromoCadence } from '@/lib/promo-schedule'
import {
  createUploadUrlAction,
  createPromoVideoAction,
  deletePromoVideoAction,
  restorePromoVideoAction,
  permanentlyDeletePromoVideoAction,
  updatePromoMetaAction,
  setPromoApprovedAction,
  updatePromoCadenceAction,
} from './actions'

export type Cadence = PromoCadence

export type PromoRow = {
  id: string
  createdAt: string
  label: string | null
  status: string
  source: string
  videoUrl: string | null
  durationSeconds: number | null
  postizPostId: string | null
  postedChannels: string[] | null
  postedAt: string | null
  approved: boolean
  approvedAt: string | null
  caption: string
  channels: string[]
}

export type TrashRow = {
  id: string
  label: string | null
  videoUrl: string | null
  source: string
  deletedAt: string
}

export type PublishLogEntry = {
  attemptedAt: string
  triggeredBy: string
  channels: string[]
  status: string
  errorMessage: string | null
}

const BUCKET = 'promo-videos'

// 'X' alone read as a close/dismiss icon, not a channel name -- it's a single
// glyph sitting at the right edge of the row, exactly where a modal's close
// button would be (TK misread it as delete, 2026-08-12). The other three
// channels don't have this problem because their names are long enough to
// read as text on sight.
const CHANNEL_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  x: 'X (Twitter)',
}

const DICT = {
  ko: {
    title: '홍보영상',
    subtitle: '영상을 저장하고 캡션·채널을 확정한 뒤 승인하면, 수동 발행 또는 예약된 cron으로 4채널에 나갑니다.',
    upload_title: '영상 업로드',
    upload_hint: '브라우저에서 Storage로 직행 업로드(대용량 OK). mp4 / mov / webm.',
    f_label: '라벨 (식별용, 선택)',
    label_ph: '예: 시즌0 티저 A, 6/20 워밍업…',
    f_file: '영상 파일',
    upload_btn: '업로드',
    uploading: '업로드 중…',
    upload_ok: '업로드 완료',
    upload_err: '업로드 실패',
    archive_title: '아카이브 (최대 100건)',
    search_ph: '테마/라벨 검색…',
    search_btn: '검색',
    search_clear: '지우기',
    empty: '업로드된 영상이 없습니다.',
    empty_search: '검색 결과가 없습니다.',
    col_posted: '게시',
    meta_title: '캡션 · 채널',
    f_channels: '채널',
    f_caption: '캡션',
    caption_ph: '게시 문구 (채널 공통)…',
    save_btn: '저장',
    saving: '저장 중…',
    save_ok: '저장됨',
    save_err: '저장 실패',
    approve_title: '승인',
    approve_btn: '승인',
    unapprove_btn: '승인 취소',
    approved_by: (when: string) => `승인됨 (${when})`,
    not_approved: '미승인',
    publish_btn: '지금 발행',
    publishing: '발행 중…',
    publish_ok: (n: number) => `${n}개 채널 발행 요청 완료`,
    publish_err: '발행 실패',
    publish_hint_unapproved: '먼저 승인하세요',
    postiz_off: 'Postiz 미연결 — 키 주입 + 배포 후 발행이 활성됩니다.',
    delete_btn: '삭제',
    deleting: '삭제 중…',
    confirm_delete: (label: string) =>
      `'${label}' 영상을 삭제할까요?\n목록에서만 사라지고 파일은 그대로입니다 — "최근 삭제"에서 복구할 수 있습니다.`,
    posted_none: '—',
    err_no_channel: '채널을 1개 이상 선택하세요.',
    err_disabled: 'Postiz 미연결 상태입니다.',
    err_no_video: '영상 URL이 없습니다.',
    history_title: '발행 이력',
    history_none: '발행 시도 없음',
    history_manual: '수동',
    history_cron: '자동(cron)',
    history_success: '성공',
    history_failed: '실패',
    cadence_title: '발행 주기',
    cadence_hint: '요일을 1개도 안 고르면 자동 발행이 정지됩니다(별도 스위치 없음, 이게 그 스위치입니다).',
    cadence_weekdays: '요일',
    cadence_time: '시각 (HH:MM, 24시간제)',
    cadence_timezone: '시간대 (IANA, 예: Asia/Seoul)',
    cadence_save: '저장',
    cadence_saving: '저장 중…',
    cadence_saved: '저장됨',
    cadence_save_err: '저장 실패',
    cadence_paused: '지금 정지 상태 (요일 0개)',
    cadence_time_ph: '예: 6, 630, 6:30, 18',
    cadence_time_err: '시각 형식을 읽을 수 없습니다 (예: 6, 630, 6:30, 18)',
    cadence_timezone_placeholder: '선택…',
    cadence_next: (when: string) => `다음 발행은: ${when}`,
    cadence_next_none: '요일·시각·시간대를 모두 정하면 다음 발행 시각이 여기 표시됩니다.',
    weekday: { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' },
    trash_title: '최근 삭제',
    trash_deleted_at: (when: string) => `삭제됨 ${when}`,
    just_deleted: (label: string) => `삭제했습니다 · ${label}`,
    undo_btn: '되돌리기',
    restore_btn: '복구',
    restoring: '복구 중…',
    permadelete_btn: '완전 삭제',
    permadeleting: '완전 삭제 중…',
    permadelete_confirm_title: '완전 삭제 — 되돌릴 수 없습니다',
    permadelete_confirm_body_lead: '이 조작은 되돌릴 수 없습니다. 계속하려면 아래에 정확히 입력하세요: ',
    permadelete_confirm_body_tail: '',
    permadelete_confirm_input_ph: (phrase: string) => `"${phrase}" 입력`,
    permadelete_forever: '영구 삭제',
    permadelete_cancel: '취소',
    permadelete_ok_file: '완전 삭제됨 (파일도 삭제)',
    permadelete_ok_no_file: '완전 삭제됨 — 파일은 R2에 남아 있습니다(이 앱은 R2 자격증명이 없음, 별도 정리 필요)',
    permadelete_err: '완전 삭제 실패',
  },
  en: {
    title: 'Promo Videos',
    subtitle: 'Save the video, lock in caption + channels, then approve. Publishing is manual or via the scheduled cron.',
    upload_title: 'Upload video',
    upload_hint: 'Direct browser-to-Storage upload (large files OK). mp4 / mov / webm.',
    f_label: 'Label (for reference, optional)',
    label_ph: 'e.g. Season 0 teaser A, 6/20 warmup…',
    f_file: 'Video file',
    upload_btn: 'Upload',
    uploading: 'Uploading…',
    upload_ok: 'Uploaded',
    upload_err: 'Upload failed',
    archive_title: 'Archive (up to 100)',
    search_ph: 'Search theme/label…',
    search_btn: 'Search',
    search_clear: 'Clear',
    empty: 'No uploaded videos yet.',
    empty_search: 'No results.',
    col_posted: 'Posted',
    meta_title: 'Caption · Channels',
    f_channels: 'Channels',
    f_caption: 'Caption',
    caption_ph: 'Post text (shared across channels)…',
    save_btn: 'Save',
    saving: 'Saving…',
    save_ok: 'Saved',
    save_err: 'Save failed',
    approve_title: 'Approval',
    approve_btn: 'Approve',
    unapprove_btn: 'Unapprove',
    approved_by: (when: string) => `Approved (${when})`,
    not_approved: 'Not approved',
    publish_btn: 'Publish now',
    publishing: 'Publishing…',
    publish_ok: (n: number) => `Publish requested to ${n} channel(s)`,
    publish_err: 'Publish failed',
    publish_hint_unapproved: 'Approve first',
    postiz_off: 'Postiz not connected — publishing activates after key injection + deploy.',
    delete_btn: 'Delete',
    deleting: 'Deleting…',
    confirm_delete: (label: string) =>
      `Delete '${label}'?\nIt only disappears from this list -- the file is untouched, and you can restore it from "Recently deleted."`,
    posted_none: '—',
    err_no_channel: 'Select at least one channel.',
    err_disabled: 'Postiz is not connected.',
    err_no_video: 'No video URL.',
    history_title: 'Publish history',
    history_none: 'No publish attempts',
    history_manual: 'Manual',
    history_cron: 'Auto (cron)',
    history_success: 'Success',
    history_failed: 'Failed',
    cadence_title: 'Publish cadence',
    cadence_hint: 'Zero weekdays selected pauses auto-publish (no separate switch -- this is the switch).',
    cadence_weekdays: 'Weekdays',
    cadence_time: 'Time (HH:MM, 24h)',
    cadence_timezone: 'Timezone (IANA, e.g. Asia/Seoul)',
    cadence_save: 'Save',
    cadence_saving: 'Saving…',
    cadence_saved: 'Saved',
    cadence_save_err: 'Save failed',
    cadence_paused: 'Currently paused (0 weekdays)',
    cadence_time_ph: 'e.g. 6, 630, 6:30, 18',
    cadence_time_err: "Couldn't read that time (e.g. 6, 630, 6:30, 18)",
    cadence_timezone_placeholder: 'Select…',
    cadence_next: (when: string) => `Next publish: ${when}`,
    cadence_next_none: 'Pick weekdays, a time, and a timezone to see the next publish slot here.',
    weekday: { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' },
    trash_title: 'Recently deleted',
    trash_deleted_at: (when: string) => `Deleted ${when}`,
    just_deleted: (label: string) => `Deleted · ${label}`,
    undo_btn: 'Undo',
    restore_btn: 'Restore',
    restoring: 'Restoring…',
    permadelete_btn: 'Delete forever',
    permadeleting: 'Deleting forever…',
    permadelete_confirm_title: 'Delete forever — cannot be undone',
    permadelete_confirm_body_lead: 'This cannot be undone. Type exactly to continue: ',
    permadelete_confirm_body_tail: '',
    permadelete_confirm_input_ph: (phrase: string) => `Type "${phrase}"`,
    permadelete_forever: 'Delete forever',
    permadelete_cancel: 'Cancel',
    permadelete_ok_file: 'Permanently deleted (file removed too)',
    permadelete_ok_no_file: 'Permanently deleted -- the file is still on R2 (this app has no R2 credentials; needs separate cleanup)',
    permadelete_err: 'Permanent delete failed',
  },
}

type Dict = (typeof DICT)['en']

export function PromoView({
  rows,
  trashRows,
  channels,
  postizEnabled,
  publishLog,
  q,
  cadence,
}: {
  rows: PromoRow[]
  trashRows: TrashRow[]
  channels: string[]
  postizEnabled: boolean
  publishLog: Record<string, PublishLogEntry[]>
  q: string
  cadence: Cadence
}) {
  const router = useRouter()
  const lang = useAdminLang()
  const t = DICT[lang]

  // Shown right where the delete happened, not just in Trash below -- the
  // immediate undo IS the safety net (HQ 2026-08-16: "목록을 찾아가지 않아도
  // 된다"). Lives here (not in Archive/PromoCard) because the card itself
  // unmounts the moment the list refreshes post-delete.
  const [justDeleted, setJustDeleted] = useState<{ id: string; label: string } | null>(null)
  const [restoring, startRestore] = useTransition()

  const handleUndo = () => {
    if (!justDeleted) return
    const id = justDeleted.id
    startRestore(async () => {
      await restorePromoVideoAction(id)
      setJustDeleted(null)
      router.refresh()
    })
  }

  return (
    <div className="p-8 max-w-5xl">
      <AdminPageHeader title={t.title} subtitle={t.subtitle} />

      {!postizEnabled && (
        <div className="mb-6 border border-[#ff8844]/30 bg-[#ff8844]/[.06] rounded px-4 py-3 text-[12px] text-[#ffb488]">
          {t.postiz_off}
        </div>
      )}

      {justDeleted && (
        <div className="mb-6 flex items-center justify-between gap-3 border border-emerald-500/30 bg-emerald-500/[.08] rounded px-4 py-3 text-xs text-emerald-200">
          <span>{t.just_deleted(justDeleted.label)}</span>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleUndo}
              disabled={restoring}
              className="font-bold text-emerald-300 hover:underline disabled:opacity-50"
            >
              {restoring ? t.restoring : t.undo_btn}
            </button>
            <button
              type="button"
              onClick={() => setJustDeleted(null)}
              className="text-emerald-200/50 hover:text-emerald-200"
              aria-label={t.permadelete_cancel}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <Trash t={t} rows={trashRows} />

      <CadenceForm t={t} cadence={cadence} />

      <UploadForm t={t} />

      <Archive
        t={t}
        rows={rows}
        channels={channels}
        postizEnabled={postizEnabled}
        publishLog={publishLog}
        q={q}
        onDeleted={(id, label) => setJustDeleted({ id, label })}
      />
    </div>
  )
}

const WEEKDAYS: (keyof Dict['weekday'])[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

function CadenceForm({ t, cadence }: { t: Dict; cadence: Cadence }) {
  const router = useRouter()
  const [weekdays, setWeekdays] = useState<string[]>(cadence.weekdays)
  // `time` is the last VALID normalized value (starts from what's saved);
  // `timeDraft` is exactly what's in the input, including invalid partial
  // typing -- kept separate so the field doesn't fight the user mid-keystroke.
  const [time, setTime] = useState(cadence.time ?? '')
  const [timeDraft, setTimeDraft] = useState(cadence.time ?? '')
  const [timeErr, setTimeErr] = useState(false)
  const [timezone, setTimezone] = useState(cadence.timezone ?? '')
  const [pending, startPending] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const toggle = (d: string) =>
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))

  // "6" -> "06:00" etc, on blur -- the field corrects itself instead of
  // requiring the operator to type the exact HH:MM shape (HQ 2026-08-14).
  const handleTimeBlur = () => {
    if (!timeDraft.trim()) {
      setTime('')
      setTimeErr(false)
      return
    }
    const normalized = normalizePromoTime(timeDraft)
    if (normalized === null) {
      setTimeErr(true)
      return
    }
    setTime(normalized)
    setTimeDraft(normalized)
    setTimeErr(false)
  }

  // Preview reuses the exact same window/weekday logic the cron runs (see
  // lib/promo-schedule) -- never a second, hand-written approximation.
  const next = useMemo(() => {
    if (timeErr || weekdays.length === 0 || !time || !timezone) return null
    return nextPublishSlot({ weekdays, time, timezone }, new Date())
  }, [weekdays, time, timezone, timeErr])

  const saveDisabled = pending || timeErr

  const handleSave = () => {
    setMsg(null)
    if (timeErr) return
    startPending(async () => {
      const res = await updatePromoCadenceAction({ weekdays, time, timezone })
      if (!res.ok) {
        setMsg({ ok: false, text: `${t.cadence_save_err}: ${res.error}` })
        return
      }
      setMsg({ ok: true, text: t.cadence_saved })
      router.refresh()
    })
  }

  return (
    <section className="border border-white/10 rounded p-5 bg-white/[.02] mb-10 max-w-xl">
      <h2 className="text-xs uppercase tracking-[0.2em] text-[#ff8844] font-bold mb-1">{t.cadence_title}</h2>
      <p className="text-[11px] text-white/40 mb-4">{t.cadence_hint}</p>

      <div className="space-y-3">
        <Labeled label={t.cadence_weekdays}>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggle(d)}
                className={`px-2.5 py-1 rounded text-[11px] border transition ${
                  weekdays.includes(d)
                    ? 'border-[#ff8844]/60 bg-[#ff8844]/10 text-[#ffb488]'
                    : 'border-white/10 text-white/40 hover:text-white/70'
                }`}
              >
                {t.weekday[d]}
              </button>
            ))}
          </div>
        </Labeled>
        <Labeled label={t.cadence_time}>
          <input
            value={timeDraft}
            onChange={(e) => {
              setTimeDraft(e.target.value)
              setTimeErr(false)
            }}
            onBlur={handleTimeBlur}
            className={`${inputCls} ${timeErr ? 'border-[#ff4444]/60' : ''}`}
            placeholder={t.cadence_time_ph}
          />
          {timeErr && <p className="mt-1 text-[11px] text-[#ff8888]">{t.cadence_time_err}</p>}
        </Labeled>
        <Labeled label={t.cadence_timezone}>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className={inputCls}
          >
            <option value="">{t.cadence_timezone_placeholder}</option>
            {PROMO_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </Labeled>

        <p className="text-[11px] text-[#ffb488]">
          {next
            ? t.cadence_next(
                `${next.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} (${new Intl.DateTimeFormat(undefined, { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }).format(next)} ${timezone})`,
              )
            : t.cadence_next_none}
        </p>

        {weekdays.length === 0 && <p className="text-[11px] text-white/35">{t.cadence_paused}</p>}
        <button
          type="button"
          onClick={handleSave}
          disabled={saveDisabled}
          className="px-3 py-1.5 rounded border border-white/15 text-white/70 text-xs font-bold hover:border-white/35 transition disabled:opacity-40"
        >
          {pending ? t.cadence_saving : t.cadence_save}
        </button>
        {msg && <p className={`text-[11px] ${msg.ok ? 'text-emerald-300' : 'text-[#ff8888]'}`}>{msg.text}</p>}
      </div>
    </section>
  )
}

function UploadForm({ t }: { t: Dict }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function readDuration(file: File): Promise<number | undefined> {
    return new Promise((resolve) => {
      try {
        const el = document.createElement('video')
        el.preload = 'metadata'
        el.onloadedmetadata = () => {
          const d = Number.isFinite(el.duration) ? Math.round(el.duration) : undefined
          URL.revokeObjectURL(el.src)
          resolve(d)
        }
        el.onerror = () => resolve(undefined)
        el.src = URL.createObjectURL(file)
      } catch {
        resolve(undefined)
      }
    })
  }

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setBusy(true)
    setMsg(null)
    try {
      const signed = await createUploadUrlAction(file.name)
      if (!signed.ok) throw new Error(signed.error)

      const duration = await readDuration(file)

      const supabase = createSupabaseBrowser()
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file)
      if (upErr) throw new Error(upErr.message)

      const created = await createPromoVideoAction({
        path: signed.path,
        label: label.trim() || undefined,
        durationSeconds: duration,
      })
      if (!created.ok) throw new Error(created.error)

      setMsg({ ok: true, text: t.upload_ok })
      setLabel('')
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    } catch (e) {
      setMsg({ ok: false, text: `${t.upload_err}: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="border border-white/10 rounded p-5 bg-white/[.02] mb-10 max-w-xl">
      <h2 className="text-xs uppercase tracking-[0.2em] text-[#ff8844] font-bold mb-1">
        {t.upload_title}
      </h2>
      <p className="text-[11px] text-white/40 mb-4">{t.upload_hint}</p>

      <div className="space-y-3">
        <Labeled label={t.f_label}>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={inputCls}
            placeholder={t.label_ph}
          />
        </Labeled>
        <Labeled label={t.f_file}>
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            className="block w-full text-xs text-white/70 file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-[#ff4444]/20 file:text-[#ff8844] file:text-xs file:font-bold"
          />
        </Labeled>
        <button
          type="button"
          onClick={handleUpload}
          disabled={busy}
          className="w-full px-3 py-2 rounded bg-[#ff4444]/80 text-white text-xs font-bold uppercase tracking-wider hover:bg-[#ff4444] transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? t.uploading : t.upload_btn}
        </button>
        {msg && (
          <p className={`text-[11px] ${msg.ok ? 'text-emerald-300' : 'text-[#ff8888]'}`}>{msg.text}</p>
        )}
      </div>
    </section>
  )
}

function Archive({
  t,
  rows,
  channels,
  postizEnabled,
  publishLog,
  q,
  onDeleted,
}: {
  t: Dict
  rows: PromoRow[]
  channels: string[]
  postizEnabled: boolean
  publishLog: Record<string, PublishLogEntry[]>
  q: string
  onDeleted: (id: string, label: string) => void
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-xs uppercase tracking-[0.2em] text-[#ff8844] font-bold">{t.archive_title}</h2>
        <form action="/admin/promo" method="get" className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder={t.search_ph}
            className="rounded border border-white/15 bg-black/30 px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:border-[#ff8844] focus:outline-none"
          />
          <button type="submit" className="rounded border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:border-white/35">
            {t.search_btn}
          </button>
          {q && (
            <a href="/admin/promo" className="rounded border border-white/15 px-3 py-1.5 text-xs text-white/50 hover:border-white/35">
              {t.search_clear}
            </a>
          )}
        </form>
      </div>
      {rows.length === 0 ? (
        <div className="border border-white/10 rounded px-4 py-8 text-center text-white/40 text-xs">
          {q ? t.empty_search : t.empty}
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <PromoCard
              key={r.id}
              t={t}
              row={r}
              channels={channels}
              postizEnabled={postizEnabled}
              history={publishLog[r.id] ?? []}
              onDeleted={onDeleted}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function PromoCard({
  t,
  row,
  channels,
  postizEnabled,
  history,
  onDeleted,
}: {
  t: Dict
  row: PromoRow
  channels: string[]
  postizEnabled: boolean
  history: PublishLogEntry[]
  onDeleted: (id: string, label: string) => void
}) {
  const router = useRouter()
  const [deleting, startDelete] = useTransition()

  const posted =
    row.postedChannels && row.postedChannels.length > 0
      ? row.postedChannels.map((c) => CHANNEL_LABEL[c] ?? c).join(', ')
      : t.posted_none

  const handleDelete = () => {
    // Soft delete now (HQ 2026-08-16) -- names the specific video rather than
    // a generic "this one", so a reflexive OK on the browser dialog still
    // shows what it just agreed to.
    if (!confirm(t.confirm_delete(row.label || row.id))) return
    startDelete(async () => {
      await deletePromoVideoAction(row.id)
      onDeleted(row.id, row.label || row.id)
      router.refresh()
    })
  }

  return (
    <div className="border border-white/10 rounded bg-white/[.02] overflow-hidden">
      <div className="flex gap-4 p-4">
        <div className="w-40 shrink-0">
          {row.videoUrl ? (
            <video src={row.videoUrl} controls className="w-full rounded bg-black aspect-[9/16] object-contain" />
          ) : (
            <div className="w-full aspect-[9/16] rounded bg-black/40 grid place-items-center text-white/30 text-[10px]">
              no video
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-white/90 truncate">{row.label || '—'}</div>
              <div className="mt-0.5 text-[11px] text-white/40">
                {new Date(row.createdAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
                {row.durationSeconds ? ` · ${row.durationSeconds}s` : ''} · {row.source}
              </div>
            </div>
            <span className="shrink-0 text-[10px] uppercase tracking-wider bg-white/5 text-white/50 px-2 py-0.5 rounded">
              {row.status}
            </span>
          </div>

          <div className="mt-2 text-[11px] text-white/50">
            <span className="text-white/35">{t.col_posted}: </span>
            {posted}
            {row.postedAt && (
              <span className="text-white/30">
                {' '}
                ({new Date(row.postedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })})
              </span>
            )}
          </div>

          {/* One card, one flow: save meta -> approve -> publish, all here --
              scattering these across screens is what leaves TK stuck on "why
              isn't it going out" (HQ 2026-08-14). */}
          <PublishCard t={t} row={row} channels={channels} postizEnabled={postizEnabled} />

          <HistoryList t={t} history={history} />

          {/* Irreversible (Storage file is gone, and it's 지수3's rendered
              output -- redoing it means regenerating, not undoing). Was
              faint gray text sitting right under Publish, easy to misread as
              a secondary/harmless action (TK, 2026-08-12). A border + red
              tint + its own spacing separates it from the publish flow. */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="mt-4 pt-3 border-t border-white/5 text-[11px] font-bold text-[#ff8888]/70 hover:text-[#ff4444] transition disabled:opacity-40 block"
          >
            {deleting ? t.deleting : t.delete_btn}
          </button>
        </div>
      </div>
    </div>
  )
}

// HQ 2026-08-16 (moved near the top, up from below the 100-row archive --
// "93개 아래에 있어 끝까지 스크롤해야 보인다, 그건 없는 것과 비슷하다"):
// collapsed by default so it stays out of the way day to day, but the count
// sits right in the title, and the section renders nothing at all when
// empty -- 0 is the common case and must add zero visual noise.
// Restore + a genuinely irreversible permanent-delete gated behind a typed
// confirmation (DeleteSeasonButton's pattern) -- so "완전 삭제" needs two
// deliberate steps (move to trash, then type the confirm phrase here), not
// one click from the live archive.
function Trash({ t, rows }: { t: Dict; rows: TrashRow[] }) {
  const [open, setOpen] = useState(false)
  if (rows.length === 0) return null

  return (
    <section className="mb-6 border border-white/10 rounded bg-white/[.02]">
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-xs uppercase tracking-[0.2em] text-white/50 font-bold">
          {t.trash_title} ({rows.length})
        </span>
        <span className="text-white/30 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {rows.map((r) => (
            <TrashCard key={r.id} t={t} row={r} />
          ))}
        </div>
      )}
    </section>
  )
}

function TrashCard({ t, row }: { t: Dict; row: TrashRow }) {
  const router = useRouter()
  const [restoring, startRestore] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [pending, startPending] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const expected = `delete ${row.label || row.id}`
  const canDelete = confirmText.trim().toLowerCase() === expected.toLowerCase()

  const handleRestore = () => {
    startRestore(async () => {
      await restorePromoVideoAction(row.id)
      router.refresh()
    })
  }

  const handlePermaDelete = () => {
    setMsg(null)
    startPending(async () => {
      const res = await permanentlyDeletePromoVideoAction(row.id)
      if (!res.ok) {
        setMsg({ ok: false, text: `${t.permadelete_err}: ${res.error}` })
        return
      }
      setMsg({ ok: true, text: res.fileDeleted ? t.permadelete_ok_file : t.permadelete_ok_no_file })
      router.refresh()
    })
  }

  return (
    <div className="border border-white/10 rounded bg-white/[.02] overflow-hidden">
      <div className="flex gap-4 p-4">
        <div className="w-24 shrink-0">
          {row.videoUrl ? (
            <video src={row.videoUrl} muted className="w-full rounded bg-black aspect-[9/16] object-contain" />
          ) : (
            <div className="w-full aspect-[9/16] rounded bg-black/40" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{row.label || row.id}</p>
          <p className="mt-1 text-xs text-white/40">{t.trash_deleted_at(new Date(row.deletedAt).toLocaleString())}</p>

          {msg && (
            <p className={`mt-2 text-xs ${msg.ok ? 'text-emerald-300' : 'text-[#ff8888]'}`}>{msg.text}</p>
          )}

          {!confirming ? (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleRestore}
                disabled={restoring}
                className="rounded bg-emerald-500/90 px-3 py-1.5 text-xs font-bold text-black transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {restoring ? t.restoring : t.restore_btn}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="rounded border border-[#ff4444]/40 px-3 py-1.5 text-xs font-bold text-[#ff8888] hover:bg-[#ff4444]/10 transition"
              >
                {t.permadelete_btn}
              </button>
            </div>
          ) : (
            <div className="mt-3 border border-[#ff4444]/40 bg-[#ff4444]/[.06] rounded p-3">
              <p className="text-xs text-[#ff8888] font-bold mb-1">{t.permadelete_confirm_title}</p>
              <p className="text-xs text-white/60 mb-2">
                {t.permadelete_confirm_body_lead}
                <code className="px-1.5 py-0.5 bg-black/40 rounded text-[#ff8844]">{expected}</code>
                {t.permadelete_confirm_body_tail}
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={t.permadelete_confirm_input_ph(expected)}
                className="w-full px-3 py-2 mb-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePermaDelete}
                  disabled={!canDelete || pending}
                  className="px-3 py-1.5 rounded bg-[#ff4444] text-white text-xs font-bold uppercase tracking-wider hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {pending ? t.permadeleting : t.permadelete_forever}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false)
                    setConfirmText('')
                  }}
                  disabled={pending}
                  className="px-3 py-1.5 rounded border border-white/15 text-white/70 text-xs font-bold uppercase tracking-wider hover:text-white transition"
                >
                  {t.permadelete_cancel}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PublishCard({
  t,
  row,
  channels,
  postizEnabled,
}: {
  t: Dict
  row: PromoRow
  channels: string[]
  postizEnabled: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>(row.channels.length ? row.channels : [])
  const [caption, setCaption] = useState(row.caption)
  const [savePending, startSave] = useTransition()
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Optimistic: the toggle flips this immediately so the Publish button
  // enables/disables without waiting on a server round-trip (HQ 2026-08-14 --
  // "승인하면 새로고침 없이 즉시 활성"). The server action still runs and
  // router.refresh() reconciles; on failure we revert.
  const [approved, setApproved] = useState(row.approved)
  const [approvePending, startApprove] = useTransition()

  const [publishBusy, setPublishBusy] = useState(false)
  const [publishMsg, setPublishMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const toggle = (c: string) =>
    setSelected((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))

  const metaDisabled = false // caption/channels can always be edited, even pre-approval

  const handleSave = () => {
    setSaveMsg(null)
    startSave(async () => {
      const res = await updatePromoMetaAction({ id: row.id, caption, channels: selected })
      if (!res.ok) {
        setSaveMsg({ ok: false, text: `${t.save_err}: ${res.error}` })
        return
      }
      setSaveMsg({ ok: true, text: t.save_ok })
      router.refresh()
    })
  }

  const handleApproveToggle = () => {
    const next = !approved
    setApproved(next) // optimistic
    startApprove(async () => {
      const res = await setPromoApprovedAction(row.id, next)
      if (!res.ok) {
        setApproved(!next) // revert
        return
      }
      router.refresh()
    })
  }

  const publishDisabled = !postizEnabled || !row.videoUrl || !approved

  const handlePublish = async () => {
    setPublishMsg(null)
    if (!postizEnabled) return setPublishMsg({ ok: false, text: t.err_disabled })
    if (!row.videoUrl) return setPublishMsg({ ok: false, text: t.err_no_video })
    if (!approved) return setPublishMsg({ ok: false, text: t.publish_hint_unapproved })
    if (selected.length === 0) return setPublishMsg({ ok: false, text: t.err_no_channel })

    setPublishBusy(true)
    try {
      const res = await fetch('/api/admin/promo/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoVideoId: row.id }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
      setPublishMsg({ ok: true, text: t.publish_ok((j.channels ?? selected).length) })
      router.refresh()
    } catch (e) {
      setPublishMsg({ ok: false, text: `${t.publish_err}: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setPublishBusy(false)
    }
  }

  return (
    <div className="mt-3 border-t border-white/5 pt-3">
      <div className="text-[10px] uppercase tracking-wider text-[#ff8844]/80 font-bold mb-2">
        {t.meta_title}
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        {channels.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => toggle(c)}
            disabled={metaDisabled}
            className={`px-2.5 py-1 rounded text-[11px] border transition disabled:opacity-40 ${
              selected.includes(c)
                ? 'border-[#ff8844]/60 bg-[#ff8844]/10 text-[#ffb488]'
                : 'border-white/10 text-white/40 hover:text-white/70'
            }`}
          >
            {CHANNEL_LABEL[c] ?? c}
          </button>
        ))}
      </div>

      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        rows={2}
        disabled={metaDisabled}
        className={`${inputCls} resize-y mb-2 disabled:opacity-40`}
        placeholder={t.caption_ph}
      />

      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={savePending}
          className="px-3 py-1.5 rounded border border-white/15 text-white/70 text-[11px] font-bold hover:border-white/35 transition disabled:opacity-40"
        >
          {savePending ? t.saving : t.save_btn}
        </button>
        {saveMsg && (
          <span className={`text-[11px] ${saveMsg.ok ? 'text-emerald-300' : 'text-[#ff8888]'}`}>{saveMsg.text}</span>
        )}
      </div>

      {/* Approval + publish live together, on purpose (HQ 2026-08-14) -- a
          disabled Publish button always sits next to the reason it's
          disabled, not on a separate tab/page. */}
      <div className="flex items-center flex-wrap gap-3 pt-3 border-t border-white/5">
        <button
          type="button"
          onClick={handleApproveToggle}
          disabled={approvePending}
          className={`px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition disabled:opacity-40 ${
            approved
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
              : 'bg-white/5 text-white/50 border border-white/10 hover:border-white/30'
          }`}
        >
          {approved ? t.unapprove_btn : t.approve_btn}
        </button>
        <span className="text-[11px] text-white/40">
          {approved && row.approvedAt
            ? t.approved_by(new Date(row.approvedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }))
            : t.not_approved}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {!approved && <span className="text-[11px] text-[#ff8844]">{t.publish_hint_unapproved}</span>}
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishDisabled || publishBusy}
            className="px-3 py-1.5 rounded bg-[#ff4444]/80 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-[#ff4444] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {publishBusy ? t.publishing : t.publish_btn}
          </button>
        </div>
      </div>

      {publishMsg && (
        <p className={`mt-2 text-[11px] ${publishMsg.ok ? 'text-emerald-300' : 'text-[#ff8888]'}`}>{publishMsg.text}</p>
      )}
    </div>
  )
}

function HistoryList({ t, history }: { t: Dict; history: PublishLogEntry[] }) {
  if (history.length === 0) return null
  return (
    <div className="mt-3 pt-3 border-t border-white/5">
      <div className="text-[10px] uppercase tracking-wider text-white/35 font-bold mb-1.5">{t.history_title}</div>
      <ul className="space-y-1">
        {history.map((h, i) => (
          <li key={i} className="text-[11px] text-white/50 flex flex-wrap items-center gap-x-2">
            <span className="text-white/30">
              {new Date(h.attemptedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
            </span>
            <span className="text-white/40">{h.triggeredBy === 'cron' ? t.history_cron : t.history_manual}</span>
            <span className={h.status === 'success' ? 'text-emerald-300/80' : 'text-[#ff8888]/80'}>
              {h.status === 'success' ? t.history_success : t.history_failed}
            </span>
            {h.channels.length > 0 && (
              <span className="text-white/30">{h.channels.map((c) => CHANNEL_LABEL[c] ?? c).join(', ')}</span>
            )}
            {h.errorMessage && <span className="text-[#ff8888]/60 truncate max-w-[280px]">{h.errorMessage}</span>}
          </li>
        ))}
      </ul>
    </div>
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
