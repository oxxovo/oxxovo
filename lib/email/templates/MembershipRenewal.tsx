// P4e -- pre-renewal notice for a PAID creator membership. Fired by email-tick
// ~membership_renewal_notice_days before membership_expires_at, once per billing
// period (the notified_at column resets on each invoice.paid). This is the
// "we're about to auto-renew" heads-up, never a charge confirmation.

import { Heading, Text } from '@react-email/components'
import { Layout } from '../components/Layout'
import type { EmailLang } from '../lang'

export type MembershipRenewalProps = {
  lang: EmailLang
  creatorName: string
  priceUsd: number
  interval: string // 'month' | 'year' (from config)
  renewsOn: string | null // membership_expires_at ISO
}

export function MembershipRenewal(p: MembershipRenewalProps) {
  return p.lang === 'ko' ? <Korean {...p} /> : <English {...p} />
}

export function subjectFor(p: MembershipRenewalProps): string {
  return p.lang === 'ko'
    ? `[OXXOVO] 크리에이터 멤버십이 곧 갱신됩니다`
    : `[OXXOVO] Your creator membership renews soon`
}

function priceLabel(priceUsd: number): string {
  return `$${priceUsd.toFixed(2)}`
}

function intervalKo(interval: string): string {
  if (interval === 'year') return '1년'
  if (interval === 'week') return '1주'
  if (interval === 'day') return '1일'
  return '월'
}

function intervalEn(interval: string): string {
  return `/${interval}`
}

function formatDateKo(iso: string | null): string {
  if (!iso) return '갱신 예정일'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '갱신 예정일'
  return d.toLocaleString('ko-KR', { dateStyle: 'long' })
}

function formatDateEn(iso: string | null): string {
  if (!iso) return 'the renewal date'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'the renewal date'
  return d.toLocaleString('en-US', { dateStyle: 'long' })
}

function Korean(p: MembershipRenewalProps) {
  return (
    <Layout lang="ko" preview="크리에이터 멤버십이 곧 자동 갱신됩니다.">
      <Heading style={headingStyle}>멤버십이 곧 갱신됩니다.</Heading>
      <Text style={paragraph}>
        {p.creatorName}님, 크리에이터 멤버십이{' '}
        <strong>{formatDateKo(p.renewsOn)}</strong>에 자동으로 갱신됩니다.
      </Text>
      <Text style={paragraph}>
        갱신 금액: <strong>{intervalKo(p.interval)} {priceLabel(p.priceUsd)}</strong>
        <br />
        별도로 하실 일은 없습니다 — 멤버십을 계속 유지하시려면 그대로 두시면
        됩니다.
      </Text>
      <Text style={muted}>
        갱신을 원하지 않으시면 갱신일 전에 프로필 페이지에서 멤버십을 해지할 수
        있습니다. 해지하셔도 현재 기간이 끝날 때까지는 크리에이터 권한이
        유지됩니다.
      </Text>
      <Text style={signoff}>OXXOVO 운영팀 드림</Text>
    </Layout>
  )
}

function English(p: MembershipRenewalProps) {
  return (
    <Layout lang="en" preview="Your creator membership is about to renew.">
      <Heading style={headingStyle}>Your membership renews soon.</Heading>
      <Text style={paragraph}>
        Hi {p.creatorName}, your creator membership will renew automatically on{' '}
        <strong>{formatDateEn(p.renewsOn)}</strong>.
      </Text>
      <Text style={paragraph}>
        Renewal amount:{' '}
        <strong>
          {priceLabel(p.priceUsd)}
          {intervalEn(p.interval)}
        </strong>
        <br />
        There&rsquo;s nothing you need to do &mdash; leave it as is to keep your
        membership active.
      </Text>
      <Text style={muted}>
        If you&rsquo;d rather not renew, you can cancel from your profile page
        before the renewal date. You&rsquo;ll keep creator access until the end of
        the current period either way.
      </Text>
      <Text style={signoff}>&mdash; The OXXOVO team</Text>
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
