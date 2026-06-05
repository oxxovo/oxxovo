// Sent when an admin invites someone (registered or not) to become a partner
// host from /admin/partners. The accept button carries a magic-link URL: the
// invitee signs in (creating the account if new), agrees to the partner terms,
// and the profile transitions partner_status invited -> active.
//
// The admin's internal invite note (profiles.partner_invite_note) is an audit
// field and is deliberately NOT shown to the invitee.

import { Heading, Section, Text, Link } from '@react-email/components'
import { Layout } from '../components/Layout'
import type { EmailLang } from '../lang'

export type PartnerInvitationProps = {
  lang: EmailLang
  // null when the invitee is not yet registered (invited by email only).
  recipientName: string | null
  // Raw tier name from member_tier_config (e.g. 'gold'); shown capitalized.
  tier: string
  // Magic-link URL that signs the invitee in and lands on partner activation.
  acceptUrl: string
}

function tierLabel(tier: string): string {
  if (!tier) return ''
  return tier.charAt(0).toUpperCase() + tier.slice(1)
}

export function PartnerInvitation(p: PartnerInvitationProps) {
  return p.lang === 'ko' ? <Korean {...p} /> : <English {...p} />
}

export function subjectFor(p: PartnerInvitationProps): string {
  return p.lang === 'ko'
    ? `[OXXOVO] 파트너 호스트로 초대합니다`
    : `[OXXOVO] You're invited to host on OXXOVO`
}

function Korean(p: PartnerInvitationProps) {
  const greeting = p.recipientName ? `${p.recipientName}님` : '안녕하세요'
  return (
    <Layout lang="ko" preview="OXXOVO 파트너 호스트로 초대합니다.">
      <Heading style={headingStyle}>{greeting}, 파트너 호스트로 초대합니다</Heading>
      <Text style={paragraph}>
        OXXOVO 운영팀이 회원님을{' '}
        <strong>{tierLabel(p.tier)} 등급 파트너 호스트</strong>로 초대합니다.
        파트너 호스트는 직접 토너먼트를 개설하고 상금 풀과 채점 기준을 설정해
        창작자들을 모을 수 있습니다.
      </Text>
      <Section style={ctaWrap}>
        <Link href={p.acceptUrl} style={ctaButton}>
          초대 수락하기
        </Link>
      </Section>
      <Text style={paragraph}>
        위 버튼을 누르면 안전한 로그인 링크를 통해 로그인되고, 파트너 약관에
        동의하시면 즉시 파트너 호스트로 활성화됩니다. 아직 계정이 없으셔도 이
        링크로 바로 시작하실 수 있습니다.
      </Text>
      <Text style={muted}>
        본 초대는 회원님 본인에게만 유효합니다. 혹시 잘못 받으셨다면 이 메일은
        무시하셔도 됩니다.
      </Text>
      <Text style={signoff}>OXXOVO 운영팀 드림</Text>
    </Layout>
  )
}

function English(p: PartnerInvitationProps) {
  const greeting = p.recipientName ? `Hi ${p.recipientName}` : 'Hello'
  return (
    <Layout lang="en" preview="You're invited to host on OXXOVO.">
      <Heading style={headingStyle}>{greeting} — you&rsquo;re invited to host</Heading>
      <Text style={paragraph}>
        The OXXOVO team would like to invite you to become a{' '}
        <strong>{tierLabel(p.tier)} partner host</strong>. Partner hosts run
        their own tournaments — setting the prize pool, scoring weights, and
        theme — and rally creators around them.
      </Text>
      <Section style={ctaWrap}>
        <Link href={p.acceptUrl} style={ctaButton}>
          Accept invitation
        </Link>
      </Section>
      <Text style={paragraph}>
        The button above signs you in through a secure link. Agree to the
        partner terms and you&rsquo;re activated as a host right away. No
        account yet? This link gets you started in one step.
      </Text>
      <Text style={muted}>
        This invitation is valid for you only. If you received it by mistake,
        you can safely ignore this email.
      </Text>
      <Text style={signoff}>— The OXXOVO team</Text>
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

const ctaWrap: React.CSSProperties = {
  textAlign: 'center',
  margin: '24px 0',
}

const ctaButton: React.CSSProperties = {
  display: 'inline-block',
  background: '#8b22ff',
  color: '#ffffff',
  fontSize: 15,
  fontWeight: 700,
  textDecoration: 'none',
  padding: '13px 28px',
  borderRadius: 8,
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
