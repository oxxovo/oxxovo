// Sent to every applicant immediately after /apply submission succeeds with
// status='pending'. Reassures the applicant that their entry is in and
// previews what happens next.

import { Heading, Text } from '@react-email/components'
import { Layout } from '../components/Layout'
import type { EmailLang } from '../lang'

export type ApplicationReceivedProps = {
  lang: EmailLang
  creatorName: string
  seasonName: string
  applicationCount: number
  maxApplicants: number
}

export function ApplicationReceived(p: ApplicationReceivedProps) {
  return p.lang === 'ko' ? <Korean {...p} /> : <English {...p} />
}

export function subjectFor(p: ApplicationReceivedProps): string {
  return p.lang === 'ko'
    ? `[OXXOVO] ${p.seasonName} 신청이 접수되었습니다`
    : `[OXXOVO] We received your ${p.seasonName} entry`
}

function Korean(p: ApplicationReceivedProps) {
  return (
    <Layout
      lang="ko"
      preview={`${p.seasonName} 신청 접수가 완료되었습니다.`}
    >
      <Heading style={headingStyle}>
        {p.creatorName}님, 신청이 접수되었습니다.
      </Heading>
      <Text style={paragraph}>
        <strong>{p.seasonName}</strong>에 참가해주셔서 감사합니다. 신청 내용을
        정상적으로 받았습니다.
      </Text>
      <Text style={paragraph}>
        현재 정원 <strong>{p.maxApplicants.toLocaleString()}명</strong> 중{' '}
        <strong>{p.applicationCount.toLocaleString()}번째</strong> 신청자이시며,
        본인의 영상은 시즌 마감 후 Triple-AI 채점 시스템으로 평가됩니다.
      </Text>
      <Text style={muted}>
        결과가 준비되는 대로 별도 이메일로 안내드리겠습니다. 그동안 본인의 신청
        현황은 OXXOVO 프로필에서 언제든지 확인하실 수 있습니다.
      </Text>
      <Text style={signoff}>OXXOVO Genesis 운영팀 드림</Text>
    </Layout>
  )
}

function English(p: ApplicationReceivedProps) {
  return (
    <Layout
      lang="en"
      preview={`Your ${p.seasonName} entry is in.`}
    >
      <Heading style={headingStyle}>
        Hi {p.creatorName} — your entry is in.
      </Heading>
      <Text style={paragraph}>
        Thanks for entering <strong>{p.seasonName}</strong>. We&rsquo;ve received
        your submission and you&rsquo;re officially in the running.
      </Text>
      <Text style={paragraph}>
        You&rsquo;re applicant{' '}
        <strong>#{p.applicationCount.toLocaleString()}</strong> of{' '}
        <strong>{p.maxApplicants.toLocaleString()}</strong>. Triple-AI scoring
        runs after the season closes — three independent models score every
        entry in parallel to keep the result fair.
      </Text>
      <Text style={muted}>
        We&rsquo;ll email you the moment your results are ready. You can check
        the status of your application anytime on your OXXOVO profile.
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
