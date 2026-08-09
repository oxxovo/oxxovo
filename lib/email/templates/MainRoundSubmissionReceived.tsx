// ⑪ -- sent when a Finalist submits their MAIN-ROUND film. Same act as ⑤, much
// higher stakes, so the copy differs in one deliberate way.
//
// ★It states that the main round is a single submission and cannot be replaced.
// That is the rule ([[project-main-round-single-submission]]): the server refuses
// a second one, and a participant who does not know that will try, be refused,
// and read the refusal as a fault. The receipt is the only moment the platform
// can say it while it is still useful information rather than an error message.
//
// It does NOT say what happens next or when. Those dates live on the season row
// and move; a receipt that hardcodes them is wrong the first time they move.

import { Heading, Text } from '@react-email/components'
import { Layout } from '../components/Layout'
import type { EmailLang } from '../lang'
import type { SubmissionFileState } from '@/lib/submission-receipt'
import type { ScheduleLine } from '../schedule-lines'
import { ScheduleList } from '../components/ScheduleList'

export type MainRoundSubmissionReceivedProps = {
  lang: EmailLang
  creatorName: string
  seasonName: string
  videoTitle: string | null
  submittedAtLabel: string | null
  fileState: SubmissionFileState
  scheduleLines: ScheduleLine[]
}

export function MainRoundSubmissionReceived(p: MainRoundSubmissionReceivedProps) {
  return p.lang === 'ko' ? <Korean {...p} /> : <English {...p} />
}

export function subjectFor(p: MainRoundSubmissionReceivedProps): string {
  return p.lang === 'ko'
    ? '[OXXOVO] 본선 작품 제출이 접수되었습니다'
    : '[OXXOVO] Your final entry has been received'
}

function Korean(p: MainRoundSubmissionReceivedProps) {
  return (
    <Layout lang="ko" preview={`${p.seasonName} 본선 작품이 접수되었습니다.`}>
      <Heading style={headingStyle}>{p.creatorName}님, 본선 작품이 접수되었습니다.</Heading>
      <Text style={paragraph}>
        <strong>{p.seasonName}</strong> 본선 작품이 정상 접수되었습니다.
        {p.videoTitle ? (
          <>
            {' '}
            제출하신 작품은 <strong>{p.videoTitle}</strong>입니다.
          </>
        ) : null}
      </Text>
      {p.submittedAtLabel ? (
        <Text style={paragraph}>
          접수 시각은 <strong>{p.submittedAtLabel}</strong>입니다.
        </Text>
      ) : null}
      <Text style={paragraph}>
        {p.fileState === 'processing'
          ? '최종 영상 파일은 현재 처리 중이며, 처리가 끝나면 참가작에 자동으로 반영됩니다. 접수 자체는 이미 완료되었습니다.'
          : '최종 영상 파일까지 참가작에 반영되었습니다.'}
      </Text>
      <ScheduleList lines={p.scheduleLines} />
      <Text style={notice}>
        본선은 <strong>한 번만 제출</strong>할 수 있으며, 접수된 작품은 교체하거나 수정할 수
        없습니다.
      </Text>
      <Text style={muted}>
        작품이 공개되면 이메일로 알려드립니다. 제출 현황은 OXXOVO 프로필에서 언제든지 확인하실 수
        있습니다.
      </Text>
      <Text style={signoff}>OXXOVO Genesis 운영팀 드림</Text>
    </Layout>
  )
}

function English(p: MainRoundSubmissionReceivedProps) {
  return (
    <Layout lang="en" preview={`Your ${p.seasonName} main-round film is in.`}>
      <Heading style={headingStyle}>Hi {p.creatorName} — your main-round film is in.</Heading>
      <Text style={paragraph}>
        We&rsquo;ve received your <strong>{p.seasonName}</strong> main-round entry
        {p.videoTitle ? (
          <>
            , <strong>{p.videoTitle}</strong>
          </>
        ) : null}
        .
      </Text>
      {p.submittedAtLabel ? (
        <Text style={paragraph}>
          Received at <strong>{p.submittedAtLabel}</strong>.
        </Text>
      ) : null}
      <Text style={paragraph}>
        {p.fileState === 'processing'
          ? 'Your final video file is still being processed, and it will be attached to your entry automatically when it finishes. The submission itself is already recorded.'
          : 'Your final video file is attached to your entry.'}
      </Text>
      <ScheduleList lines={p.scheduleLines} />
      <Text style={notice}>
        The main round is a <strong>single submission</strong> — this entry cannot be replaced or
        edited.
      </Text>
      <Text style={muted}>
        We&rsquo;ll email you when your film goes public. You can check your submission any time from
        your OXXOVO profile.
      </Text>
      <Text style={signoff}>— The OXXOVO Genesis team</Text>
    </Layout>
  )
}

const headingStyle: React.CSSProperties = {
  color: '#111111',
  fontSize: 22,
  fontWeight: 700,
  lineHeight: 1.4,
  margin: '0 0 18px',
}

const paragraph: React.CSSProperties = {
  color: '#333333',
  fontSize: 15,
  lineHeight: 1.7,
  margin: '0 0 14px',
}

// The one line the participant most needs to have read before they try again.
const notice: React.CSSProperties = {
  color: '#111111',
  fontSize: 14,
  lineHeight: 1.7,
  margin: '18px 0 0',
  padding: '12px 14px',
  background: '#f5f0ff',
  borderLeft: '3px solid #8b22ff',
  borderRadius: 4,
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
