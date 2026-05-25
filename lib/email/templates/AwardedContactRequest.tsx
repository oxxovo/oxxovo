// Sent automatically by saveAwardRank() when an applicant's award_rank is
// set to 1/2/3. Requests payout/contact details needed to disburse the prize.
// Per OXXOVO automation philosophy, this is auto — there is no "Send awarded
// email" button.
//
// Non-cash perks (trophy / badge / grand-final ticket) come in via the
// `extras` prop, which is the JSONB blob from seasons.award_prizes[rank].
// Any field can be absent — for Season 0 only 1st place receives the
// physical trophy, while 2nd/3rd receive badge + grand-final only.

import { Heading, Text } from '@react-email/components'
import { Layout } from '../components/Layout'
import { RESULT_INTEGRITY_NOTE_KO, RESULT_INTEGRITY_NOTE_EN } from '../messages'
import type { EmailLang } from '../lang'
import type { RankAward } from '@/lib/seasons'

export type AwardedContactRequestProps = {
  lang: EmailLang
  creatorName: string
  seasonName: string
  awardRank: 1 | 2 | 3
  prizeAmountUsd: number
  extras: RankAward
}

const RANK_KO: Record<1 | 2 | 3, string> = {
  1: '1등',
  2: '2등',
  3: '3등',
}

const RANK_EN: Record<1 | 2 | 3, string> = {
  1: '1st place',
  2: '2nd place',
  3: '3rd place',
}

export function AwardedContactRequest(p: AwardedContactRequestProps) {
  return p.lang === 'ko' ? <Korean {...p} /> : <English {...p} />
}

export function subjectFor(p: AwardedContactRequestProps): string {
  return p.lang === 'ko'
    ? `[OXXOVO] ${p.seasonName} ${RANK_KO[p.awardRank]} 수상 — 상금 지급 안내`
    : `[OXXOVO] ${RANK_EN[p.awardRank]} in ${p.seasonName} — prize payout`
}

function awardListKo(prize: number, x: RankAward): string[] {
  const items = [`상금 $${prize.toLocaleString()} USD`]
  if (x.trophy_ko) items.push(x.trophy_ko)
  if (x.badge_ko) items.push(x.badge_ko)
  if (x.grand_final_ko) items.push(x.grand_final_ko)
  return items
}

function awardListEn(prize: number, x: RankAward): string[] {
  const items = [`$${prize.toLocaleString()} USD cash prize`]
  if (x.trophy_en) items.push(x.trophy_en)
  if (x.badge_en) items.push(x.badge_en)
  if (x.grand_final_en) items.push(x.grand_final_en)
  return items
}

function Korean(p: AwardedContactRequestProps) {
  const list = awardListKo(p.prizeAmountUsd, p.extras)
  return (
    <Layout
      lang="ko"
      preview={`${p.seasonName} ${RANK_KO[p.awardRank]} 수상 — 상금 지급 안내.`}
    >
      <Heading style={headingStyle}>
        축하합니다, {p.creatorName}님 — {RANK_KO[p.awardRank]} 수상!
      </Heading>
      <Text style={paragraph}>
        <strong>{p.seasonName}</strong>에서{' '}
        <strong>{RANK_KO[p.awardRank]}</strong>으로 선정되셨습니다. 시상 내역은
        아래와 같습니다.
      </Text>
      <Text style={paragraph}>
        {list.map((item, i) => (
          <span key={i}>
            · {item}
            {i < list.length - 1 ? <br /> : null}
          </span>
        ))}
      </Text>
      <Text style={paragraph}>
        상금 지급을 위해 본 이메일에 회신하여 아래 정보를 보내주세요:
      </Text>
      <Text style={paragraph}>
        · 본명 (신분증 기준)
        <br />· 거주 국가
        <br />· 선호 지급 방식 (PayPal / 해외송금 / 기타)
        <br />· 세무 신고 관련 서류 필요 여부 확인용 이메일 주소
      </Text>
      <Text style={muted}>
        {RESULT_INTEGRITY_NOTE_KO} 상금 지급은 회신 받은 정보를 기반으로
        영업일 기준 7일 이내에 처리됩니다.
      </Text>
      <Text style={signoff}>OXXOVO Genesis 운영팀 드림</Text>
    </Layout>
  )
}

function English(p: AwardedContactRequestProps) {
  const list = awardListEn(p.prizeAmountUsd, p.extras)
  return (
    <Layout
      lang="en"
      preview={`${RANK_EN[p.awardRank]} in ${p.seasonName} — prize payout details.`}
    >
      <Heading style={headingStyle}>
        Congrats, {p.creatorName} — {RANK_EN[p.awardRank]}!
      </Heading>
      <Text style={paragraph}>
        You took <strong>{RANK_EN[p.awardRank]}</strong> in{' '}
        <strong>{p.seasonName}</strong>. Your award includes:
      </Text>
      <Text style={paragraph}>
        {list.map((item, i) => (
          <span key={i}>
            · {item}
            {i < list.length - 1 ? <br /> : null}
          </span>
        ))}
      </Text>
      <Text style={paragraph}>
        To disburse the cash prize, please reply to this email with:
      </Text>
      <Text style={paragraph}>
        · Legal name (as it appears on government ID)
        <br />· Country of residence
        <br />· Preferred payout method (PayPal / international wire / other)
        <br />· Best email for any tax-form correspondence
      </Text>
      <Text style={muted}>
        {RESULT_INTEGRITY_NOTE_EN} Payout is processed within 7 business days
        of receiving your reply.
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
