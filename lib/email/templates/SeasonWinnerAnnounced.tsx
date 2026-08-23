// HQ 2026-08-22 (new email 1 of 2): "the winner is out" -- fired at
// awards_announcement_at, same instant as results_announced (#15), but to
// the OPPOSITE cohort: prelim non-advancers (status='rejected'), who never
// reach results_announced's query (that stays main-round-only, unchanged).
// This is NOT a second results notice -- NotSelected already gave them
// their own score/rank/feedback weeks earlier at finalist advancement. This
// is a season-closing FYI: the competition they entered has a winner now,
// Watch is worth a look. Deliberately its own templateKey/function so it
// can never be confused with results_announced's 4 placement variants.
// Placeholder copy pending 제니3 -- wiring/timing only.

import { Heading, Text, Section, Button } from '@react-email/components'
import { Layout } from '../components/Layout'
import type { EmailLang } from '../lang'

export type SeasonWinnerAnnouncedProps = {
  lang: EmailLang
  creatorName: string
  seasonName: string
  watchUrl: string
}

export function SeasonWinnerAnnounced(p: SeasonWinnerAnnouncedProps) {
  return p.lang === 'ko' ? <Korean {...p} /> : <English {...p} />
}

export function subjectFor(p: SeasonWinnerAnnouncedProps): string {
  return p.lang === 'ko'
    ? `[OXXOVO] ${p.seasonName} 우승작이 나왔습니다`
    : `[OXXOVO] ${p.seasonName}'s winner is out`
}

function Korean(p: SeasonWinnerAnnouncedProps) {
  return (
    <Layout lang="ko" preview={`${p.seasonName} 우승작이 발표되었습니다.`}>
      <Heading style={headingStyle}>{p.creatorName}님, {p.seasonName} 우승작이 나왔습니다.</Heading>
      <Text style={paragraph}>
        참가해 주셔서 감사합니다. <strong>{p.seasonName}</strong>의 본선 결과 —
        우승작과 순위 — 가 지금 OXXOVO Watch에 공개되었습니다.
      </Text>
      <Section style={{ textAlign: 'center', margin: '20px 0' }}>
        <Button href={p.watchUrl} style={ctaButton}>
          🏆 결과 보러 가기
        </Button>
      </Section>
      <Text style={signoff}>OXXOVO Genesis 운영팀 드림</Text>
    </Layout>
  )
}

function English(p: SeasonWinnerAnnouncedProps) {
  return (
    <Layout lang="en" preview={`${p.seasonName}'s winner is out.`}>
      <Heading style={headingStyle}>Hi {p.creatorName} — {p.seasonName}&rsquo;s winner is out.</Heading>
      <Text style={paragraph}>
        Thanks for entering. The <strong>{p.seasonName}</strong> main-round
        results — the winner and full standings — are live on OXXOVO Watch
        now.
      </Text>
      <Section style={{ textAlign: 'center', margin: '20px 0' }}>
        <Button href={p.watchUrl} style={ctaButton}>
          🏆 See the results
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
