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
import { getResend, EMAIL_FROM } from './client'
import type { RankAward } from '@/lib/seasons'
import { detectEmailLang, type EmailLang } from './lang'
import { logEmail, alreadySent, type TemplateKey } from './log'
import {
  PreRegistered,
  subjectFor as preRegisteredSubject,
  type PreRegisteredProps,
} from './templates/PreRegistered'
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
  ResultsAnnounced,
  subjectFor as resultsAnnouncedSubject,
  type ResultsAnnouncedProps,
} from './templates/ResultsAnnounced'
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
import { isMemberHostedEnabled } from '@/lib/member-hosted'

export type SendResult =
  | { ok: true; messageId: string | null; skipped?: false }
  | { ok: true; messageId: null; skipped: true; reason: 'already_sent' | 'member_hosted_disabled' }
  | { ok: false; error: string }

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
}

// Shared engine: dedup + render + resend + log. Every send* helper funnels
// through this so retry/dedup/logging behavior is identical across templates.
async function executeSend(input: ExecuteSendInput): Promise<SendResult> {
  const baseMetadata: Record<string, unknown> | null =
    input.reminderHour != null ? { reminder_hour: input.reminderHour } : null

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
    })

    if (error) {
      await logEmail({
        applicationId: input.applicationId,
        seasonId: input.seasonId,
        toEmail: input.toEmail,
        templateKey: input.templateKey,
        language: input.language,
        subject: input.subject,
        status: 'failed',
        errorMessage: error.message,
        metadata: baseMetadata,
      })
      return { ok: false, error: error.message }
    }

    await logEmail({
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
  applicationId?: string | null
  seasonId?: string | null
  forceLang?: EmailLang
}

export async function sendSelectedTop50(
  input: SendSelectedTop50Input,
): Promise<SendResult> {
  const lang = input.forceLang ?? detectEmailLang(input.country)
  const props: SelectedTop50Props = {
    lang,
    creatorName: input.creatorName,
    seasonName: input.seasonName,
    topNAdvance: input.topNAdvance,
    totalParticipants: input.totalParticipants,
    mainRoundStartAt: input.mainRoundStartAt,
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

type SendResultsAnnouncedInput = {
  toEmail: string
  country: string | null | undefined
  creatorName: string
  seasonName: string
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
