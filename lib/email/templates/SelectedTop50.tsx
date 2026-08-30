// Sent when advancement sets status='selected' — the applicant advanced to the
// main round. The "top50" in the template_key refers to Genesis Season 0's
// top_n_advance=50; future seasons may pass a different topNAdvance value.
// Leads with the scale of the field they beat, then the concrete next-round
// timeline (theme drop + submission instructions arrive automatically).
//
// ★HQ 2026-08-22 (item 1, #7): now carries the same prelim Season Report
// NotSelected.tsx does -- score/rank/percentile/strength/improvement, all
// derived from scoring_results.ai_outputs via the SAME rankMap
// (fireFinalistResults, app/api/cron/email-tick/route.ts) NotSelected
// already used. HQ: "붙은 사람도 자기 점수가 궁금하다" -- advancing doesn't
// make the AI's reasoning less interesting, and it was already computed for
// every scored applicant regardless of outcome; SelectedTop50 just wasn't
// reading it. videoUrl points at the PRELIM entry (round=application,
// default) -- the main-round video doesn't exist yet at advancement time.

import { Heading, Text, Section, Link } from '@react-email/components'
import { Layout } from '../components/Layout'
import { RESULT_INTEGRITY_NOTE_KO, RESULT_INTEGRITY_NOTE_EN } from '../messages'
import type { EmailLang } from '../lang'
import { formatDeadlinePT } from '@/lib/seasons'

export type SelectedTop50Props = {
  lang: EmailLang
  creatorName: string
  seasonName: string
  topNAdvance: number
  totalParticipants: number
  mainRoundStartAt: string | null
  score: number
  rank: number
  percentile: number // "top X%" (already rounded)
  strength: string
  improvement: string
  videoUrl: string
  profileUrl: string
}

// Same visual as NotSelected.tsx's ReportCard, minus the "watch mine" emoji
// row style differences -- kept as its own component (not a shared import)
// because the two templates are allowed to diverge in tone independently;
// see [[feedback-policy-obsolete-code-stays-inactive]]-adjacent reasoning --
// premature sharing here would couple two copy surfaces HQ may want to
// evolve separately.
function ReportCard(p: SelectedTop50Props & { L: Record<string, string> }) {
  return (
    <Section style={card}>
      <Text style={rowLine}>
        <span style={emoji}>🏅</span> <strong>{p.L.score}</strong>{' '}
        <span style={scoreVal}>{p.score.toFixed(2)} / 100</span>
      </Text>
      <Text style={rowLine}>
        <span style={emoji}>📈</span> <strong>{p.L.percentile}</strong>{' '}
        {p.L.top} {p.percentile}% ({p.rank} / {p.totalParticipants})
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

export function SelectedTop50(p: SelectedTop50Props) {
  return p.lang === 'ko' ? <Korean {...p} /> : <English {...p} />
}

export function subjectFor(p: SelectedTop50Props): string {
  return p.lang === 'ko'
    ? `축하합니다 — ${p.seasonName} 본선에 진출하셨습니다`
    : `Congratulations — you're moving to the main round`
}

// ★2026-08-30 (HQ, render-preview audit): this used to be its own
// toLocaleString('ko-KR'/'en-US', {dateStyle, timeStyle}) with NO timeZone --
// which renders in whatever timezone the process happens to run in. Locally
// that is often America/Los_Angeles by coincidence, which hid the bug; on
// Vercel (TZ=UTC by default) main_round_start_at = 2026-11-10T01:00:00Z came
// out as "November 10, 1:00 AM" instead of the correct "November 9, 5:00 PM
// PT" -- wrong date AND wrong time. formatDeadlinePT is the one canonical,
// timezone-explicit formatter every other date in the product uses; this
// template just was not using it.
function formatDateKo(iso: string | null): string {
  return formatDeadlinePT(iso, 'ko') ?? '일정 안내 예정'
}
function formatDateEn(iso: string | null): string {
  return formatDeadlinePT(iso, 'en') ?? 'to be announced'
}

function Korean(p: SelectedTop50Props) {
  const L = {
    score: 'Triple-AI 점수',
    percentile: '전체 참가자 중',
    top: '상위',
    strength: '가장 강했던 요소',
    improvement: '개선 효과가 가장 클 요소',
    watchMine: '내 작품 보기',
  }
  return (
    <Layout lang="ko" preview={`축하합니다 — ${p.seasonName} 본선 진출이 확정되었습니다.`}>
      <Heading style={headingStyle}>축하합니다, {p.creatorName}님 — 본선 진출 확정!</Heading>
      <Text style={paragraph}>
        {p.totalParticipants.toLocaleString()}명의 크리에이터 중, 당신의 작품이 OXXOVO{' '}
        <strong>{p.seasonName}</strong> 본선에 진출했습니다. Triple-AI 채점 기준 상위{' '}
        <strong>{p.topNAdvance.toLocaleString()}명</strong>입니다.
      </Text>

      <Heading as="h2" style={sectionHead}>
        📋 예선 Season Report
      </Heading>
      <ReportCard {...p} L={L} />

      <Text style={paragraph}>
        본선 시작: <strong>{formatDateKo(p.mainRoundStartAt)}</strong>
        <br />
        시작 시각에 맞춰 테마 공개와 제출 안내 메일이 자동으로 발송됩니다.
      </Text>
      <Text style={paragraph}>
        <strong>이제 진짜 경쟁이 시작됩니다.</strong> 곧 관객 투표가 열립니다. 다음 라운드를
        준비하세요.
      </Text>
      <Text style={muted}>{RESULT_INTEGRITY_NOTE_KO}</Text>
      <Text style={signoff}>OXXOVO Genesis 운영팀 드림</Text>
    </Layout>
  )
}

function English(p: SelectedTop50Props) {
  const L = {
    score: 'Triple-AI Score',
    percentile: 'Among all entrants',
    top: 'top',
    strength: 'Your strongest trait',
    improvement: 'Biggest room to grow',
    watchMine: 'Watch my entry',
  }
  return (
    <Layout lang="en" preview={`Congrats — you're through to the ${p.seasonName} main round.`}>
      <Heading style={headingStyle}>Congrats, {p.creatorName} — you&rsquo;re through.</Heading>
      <Text style={paragraph}>
        Out of {p.totalParticipants.toLocaleString()} creators, your entry advanced to the
        OXXOVO <strong>{p.seasonName}</strong> main round — the top{' '}
        <strong>{p.topNAdvance.toLocaleString()}</strong> by Triple-AI score.
      </Text>

      <Heading as="h2" style={sectionHead}>
        📋 Preliminary Season Report
      </Heading>
      <ReportCard {...p} L={L} />

      <Text style={paragraph}>
        Main round begins: <strong>{formatDateEn(p.mainRoundStartAt)}</strong>
        <br />
        Theme drop and submission instructions go out automatically at the start time.
      </Text>
      <Text style={paragraph}>
        <strong>The competition starts now.</strong> Audience voting opens soon. Prepare for
        the next round.
      </Text>
      <Text style={muted}>{RESULT_INTEGRITY_NOTE_EN}</Text>
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
const muted: React.CSSProperties = { color: '#666666', fontSize: 13, lineHeight: 1.7, margin: '20px 0 0' }
const signoff: React.CSSProperties = { color: '#8b22ff', fontSize: 13, fontWeight: 600, margin: '24px 0 0' }
const sectionHead: React.CSSProperties = {
  color: '#0a0608',
  fontSize: 17,
  lineHeight: 1.4,
  fontWeight: 700,
  margin: '0 0 12px',
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
