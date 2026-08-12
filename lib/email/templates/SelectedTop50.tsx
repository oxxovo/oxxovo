// Sent when advancement sets status='selected' — the applicant advanced to the
// main round. The "top50" in the template_key refers to Genesis Season 0's
// top_n_advance=50; future seasons may pass a different topNAdvance value.
// Leads with the scale of the field they beat, then the concrete next-round
// timeline (theme drop + submission instructions arrive automatically).

import { Heading, Text } from '@react-email/components'
import { Layout } from '../components/Layout'
import { RESULT_INTEGRITY_NOTE_KO, RESULT_INTEGRITY_NOTE_EN } from '../messages'
import type { EmailLang } from '../lang'

export type SelectedTop50Props = {
  lang: EmailLang
  creatorName: string
  seasonName: string
  topNAdvance: number
  totalParticipants: number
  mainRoundStartAt: string | null
}

export function SelectedTop50(p: SelectedTop50Props) {
  return p.lang === 'ko' ? <Korean {...p} /> : <English {...p} />
}

export function subjectFor(p: SelectedTop50Props): string {
  return p.lang === 'ko'
    ? `축하합니다 — ${p.seasonName} 본선에 진출하셨습니다`
    : `Congratulations — you're moving to the main round`
}

function formatDateKo(iso: string | null): string {
  if (!iso) return '일정 안내 예정'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '일정 안내 예정'
  return d.toLocaleString('ko-KR', { dateStyle: 'long', timeStyle: 'short' })
}
function formatDateEn(iso: string | null): string {
  if (!iso) return 'to be announced'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'to be announced'
  return d.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })
}

function Korean(p: SelectedTop50Props) {
  return (
    <Layout lang="ko" preview={`축하합니다 — ${p.seasonName} 본선 진출이 확정되었습니다.`}>
      <Heading style={headingStyle}>축하합니다, {p.creatorName}님 — 본선 진출 확정!</Heading>
      <Text style={paragraph}>
        {p.totalParticipants.toLocaleString()}명의 크리에이터 중, 당신의 작품이 OXXOVO{' '}
        <strong>{p.seasonName}</strong> 본선에 진출했습니다. Triple-AI 채점 기준 상위{' '}
        <strong>{p.topNAdvance.toLocaleString()}명</strong>입니다.
      </Text>
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
  return (
    <Layout lang="en" preview={`Congrats — you're through to the ${p.seasonName} main round.`}>
      <Heading style={headingStyle}>Congrats, {p.creatorName} — you&rsquo;re through.</Heading>
      <Text style={paragraph}>
        Out of {p.totalParticipants.toLocaleString()} creators, your entry advanced to the
        OXXOVO <strong>{p.seasonName}</strong> main round — the top{' '}
        <strong>{p.topNAdvance.toLocaleString()}</strong> by Triple-AI score.
      </Text>
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
