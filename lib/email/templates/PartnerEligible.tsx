// Sent automatically when a member's cumulative record crosses the partner
// eligibility thresholds (platform_config) and their partner_status flips
// none -> auto_eligible. Congratulates them and points to the partner
// application / activation page. Unlike PartnerInvitation this is never an
// admin action — it is a side-effect of the awarded-rank transition.

import { Heading, Section, Text, Link } from '@react-email/components'
import { Layout } from '../components/Layout'
import type { EmailLang } from '../lang'

export type PartnerEligibleProps = {
  lang: EmailLang
  creatorName: string
  // Raw tier name from member_tier_config (e.g. 'gold'); shown capitalized.
  tier: string
  // Where the member applies / activates as a partner host.
  applyUrl: string
}

function tierLabel(tier: string): string {
  if (!tier) return ''
  return tier.charAt(0).toUpperCase() + tier.slice(1)
}

export function PartnerEligible(p: PartnerEligibleProps) {
  return p.lang === 'ko' ? <Korean {...p} /> : <English {...p} />
}

export function subjectFor(p: PartnerEligibleProps): string {
  return p.lang === 'ko'
    ? `[OXXOVO] 파트너 호스트 자격을 획득하셨습니다`
    : `[OXXOVO] You've qualified to host on OXXOVO`
}

function Korean(p: PartnerEligibleProps) {
  return (
    <Layout lang="ko" preview="파트너 호스트 자격을 획득하셨습니다.">
      <Heading style={headingStyle}>
        축하합니다, {p.creatorName}님 — 파트너 자격 획득!
      </Heading>
      <Text style={paragraph}>
        그동안의 누적 성과로 <strong>{tierLabel(p.tier)} 등급 파트너 호스트</strong>{' '}
        자격을 획득하셨습니다. 이제 직접 토너먼트를 개설하고 상금 풀과 채점
        기준을 설정해 회원님만의 대회를 운영하실 수 있습니다.
      </Text>
      <Section style={ctaWrap}>
        <Link href={p.applyUrl} style={ctaButton}>
          파트너 신청하기
        </Link>
      </Section>
      <Text style={paragraph}>
        신청 후 파트너 약관에 동의하시면 호스트 권한이 활성화됩니다. 개설 가능
        정원과 횟수는 등급에 따라 다르며, 신청 단계에서 안내해 드립니다.
      </Text>
      <Text style={muted}>
        자격은 회원님의 누적 기록에 따라 자동으로 부여되었습니다. 등급은 이후
        상위 성과를 거두시면 자동으로 상향됩니다.
      </Text>
      <Text style={signoff}>OXXOVO 운영팀 드림</Text>
    </Layout>
  )
}

function English(p: PartnerEligibleProps) {
  return (
    <Layout lang="en" preview="You've qualified to host on OXXOVO.">
      <Heading style={headingStyle}>
        Congrats, {p.creatorName} — you qualified to host!
      </Heading>
      <Text style={paragraph}>
        Your cumulative record has earned you{' '}
        <strong>{tierLabel(p.tier)} partner host</strong> status. You can now run
        your own tournaments — setting the prize pool, scoring weights, and theme
        for a competition that&rsquo;s entirely yours.
      </Text>
      <Section style={ctaWrap}>
        <Link href={p.applyUrl} style={ctaButton}>
          Apply as a partner
        </Link>
      </Section>
      <Text style={paragraph}>
        Once you apply and agree to the partner terms, your host access turns
        on. Your applicant capacity and how many tournaments you can run depend
        on your tier — we&rsquo;ll walk you through it when you apply.
      </Text>
      <Text style={muted}>
        This status was granted automatically from your cumulative record. Your
        tier upgrades on its own as you place higher in future seasons.
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
