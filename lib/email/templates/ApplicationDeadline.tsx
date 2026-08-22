// Reminder sent automatically by email-tick when the PRELIM video submission
// window (application_close_at) has `hoursRemaining` left. Goes to registered
// applicants who have NOT yet submitted their prelim video. HQ 2026-08-22:
// replaces the old registration_count (registration-deadline) notice --
// this one is about the VIDEO deadline, not the registration cutoff (the
// Watch countdown already covers that). Copy is a functional placeholder
// pending Jenny3's final wording -- wiring/timing only, per HQ instruction.

import { Heading, Text } from '@react-email/components'
import { Layout } from '../components/Layout'
import type { EmailLang } from '../lang'

export type ApplicationDeadlineProps = {
  lang: EmailLang
  creatorName: string
  seasonName: string
  hoursRemaining: number
}

// hoursRemaining is one of [168, 72, 24, 6] for season_0 (7d/3d/1d/6h) --
// display whole days when it divides evenly into a day and is at least a
// day out, hours only for the final same-day reminder.
function remainingLabel(hours: number, lang: EmailLang): string {
  if (hours >= 24 && hours % 24 === 0) {
    const days = hours / 24
    return lang === 'ko' ? `${days}일` : `${days} day${days === 1 ? '' : 's'}`
  }
  return lang === 'ko' ? `${hours}시간` : `${hours} hour${hours === 1 ? '' : 's'}`
}

export function ApplicationDeadline(p: ApplicationDeadlineProps) {
  return p.lang === 'ko' ? <Korean {...p} /> : <English {...p} />
}

export function subjectFor(p: ApplicationDeadlineProps): string {
  const label = remainingLabel(p.hoursRemaining, p.lang)
  return p.lang === 'ko'
    ? `[OXXOVO] 예선 영상 제출 마감 ${label} 전입니다`
    : `[OXXOVO] ${label} left to submit your preliminary video`
}

function Korean(p: ApplicationDeadlineProps) {
  const label = remainingLabel(p.hoursRemaining, 'ko')
  return (
    <Layout lang="ko" preview={`${p.seasonName} 예선 영상 제출 마감 ${label} 전.`}>
      <Heading style={headingStyle}>
        {p.creatorName}님, 예선 영상 제출 마감 {label} 전입니다.
      </Heading>
      <Text style={paragraph}>
        <strong>{p.seasonName}</strong> 예선 영상 제출까지 <strong>{label}</strong>이
        남았습니다. 등록은 하셨지만 아직 영상 제출이 완료되지 않은 상태로 확인되어
        안내드립니다.
      </Text>
      <Text style={paragraph}>
        OXXOVO Studio에서 영상 생성·제출을 완료해주세요. 마감 시각이 지나면
        시스템이 자동으로 제출을 잠그며, 별도 예외 처리는 운영팀도 할 수 없는
        구조입니다.
      </Text>
      <Text style={muted}>
        이미 제출하셨다면 본 메일은 무시하셔도 됩니다. 본 메일은 미제출 등록자에게만
        자동 발송됩니다.
      </Text>
      <Text style={signoff}>OXXOVO Genesis 운영팀 드림</Text>
    </Layout>
  )
}

function English(p: ApplicationDeadlineProps) {
  const label = remainingLabel(p.hoursRemaining, 'en')
  return (
    <Layout lang="en" preview={`${p.seasonName} preliminary video submission closes in ${label}.`}>
      <Heading style={headingStyle}>
        Hi {p.creatorName} — {label} to submit your preliminary video.
      </Heading>
      <Text style={paragraph}>
        You have <strong>{label}</strong> left to submit your{' '}
        <strong>{p.seasonName}</strong> preliminary video. We&rsquo;re sending
        this because you&rsquo;re registered but your submission is still
        showing as incomplete.
      </Text>
      <Text style={paragraph}>
        Generate and submit your video from OXXOVO Studio to lock it in. Once
        the deadline passes, the system automatically closes submissions — no
        manual overrides are possible, even by operators.
      </Text>
      <Text style={muted}>
        If you&rsquo;ve already submitted, ignore this email. These reminders
        only go to registrants who haven&rsquo;t submitted yet.
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
