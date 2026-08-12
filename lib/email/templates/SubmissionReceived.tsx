// ⑤ -- sent when a participant SUBMITS A FILM through Studio, which is a
// different act from applying and was previously silent.
//
// ★It has to be legible next to ApplicationReceived, because the same person
// gets both: one when they take a place in the season, one when they hand in the
// film, days apart. So the subject leads with 작품/film rather than 신청/entry,
// and the body names what was received (the title) and when.
//
// Two file states, because Studio submission is asynchronous: 'processing' means
// the submission is accepted and the render is still finishing, 'complete' means
// the file is on the entry. Neither is a warning -- both are receipts.

import { Heading, Text } from '@react-email/components'
import { Layout } from '../components/Layout'
import type { EmailLang } from '../lang'
import type { SubmissionFileState } from '@/lib/submission-receipt'
import type { ScheduleLine } from '../schedule-lines'
import { ScheduleList } from '../components/ScheduleList'

export type SubmissionReceivedProps = {
  lang: EmailLang
  creatorName: string
  seasonName: string
  // null when the participant did not title the entry -- the copy drops the
  // title line rather than inventing one.
  videoTitle: string | null
  submittedAtLabel: string | null
  fileState: SubmissionFileState
  // ★Built from the season row, never typed. A bullet whose column is null is
  // absent rather than guessed -- see lib/email/schedule-lines.ts.
  scheduleLines: ScheduleLine[]
}

export function SubmissionReceived(p: SubmissionReceivedProps) {
  return p.lang === 'ko' ? <Korean {...p} /> : <English {...p} />
}

export function subjectFor(p: SubmissionReceivedProps): string {
  return p.lang === 'ko'
    ? '[OXXOVO] 예선 작품 제출이 접수되었습니다'
    : '[OXXOVO] Your preliminary entry has been received'
}

function Korean(p: SubmissionReceivedProps) {
  return (
    <Layout lang="ko" preview={`${p.seasonName} 작품 제출이 접수되었습니다.`}>
      <Heading style={headingStyle}>{p.creatorName}님, 예선 작품이 접수되었습니다.</Heading>
      <Text style={paragraph}>
        <strong>{p.seasonName}</strong> 예선 작품이 정상 접수되었습니다.
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
          ? '최종 영상 파일은 현재 처리 중이며, 처리가 끝나면 참가작에 자동으로 반영됩니다. 접수 자체는 이미 완료되었으므로 추가로 하실 일은 없습니다.'
          : '최종 영상 파일까지 참가작에 반영되었습니다. 추가로 하실 일은 없습니다.'}
      </Text>
      <ScheduleList lines={p.scheduleLines} />
      <Text style={muted}>
        작품이 공개되면 이메일로 알려드립니다. 제출 현황은 OXXOVO 프로필에서 언제든지 확인하실 수
        있습니다.
      </Text>
      <Text style={signoff}>OXXOVO Genesis 운영팀 드림</Text>
    </Layout>
  )
}

function English(p: SubmissionReceivedProps) {
  return (
    <Layout lang="en" preview={`Your ${p.seasonName} film is in.`}>
      <Heading style={headingStyle}>Hi {p.creatorName} — your preliminary entry is in.</Heading>
      <Text style={paragraph}>
        We&rsquo;ve received your <strong>{p.seasonName}</strong> preliminary entry
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
          ? 'Your final video file is still being processed, and it will be attached to your entry automatically when it finishes. The submission itself is already recorded — there is nothing else for you to do.'
          : 'Your final video file is attached to your entry. There is nothing else for you to do.'}
      </Text>
      <ScheduleList lines={p.scheduleLines} />
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
