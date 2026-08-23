// Sent automatically by Phase 5c cron when seasons.awards_announcement_at
// fires. Goes to all main-round participants (status IN selected/
// main_round_submitted/awarded) announcing that the final results are live.
//
// ★HQ 2026-08-22 (item 2, #15): split into 4 placement variants -- 1st/2nd/
// 3rd get a distinct congratulatory line (prize amount context), everyone
// else who reached the main round without a top-3 rank gets a neutral
// "results are live, here's your score" version. Prelim non-advancers are
// deliberately NOT a 5th variant here -- they already received NotSelected
// at finalist advancement (an earlier, separate stage); this email's
// recipient query never included them (see fireResultsAnnounced,
// app/api/cron/email-tick/route.ts) and that is unchanged by this split.
// Placeholder copy pending 제니3 -- wiring/branching only.
import { Heading, Text } from '@react-email/components'
import { Layout } from '../components/Layout'
import type { EmailLang } from '../lang'

export type ResultsPlacement = 'rank1' | 'rank2' | 'rank3' | 'main_no_award'

export type ResultsAnnouncedProps = {
  lang: EmailLang
  creatorName: string
  seasonName: string
  placement: ResultsPlacement
}

export function ResultsAnnounced(p: ResultsAnnouncedProps) {
  return p.lang === 'ko' ? <Korean {...p} /> : <English {...p} />
}

const SUBJECT_KO: Record<ResultsPlacement, (seasonName: string) => string> = {
  rank1: (s) => `[OXXOVO] 축하합니다 — ${s} 1위입니다`,
  rank2: (s) => `[OXXOVO] 축하합니다 — ${s} 2위입니다`,
  rank3: (s) => `[OXXOVO] 축하합니다 — ${s} 3위입니다`,
  main_no_award: (s) => `[OXXOVO] ${s} 최종 결과가 발표되었습니다`,
}
const SUBJECT_EN: Record<ResultsPlacement, (seasonName: string) => string> = {
  rank1: (s) => `[OXXOVO] Congratulations — you placed 1st in ${s}`,
  rank2: (s) => `[OXXOVO] Congratulations — you placed 2nd in ${s}`,
  rank3: (s) => `[OXXOVO] Congratulations — you placed 3rd in ${s}`,
  main_no_award: (s) => `[OXXOVO] ${s} final results are live`,
}

export function subjectFor(p: ResultsAnnouncedProps): string {
  return p.lang === 'ko' ? SUBJECT_KO[p.placement](p.seasonName) : SUBJECT_EN[p.placement](p.seasonName)
}

const RANK_LABEL_KO: Record<ResultsPlacement, string | null> = {
  rank1: '1위',
  rank2: '2위',
  rank3: '3위',
  main_no_award: null,
}
const RANK_LABEL_EN: Record<ResultsPlacement, string | null> = {
  rank1: '1st place',
  rank2: '2nd place',
  rank3: '3rd place',
  main_no_award: null,
}

function Korean(p: ResultsAnnouncedProps) {
  const rank = RANK_LABEL_KO[p.placement]
  return (
    <Layout
      lang="ko"
      preview={`${p.seasonName} 최종 결과 공개.`}
    >
      <Heading style={headingStyle}>
        {rank
          ? `축하합니다, ${p.creatorName}님 — ${p.seasonName} ${rank}!`
          : `${p.creatorName}님, 최종 결과가 발표되었습니다.`}
      </Heading>
      <Text style={paragraph}>
        <strong>{p.seasonName}</strong>의 최종 결과 — Triple-AI 채점과
        커뮤니티 투표 가중합 — 가 공개되었습니다. OXXOVO 프로필에서 본인의
        최종 순위와 점수 세부 항목을 확인하실 수 있습니다.
      </Text>
      {rank ? (
        <Text style={paragraph}>
          상금 지급을 위한 안내 메일이 별도로 자동 발송됩니다.
        </Text>
      ) : (
        <Text style={paragraph}>
          1·2·3위 수상자에게는 상금 지급을 위한 안내 메일이 별도로 자동
          발송됩니다. 그 외 참가자분들의 결과도 모두 프로필에 영구 기록됩니다.
        </Text>
      )}
      <Text style={signoff}>OXXOVO Genesis 운영팀 드림</Text>
    </Layout>
  )
}

function English(p: ResultsAnnouncedProps) {
  const rank = RANK_LABEL_EN[p.placement]
  return (
    <Layout
      lang="en"
      preview={`${p.seasonName} final results are live.`}
    >
      <Heading style={headingStyle}>
        {rank
          ? `Congrats, ${p.creatorName} — ${rank} in ${p.seasonName}!`
          : `Hi ${p.creatorName} — final results are live.`}
      </Heading>
      <Text style={paragraph}>
        The final <strong>{p.seasonName}</strong> results — Triple-AI scoring
        combined with community vote — are now posted. Check your OXXOVO
        profile for your final placement and the full score breakdown.
      </Text>
      {rank ? (
        <Text style={paragraph}>
          A separate automatic email with prize payout instructions is on its way.
        </Text>
      ) : (
        <Text style={paragraph}>
          Top three finishers will receive a separate automatic email with prize
          payout instructions. Every participant&rsquo;s result is permanently
          recorded on their profile.
        </Text>
      )}
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
