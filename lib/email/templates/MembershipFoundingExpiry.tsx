// P4e -- founding free-year ending notice. Fired by email-tick
// ~membership_renewal_notice_days before a founding_free membership's
// membership_expires_at. Founding members have NO Stripe subscription, so this
// is NOT a charge warning -- it's an invitation to subscribe to keep creator
// access. One-time term (notified_at never auto-resets), so one notice.

import { Button, Heading, Section, Text } from '@react-email/components'
import { Layout } from '../components/Layout'
import type { EmailLang } from '../lang'

export type MembershipFoundingExpiryProps = {
  lang: EmailLang
  creatorName: string
  foundingNumber: number
  endsOn: string | null // membership_expires_at ISO
  priceUsd: number
  interval: string // 'month' | 'year' (from config)
  subscribeUrl: string
}

export function MembershipFoundingExpiry(p: MembershipFoundingExpiryProps) {
  return p.lang === 'ko' ? <Korean {...p} /> : <English {...p} />
}

export function subjectFor(p: MembershipFoundingExpiryProps): string {
  return p.lang === 'ko'
    ? `[OXXOVO] 파운딩 무료 기간이 곧 종료됩니다`
    : `[OXXOVO] Your founding free year is ending`
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

// ★2026-08-30 (HQ, render-preview audit): no timeZone -- same bug class as
// SelectedTop50's date (see lib/seasons.ts formatDeadlinePT's comment).
// Date-only by design (no clock time in the copy), so it gets an explicit
// timeZone rather than switching to formatDeadlinePT (which always appends a
// time + PT label).
function formatDateKo(iso: string | null): string {
  if (!iso) return '종료 예정일'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '종료 예정일'
  return d.toLocaleString('ko-KR', { timeZone: 'America/Los_Angeles', dateStyle: 'long' })
}

function formatDateEn(iso: string | null): string {
  if (!iso) return 'soon'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'soon'
  return d.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'long' })
}

function Korean(p: MembershipFoundingExpiryProps) {
  return (
    <Layout lang="ko" preview="파운딩 크리에이터 무료 기간이 곧 종료됩니다.">
      <Heading style={headingStyle}>무료 기간이 곧 종료됩니다.</Heading>
      <Text style={paragraph}>
        {p.creatorName}님은 <strong>파운딩 크리에이터 #{p.foundingNumber}</strong>로,
        지금까지 무료로 크리에이터 멤버십을 이용해 오셨습니다.
      </Text>
      <Text style={paragraph}>
        무료 기간은 <strong>{formatDateKo(p.endsOn)}</strong>에 종료됩니다. 별도의
        자동 결제는 발생하지 않습니다 — 계속 이용하시려면 아래에서 직접 구독을
        시작해 주세요.
      </Text>
      <Text style={paragraph}>
        구독 금액: <strong>{intervalKo(p.interval)} {priceLabel(p.priceUsd)}</strong>
      </Text>
      <Section style={ctaWrap}>
        <Button style={ctaButton} href={p.subscribeUrl}>
          구독하고 계속하기
        </Button>
      </Section>
      <Text style={muted}>
        구독하지 않으셔도 일반 멤버로 전환되어 투표 등 기본 기능은 계속 이용하실
        수 있습니다.
      </Text>
      <Text style={signoff}>OXXOVO 운영팀 드림</Text>
    </Layout>
  )
}

function English(p: MembershipFoundingExpiryProps) {
  return (
    <Layout lang="en" preview="Your founding free year is ending soon.">
      <Heading style={headingStyle}>Your free year is ending.</Heading>
      <Text style={paragraph}>
        {p.creatorName}, as <strong>Founding Creator #{p.foundingNumber}</strong>{' '}
        you&rsquo;ve had creator membership free this whole time.
      </Text>
      <Text style={paragraph}>
        Your free period ends on <strong>{formatDateEn(p.endsOn)}</strong>. There&rsquo;s
        no automatic charge &mdash; to keep creator access, start a subscription
        below.
      </Text>
      <Text style={paragraph}>
        Subscription:{' '}
        <strong>
          {priceLabel(p.priceUsd)}
          {intervalEn(p.interval)}
        </strong>
      </Text>
      <Section style={ctaWrap}>
        <Button style={ctaButton} href={p.subscribeUrl}>
          Subscribe to continue
        </Button>
      </Section>
      <Text style={muted}>
        If you don&rsquo;t subscribe, your account simply returns to a free member
        &mdash; you keep the vote and the basics.
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

const ctaWrap: React.CSSProperties = {
  margin: '24px 0',
}

const ctaButton: React.CSSProperties = {
  background: '#8b22ff',
  color: '#ffffff',
  fontSize: 15,
  fontWeight: 700,
  padding: '12px 28px',
  borderRadius: 8,
  textDecoration: 'none',
  display: 'inline-block',
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
