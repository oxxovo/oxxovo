// Sent automatically by Phase 5c cron when seasons.main_round_start_at fires.
// Goes only to applicants whose status='selected'. Announces the theme drop
// timing and submission window.
//
// 5b ships the template + sender; the cron route lands in 5c.

import { Heading, Text } from '@react-email/components'
import { Layout } from '../components/Layout'
import type { EmailLang } from '../lang'

export type MainRoundStartProps = {
  lang: EmailLang
  creatorName: string
  seasonName: string
  themeAnnouncementMinutesBefore: number
  submissionHours: number
  mainRoundVideoMinSeconds: number
  mainRoundVideoMaxSeconds: number
}

function formatVideoRangeKo(min: number, max: number): string {
  return min === max ? `${min}초` : `${min}~${max}초`
}

function formatVideoRangeEn(min: number, max: number): string {
  return min === max ? `${min} seconds` : `${min}–${max} seconds`
}

export function MainRoundStart(p: MainRoundStartProps) {
  return p.lang === 'ko' ? <Korean {...p} /> : <English {...p} />
}

export function subjectFor(p: MainRoundStartProps): string {
  return p.lang === 'ko'
    ? `[OXXOVO] ${p.seasonName} 본선이 곧 시작됩니다`
    : `[OXXOVO] ${p.seasonName} main round is about to begin`
}

function Korean(p: MainRoundStartProps) {
  return (
    <Layout
      lang="ko"
      preview={`${p.seasonName} 본선 시작 안내.`}
    >
      <Heading style={headingStyle}>
        {p.creatorName}님, 본선이 곧 시작됩니다.
      </Heading>
      <Text style={paragraph}>
        <strong>{p.seasonName}</strong> 본선 라운드가 곧 시작됩니다. 테마는
        시작 시각 <strong>{p.themeAnnouncementMinutesBefore}분 전</strong>에
        OXXOVO 프로필에 공개됩니다.
      </Text>
      <Text style={paragraph}>
        제출 영상은{' '}
        <strong>
          {formatVideoRangeKo(p.mainRoundVideoMinSeconds, p.mainRoundVideoMaxSeconds)}
        </strong>{' '}
        길이로 제작하시고, 테마 공개 시각으로부터{' '}
        <strong>{p.submissionHours}시간</strong> 이내에 제출해주셔야 합니다.
      </Text>
      <Text style={muted}>
        제출 마감 임박 시 별도 리마인더 메일이 자동 발송됩니다. 본선 결과는
        Triple-AI 채점 + 커뮤니티 투표 가중합으로 결정됩니다.
      </Text>
      <Text style={signoff}>OXXOVO Genesis 운영팀 드림</Text>
    </Layout>
  )
}

function English(p: MainRoundStartProps) {
  return (
    <Layout
      lang="en"
      preview={`${p.seasonName} main round starting soon.`}
    >
      <Heading style={headingStyle}>
        Hi {p.creatorName} — main round is about to begin.
      </Heading>
      <Text style={paragraph}>
        The <strong>{p.seasonName}</strong> main round is starting. The theme
        will be revealed on your OXXOVO profile{' '}
        <strong>{p.themeAnnouncementMinutesBefore} minutes</strong> before the
        start time.
      </Text>
      <Text style={paragraph}>
        Your entry video should be{' '}
        <strong>
          {formatVideoRangeEn(p.mainRoundVideoMinSeconds, p.mainRoundVideoMaxSeconds)}
        </strong>{' '}
        long and must be submitted within{' '}
        <strong>{p.submissionHours} hours</strong> of the theme drop.
      </Text>
      <Text style={muted}>
        We&rsquo;ll send an automatic reminder as the deadline approaches.
        Final results combine Triple-AI scoring with community vote weighting.
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
