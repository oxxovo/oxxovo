// Sent when admin sets status='rejected' — applicant did not advance to the
// main round. Tone: respectful, brief, no false hope. Mentions that future
// seasons reopen for entry.

import { Heading, Text } from '@react-email/components'
import { Layout } from '../components/Layout'
import { RESULT_INTEGRITY_NOTE_KO, RESULT_INTEGRITY_NOTE_EN } from '../messages'
import type { EmailLang } from '../lang'

export type NotSelectedProps = {
  lang: EmailLang
  creatorName: string
  seasonName: string
}

export function NotSelected(p: NotSelectedProps) {
  return p.lang === 'ko' ? <Korean {...p} /> : <English {...p} />
}

export function subjectFor(p: NotSelectedProps): string {
  return p.lang === 'ko'
    ? `[OXXOVO] ${p.seasonName} 본선 진출자 안내`
    : `[OXXOVO] ${p.seasonName} main round selection update`
}

function Korean(p: NotSelectedProps) {
  return (
    <Layout
      lang="ko"
      preview={`${p.seasonName} 본선 진출자 안내드립니다.`}
    >
      <Heading style={headingStyle}>
        {p.creatorName}님께,
      </Heading>
      <Text style={paragraph}>
        Triple-AI 채점이 마무리되었습니다. 안타깝게도 이번{' '}
        <strong>{p.seasonName}</strong>에서는 본선 진출자로 선정되지
        못하셨다는 결과를 전해드립니다.
      </Text>
      <Text style={paragraph}>
        시간을 들여 영상을 만들어 제출해주신 점, 진심으로 감사드립니다. OXXOVO
        프로필에 본인 채점 결과가 게시되어 있으니 참고하실 수 있습니다.
      </Text>
      <Text style={muted}>
        {RESULT_INTEGRITY_NOTE_KO} 다음 시즌도 동일한 기준으로 열립니다.
      </Text>
      <Text style={signoff}>OXXOVO Genesis 운영팀 드림</Text>
    </Layout>
  )
}

function English(p: NotSelectedProps) {
  return (
    <Layout
      lang="en"
      preview={`${p.seasonName} main round selection update.`}
    >
      <Heading style={headingStyle}>
        Hi {p.creatorName},
      </Heading>
      <Text style={paragraph}>
        Triple-AI scoring is complete. Your{' '}
        <strong>{p.seasonName}</strong> entry was not selected for the main
        round this time.
      </Text>
      <Text style={paragraph}>
        Thank you for putting the work in — your score breakdown is posted on
        your OXXOVO profile if you&rsquo;d like to review it.
      </Text>
      <Text style={muted}>
        {RESULT_INTEGRITY_NOTE_EN} The next season opens on the same terms.
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
