// HQ 2026-08-22 (new email 2 of 2): next-season invite. Recipients = every
// participant of the PRIOR season -- any outcome (rejected/selected/
// awarded), per HQ: "미진출·진출·입상 전부". Fired as a side effect of the
// admin confirming the next season's real schedule (see
// fireSeasonInviteIfConfirmed, app/admin/seasons/actions.ts) -- not
// date-based, and deliberately NOT a dedicated admin "Send" button either
// (see that function's header comment: project-automation-philosophy bans
// a separate Send trigger; this rides the existing season-save action the
// same way selected/rejected ride saveStatus).
// Placeholder copy pending 제니3 -- wiring/timing only.

import { Heading, Text, Section, Button } from '@react-email/components'
import { Layout } from '../components/Layout'
import type { EmailLang } from '../lang'

export type SeasonInviteProps = {
  lang: EmailLang
  creatorName: string
  priorSeasonName: string
  nextSeasonName: string
  nextSeasonOpenAt: string // localized, or "" when unknown
  applyUrl: string
}

export function SeasonInvite(p: SeasonInviteProps) {
  return p.lang === 'ko' ? <Korean {...p} /> : <English {...p} />
}

export function subjectFor(p: SeasonInviteProps): string {
  return p.lang === 'ko'
    ? `[OXXOVO] ${p.nextSeasonName} 신청이 열립니다`
    : `[OXXOVO] ${p.nextSeasonName} applications are opening`
}

function Korean(p: SeasonInviteProps) {
  return (
    <Layout lang="ko" preview={`${p.nextSeasonName} 일정이 확정되었습니다.`}>
      <Heading style={headingStyle}>{p.creatorName}님, {p.nextSeasonName} 일정이 확정되었습니다.</Heading>
      <Text style={paragraph}>
        <strong>{p.priorSeasonName}</strong>에 참가해 주셔서 감사합니다.{' '}
        <strong>{p.nextSeasonName}</strong>
        {p.nextSeasonOpenAt ? `이 ${p.nextSeasonOpenAt}부터 신청을 받습니다.` : '의 신청 일정이 곧 공개됩니다.'}
      </Text>
      <Text style={paragraph}>
        모든 시즌은 새로운 시작입니다 — 지난 시즌의 결과는 다음 시즌으로 이어지지 않습니다.
      </Text>
      <Section style={{ textAlign: 'center', margin: '20px 0' }}>
        <Button href={p.applyUrl} style={ctaButton}>
          🚀 {p.nextSeasonName} 알아보기
        </Button>
      </Section>
      <Text style={signoff}>OXXOVO Genesis 운영팀 드림</Text>
    </Layout>
  )
}

function English(p: SeasonInviteProps) {
  return (
    <Layout lang="en" preview={`${p.nextSeasonName}'s schedule is confirmed.`}>
      <Heading style={headingStyle}>Hi {p.creatorName} — {p.nextSeasonName}&rsquo;s schedule is confirmed.</Heading>
      <Text style={paragraph}>
        Thanks for entering <strong>{p.priorSeasonName}</strong>.{' '}
        <strong>{p.nextSeasonName}</strong>
        {p.nextSeasonOpenAt ? ` opens for applications on ${p.nextSeasonOpenAt}.` : "'s application window will be announced soon."}
      </Text>
      <Text style={paragraph}>
        Every season is a new beginning — no result carries over from last time.
      </Text>
      <Section style={{ textAlign: 'center', margin: '20px 0' }}>
        <Button href={p.applyUrl} style={ctaButton}>
          🚀 Check out {p.nextSeasonName}
        </Button>
      </Section>
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
const ctaButton: React.CSSProperties = {
  background: '#8b22ff',
  color: '#ffffff',
  fontSize: 16,
  fontWeight: 700,
  padding: '14px 32px',
  borderRadius: 10,
  textDecoration: 'none',
  display: 'inline-block',
}
const signoff: React.CSSProperties = { color: '#8b22ff', fontSize: 13, fontWeight: 600, margin: '24px 0 0' }
