// Sent when advancement sets status='rejected' — applicant did not reach the
// main round. This is a RETENTION tool, not a rejection: it hands the creator a
// Season Report (their Triple-AI score, percentile, strongest trait, biggest
// growth lever), reminds them their work stays public on Watch, and drives them
// to the next season with a hard reset promise ("no score carries over").
//
// All dynamic values are computed upstream (email-tick fireFinalistResults):
// score/rank/total/percentile from the season's scored pool, strength/
// improvement from scoring_results.ai_outputs, links + next-season dates resolved
// in send.tsx. Tone: respectful, honest, encouraging — never false hope.

import { Heading, Text, Section, Button, Hr, Link } from '@react-email/components'
import { Layout } from '../components/Layout'
import type { EmailLang } from '../lang'

export type NotSelectedProps = {
  lang: EmailLang
  creatorName: string
  seasonName: string
  score: number
  rank: number
  total: number
  percentile: number // "top X%" (already rounded)
  strength: string
  improvement: string
  videoUrl: string
  profileUrl: string
  nextSeasonName: string
  nextSeasonDate: string // localized, or "" when unknown
  applyUrl: string
}

export function NotSelected(p: NotSelectedProps) {
  return p.lang === 'ko' ? <Korean {...p} /> : <English {...p} />
}

export function subjectFor(p: NotSelectedProps): string {
  return p.lang === 'ko'
    ? `OXXOVO ${p.seasonName} 평가 결과가 도착했습니다`
    : `Your OXXOVO ${p.seasonName} results are in`
}

// ── Season Report card (shared visual, localized labels) ────────────────────
function ReportCard(p: NotSelectedProps & { L: Record<string, string> }) {
  return (
    <Section style={card}>
      <Text style={rowLine}>
        <span style={emoji}>🏅</span> <strong>{p.L.score}</strong>{' '}
        <span style={scoreVal}>{Math.round(p.score)} / 100</span>
      </Text>
      <Text style={rowLine}>
        <span style={emoji}>📈</span> <strong>{p.L.percentile}</strong>{' '}
        {p.L.top} {p.percentile}% ({p.rank} / {p.total})
      </Text>
      <Text style={rowLine}>
        <span style={emoji}>💪</span> <strong>{p.L.strength}</strong>
        <br />
        <span style={detail}>{p.strength}</span>
      </Text>
      <Text style={rowLine}>
        <span style={emoji}>🎯</span> <strong>{p.L.improvement}</strong>
        <br />
        <span style={detail}>{p.improvement}</span>
      </Text>
      <Text style={{ ...rowLine, margin: '4px 0 0' }}>
        <span style={emoji}>🎬</span>{' '}
        <Link href={p.videoUrl} style={inlineLink}>
          {p.L.watchMine}
        </Link>
      </Text>
    </Section>
  )
}

function Korean(p: NotSelectedProps) {
  const L = {
    score: 'Triple-AI 점수',
    percentile: '전체 참가자 중',
    top: '상위',
    strength: '가장 강했던 요소',
    improvement: '개선 효과가 가장 클 요소',
    watchMine: '내 작품 보기',
  }
  return (
    <Layout lang="ko" preview={`${p.seasonName} 평가 결과 — Season Report가 도착했습니다.`}>
      <Heading style={headingStyle}>안녕하세요, {p.creatorName}님</Heading>
      <Text style={paragraph}>
        OXXOVO {p.seasonName}에 참가해 주셔서 감사합니다. 귀하의 작품에 대한 공식
        Triple-AI 평가가 완료되었습니다. 이번 시즌에는 아쉽게도 본선 진출작으로
        선정되지는 않았습니다.
      </Text>
      <Text style={paragraph}>
        하지만 이것이 끝은 아닙니다. 모든 훌륭한 감독은 우승하기 전에 먼저
        도전했습니다.
      </Text>

      <Heading as="h2" style={sectionHead}>
        📋 Season Report
      </Heading>
      <ReportCard {...p} L={L} />

      <Hr style={hr} />
      <Heading as="h2" style={sectionHead}>
        당신의 작품은 계속 공개됩니다
      </Heading>
      <Text style={paragraph}>
        귀하의 작품은 OXXOVO 공식 Watch에 계속 공개되며, 언제든 다른 사람들에게
        보여집니다.
      </Text>

      <Hr style={hr} />
      <Heading as="h2" style={sectionHead}>
        {p.nextSeasonName}
        {p.nextSeasonDate ? ` — ${p.nextSeasonDate} 시작` : ''}
      </Heading>
      <Text style={paragraph}>
        <strong>모든 시즌은 새로운 시작입니다. 지난 시즌의 점수는 다음 시즌으로
        이어지지 않습니다.</strong> 다음 작품이 당신의 랭킹을 만듭니다.
      </Text>
      <Section style={{ textAlign: 'center', margin: '28px 0 8px' }}>
        <Button href={p.applyUrl} style={ctaButton}>
          🚀 {p.nextSeasonName} 참가하기
        </Button>
      </Section>
      <Text style={{ ...muted, textAlign: 'center' }}>
        <Link href={p.profileUrl} style={inlineLink}>
          전체 평가 보기
        </Link>
      </Text>

      <Hr style={hr} />
      <Text style={closer}>
        AI는 쉽습니다. 우승은 어렵습니다.
        <br />
        {p.nextSeasonName}에서 다시 만나겠습니다.
      </Text>
      <Text style={signoff}>OXXOVO 드림</Text>
    </Layout>
  )
}

function English(p: NotSelectedProps) {
  const L = {
    score: 'Triple-AI Score',
    percentile: 'Among all entrants',
    top: 'top',
    strength: 'Your strongest trait',
    improvement: 'Biggest room to grow',
    watchMine: 'Watch my entry',
  }
  return (
    <Layout lang="en" preview={`Your ${p.seasonName} results — Season Report inside.`}>
      <Heading style={headingStyle}>Hi {p.creatorName},</Heading>
      <Text style={paragraph}>
        Thank you for entering OXXOVO {p.seasonName}. Your official Triple-AI
        evaluation is complete. This season your entry was not selected for the
        main round.
      </Text>
      <Text style={paragraph}>
        But this isn&rsquo;t the end. Every great director entered before they
        ever won.
      </Text>

      <Heading as="h2" style={sectionHead}>
        📋 Season Report
      </Heading>
      <ReportCard {...p} L={L} />

      <Hr style={hr} />
      <Heading as="h2" style={sectionHead}>
        Your work stays public
      </Heading>
      <Text style={paragraph}>
        Your entry remains live on OXXOVO&rsquo;s official Watch for anyone to
        discover, any time.
      </Text>

      <Hr style={hr} />
      <Heading as="h2" style={sectionHead}>
        {p.nextSeasonName}
        {p.nextSeasonDate ? ` — starts ${p.nextSeasonDate}` : ''}
      </Heading>
      <Text style={paragraph}>
        <strong>Every season is a new beginning. No creator carries
        yesterday&rsquo;s score into tomorrow&rsquo;s competition.</strong> Your
        next entry makes your ranking.
      </Text>
      <Section style={{ textAlign: 'center', margin: '28px 0 8px' }}>
        <Button href={p.applyUrl} style={ctaButton}>
          🚀 Enter {p.nextSeasonName}
        </Button>
      </Section>
      <Text style={{ ...muted, textAlign: 'center' }}>
        <Link href={p.profileUrl} style={inlineLink}>
          See full evaluation
        </Link>
      </Text>

      <Hr style={hr} />
      <Text style={closer}>
        AI is easy. Winning is hard.
        <br />
        See you in {p.nextSeasonName}.
      </Text>
      <Text style={signoff}>— OXXOVO</Text>
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
const sectionHead: React.CSSProperties = {
  color: '#0a0608',
  fontSize: 17,
  lineHeight: 1.4,
  fontWeight: 700,
  margin: '0 0 12px',
}
const paragraph: React.CSSProperties = {
  color: '#1a1a1f',
  fontSize: 15,
  lineHeight: 1.7,
  margin: '0 0 14px',
}
const card: React.CSSProperties = {
  background: '#f6f2ff',
  border: '1px solid #e4d8ff',
  borderRadius: 12,
  padding: '18px 20px',
  margin: '0 0 8px',
}
const rowLine: React.CSSProperties = {
  color: '#1a1a1f',
  fontSize: 15,
  lineHeight: 1.6,
  margin: '0 0 12px',
}
const emoji: React.CSSProperties = { fontSize: 16 }
const scoreVal: React.CSSProperties = { color: '#8b22ff', fontWeight: 800 }
const detail: React.CSSProperties = { color: '#40404a', fontSize: 14, lineHeight: 1.6 }
const inlineLink: React.CSSProperties = { color: '#8b22ff', fontWeight: 600, textDecoration: 'underline' }
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
const hr: React.CSSProperties = { borderColor: '#eceaf2', margin: '28px 0' }
const closer: React.CSSProperties = {
  color: '#1a1a1f',
  fontSize: 15,
  lineHeight: 1.7,
  fontWeight: 600,
  margin: '0 0 12px',
}
const muted: React.CSSProperties = { color: '#666666', fontSize: 13, lineHeight: 1.7, margin: '12px 0 0' }
const signoff: React.CSSProperties = { color: '#8b22ff', fontSize: 13, fontWeight: 600, margin: '24px 0 0' }
