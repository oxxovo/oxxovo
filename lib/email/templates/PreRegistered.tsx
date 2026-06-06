// Sent when a visitor pre-registers their email on /pre-register ("notify me
// when applications open"). This is NOT an application — it only confirms the
// email is on the early-notice list for the named season. The actual /apply
// step happens later, when applications open.

import { Heading, Text } from '@react-email/components'
import { Layout } from '../components/Layout'
import type { EmailLang } from '../lang'

export type PreRegisteredProps = {
  lang: EmailLang
  seasonName: string
}

export function PreRegistered(p: PreRegisteredProps) {
  return p.lang === 'ko' ? <Korean {...p} /> : <English {...p} />
}

export function subjectFor(p: PreRegisteredProps): string {
  return p.lang === 'ko'
    ? `[OXXOVO] ${p.seasonName} 사전 등록이 완료되었습니다`
    : `[OXXOVO] You're pre-registered for ${p.seasonName}`
}

function Korean(p: PreRegisteredProps) {
  return (
    <Layout lang="ko" preview={`${p.seasonName} 사전 등록 완료.`}>
      <Heading style={headingStyle}>사전 등록이 완료되었습니다.</Heading>
      <Text style={paragraph}>
        <strong>{p.seasonName}</strong> 사전 등록 명단에 이 이메일 주소가
        등록되었습니다.
      </Text>
      <Text style={paragraph}>
        신청이 열리면 이 주소로 가장 먼저 안내 메일을 보내드립니다. 별도로
        준비하실 것은 없습니다.
      </Text>
      <Text style={muted}>
        본인이 신청한 적이 없다면 이 메일은 무시하셔도 됩니다.
      </Text>
      <Text style={signoff}>OXXOVO Genesis 운영팀 드림</Text>
    </Layout>
  )
}

function English(p: PreRegisteredProps) {
  return (
    <Layout lang="en" preview={`You're on the ${p.seasonName} early-notice list.`}>
      <Heading style={headingStyle}>You&rsquo;re pre-registered.</Heading>
      <Text style={paragraph}>
        This email address is on the <strong>{p.seasonName}</strong>{' '}
        pre-registration list.
      </Text>
      <Text style={paragraph}>
        When applications open, we&rsquo;ll email you here first &mdash; there&rsquo;s
        nothing else you need to do right now.
      </Text>
      <Text style={muted}>
        If you didn&rsquo;t sign up, you can safely ignore this email.
      </Text>
      <Text style={signoff}>&mdash; The OXXOVO Genesis team</Text>
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
