// HQ 2026-08-22, item 3 (#13): community vote deadline reminder, fired ONCE
// (not multi-fire like submission_deadline/application_deadline) at a fixed
// 24h before community_vote_end_at -- per HQ's canonical spec, not a
// season-configurable hours array (see fireVoteDeadline, email-tick route.ts).
//
// TWO audiences, TWO recipient pools, ONE template branching on `audience`:
//   participant -- the main-round entrant themselves. "Last chance to rally
//                   votes" -- they have a personal stake and a video to share.
//   member      -- any opted-in site member, not necessarily entered this
//                   season. "Vote now if you haven't" -- no personal stake,
//                   just a nudge to go cast a vote before it closes.
// Placeholder copy pending 제니3 -- wiring/branching only, per HQ instruction.

import { Heading, Text, Section, Button } from '@react-email/components'
import { Layout } from '../components/Layout'
import type { EmailLang } from '../lang'

export type VoteDeadlineAudience = 'participant' | 'member'

export type VoteDeadlineProps = {
  lang: EmailLang
  name: string
  seasonName: string
  audience: VoteDeadlineAudience
  voteUrl: string
  // Only meaningful for audience='participant' (their own entry to share);
  // null for audience='member' (no single video to point at).
  videoUrl: string | null
}

export function VoteDeadline(p: VoteDeadlineProps) {
  return p.lang === 'ko' ? <Korean {...p} /> : <English {...p} />
}

export function subjectFor(p: VoteDeadlineProps): string {
  if (p.lang === 'ko') {
    return p.audience === 'participant'
      ? `[OXXOVO] 투표 마감 24시간 전 — 팬들에게 지금 알리세요`
      : `[OXXOVO] ${p.seasonName} 투표 마감 24시간 전입니다`
  }
  return p.audience === 'participant'
    ? `[OXXOVO] 24 hours left to vote — rally your fans now`
    : `[OXXOVO] ${p.seasonName} voting closes in 24 hours`
}

function Korean(p: VoteDeadlineProps) {
  return (
    <Layout lang="ko" preview={`${p.seasonName} 관객 투표 마감 24시간 전.`}>
      {p.audience === 'participant' ? (
        <>
          <Heading style={headingStyle}>{p.name}님, 투표 마감까지 24시간 남았습니다.</Heading>
          <Text style={paragraph}>
            <strong>{p.seasonName}</strong> 관객 투표가 <strong>24시간 후</strong> 마감됩니다.
            본선 결과는 Triple-AI 채점과 관객 투표를 합산해 정해집니다 — 마지막으로 팬들에게
            투표를 부탁할 기회입니다.
          </Text>
          {p.videoUrl && (
            <Section style={{ textAlign: 'center', margin: '20px 0' }}>
              <Button href={p.videoUrl} style={ctaButton}>
                🎬 내 작품 공유하기
              </Button>
            </Section>
          )}
        </>
      ) : (
        <>
          <Heading style={headingStyle}>{p.name}님, 투표 마감까지 24시간 남았습니다.</Heading>
          <Text style={paragraph}>
            <strong>{p.seasonName}</strong> 관객 투표가 <strong>24시간 후</strong> 마감됩니다.
            아직 투표하지 않으셨다면, 지금이 마지막 기회입니다.
          </Text>
          <Section style={{ textAlign: 'center', margin: '20px 0' }}>
            <Button href={p.voteUrl} style={ctaButton}>
              🗳️ 지금 투표하기
            </Button>
          </Section>
        </>
      )}
      <Text style={signoff}>OXXOVO Genesis 운영팀 드림</Text>
    </Layout>
  )
}

function English(p: VoteDeadlineProps) {
  return (
    <Layout lang="en" preview={`${p.seasonName} community vote closes in 24 hours.`}>
      {p.audience === 'participant' ? (
        <>
          <Heading style={headingStyle}>Hi {p.name} — 24 hours left to vote.</Heading>
          <Text style={paragraph}>
            <strong>{p.seasonName}</strong>&rsquo;s community vote closes in{' '}
            <strong>24 hours</strong>. The main round result combines Triple-AI scoring with
            the audience vote — this is your last chance to ask your fans to cast theirs.
          </Text>
          {p.videoUrl && (
            <Section style={{ textAlign: 'center', margin: '20px 0' }}>
              <Button href={p.videoUrl} style={ctaButton}>
                🎬 Share your entry
              </Button>
            </Section>
          )}
        </>
      ) : (
        <>
          <Heading style={headingStyle}>Hi {p.name} — 24 hours left to vote.</Heading>
          <Text style={paragraph}>
            <strong>{p.seasonName}</strong>&rsquo;s community vote closes in{' '}
            <strong>24 hours</strong>. If you haven&rsquo;t voted yet, this is your last
            chance.
          </Text>
          <Section style={{ textAlign: 'center', margin: '20px 0' }}>
            <Button href={p.voteUrl} style={ctaButton}>
              🗳️ Vote now
            </Button>
          </Section>
        </>
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
