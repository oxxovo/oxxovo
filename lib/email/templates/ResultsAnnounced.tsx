// Sent automatically by Phase 5c cron when seasons.awards_announcement_at
// fires. Goes to all main-round participants (status='selected') announcing
// that the final results — Triple-AI + community vote — are now live on
// their profiles.

import { Heading, Text } from '@react-email/components'
import { Layout } from '../components/Layout'
import type { EmailLang } from '../lang'

export type ResultsAnnouncedProps = {
  lang: EmailLang
  creatorName: string
  seasonName: string
}

export function ResultsAnnounced(p: ResultsAnnouncedProps) {
  return p.lang === 'ko' ? <Korean {...p} /> : <English {...p} />
}

export function subjectFor(p: ResultsAnnouncedProps): string {
  return p.lang === 'ko'
    ? `[OXXOVO] ${p.seasonName} 최종 결과가 발표되었습니다`
    : `[OXXOVO] ${p.seasonName} final results are live`
}

function Korean(p: ResultsAnnouncedProps) {
  return (
    <Layout
      lang="ko"
      preview={`${p.seasonName} 최종 결과 공개.`}
    >
      <Heading style={headingStyle}>
        {p.creatorName}님, 최종 결과가 발표되었습니다.
      </Heading>
      <Text style={paragraph}>
        <strong>{p.seasonName}</strong>의 최종 결과 — Triple-AI 채점과
        커뮤니티 투표 가중합 — 가 공개되었습니다. OXXOVO 프로필에서 본인의
        최종 순위와 점수 세부 항목을 확인하실 수 있습니다.
      </Text>
      <Text style={paragraph}>
        1·2·3위 수상자에게는 상금 지급을 위한 안내 메일이 별도로 자동
        발송됩니다. 그 외 참가자분들의 결과도 모두 프로필에 영구 기록됩니다.
      </Text>
      <Text style={signoff}>OXXOVO Genesis 운영팀 드림</Text>
    </Layout>
  )
}

function English(p: ResultsAnnouncedProps) {
  return (
    <Layout
      lang="en"
      preview={`${p.seasonName} final results are live.`}
    >
      <Heading style={headingStyle}>
        Hi {p.creatorName} — final results are live.
      </Heading>
      <Text style={paragraph}>
        The final <strong>{p.seasonName}</strong> results — Triple-AI scoring
        combined with community vote — are now posted. Check your OXXOVO
        profile for your final placement and the full score breakdown.
      </Text>
      <Text style={paragraph}>
        Top three finishers will receive a separate automatic email with prize
        payout instructions. Every participant&rsquo;s result is permanently
        recorded on their profile.
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

const signoff: React.CSSProperties = {
  color: '#8b22ff',
  fontSize: 13,
  fontWeight: 600,
  margin: '24px 0 0',
}
