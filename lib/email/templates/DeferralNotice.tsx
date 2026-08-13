// PLACEHOLDER COPY -- wording is 제니3's, this is the wiring only (HQ
// 2026-08-12). Fired once per application_defer_count value when
// defer_season_schedule actually shifts a season's calendar, to everyone
// currently registered. Values available to the real copy: deferCount,
// maxDeferCount, newRegistrationCloseAt, newApplicationCloseAt.

import { Heading, Text } from '@react-email/components'
import { Layout } from '../components/Layout'
import type { EmailLang } from '../lang'
import { formatDeadlinePT } from '@/lib/seasons'

export type DeferralNoticeProps = {
  lang: EmailLang
  creatorName: string
  seasonName: string
  deferCount: number
  maxDeferCount: number
  newRegistrationCloseAt: string | null
  newApplicationCloseAt: string | null
}

export function DeferralNotice(p: DeferralNoticeProps) {
  return p.lang === 'ko' ? <Korean {...p} /> : <English {...p} />
}

export function subjectFor(p: DeferralNoticeProps): string {
  return p.lang === 'ko'
    ? `[OXXOVO] ${p.seasonName} 일정이 1주 연기되었습니다`
    : `[OXXOVO] ${p.seasonName} schedule extended by one week`
}

function Korean(p: DeferralNoticeProps) {
  const registrationClose = formatDeadlinePT(p.newRegistrationCloseAt)
  const submissionClose = formatDeadlinePT(p.newApplicationCloseAt)
  return (
    <Layout lang="ko" preview={`${p.seasonName} 일정이 1주 연기되었습니다.`}>
      <Heading style={headingStyle}>
        {p.creatorName}님, {p.seasonName} 일정 변경을 안내드립니다.
      </Heading>
      <Text style={paragraph}>
        최소 성립 인원에 도달하지 못해 전체 일정이 1주 연기되었습니다
        (연기 {p.deferCount}/{p.maxDeferCount}회차).
      </Text>
      {registrationClose && (
        <Text style={paragraph}>
          변경된 등록 마감: <strong>{registrationClose}</strong>
        </Text>
      )}
      {submissionClose && (
        <Text style={paragraph}>
          변경된 제출 마감: <strong>{submissionClose}</strong>
        </Text>
      )}
      <Text style={muted}>이미 등록/제출하셨다면 별도로 하실 일은 없습니다.</Text>
      <Text style={signoff}>OXXOVO Genesis 운영팀 드림</Text>
    </Layout>
  )
}

function English(p: DeferralNoticeProps) {
  const registrationClose = formatDeadlinePT(p.newRegistrationCloseAt)
  const submissionClose = formatDeadlinePT(p.newApplicationCloseAt)
  return (
    <Layout lang="en" preview={`${p.seasonName}'s schedule was extended by one week.`}>
      <Heading style={headingStyle}>
        Hi {p.creatorName} — {p.seasonName}&rsquo;s schedule changed.
      </Heading>
      <Text style={paragraph}>
        The minimum participant count wasn&rsquo;t reached, so the whole
        schedule was extended by one week (deferral {p.deferCount}/
        {p.maxDeferCount}).
      </Text>
      {registrationClose && (
        <Text style={paragraph}>
          New registration deadline: <strong>{registrationClose}</strong>
        </Text>
      )}
      {submissionClose && (
        <Text style={paragraph}>
          New submission deadline: <strong>{submissionClose}</strong>
        </Text>
      )}
      <Text style={muted}>No action needed if you&rsquo;re already registered/submitted.</Text>
      <Text style={signoff}>— The OXXOVO Genesis team</Text>
    </Layout>
  )
}

const headingStyle: React.CSSProperties = {
  color: '#0a0608',
  fontSize: 26,
  lineHeight: 1.3,
  fontWeight: 800,
  margin: '0 0 16px',
}

const paragraph: React.CSSProperties = {
  color: '#1a1a1f',
  fontSize: 15,
  lineHeight: 1.7,
  margin: '0 0 14px',
}

const muted: React.CSSProperties = {
  color: '#666666',
  fontSize: 13,
  lineHeight: 1.7,
  margin: '20px 0 0',
}

const signoff: React.CSSProperties = {
  color: '#8b22ff',
  fontSize: 13,
  fontWeight: 600,
  margin: '24px 0 0',
}
