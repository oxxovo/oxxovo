// Reminder sent automatically by Phase 5c cron when the submission window has
// `hoursRemaining` left. Goes to selected applicants who have NOT yet submitted
// their main-round entry.

import { Heading, Text } from '@react-email/components'
import { Layout } from '../components/Layout'
import type { EmailLang } from '../lang'

export type SubmissionDeadlineProps = {
  lang: EmailLang
  creatorName: string
  seasonName: string
  hoursRemaining: number
}

export function SubmissionDeadline(p: SubmissionDeadlineProps) {
  return p.lang === 'ko' ? <Korean {...p} /> : <English {...p} />
}

export function subjectFor(p: SubmissionDeadlineProps): string {
  return p.lang === 'ko'
    ? `[OXXOVO] 제출 마감 ${p.hoursRemaining}시간 전입니다`
    : `[OXXOVO] ${p.hoursRemaining} hours left to submit`
}

function Korean(p: SubmissionDeadlineProps) {
  return (
    <Layout
      lang="ko"
      preview={`${p.seasonName} 제출 마감 ${p.hoursRemaining}시간 전.`}
    >
      <Heading style={headingStyle}>
        {p.creatorName}님, 제출 마감 {p.hoursRemaining}시간 전입니다.
      </Heading>
      <Text style={paragraph}>
        <strong>{p.seasonName}</strong> 본선 영상 제출까지{' '}
        <strong>{p.hoursRemaining}시간</strong>이 남았습니다. 아직 제출이
        완료되지 않은 상태로 확인되어 안내드립니다.
      </Text>
      <Text style={paragraph}>
        OXXOVO 프로필에서 영상 업로드를 완료해주세요. 마감 시각이 지나면
        시스템이 자동으로 제출을 잠그며, 별도 예외 처리는 운영팀도 할 수 없는
        구조입니다.
      </Text>
      <Text style={muted}>
        이미 제출하셨다면 본 메일은 무시하셔도 됩니다. 본 메일은 미제출자에게만
        자동 발송됩니다.
      </Text>
      <Text style={signoff}>OXXOVO Genesis 운영팀 드림</Text>
    </Layout>
  )
}

function English(p: SubmissionDeadlineProps) {
  return (
    <Layout
      lang="en"
      preview={`${p.seasonName} submission closes in ${p.hoursRemaining}h.`}
    >
      <Heading style={headingStyle}>
        Hi {p.creatorName} — {p.hoursRemaining} hours to submit.
      </Heading>
      <Text style={paragraph}>
        You have <strong>{p.hoursRemaining} hours</strong> left to submit your{' '}
        <strong>{p.seasonName}</strong>
        {' '}main-round entry. We&rsquo;re sending this because your submission
        is still showing as incomplete.
      </Text>
      <Text style={paragraph}>
        Upload your video from your OXXOVO profile to lock it in. Once the
        deadline passes, the system automatically closes submissions — no manual
        overrides are possible, even by operators.
      </Text>
      <Text style={muted}>
        If you&rsquo;ve already submitted, ignore this email. These reminders
        only go to applicants who haven&rsquo;t submitted yet.
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
