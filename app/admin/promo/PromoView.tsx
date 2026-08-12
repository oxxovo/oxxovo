'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminLang } from '@/lib/admin-i18n'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import {
  createUploadUrlAction,
  createPromoVideoAction,
  deletePromoVideoAction,
} from './actions'

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
    subtitle: '영상을 업로드하고 Instagram / TikTok / YouTube / X 4채널에 발행합니다. (수동 업로드 v1)',
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
    empty: '업로드된 영상이 없습니다.',
    col_when: '생성',
    col_label: '라벨',
    col_status: '상태',
    col_posted: '게시',
    col_actions: '',
    publish_title: '4채널 발행',
    f_channels: '채널',
    f_caption: '캡션',
    caption_ph: '게시 문구 (채널 공통)…',
    f_when: '시점',
    when_now: '즉시',
    when_schedule: '예약',
    publish_btn: '발행',
    publishing: '발행 중…',
    publish_ok: (n: number) => `${n}개 채널 발행 요청 완료`,
    publish_err: '발행 실패',
    postiz_off: 'Postiz 미연결 — 키 주입 + 배포 후 발행이 활성됩니다.',
    delete_btn: '삭제',
    deleting: '삭제 중…',
    confirm_delete: (label: string) =>
      `'${label}' 영상을 삭제할까요?\nStorage 파일도 함께 삭제되며, 되돌릴 수 없습니다.`,
    posted_none: '—',
    play: '재생',
    err_no_channel: '채널을 1개 이상 선택하세요.',
    err_disabled: 'Postiz 미연결 상태입니다.',
    err_no_video: '영상 URL이 없습니다.',
  },
  en: {
    title: 'Promo Videos',
    subtitle: 'Upload a video and publish to Instagram / TikTok / YouTube / X. (manual upload v1)',
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
    empty: 'No uploaded videos yet.',
    col_when: 'Created',
    col_label: 'Label',
    col_status: 'Status',
    col_posted: 'Posted',
    col_actions: '',
    publish_title: 'Publish to 4 channels',
    f_channels: 'Channels',
    f_caption: 'Caption',
    caption_ph: 'Post text (shared across channels)…',
    f_when: 'When',
    when_now: 'Now',
    when_schedule: 'Schedule',
    publish_btn: 'Publish',
    publishing: 'Publishing…',
    publish_ok: (n: number) => `Publish requested to ${n} channel(s)`,
    publish_err: 'Publish failed',
    postiz_off: 'Postiz not connected — publishing activates after key injection + deploy.',
    delete_btn: 'Delete',
    deleting: 'Deleting…',
    confirm_delete: (label: string) =>
      `Delete '${label}'?\nThe Storage file is removed too, and this cannot be undone.`,
    posted_none: '—',
    play: 'Play',
    err_no_channel: 'Select at least one channel.',
    err_disabled: 'Postiz is not connected.',
    err_no_video: 'No video URL.',
  },
}

type Dict = (typeof DICT)['en']

export function PromoView({
  rows,
  channels,
  postizEnabled,
}: {
  rows: PromoRow[]
  channels: string[]
  postizEnabled: boolean
}) {
  const lang = useAdminLang()
  const t = DICT[lang]

  return (
    <div className="p-8 max-w-5xl">
      <header className="mb-8">
        <h1 className="text-3xl font-black">{t.title}</h1>
        <p className="mt-1 text-sm text-white/50 max-w-2xl">{t.subtitle}</p>
      </header>

      {!postizEnabled && (
        <div className="mb-6 border border-[#ff8844]/30 bg-[#ff8844]/[.06] rounded px-4 py-3 text-[12px] text-[#ffb488]">
          {t.postiz_off}
        </div>
      )}

      <UploadForm t={t} />

      <Archive t={t} rows={rows} channels={channels} postizEnabled={postizEnabled} />
    </div>
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
}: {
  t: Dict
  rows: PromoRow[]
  channels: string[]
  postizEnabled: boolean
}) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-[0.2em] text-[#ff8844] font-bold mb-3">
        {t.archive_title}
      </h2>
      {rows.length === 0 ? (
        <div className="border border-white/10 rounded px-4 py-8 text-center text-white/40 text-xs">
          {t.empty}
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
}: {
  t: Dict
  row: PromoRow
  channels: string[]
  postizEnabled: boolean
}) {
  const router = useRouter()
  const [deleting, startDelete] = useTransition()

  const posted =
    row.postedChannels && row.postedChannels.length > 0
      ? row.postedChannels.map((c) => CHANNEL_LABEL[c] ?? c).join(', ')
      : t.posted_none

  const handleDelete = () => {
    // Irreversible (lib/studio-actors-adjacent output, remade by hand if lost
    // by mistake) -- names the specific video rather than a generic "this
    // one", so a reflexive OK on the browser dialog still shows what it just
    // agreed to.
    if (!confirm(t.confirm_delete(row.label || row.id))) return
    startDelete(async () => {
      await deletePromoVideoAction(row.id)
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

          <PublishPanel t={t} row={row} channels={channels} postizEnabled={postizEnabled} />

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

function PublishPanel({
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
  const [selected, setSelected] = useState<string[]>(channels)
  const [caption, setCaption] = useState('')
  const [scheduled, setScheduled] = useState(false)
  const [when, setWhen] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const toggle = (c: string) =>
    setSelected((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))

  const disabled = !postizEnabled || !row.videoUrl

  const handlePublish = async () => {
    setMsg(null)
    if (!postizEnabled) return setMsg({ ok: false, text: t.err_disabled })
    if (!row.videoUrl) return setMsg({ ok: false, text: t.err_no_video })
    if (selected.length === 0) return setMsg({ ok: false, text: t.err_no_channel })

    setBusy(true)
    try {
      const scheduledAt = scheduled && when ? new Date(when).toISOString() : undefined
      const res = await fetch('/api/admin/promo/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoVideoId: row.id, channels: selected, caption, scheduledAt }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.detail || j.error || `HTTP ${res.status}`)
      setMsg({ ok: true, text: t.publish_ok((j.channels ?? selected).length) })
      router.refresh()
    } catch (e) {
      setMsg({ ok: false, text: `${t.publish_err}: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 border-t border-white/5 pt-3">
      <div className="text-[10px] uppercase tracking-wider text-[#ff8844]/80 font-bold mb-2">
        {t.publish_title}
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        {channels.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => toggle(c)}
            disabled={disabled}
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
        disabled={disabled}
        className={`${inputCls} resize-y mb-2 disabled:opacity-40`}
        placeholder={t.caption_ph}
      />

      <div className="flex items-center gap-3 mb-2 text-[11px]">
        <label className="flex items-center gap-1.5 text-white/60">
          <input
            type="radio"
            checked={!scheduled}
            onChange={() => setScheduled(false)}
            disabled={disabled}
          />
          {t.when_now}
        </label>
        <label className="flex items-center gap-1.5 text-white/60">
          <input
            type="radio"
            checked={scheduled}
            onChange={() => setScheduled(true)}
            disabled={disabled}
          />
          {t.when_schedule}
        </label>
        {scheduled && (
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            disabled={disabled}
            className="px-2 py-1 bg-[#100608] border border-white/10 rounded text-[11px] text-white"
          />
        )}
      </div>

      <button
        type="button"
        onClick={handlePublish}
        disabled={disabled || busy}
        className="px-3 py-1.5 rounded bg-[#ff4444]/80 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-[#ff4444] transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy ? t.publishing : t.publish_btn}
      </button>

      {msg && (
        <p className={`mt-2 text-[11px] ${msg.ok ? 'text-emerald-300' : 'text-[#ff8888]'}`}>{msg.text}</p>
      )}
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
