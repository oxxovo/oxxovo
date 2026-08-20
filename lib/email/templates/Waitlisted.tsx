// Sent when /apply succeeds but the season is at capacity, so the application
// is filed with status='waitlist' instead of 'pending'. Sets expectation that
// the entry is in the queue but not guaranteed a spot.

import { Heading, Text } from '@react-email/components'
import { Layout } from '../components/Layout'
import type { EmailLang } from '../lang'

export type WaitlistedProps = {
  lang: EmailLang
  creatorName: string
  seasonName: string
  maxApplicants: number
}

export function Waitlisted(p: WaitlistedProps) {
  return p.lang === 'ko' ? <Korean {...p} /> : <English {...p} />
}

export function subjectFor(p: WaitlistedProps): string {
  return p.lang === 'ko'
    ? `[OXXOVO] ${p.seasonName} 대기자 명단에 등록되었습니다`
    : `[OXXOVO] You're on the ${p.seasonName} waitlist`
}

function Korean(p: WaitlistedProps) {
  return (
    <Layout
      lang="ko"
      preview={`${p.seasonName} 대기자 명단 등록 완료.`}
    >
      <Heading style={headingStyle}>
        {p.creatorName}님, 대기자 명단에 등록되었습니다.
      </Heading>
      <Text style={paragraph}>
        <strong>{p.seasonName}</strong> 정원{' '}
        <strong>{p.maxApplicants.toLocaleString()}명</strong>이 모두 차서, 신청을
        대기자 명단으로 접수했습니다.
      </Text>
      <Text style={paragraph}>
        이번 시즌은 정원이 찼습니다. 다음 시즌 일정은 공개되는 대로
        안내해 드리겠습니다.
      </Text>
      <Text style={signoff}>OXXOVO Genesis 운영팀 드림</Text>
    </Layout>
  )
}

function English(p: WaitlistedProps) {
  return (
    <Layout lang="en" preview={`Your ${p.seasonName} entry is on the waitlist.`}>
      <Heading style={headingStyle}>
        Hi {p.creatorName} — you&rsquo;re on the waitlist.
      </Heading>
      <Text style={paragraph}>
        <strong>{p.seasonName}</strong> has reached its capacity of{' '}
        <strong>{p.maxApplicants.toLocaleString()}</strong>, so your entry has
        been filed on the waitlist.
      </Text>
      <Text style={paragraph}>
        This season&rsquo;s field is full. The next season&rsquo;s schedule
        will be announced when it&rsquo;s set.
      </Text>
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
