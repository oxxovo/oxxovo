// PLACEHOLDER COPY -- wording is 제니3's, this is the wiring only (HQ
// 2026-08-12). Sent D-14/7/3/1 before registration_close_at (not
// application_close_at) to everyone currently registered for the season.
// Values available to the real copy: currentCount, minParticipants,
// deferralPossible (currentCount < minParticipants at send time),
// registrationCloseAt.

import { Heading, Text } from '@react-email/components'
import { Layout } from '../components/Layout'
import type { EmailLang } from '../lang'
import { formatDeadlinePT } from '@/lib/seasons'

export type RegistrationCountProps = {
  lang: EmailLang
  creatorName: string
  seasonName: string
  currentCount: number
  minParticipants: number
  registrationCloseAt: string | null
  reminderDay: number
}

export function RegistrationCount(p: RegistrationCountProps) {
  return p.lang === 'ko' ? <Korean {...p} /> : <English {...p} />
}

export function subjectFor(p: RegistrationCountProps): string {
  return p.lang === 'ko'
    ? `[OXXOVO] ${p.seasonName} 등록 현황 (마감 D-${p.reminderDay})`
    : `[OXXOVO] ${p.seasonName} registration update (D-${p.reminderDay})`
}

function Korean(p: RegistrationCountProps) {
  const deadline = formatDeadlinePT(p.registrationCloseAt)
  const deferralPossible = p.currentCount < p.minParticipants
  return (
    <Layout lang="ko" preview={`현재 등록 ${p.currentCount}명 / 최소 ${p.minParticipants}명.`}>
      <Heading style={headingStyle}>
        {p.creatorName}님, {p.seasonName} 등록 현황을 안내드립니다.
      </Heading>
      <Text style={paragraph}>
        현재 등록 인원: <strong>{p.currentCount}명</strong> / 최소 성립 인원:{' '}
        <strong>{p.minParticipants}명</strong>
      </Text>
      {deferralPossible && (
        <Text style={paragraph}>
          최소 인원에 도달하지 못하면 일정이 연기될 수 있습니다. 미달이면
          연기되니 안심하고 신청하셔도 됩니다.
        </Text>
      )}
      {deadline && (
        <Text style={paragraph}>
          등록 마감: <strong>{deadline}</strong>
        </Text>
      )}
      <Text style={muted}>이미 등록을 완료하셨다면 별도로 하실 일은 없습니다.</Text>
      <Text style={signoff}>OXXOVO Genesis 운영팀 드림</Text>
    </Layout>
  )
}

function English(p: RegistrationCountProps) {
  const deadline = formatDeadlinePT(p.registrationCloseAt)
  const deferralPossible = p.currentCount < p.minParticipants
  return (
    <Layout lang="en" preview={`${p.currentCount} registered / ${p.minParticipants} needed.`}>
      <Heading style={headingStyle}>
        Hi {p.creatorName} — {p.seasonName} registration update.
      </Heading>
      <Text style={paragraph}>
        Currently registered: <strong>{p.currentCount}</strong> / minimum needed:{' '}
        <strong>{p.minParticipants}</strong>
      </Text>
      {deferralPossible && (
        <Text style={paragraph}>
          If the minimum isn&rsquo;t reached, the schedule may be deferred a
          week. Register with confidence — a shortfall defers the season, it
          doesn&rsquo;t disqualify you.
        </Text>
      )}
      {deadline && (
        <Text style={paragraph}>
          Registration closes: <strong>{deadline}</strong>
        </Text>
      )}
      <Text style={muted}>No action needed if you&rsquo;re already registered.</Text>
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
