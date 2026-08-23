// High-level send helpers. Each template gets its own helper that:
//   1. renders the React Email template to HTML
//   2. calls Resend
//   3. writes an email_logs row (sent / failed / skipped)
//
// Callers (apply route, status-change actions, cron route) just invoke the
// helper — they don't touch Resend or the logs table directly. Per OXXOVO
// automation philosophy, every helper is a side-effect of an existing action;
// there is no "Send X email" UI.

import 'server-only'
import { render } from '@react-email/components'
import type { ReactElement } from 'react'
import { getResend, EMAIL_FROM, APP_URL } from './client'
import type { RankAward } from '@/lib/seasons'
import { detectEmailLang, type EmailLang } from './lang'
import { logEmail, alreadySent, type TemplateKey } from './log'
import { sendAdminAlert } from './admin-alert'
import { isRateLimitError } from './deferral'
import {
  PreRegistered,
  subjectFor as preRegisteredSubject,
  type PreRegisteredProps,
} from './templates/PreRegistered'
import { AdminBroadcast, type AdminBroadcastProps } from './templates/AdminBroadcast'
import {
  ApplicationReceived,
  subjectFor as applicationReceivedSubject,
  type ApplicationReceivedProps,
} from './templates/ApplicationReceived'
import {
  Waitlisted,
  subjectFor as waitlistedSubject,
  type WaitlistedProps,
} from './templates/Waitlisted'
import {
  SelectedTop50,
  subjectFor as selectedTop50Subject,
  type SelectedTop50Props,
} from './templates/SelectedTop50'
import {
  NotSelected,
  subjectFor as notSelectedSubject,
  type NotSelectedProps,
} from './templates/NotSelected'
import {
  MainRoundStart,
  subjectFor as mainRoundStartSubject,
  type MainRoundStartProps,
} from './templates/MainRoundStart'
import {
  SubmissionDeadline,
  subjectFor as submissionDeadlineSubject,
  type SubmissionDeadlineProps,
} from './templates/SubmissionDeadline'
import {
  RegistrationCount,
  subjectFor as registrationCountSubject,
  type RegistrationCountProps,
} from './templates/RegistrationCount'
import {
  ApplicationDeadline,
  subjectFor as applicationDeadlineSubject,
  type ApplicationDeadlineProps,
} from './templates/ApplicationDeadline'
import {
  VoteDeadline,
  subjectFor as voteDeadlineSubject,
  type VoteDeadlineProps,
  type VoteDeadlineAudience,
} from './templates/VoteDeadline'
export type { VoteDeadlineAudience } from './templates/VoteDeadline'
import {
  DeferralNotice,
  subjectFor as deferralNoticeSubject,
  type DeferralNoticeProps,
} from './templates/DeferralNotice'
import {
  ResultsAnnounced,
  subjectFor as resultsAnnouncedSubject,
  type ResultsAnnouncedProps,
  type ResultsPlacement,
} from './templates/ResultsAnnounced'
export type { ResultsPlacement } from './templates/ResultsAnnounced'
import {
  AwardedContactRequest,
  subjectFor as awardedContactRequestSubject,
  type AwardedContactRequestProps,
} from './templates/AwardedContactRequest'
import {
  PartnerInvitation,
  subjectFor as partnerInvitationSubject,
  type PartnerInvitationProps,
} from './templates/PartnerInvitation'
import {
  PartnerEligible,
  subjectFor as partnerEligibleSubject,
  type PartnerEligibleProps,
} from './templates/PartnerEligible'
import {
  MembershipRenewal,
  subjectFor as membershipRenewalSubject,
  type MembershipRenewalProps,
} from './templates/MembershipRenewal'
import {
  MembershipFoundingExpiry,
  subjectFor as membershipFoundingExpirySubject,
  type MembershipFoundingExpiryProps,
} from './templates/MembershipFoundingExpiry'
import {
  VideoLivePrelim,
  subjectFor as videoLivePrelimSubject,
  type VideoLivePrelimProps,
} from './templates/VideoLivePrelim'
import {
  VideoLiveMain,
  subjectFor as videoLiveMainSubject,
  type VideoLiveMainProps,
} from './templates/VideoLiveMain'
import {
  SubmissionReceived,
  subjectFor as submissionReceivedSubject,
  type SubmissionReceivedProps,
} from './templates/SubmissionReceived'
import {
  MainRoundSubmissionReceived,
  subjectFor as mainRoundSubmissionReceivedSubject,
  type MainRoundSubmissionReceivedProps,
} from './templates/MainRoundSubmissionReceived'
import type { SubmissionFileState } from '@/lib/submission-receipt'
import {
  prelimReceiptLines,
  mainReceiptLines,
  type ReceiptSeason,
} from './schedule-lines'
import { buildShareUrl } from '@/lib/share-kit'
import { isMemberHostedEnabled } from '@/lib/member-hosted'

export type SendResult =
  | { ok: true; messageId: string | null; skipped?: false }
  | { ok: true; messageId: null; skipped: true; reason: 'already_sent' | 'member_hosted_disabled' }
  // ★`deferred` separates "this send must not be attempted again soon" from
  // "not now". Only the first deserves the failure backoff; see rateLimited().
  | { ok: false; error: string; deferred?: true }

type ExecuteSendInput = {
  toEmail: string
  templateKey: TemplateKey
  language: EmailLang
  subject: string
  element: ReactElement
  applicationId?: string | null
  seasonId?: string | null
  // Cron-only: extra dedup key for multi-fire templates (submission_deadline
  // fires once per reminder_hour). Also persisted in metadata.
  reminderHour?: number
  // Extra fields merged into the logged metadata (e.g. admin_broadcast's
  // campaign_id/segment). Merged UNDER reminderHour's key so a future caller
  // combining both cannot silently clobber the dedup key.
  metadata?: Record<string, unknown> | null
}

// RFC 8058 one-click unsubscribe. Every outbound email carries these headers,
// transactional included -- deliverability (Gmail/Yahoo bulk-sender rules)
// and the List-Unsubscribe-Post one-click action both depend on it being
// present everywhere, not just on templates this session considers
// "marketing". The link itself unsubscribes from tournament ANNOUNCEMENT
// emails only (lib/email/consent.ts canSendMarketingEmail) -- it cannot stop
// notices about the recipient's own application/account (see app/privacy
// Section 11), because there is nothing on this row for those to check.
// Keyed by email (not a signed token): matches the SMS STOP pattern in scope
// and cost -- worst case of a guessed/leaked link is an unwanted unsubscribe,
// reversible by logging back in.
function unsubscribeHeaders(toEmail: string): Record<string, string> {
  const url = `${APP_URL}/api/email/unsubscribe?email=${encodeURIComponent(toEmail)}`
  return {
    'List-Unsubscribe': `<mailto:info@oxxovo.ai?subject=unsubscribe>, <${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}

// Shared engine: dedup + render + resend + log. Every send* helper funnels
// through this so retry/dedup/logging behavior is identical across templates.
async function executeSend(input: ExecuteSendInput): Promise<SendResult> {
  // registration_count's numeric variant is a DAY count and deferral_notice's
  // is a DEFER COUNT, neither an hour count -- each stored under its own
  // metadata key so none can collide with another (lib/email/log.ts
  // canSend/alreadySent match on whichever key applies to the templateKey).
  const reminderKey =
    input.templateKey === 'registration_count'
      ? 'reminder_day'
      : input.templateKey === 'deferral_notice'
        ? 'defer_count'
        : 'reminder_hour'
  const baseMetadata: Record<string, unknown> | null =
    input.reminderHour != null || input.metadata
      ? { ...(input.metadata ?? {}), ...(input.reminderHour != null ? { [reminderKey]: input.reminderHour } : {}) }
      : null

  if (input.applicationId) {
    if (
      await alreadySent(input.applicationId, input.templateKey, input.reminderHour)
    ) {
      await logEmail({
        applicationId: input.applicationId,
        seasonId: input.seasonId,
        toEmail: input.toEmail,
        templateKey: input.templateKey,
        language: input.language,
        subject: '(skipped — already sent)',
        status: 'skipped',
        metadata: { ...(baseMetadata ?? {}), reason: 'already_sent' },
      })
      return { ok: true, messageId: null, skipped: true, reason: 'already_sent' }
    }
  }

  const html = await render(input.element)

  try {
    const resend = getResend()
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: input.toEmail,
      subject: input.subject,
      html,
      headers: unsubscribeHeaders(input.toEmail),
    })

    if (error) {
      // ★A rate limit is logged 'queued', not 'failed'. canSend only counts
      // 'failed' rows toward the backoff and only 'sent' rows toward dedup, so
      // 'queued' leaves the recipient fully eligible on the very next tick --
      // which is the correct answer to "not now". /admin/emails already renders
      // the status, so the deferral is visible rather than invented.
      const deferred = isRateLimitError(error as { name?: string; message?: string; statusCode?: number })
      await logEmail({
        applicationId: input.applicationId,
        seasonId: input.seasonId,
        toEmail: input.toEmail,
        templateKey: input.templateKey,
        language: input.language,
        subject: input.subject,
        status: deferred ? 'queued' : 'failed',
        errorMessage: error.message,
        metadata: deferred
          ? { ...(baseMetadata ?? {}), deferred_reason: 'rate_limited' }
          : baseMetadata,
      })
      return deferred
        ? { ok: false, error: error.message, deferred: true }
        : { ok: false, error: error.message }
    }

    const logged = await logEmail({
      applicationId: input.applicationId,
      seasonId: input.seasonId,
      toEmail: input.toEmail,
      templateKey: input.templateKey,
      language: input.language,
      subject: input.subject,
      resendMessageId: data?.id ?? null,
      status: 'sent',
      metadata: baseMetadata,
    })
    // ★The send genuinely happened -- `ok: true` below is still true, and
    // stays true, so nothing upstream retries and duplicate-sends. What
    // changes is that a human finds out the dedup row didn't land, instead
    // of the next tick quietly discovering "no record of this" and sending
    // it again. Fire-and-forget, never lets an alert-send failure surface
    // as this function failing.
    if (!logged) {
      sendAdminAlert(
        `[email log] insert failed after a real send -- ${input.templateKey} to ${input.toEmail}`,
        `<p>logEmail() failed to record a 'sent' row for <b>${input.templateKey}</b> to <b>${input.toEmail}</b> ` +
          `(applicationId=${input.applicationId ?? 'none'}). The email WAS sent (Resend id ${data?.id ?? 'unknown'}). ` +
          `Without this row the next dedup check will not see it as sent and may resend it -- check email_logs and, ` +
          `if the row is really missing, insert it manually or investigate why the insert failed.</p>`,
      ).catch((e) => console.error('[email send] admin alert for log failure also failed:', e))
    }
    return { ok: true, messageId: data?.id ?? null }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await logEmail({
      applicationId: input.applicationId,
      seasonId: input.seasonId,
      toEmail: input.toEmail,
      templateKey: input.templateKey,
      language: input.language,
      subject: input.subject,
      status: 'failed',
      errorMessage: message,
      metadata: baseMetadata,
    })
    return { ok: false, error: message }
  }
}

// ─── per-template senders ─────────────────────────────────────────────────

type SendPreRegisteredInput = {
  toEmail: string
  // Country drives ko/en. Pre-registration has no country field yet, so
  // callers pass null and the email defaults to English.
  country: string | null | undefined
  seasonName: string
  seasonId?: string | null
  forceLang?: EmailLang
}

// Pre-registration confirmation. Not application-scoped (no applicationId), so
// executeSend's per-application dedup does not run — the caller (pre-register
// route) only fires this on the FIRST insert, never on a duplicate re-submit,
// so a given address receives at most one confirmation.
export async function sendPreRegistered(
  input: SendPreRegisteredInput,
): Promise<SendResult> {
  const lang = input.forceLang ?? detectEmailLang(input.country)
  const props: PreRegisteredProps = {
    lang,
    seasonName: input.seasonName,
  }
  return executeSend({
    toEmail: input.toEmail,
    templateKey: 'pre_registered',
    language: lang,
    subject: preRegisteredSubject(props),
    element: <PreRegistered {...props} />,
    seasonId: input.seasonId,
  })
}

type SendAdminBroadcastInput = {
  toEmail: string
  subject: string
  bodyText: string
  posterImageUrl: string | null
  promoVideoUrl: string | null
  seasonId?: string | null
  campaignId: string
  segment: string
  lang?: EmailLang
}

// admin_broadcasts recipient-console send. NOT application-scoped
// (applicationId omitted -- executeSend's per-application dedup does not
// apply); dedup for a campaign is (campaign_id, to_email), checked by
// lib/email/broadcast-tick.ts BEFORE this is ever called, not here.
export async function sendAdminBroadcast(
  input: SendAdminBroadcastInput,
): Promise<SendResult> {
  const lang = input.lang ?? 'en'
  const props: AdminBroadcastProps = {
    lang,
    subject: input.subject,
    bodyText: input.bodyText,
    posterImageUrl: input.posterImageUrl,
    promoVideoUrl: input.promoVideoUrl,
  }
  return executeSend({
    toEmail: input.toEmail,
    templateKey: 'admin_broadcast',
    language: lang,
    subject: input.subject,
    element: <AdminBroadcast {...props} />,
    seasonId: input.seasonId,
    metadata: { campaign_id: input.campaignId, segment: input.segment },
  })
}

type SendApplicationReceivedInput = {
  toEmail: string
  country: string | null | undefined
  creatorName: string
  seasonName: string
  applicationCount: number
  maxApplicants: number
  applicationId?: string | null
  seasonId?: string | null
  forceLang?: EmailLang
}

export async function sendApplicationReceived(
  input: SendApplicationReceivedInput,
): Promise<SendResult> {
  const lang = input.forceLang ?? detectEmailLang(input.country)
  const props: ApplicationReceivedProps = {
    lang,
    creatorName: input.creatorName,
    seasonName: input.seasonName,
    applicationCount: input.applicationCount,
    maxApplicants: input.maxApplicants,
  }
  return executeSend({
    toEmail: input.toEmail,
    templateKey: 'application_received',
    language: lang,
    subject: applicationReceivedSubject(props),
    element: <ApplicationReceived {...props} />,
    applicationId: input.applicationId,
    seasonId: input.seasonId,
  })
}

type SendWaitlistedInput = {
  toEmail: string
  country: string | null | undefined
  creatorName: string
  seasonName: string
  maxApplicants: number
  applicationId?: string | null
  seasonId?: string | null
  forceLang?: EmailLang
}

export async function sendWaitlisted(
  input: SendWaitlistedInput,
): Promise<SendResult> {
  const lang = input.forceLang ?? detectEmailLang(input.country)
  const props: WaitlistedProps = {
    lang,
    creatorName: input.creatorName,
    seasonName: input.seasonName,
    maxApplicants: input.maxApplicants,
  }
  return executeSend({
    toEmail: input.toEmail,
    templateKey: 'waitlisted',
    language: lang,
    subject: waitlistedSubject(props),
    element: <Waitlisted {...props} />,
    applicationId: input.applicationId,
    seasonId: input.seasonId,
  })
}

type SendSelectedTop50Input = {
  toEmail: string
  country: string | null | undefined
  creatorName: string
  seasonName: string
  topNAdvance: number
  totalParticipants: number
  mainRoundStartAt: string | null
  // HQ 2026-08-22, item 1 (#7): same prelim Season Report fields
  // NotSelected carries, derived from the same rankMap (scoring_results.
  // ai_outputs) -- advancing doesn't make the AI's reasoning uninteresting.
  score: number
  rank: number
  percentile: number
  strength: string
  improvement: string
  applicationId?: string | null
  seasonId?: string | null
  forceLang?: EmailLang
}

export async function sendSelectedTop50(
  input: SendSelectedTop50Input,
): Promise<SendResult> {
  const lang = input.forceLang ?? detectEmailLang(input.country)
  const base = (process.env.APP_URL ?? 'https://www.oxxovo.ai').replace(/\/$/, '')
  const props: SelectedTop50Props = {
    lang,
    creatorName: input.creatorName,
    seasonName: input.seasonName,
    topNAdvance: input.topNAdvance,
    totalParticipants: input.totalParticipants,
    mainRoundStartAt: input.mainRoundStartAt,
    score: input.score,
    rank: input.rank,
    percentile: input.percentile,
    strength: input.strength,
    improvement: input.improvement,
    // Points at the PRELIM entry (round=application, default) -- the
    // main-round video doesn't exist yet at advancement time, same
    // reasoning as sendNotSelected's videoUrl just below.
    videoUrl: input.applicationId ? `${base}/watch/${input.applicationId}` : `${base}/watch`,
    profileUrl: `${base}/profile`,
  }
  return executeSend({
    toEmail: input.toEmail,
    templateKey: 'selected_top50',
    language: lang,
    subject: selectedTop50Subject(props),
    element: <SelectedTop50 {...props} />,
    applicationId: input.applicationId,
    seasonId: input.seasonId,
  })
}

type SendNotSelectedInput = {
  toEmail: string
  country: string | null | undefined
  creatorName: string
  seasonName: string
  score: number
  rank: number
  total: number
  percentile: number
  strength: string
  improvement: string
  nextSeasonName: string
  nextSeasonOpenAt: string | null
  applicationId?: string | null
  seasonId?: string | null
  forceLang?: EmailLang
}

export async function sendNotSelected(
  input: SendNotSelectedInput,
): Promise<SendResult> {
  const lang = input.forceLang ?? detectEmailLang(input.country)
  const base = (process.env.APP_URL ?? 'https://www.oxxovo.ai').replace(/\/$/, '')
  const nextSeasonDate = input.nextSeasonOpenAt
    ? new Date(input.nextSeasonOpenAt).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', {
        dateStyle: 'long',
      })
    : ''
  const props: NotSelectedProps = {
    lang,
    creatorName: input.creatorName,
    seasonName: input.seasonName,
    score: input.score,
    rank: input.rank,
    total: input.total,
    percentile: input.percentile,
    strength: input.strength,
    improvement: input.improvement,
    videoUrl: input.applicationId ? `${base}/watch/${input.applicationId}` : `${base}/watch`,
    profileUrl: `${base}/profile`,
    nextSeasonName: input.nextSeasonName,
    nextSeasonDate,
    applyUrl: `${base}/apply`,
  }
  return executeSend({
    toEmail: input.toEmail,
    templateKey: 'not_selected',
    language: lang,
    subject: notSelectedSubject(props),
    element: <NotSelected {...props} />,
    applicationId: input.applicationId,
    seasonId: input.seasonId,
  })
}

type SendMainRoundStartInput = {
  toEmail: string
  country: string | null | undefined
  creatorName: string
  seasonName: string
  themeAnnouncementMinutesBefore: number
  submissionHours: number
  mainRoundVideoMinSeconds: number
  mainRoundVideoMaxSeconds: number
  applicationId?: string | null
  seasonId?: string | null
  forceLang?: EmailLang
}

export async function sendMainRoundStart(
  input: SendMainRoundStartInput,
): Promise<SendResult> {
  const lang = input.forceLang ?? detectEmailLang(input.country)
  const props: MainRoundStartProps = {
    lang,
    creatorName: input.creatorName,
    seasonName: input.seasonName,
    themeAnnouncementMinutesBefore: input.themeAnnouncementMinutesBefore,
    submissionHours: input.submissionHours,
    mainRoundVideoMinSeconds: input.mainRoundVideoMinSeconds,
    mainRoundVideoMaxSeconds: input.mainRoundVideoMaxSeconds,
  }
  return executeSend({
    toEmail: input.toEmail,
    templateKey: 'main_round_start',
    language: lang,
    subject: mainRoundStartSubject(props),
    element: <MainRoundStart {...props} />,
    applicationId: input.applicationId,
    seasonId: input.seasonId,
  })
}

type SendSubmissionDeadlineInput = {
  toEmail: string
  country: string | null | undefined
  creatorName: string
  seasonName: string
  hoursRemaining: number
  // The reminder slot from seasons.deadline_reminder_hours that triggered
  // this send (e.g. 24 or 6). Used as the multi-fire dedup key so the same
  // applicant can receive a 24h reminder AND a 6h reminder without the
  // partial unique index blocking the second send.
  reminderHour: number
  applicationId?: string | null
  seasonId?: string | null
  forceLang?: EmailLang
}

export async function sendSubmissionDeadline(
  input: SendSubmissionDeadlineInput,
): Promise<SendResult> {
  const lang = input.forceLang ?? detectEmailLang(input.country)
  const props: SubmissionDeadlineProps = {
    lang,
    creatorName: input.creatorName,
    seasonName: input.seasonName,
    hoursRemaining: input.hoursRemaining,
  }
  return executeSend({
    toEmail: input.toEmail,
    templateKey: 'submission_deadline',
    language: lang,
    subject: submissionDeadlineSubject(props),
    element: <SubmissionDeadline {...props} />,
    applicationId: input.applicationId,
    seasonId: input.seasonId,
    reminderHour: input.reminderHour,
  })
}

// HQ 2026-08-22: same shape as sendSubmissionDeadline, one round earlier --
// off application_close_at (the PRELIM video hard-cut) instead of the main-
// round close. Replaces sendRegistrationCount as the participant-facing
// deadline reminder (that one counted down to the REGISTRATION cutoff, which
// is no longer announced by email at all -- the Watch countdown covers it).
type SendApplicationDeadlineInput = {
  toEmail: string
  country: string | null | undefined
  creatorName: string
  seasonName: string
  hoursRemaining: number
  // The reminder slot from seasons.application_deadline_reminder_hours that
  // triggered this send (e.g. 168/72/24/6). Shares the 'reminder_hour' dedup
  // key with submission_deadline (see lib/email/log.ts) -- safe because the
  // two templateKeys are distinct, so the same numeric value never collides
  // across them.
  reminderHour: number
  applicationId?: string | null
  seasonId?: string | null
  forceLang?: EmailLang
}

export async function sendApplicationDeadline(
  input: SendApplicationDeadlineInput,
): Promise<SendResult> {
  const lang = input.forceLang ?? detectEmailLang(input.country)
  const props: ApplicationDeadlineProps = {
    lang,
    creatorName: input.creatorName,
    seasonName: input.seasonName,
    hoursRemaining: input.hoursRemaining,
  }
  return executeSend({
    toEmail: input.toEmail,
    templateKey: 'application_deadline',
    language: lang,
    subject: applicationDeadlineSubject(props),
    element: <ApplicationDeadline {...props} />,
    applicationId: input.applicationId,
    seasonId: input.seasonId,
    reminderHour: input.reminderHour,
  })
}

// HQ 2026-08-22, item 3 (#13): community vote deadline, ONE fire, 24h before
// community_vote_end_at. applicationId is present for the participant
// audience (normal per-application dedup applies) and OMITTED for the
// member audience -- executeSend's alreadySent() check only runs when
// applicationId is set, so a member send skips that path entirely and
// fireVoteDeadlineMembers (email-tick route.ts) does its own dedup instead.
// Passing a member through with no applicationId is deliberate, not an
// oversight -- see the log.ts comment on 'vote_deadline'.
type SendVoteDeadlineInput = {
  toEmail: string
  country: string | null | undefined
  name: string
  seasonName: string
  audience: VoteDeadlineAudience
  videoUrl: string | null
  applicationId?: string | null
  seasonId?: string | null
  forceLang?: EmailLang
}

export async function sendVoteDeadline(input: SendVoteDeadlineInput): Promise<SendResult> {
  const lang = input.forceLang ?? detectEmailLang(input.country)
  const base = (process.env.APP_URL ?? 'https://www.oxxovo.ai').replace(/\/$/, '')
  const props: VoteDeadlineProps = {
    lang,
    name: input.name,
    seasonName: input.seasonName,
    audience: input.audience,
    voteUrl: `${base}/watch`,
    videoUrl: input.videoUrl,
  }
  return executeSend({
    toEmail: input.toEmail,
    templateKey: 'vote_deadline',
    language: lang,
    subject: voteDeadlineSubject(props),
    element: <VoteDeadline {...props} />,
    applicationId: input.applicationId,
    seasonId: input.seasonId,
    metadata: { audience: input.audience },
  })
}

type SendRegistrationCountInput = {
  toEmail: string
  country: string | null | undefined
  creatorName: string
  seasonName: string
  currentCount: number
  minParticipants: number
  registrationCloseAt: string | null
  // The reminder slot from seasons.registration_reminder_days that triggered
  // this send (e.g. 14, 7, 3, 1). Multi-fire dedup key, stored under its own
  // metadata key (reminder_day) -- see executeSend.
  reminderDay: number
  applicationId?: string | null
  seasonId?: string | null
  forceLang?: EmailLang
}

export async function sendRegistrationCount(
  input: SendRegistrationCountInput,
): Promise<SendResult> {
  const lang = input.forceLang ?? detectEmailLang(input.country)
  const props: RegistrationCountProps = {
    lang,
    creatorName: input.creatorName,
    seasonName: input.seasonName,
    currentCount: input.currentCount,
    minParticipants: input.minParticipants,
    registrationCloseAt: input.registrationCloseAt,
    reminderDay: input.reminderDay,
  }
  return executeSend({
    toEmail: input.toEmail,
    templateKey: 'registration_count',
    language: lang,
    subject: registrationCountSubject(props),
    element: <RegistrationCount {...props} />,
    applicationId: input.applicationId,
    seasonId: input.seasonId,
    reminderHour: input.reminderDay,
  })
}

type SendDeferralNoticeInput = {
  toEmail: string
  country: string | null | undefined
  creatorName: string
  seasonName: string
  deferCount: number
  maxDeferCount: number
  newRegistrationCloseAt: string | null
  newApplicationCloseAt: string | null
  applicationId?: string | null
  seasonId?: string | null
  forceLang?: EmailLang
}

export async function sendDeferralNotice(
  input: SendDeferralNoticeInput,
): Promise<SendResult> {
  const lang = input.forceLang ?? detectEmailLang(input.country)
  const props: DeferralNoticeProps = {
    lang,
    creatorName: input.creatorName,
    seasonName: input.seasonName,
    deferCount: input.deferCount,
    maxDeferCount: input.maxDeferCount,
    newRegistrationCloseAt: input.newRegistrationCloseAt,
    newApplicationCloseAt: input.newApplicationCloseAt,
  }
  return executeSend({
    toEmail: input.toEmail,
    templateKey: 'deferral_notice',
    language: lang,
    subject: deferralNoticeSubject(props),
    element: <DeferralNotice {...props} />,
    applicationId: input.applicationId,
    seasonId: input.seasonId,
    reminderHour: input.deferCount,
  })
}

type SendResultsAnnouncedInput = {
  toEmail: string
  country: string | null | undefined
  creatorName: string
  seasonName: string
  // HQ 2026-08-22, item 2 (#15): which of the 4 variants this recipient gets
  // -- computed by the caller from award_rank (fireResultsAnnounced).
  placement: ResultsPlacement
  applicationId?: string | null
  seasonId?: string | null
  forceLang?: EmailLang
}

export async function sendResultsAnnounced(
  input: SendResultsAnnouncedInput,
): Promise<SendResult> {
  const lang = input.forceLang ?? detectEmailLang(input.country)
  const props: ResultsAnnouncedProps = {
    lang,
    creatorName: input.creatorName,
    seasonName: input.seasonName,
    placement: input.placement,
  }
  return executeSend({
    toEmail: input.toEmail,
    templateKey: 'results_announced',
    language: lang,
    subject: resultsAnnouncedSubject(props),
    element: <ResultsAnnounced {...props} />,
    applicationId: input.applicationId,
    seasonId: input.seasonId,
  })
}

type SendAwardedContactRequestInput = {
  toEmail: string
  country: string | null | undefined
  creatorName: string
  seasonName: string
  awardRank: 1 | 2 | 3
  prizeAmountUsd: number
  extras: RankAward
  applicationId?: string | null
  seasonId?: string | null
  forceLang?: EmailLang
}

export async function sendAwardedContactRequest(
  input: SendAwardedContactRequestInput,
): Promise<SendResult> {
  const lang = input.forceLang ?? detectEmailLang(input.country)
  const props: AwardedContactRequestProps = {
    lang,
    creatorName: input.creatorName,
    seasonName: input.seasonName,
    awardRank: input.awardRank,
    prizeAmountUsd: input.prizeAmountUsd,
    extras: input.extras,
  }
  return executeSend({
    toEmail: input.toEmail,
    templateKey: 'awarded_contact_request',
    language: lang,
    subject: awardedContactRequestSubject(props),
    element: <AwardedContactRequest {...props} />,
    applicationId: input.applicationId,
    seasonId: input.seasonId,
  })
}

// ─── partner host emails ──────────────────────────────────────────────────
// These are user/profile-scoped, not application-scoped, so they carry no
// applicationId. executeSend's per-application dedup therefore does not run;
// callers (admin invite action, awarded-rank eligibility hook) own the gating
// of when to fire. Language: detected from the recipient's country, or forced.

type SendPartnerInvitationInput = {
  toEmail: string
  country: string | null | undefined
  // null when the invitee is not yet registered (invited by email only).
  recipientName: string | null
  tier: string
  acceptUrl: string
  forceLang?: EmailLang
}

export async function sendPartnerInvitation(
  input: SendPartnerInvitationInput,
): Promise<SendResult> {
  // Suppressed while the member-hosted program is off (master switch).
  if (!(await isMemberHostedEnabled())) {
    return { ok: true, messageId: null, skipped: true, reason: 'member_hosted_disabled' }
  }
  const lang = input.forceLang ?? detectEmailLang(input.country)
  const props: PartnerInvitationProps = {
    lang,
    recipientName: input.recipientName,
    tier: input.tier,
    acceptUrl: input.acceptUrl,
  }
  return executeSend({
    toEmail: input.toEmail,
    templateKey: 'partner_invitation',
    language: lang,
    subject: partnerInvitationSubject(props),
    element: <PartnerInvitation {...props} />,
  })
}

type SendPartnerEligibleInput = {
  toEmail: string
  country: string | null | undefined
  creatorName: string
  tier: string
  applyUrl: string
  forceLang?: EmailLang
}

export async function sendPartnerEligible(
  input: SendPartnerEligibleInput,
): Promise<SendResult> {
  // Suppressed while the member-hosted program is off (master switch).
  if (!(await isMemberHostedEnabled())) {
    return { ok: true, messageId: null, skipped: true, reason: 'member_hosted_disabled' }
  }
  const lang = input.forceLang ?? detectEmailLang(input.country)
  const props: PartnerEligibleProps = {
    lang,
    creatorName: input.creatorName,
    tier: input.tier,
    applyUrl: input.applyUrl,
  }
  return executeSend({
    toEmail: input.toEmail,
    templateKey: 'partner_eligible',
    language: lang,
    subject: partnerEligibleSubject(props),
    element: <PartnerEligible {...props} />,
  })
}

// ─── membership notices (P4e) ─────────────────────────────────────────────
// Profile-scoped (no applicationId -> executeSend's per-application dedup does
// not run). Dedup is owned by the caller (email-tick) via the profiles
// membership_renewal_notified_at column. The cron gates the whole block on the
// membership master switch, so these never fire in dark launch.

type SendMembershipRenewalInput = {
  toEmail: string
  country: string | null | undefined
  creatorName: string
  priceUsd: number
  interval: string
  renewsOn: string | null
  forceLang?: EmailLang
}

export async function sendMembershipRenewal(
  input: SendMembershipRenewalInput,
): Promise<SendResult> {
  const lang = input.forceLang ?? detectEmailLang(input.country)
  const props: MembershipRenewalProps = {
    lang,
    creatorName: input.creatorName,
    priceUsd: input.priceUsd,
    interval: input.interval,
    renewsOn: input.renewsOn,
  }
  return executeSend({
    toEmail: input.toEmail,
    templateKey: 'membership_renewal',
    language: lang,
    subject: membershipRenewalSubject(props),
    element: <MembershipRenewal {...props} />,
  })
}

type SendMembershipFoundingExpiryInput = {
  toEmail: string
  country: string | null | undefined
  creatorName: string
  foundingNumber: number
  endsOn: string | null
  priceUsd: number
  interval: string
  subscribeUrl: string
  forceLang?: EmailLang
}

export async function sendMembershipFoundingExpiry(
  input: SendMembershipFoundingExpiryInput,
): Promise<SendResult> {
  const lang = input.forceLang ?? detectEmailLang(input.country)
  const props: MembershipFoundingExpiryProps = {
    lang,
    creatorName: input.creatorName,
    foundingNumber: input.foundingNumber,
    endsOn: input.endsOn,
    priceUsd: input.priceUsd,
    interval: input.interval,
    subscribeUrl: input.subscribeUrl,
  }
  return executeSend({
    toEmail: input.toEmail,
    templateKey: 'membership_founding_expiry',
    language: lang,
    subject: membershipFoundingExpirySubject(props),
    element: <MembershipFoundingExpiry {...props} />,
  })
}

// ─── ⑤ submission receipt ──────────────────────────────────────────────────
// Application-scoped -> executeSend's per-application dedup makes it once-only.
// Fired from the Studio submit action for the participant's own row, and swept
// by email-tick for anything that send missed -- both go through the same dedup,
// so the sweep is a no-op whenever the immediate send worked.

type SendSubmissionReceivedInput = {
  toEmail: string
  country: string | null | undefined
  creatorName: string
  seasonName: string
  videoTitle: string | null
  submittedAtLabel: string | null
  fileState: SubmissionFileState
  // The season's own schedule columns. The receipt renders only the bullets it
  // can source from these -- no dates are typed into the template.
  season: ReceiptSeason
  applicationId: string
  seasonId?: string | null
  forceLang?: EmailLang
}

export async function sendSubmissionReceived(
  input: SendSubmissionReceivedInput,
): Promise<SendResult> {
  const lang = input.forceLang ?? detectEmailLang(input.country)
  const props: SubmissionReceivedProps = {
    lang,
    creatorName: input.creatorName,
    seasonName: input.seasonName,
    videoTitle: input.videoTitle,
    submittedAtLabel: input.submittedAtLabel,
    fileState: input.fileState,
    scheduleLines: prelimReceiptLines(input.season, lang),
  }
  return executeSend({
    toEmail: input.toEmail,
    templateKey: 'studio_submission_received',
    language: lang,
    subject: submissionReceivedSubject(props),
    element: <SubmissionReceived {...props} />,
    applicationId: input.applicationId,
    seasonId: input.seasonId,
  })
}

export async function sendMainRoundSubmissionReceived(
  input: SendSubmissionReceivedInput,
): Promise<SendResult> {
  const lang = input.forceLang ?? detectEmailLang(input.country)
  const props: MainRoundSubmissionReceivedProps = {
    lang,
    creatorName: input.creatorName,
    seasonName: input.seasonName,
    videoTitle: input.videoTitle,
    submittedAtLabel: input.submittedAtLabel,
    fileState: input.fileState,
    scheduleLines: mainReceiptLines(input.season, lang),
  }
  return executeSend({
    toEmail: input.toEmail,
    templateKey: 'main_round_submission_received',
    language: lang,
    subject: mainRoundSubmissionReceivedSubject(props),
    element: <MainRoundSubmissionReceived {...props} />,
    applicationId: input.applicationId,
    seasonId: input.seasonId,
  })
}

// ─── growth-engine "your film is live" emails ─────────────────────────────
// Application-scoped -> executeSend's per-application dedup makes them once-only.
// "Watch your film" uses a plain URL (the creator viewing their own film); the
// "share to fans" link carries a ?ref= + utm so their fans' signups + votes
// credit back to them (the growth loop). creatorUserId null -> no attribution.
// Data (score/rank/AI notes for prelim; vote deadline/views for main) is gathered
// by the caller (email-tick fire trigger) and passed in.

const APP_BASE = (process.env.APP_URL ?? 'https://www.oxxovo.ai').replace(/\/$/, '')

// ★An entry with no title is "Untitled", not the season name and not the
// creator's name (Jenny3, 2026-08-08). The card already shows the creator
// separately, so putting it in the title slot prints the same name twice; and
// the season name would give every untitled entry in the season one identical
// title. "Untitled" is the standard art/film convention for exactly this.
// Resolved HERE because it is language-dependent and the caller does not know
// which language the send resolved to.
function titleOrUntitled(title: string | null | undefined, lang: EmailLang): string {
  const t = title?.trim()
  if (t) return t
  return lang === 'ko' ? '제목 없음' : 'Untitled'
}

function shareLink(watchUrl: string, creatorUserId: string | null, campaign: string): string {
  return creatorUserId
    ? buildShareUrl(watchUrl, creatorUserId, { source: 'email_share', medium: 'email', campaign })
    : watchUrl
}

type SendVideoLivePrelimInput = {
  toEmail: string
  country: string | null | undefined
  // Referrer id for the ?ref= share link (the creator's user id). null when the
  // entry has no linked account -> the email still sends, without attribution.
  creatorUserId: string | null
  nickname: string
  seasonName: string
  // Nullable at the CALLER; resolved to '제목 없음' / 'Untitled' below, where the
  // language is known. The template still takes a plain string.
  videoTitle: string | null
  thumbnailUrl: string | null
  score: number | null
  percentile: number | null
  rank: number | null
  aiStrength: string
  aiImprove: string
  applicationId: string
  seasonId?: string | null
  forceLang?: EmailLang
}

export async function sendVideoLivePrelim(input: SendVideoLivePrelimInput): Promise<SendResult> {
  const lang = input.forceLang ?? detectEmailLang(input.country)
  const watchUrl = `${APP_BASE}/watch/${input.applicationId}?round=application`
  const props: VideoLivePrelimProps = {
    lang,
    nickname: input.nickname,
    seasonName: input.seasonName,
    videoTitle: titleOrUntitled(input.videoTitle, lang),
    thumbnailUrl: input.thumbnailUrl,
    watchUrl,
    shareUrl: shareLink(watchUrl, input.creatorUserId, 'prelim_published'),
    reportUrl: watchUrl,
    score: input.score,
    percentile: input.percentile,
    rank: input.rank,
    aiStrength: input.aiStrength,
    aiImprove: input.aiImprove,
  }
  return executeSend({
    toEmail: input.toEmail,
    templateKey: 'video_live_prelim',
    language: lang,
    subject: videoLivePrelimSubject(props),
    element: <VideoLivePrelim {...props} />,
    applicationId: input.applicationId,
    seasonId: input.seasonId,
  })
}

type SendVideoLiveMainInput = {
  toEmail: string
  country: string | null | undefined
  creatorUserId: string | null
  nickname: string
  seasonName: string
  videoTitle: string | null
  thumbnailUrl: string | null
  voteDeadline: string
  viewCount: number
  applicationId: string
  seasonId?: string | null
  forceLang?: EmailLang
}

export async function sendVideoLiveMain(input: SendVideoLiveMainInput): Promise<SendResult> {
  const lang = input.forceLang ?? detectEmailLang(input.country)
  const watchUrl = `${APP_BASE}/watch/${input.applicationId}?round=main`
  const props: VideoLiveMainProps = {
    lang,
    nickname: input.nickname,
    seasonName: input.seasonName,
    videoTitle: titleOrUntitled(input.videoTitle, lang),
    thumbnailUrl: input.thumbnailUrl,
    watchUrl,
    shareUrl: shareLink(watchUrl, input.creatorUserId, 'main_round_live'),
    voteDeadline: input.voteDeadline,
    viewCount: input.viewCount,
  }
  return executeSend({
    toEmail: input.toEmail,
    templateKey: 'video_live_main',
    language: lang,
    subject: videoLiveMainSubject(props),
    element: <VideoLiveMain {...props} />,
    applicationId: input.applicationId,
    seasonId: input.seasonId,
  })
}
