'use client'

import { useMemo, useState } from 'react'
import { useT } from '@/lib/admin-i18n'
import { VideoEmbed } from '@/app/_components/VideoEmbed'
import { CountdownTimer } from '@/app/_components/CountdownTimer'
import { ConfirmModal } from '@/app/_components/ConfirmModal'
import {
  canSubmitMainRound,
  type Season,
  type SubmitBlockReason,
} from '@/lib/seasons'
import { acceptsExternalUrl, formatVideoPlatforms, validateVideoUrl } from '@/lib/video-url'
import {
  getMessage,
  type SystemMessageKey,
  type SystemMessages,
} from '@/lib/system-messages'
import type { Lang } from '@/lib/admin-i18n'
import {
  saveMainRoundSubmission,
  type MainRoundSubmissionError,
  type ProfileApplication,
} from './actions'

// Single-submission model — one video, no edits.
// Card branches:
//   ok=true                          → SubmitFormCard (warning + form + embed + countdown + modal)
//   reason='not_selected'            → BlockedCard
//   reason='before_start'            → BlockedCard + theme-reveal countdown
//   reason='after_close'             → BlockedCard
//   reason='season_dates_not_set'    → BlockedCard
//   reason=null, status='main_round_submitted' → SubmittedCard (no edit button)
//   reason=null, status='awarded'    → null (handled by WinnerCelebrationCard upstream)
//   reason=null, status='rejected'   → status_rejected_msg card
//   reason=null, status='flagged'    → status_flagged_msg card

export type MockOverrides = {
  status?: string
  themeRevealed?: boolean
  closeInSeconds?: number
}

export type RevealedTheme = { prelimTheme: string | null; theme: string | null; twist: string | null; twistRevealed: boolean }

type MainRoundCardProps = {
  app: ProfileApplication
  season: Season
  messages: SystemMessages
  lang: Lang
  // ★2026-08-16: gated separately from `season` -- see app/profile/page.tsx.
  // Never read season.main_round_theme_label directly, that field is only on
  // `season` because the Season type is shared everywhere; the anon-readable
  // source it comes from was the leak.
  revealedTheme: RevealedTheme
  mockOverrides?: MockOverrides
}

const REASON_MSG_KEY: Record<SubmitBlockReason, SystemMessageKey> = {
  not_selected: 'main_round_block_not_selected',
  before_start: 'main_round_block_before_start',
  after_close: 'main_round_block_after_close',
  season_dates_not_set: 'main_round_block_season_dates_not_set',
}

// Apply mock overrides to season (closeInSeconds → end_at; ensures start_at is past).
// In dev only — mockOverrides is undefined in production via NODE_ENV gate upstream.
function applyMockSeason(season: Season, mock: MockOverrides | undefined): Season {
  if (!mock || mock.closeInSeconds === undefined) return season
  const nowMs = Date.now()
  const endAt = new Date(nowMs + mock.closeInSeconds * 1000).toISOString()
  // If start_at is in the future (or null), pull it back so the round is "active now".
  let startAt = season.main_round_start_at
  if (!startAt || new Date(startAt).getTime() > nowMs) {
    startAt = new Date(nowMs - 60_000).toISOString()
  }
  return { ...season, main_round_start_at: startAt, main_round_end_at: endAt }
}

export function MainRoundCard({
  app,
  season,
  messages,
  lang,
  revealedTheme,
  mockOverrides,
}: MainRoundCardProps) {
  const effectiveStatus = mockOverrides?.status ?? app.status
  const effectiveApp = effectiveStatus === app.status ? app : { ...app, status: effectiveStatus }
  const effectiveSeason = useMemo(() => applyMockSeason(season, mockOverrides), [season, mockOverrides])
  // ★2026-08-17: mockOverrides.themeRevealed no longer maps to anything --
  // the theme label has no reveal gate at all now (always shown once set),
  // and this card only ever renders once the main round is already active
  // (canSubmitMainRound gates SubmitFormCard on now >= main_round_start_at),
  // so the label is unconditionally available by the time anyone sees this.
  // Field kept on MockOverrides for now (harmless, unused) rather than
  // touching the URL-param plumbing in page.tsx as part of this fix.
  const effectiveRevealedTheme: RevealedTheme = revealedTheme

  const check = canSubmitMainRound(effectiveApp, effectiveSeason)

  // Dev-only diagnostics — KO/EN toggle catch 추적용. production에서 dead-code 제거.
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log('[MainRoundCard]', {
      appStatus: app.status,
      effectiveStatus,
      check,
      hasVideo: !!app.main_round_video_url,
      submittedAt: app.main_round_submitted_at,
      mockOverrides,
    })
  }

  // Branch 1: 제출 가능 — 폼
  if (check.ok) {
    return (
      <SubmitFormCard
        app={effectiveApp}
        season={effectiveSeason}
        messages={messages}
        lang={lang}
        revealedTheme={effectiveRevealedTheme}
        mockOverrides={mockOverrides}
      />
    )
  }

  // Branch 2: reason 메시지 카드 (4개 reason)
  if (check.reason !== null) {
    return (
      <BlockedCard
        reason={check.reason}
        season={effectiveSeason}
        messages={messages}
        lang={lang}
      />
    )
  }

  // Branch 3: reason=null → status 직접 분기
  if (effectiveStatus === 'main_round_submitted') {
    return (
      <SubmittedCard
        app={effectiveApp}
        season={effectiveSeason}
        messages={messages}
        lang={lang}
      />
    )
  }
  if (effectiveStatus === 'awarded') {
    // WinnerCelebrationCard가 page.tsx에서 별도 렌더. 본선 카드는 안 그림.
    return null
  }
  if (effectiveStatus === 'rejected' || effectiveStatus === 'flagged') {
    return <StatusOnlyCard status={effectiveStatus} />
  }
  // unknown status — fail safe
  return null
}

// ─── SubmitFormCard ──────────────────────────────────────────────────────

function SubmitFormCard({
  app,
  season,
  messages,
  lang,
  revealedTheme,
  mockOverrides,
}: {
  app: ProfileApplication
  season: Season
  messages: SystemMessages
  lang: Lang
  revealedTheme: RevealedTheme
  mockOverrides?: MockOverrides
}) {
  const t = useT()
  const [videoUrl, setVideoUrl] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submittedLocal, setSubmittedLocal] = useState<{
    videoUrl: string
    submittedAt: string
  } | null>(null)

  const validation = useMemo(
    () => validateVideoUrl(videoUrl, season.allowed_video_platforms),
    [videoUrl, season.allowed_video_platforms],
  )

  // ★Same predicate, same column as /apply. When the season's allowed sources
  // contain no linkable platform (season_0 = ['studio']) this form cannot
  // produce a valid submission: validateVideoUrl rejects every input, so the URL
  // field and the submit button are a dead end that still reads "paste a link".
  // Hide the dead controls rather than leaving them permanently disabled.
  const takesExternalUrl = acceptsExternalUrl(season.allowed_video_platforms)

  // Theme is a PUBLIC brief now (TK 2026-07-12, "A") -- shown as soon as the
  // operator sets it, the same moment the audience sees it on Watch. No 60-min
  // reveal gate: it would be pointless when the theme is already public there.
  const endAt = season.main_round_end_at ? new Date(season.main_round_end_at) : null

  const handleConfirm = async () => {
    setConfirmOpen(false)
    setSubmitting(true)
    setSubmitError(null)

    const res = await saveMainRoundSubmission({
      applicationId: app.id,
      videoUrl,
    })

    setSubmitting(false)

    if (!res.ok) {
      const errorMap: Record<MainRoundSubmissionError, string> = {
        unauthenticated: t.profile.main_round_err_invalid_token,
        not_found: t.profile.main_round_err_not_found,
        not_owner: t.profile.main_round_err_not_owner,
        season_not_found: t.profile.main_round_err_season_not_found,
        not_selected: t.profile.main_round_err_not_selected,
        season_dates_not_set: t.profile.main_round_err_season_dates_not_set,
        before_start: t.profile.main_round_err_before_start,
        after_close: t.profile.main_round_err_after_close,
        video_url_required: t.profile.main_round_err_video_url_required,
        video_url_invalid: t.profile.main_round_err_video_url_invalid,
        video_url_not_allowed: t.profile.main_round_err_video_url_not_allowed,
        race_or_already_submitted:
          t.profile.main_round_err_race_or_already_submitted,
        save_failed: t.profile.main_round_err_save_failed,
      }
      setSubmitError(errorMap[res.error])
      return
    }

    // success — render SubmittedCard locally so the user sees their submission
    // immediately. Server data refreshes on next page visit (revalidatePath
    // already fired admin caches; for the user-facing page we use local state).
    setSubmittedLocal({
      videoUrl,
      submittedAt: new Date().toISOString(),
    })
  }

  // Success branch — show SubmittedCard with locally-known data.
  if (submittedLocal) {
    return (
      <SubmittedCard
        app={{
          ...app,
          status: 'main_round_submitted',
          main_round_video_url: submittedLocal.videoUrl,
          main_round_submitted_at: submittedLocal.submittedAt,
        }}
        season={season}
        messages={messages}
        lang={lang}
      />
    )
  }

  return (
    <Card title={t.profile.main_round_section_title} accent={false}>
      {/* 본선 테마 영역 */}
      <div className="mb-5">
        <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
          {t.profile.main_round_theme_label}
        </div>
        {revealedTheme.theme ? (
          <div className="rounded-lg border border-[#8b22ff]/40 bg-[#8b22ff]/[.08] px-4 py-3">
            <p className="text-lg font-bold text-[#d4a7ff]">{revealedTheme.theme}</p>
            <a
              href="/rules"
              className="mt-1 inline-block text-xs font-semibold text-[#b66cff] hover:text-[#d4a7ff] transition"
            >
              {t.profile.main_round_theme_full_link}
            </a>
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 bg-white/[.02] px-4 py-3">
            <p className="text-sm text-white/70">
              {getMessage(messages, 'main_round_theme_reveal_waiting', lang)}
            </p>
          </div>
        )}
      </div>

      {/* 필수조건(Twist) — SubmitFormCard는 canSubmitMainRound가 이미
          now >= main_round_start_at를 보장하므로, twist reveal instant가
          main_round_start_at와 정확히 같은 지금(theme_announcement_minutes_
          before=0) 여기 도달했다는 것 자체가 twistRevealed=true를 함의한다.
          그래도 방어적으로 둘 다 확인. */}
      {revealedTheme.twistRevealed && revealedTheme.twist && (
        <div className="mb-5 rounded-lg border border-[#8b22ff]/40 bg-[#8b22ff]/[.08] px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
            {t.profile.main_round_twist_label}
          </div>
          <p className="text-sm font-semibold text-[#d9b8ff]">{revealedTheme.twist}</p>
        </div>
      )}

      {/* 사전 경고 */}
      <div className="mb-5 rounded-lg border border-[#ff8844]/40 bg-[#ff8844]/[.08] px-4 py-3">
        <p className="text-sm text-[#ffb088] leading-relaxed">
          {getMessage(messages, 'main_round_submission_warning', lang)}
        </p>
      </div>

      {/* 허용 플랫폼 표시 */}
      <div className="mb-4 text-xs text-white/50">
        {t.profile.main_round_allowed_platforms_label}:{' '}
        <span className="text-white/80">
          {formatVideoPlatforms(season.allowed_video_platforms)}
        </span>
      </div>

      {/* 링크 접수가 없는 시즌 — 죽은 입력란 대신 사실만 */}
      {!takesExternalUrl && (
        <div className="mb-5 rounded-lg border border-white/10 bg-white/[.03] px-4 py-3">
          <p className="text-sm text-white/60 leading-relaxed">
            {t.profile.main_round_external_url_closed(
              formatVideoPlatforms(season.allowed_video_platforms),
            )}
          </p>
        </div>
      )}

      {/* 영상 URL 입력 */}
      {takesExternalUrl && (
      <label className="block mb-4">
        <div className="text-[11px] uppercase tracking-wider text-white/60 mb-1.5">
          {t.profile.main_round_video_url_label}
          <span className="text-[#ff8888] ml-1">*</span>
        </div>
        <input
          type="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder={t.profile.main_round_video_url_placeholder}
          className="w-full px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white placeholder:text-white/30 focus:border-[#8b22ff] focus:outline-none transition"
        />
        {videoUrl.trim() !== '' && !validation.valid && (
          <p className="mt-1.5 text-xs text-amber-400">
            {validation.error === 'empty'
              ? t.profile.main_round_video_url_err_empty
              : validation.error === 'unknown_platform'
              ? t.profile.main_round_video_url_err_unknown
              : t.profile.main_round_video_url_err_not_allowed}
          </p>
        )}
        {validation.valid && (
          <p className="mt-1.5 text-xs text-[#b66cff]">
            ✓ {formatVideoPlatforms([validation.platform])}
          </p>
        )}
      </label>
      )}

      {/* 영상 임베드 미리보기 — valid URL일 때만 */}
      {validation.valid && (
        <div className="mb-5">
          <VideoEmbed url={videoUrl} />
        </div>
      )}

      {/* 본선 마감 카운트다운 */}
      {endAt && (
        <div className="mb-5 text-xs text-white/60">
          {t.profile.main_round_close_countdown_label}{' '}
          <CountdownTimer
            targetAt={endAt}
            className="text-[#ff8844] font-bold tabular-nums ml-1"
          />
        </div>
      )}

      {/* 서버 에러 메시지 */}
      {submitError && (
        <div className="mb-4 px-3 py-2 rounded border border-[#ff4444]/30 bg-[#ff4444]/10 text-xs text-[#ff8888]">
          {submitError}
        </div>
      )}

      {/* 제출 버튼 — 링크 접수가 없는 시즌에서는 영원히 disabled라 렌더하지 않는다 */}
      {takesExternalUrl && (
        <button
          type="button"
          disabled={!validation.valid || submitting}
          onClick={() => setConfirmOpen(true)}
          className="w-full px-5 py-3 rounded bg-gradient-to-br from-[#7d23ff] to-[#6220dc] text-white font-bold text-sm uppercase tracking-wider hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? t.profile.main_round_submitting : t.profile.main_round_submit_btn}
        </button>
      )}

      {/* 확인 모달 */}
      <ConfirmModal
        open={confirmOpen}
        message={getMessage(messages, 'main_round_submit_confirm_modal', lang)}
        confirmLabel={t.profile.main_round_modal_confirm}
        cancelLabel={t.profile.main_round_modal_cancel}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
        variant="danger"
      />
    </Card>
  )
}

// ─── BlockedCard ─────────────────────────────────────────────────────────
// 4 reason 메시지 카드. before_start면 시작 카운트다운 추가.

function BlockedCard({
  reason,
  season,
  messages,
  lang,
}: {
  reason: SubmitBlockReason
  season: Season
  messages: SystemMessages
  lang: Lang
}) {
  const t = useT()
  const msgKey = REASON_MSG_KEY[reason]
  const startAt = season.main_round_start_at ? new Date(season.main_round_start_at) : null

  return (
    <Card title={t.profile.main_round_section_title}>
      <p className="text-sm text-white/80 leading-relaxed">
        {getMessage(messages, msgKey, lang)}
      </p>
      {reason === 'before_start' && startAt && (
        <p className="mt-3 text-xs text-white/60">
          {t.profile.main_round_close_countdown_label}{' '}
          <CountdownTimer
            targetAt={startAt}
            className="text-[#b66cff] font-bold tabular-nums ml-1"
          />
        </p>
      )}
    </Card>
  )
}

// ─── SubmittedCard ───────────────────────────────────────────────────────
// status='main_round_submitted' — 제출본 표시. 편집 버튼 없음 (단일 제출).

function SubmittedCard({
  app,
  season,
  messages,
  lang,
}: {
  app: ProfileApplication
  season: Season
  messages: SystemMessages
  lang: Lang
}) {
  const t = useT()

  // Defensive null guard — SubmittedCard should only render when the user has
  // actually submitted. main_round_video_url / main_round_submitted_at being
  // null while status='main_round_submitted' is a data inconsistency
  // (CHECK constraint main_round_submission_consistency_chk should prevent it
  // at DB level, but if we somehow reach here we don't want to show blank
  // fields like "—" — return null instead.
  if (!app.main_round_video_url || !app.main_round_submitted_at) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error(
        '[SubmittedCard] rendered with missing submission data — branching catch suspected',
        { status: app.status, url: app.main_round_video_url, at: app.main_round_submitted_at },
      )
    }
    return null
  }

  const endAt = season.main_round_end_at ? new Date(season.main_round_end_at) : null
  const submittedAt = new Date(app.main_round_submitted_at).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <Card title={t.profile.main_round_section_title} accent>
      <div className="mb-5 rounded-lg border border-emerald-500/30 bg-emerald-500/[.08] px-4 py-3">
        <p className="text-sm text-emerald-200 leading-relaxed">
          {getMessage(messages, 'main_round_submitted_confirmation', lang)}
        </p>
      </div>

      <div className="space-y-3 mb-5">
        <FieldRow
          label={t.profile.main_round_submitted_video_label}
          value={
            <a
              href={app.main_round_video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#b66cff] hover:underline break-all"
            >
              {app.main_round_video_url}
            </a>
          }
        />
        <FieldRow label={t.profile.main_round_submitted_at_label} value={submittedAt} />
      </div>

      <div className="mb-5">
        <VideoEmbed url={app.main_round_video_url} />
      </div>

      {endAt && (
        <div className="text-xs text-white/60">
          {t.profile.main_round_close_countdown_label}{' '}
          <CountdownTimer
            targetAt={endAt}
            className="text-[#ff8844] font-bold tabular-nums ml-1"
          />
        </div>
      )}
    </Card>
  )
}

// ─── StatusOnlyCard ──────────────────────────────────────────────────────
// rejected / flagged — i18n status_*_msg만 표시.

function StatusOnlyCard({ status }: { status: 'rejected' | 'flagged' }) {
  const t = useT()
  const message =
    status === 'rejected' ? t.profile.status_rejected_msg : t.profile.status_flagged_msg
  return (
    <Card title={t.profile.main_round_section_title}>
      <p className="text-sm text-white/80 leading-relaxed">{message}</p>
    </Card>
  )
}

// ─── Layout primitives — matches profile/page.tsx pattern ───────────────

function Card({
  title,
  accent,
  children,
}: {
  title: string
  accent?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      className={`mt-6 border rounded-lg p-6 ${
        accent
          ? 'border-emerald-500/40 bg-emerald-500/[.04]'
          : 'border-white/10 bg-white/[.02]'
      }`}
    >
      <h2 className={`text-xs uppercase tracking-[0.2em] font-bold mb-4 ${
        accent ? 'text-emerald-300' : 'text-[#b66cff]'
      }`}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4">
      <div className="text-[10px] uppercase tracking-wider text-white/40 sm:w-32 shrink-0">
        {label}
      </div>
      <div className="text-sm text-white/90 break-words">{value}</div>
    </div>
  )
}

