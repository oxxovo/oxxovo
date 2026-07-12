// Growth engine #2: sent once a creator's MAIN-ROUND film is live on Watch.
// Unlike the prelim mail, the main round has an OPEN community vote, so the call
// is "watch AND vote" -- the creator rallies their fans to cast official votes.
// Tone (advisor): the film is officially competing; invite fans to watch and
// vote -- the share links carry the creator's ?ref= so signups + votes credit
// back to them (the growth loop).
//
// Mirrors VideoLivePrelim's structure/styles (plumbing first; Jenny3's KO dark
// comp gets layered on after). (TK 2026-07-12)

import { Heading, Text, Section, Button, Img, Link, Hr } from '@react-email/components'
import { Layout } from '../components/Layout'
import type { EmailLang } from '../lang'

export type VideoLiveMainProps = {
  lang: EmailLang
  creatorName: string
  seasonName: string
  videoTitle: string
  thumbnailUrl: string | null
  videoUrl: string
  shareText: string
  xUrl: string
  fbUrl: string
}

export function VideoLiveMain(p: VideoLiveMainProps) {
  return p.lang === 'ko' ? <Korean {...p} /> : <English {...p} />
}

export function subjectFor(p: VideoLiveMainProps): string {
  return p.lang === 'ko'
    ? `🏆 ${p.videoTitle} — 본선 진출작 공개, 투표가 시작됐습니다`
    : `🏆 Your main-round film is live — the vote is on`
}

function Hero({ p }: { p: VideoLiveMainProps }) {
  if (!p.thumbnailUrl) return null
  return (
    <Link href={p.videoUrl}>
      <Img src={p.thumbnailUrl} alt={p.videoTitle} width="536" style={hero} />
    </Link>
  )
}

function ShareRow({ p, L }: { p: VideoLiveMainProps; L: Record<string, string> }) {
  return (
    <Section style={{ textAlign: 'center', margin: '8px 0 4px' }}>
      <Button href={p.xUrl} style={xBtn}>X</Button>
      <Button href={p.fbUrl} style={fbBtn}>Facebook</Button>
      <Text style={shareHint}>
        {L.moreShare}{' '}
        <Link href={p.videoUrl} style={inlineLink}>{L.onWatch}</Link>
      </Text>
    </Section>
  )
}

function Korean(p: VideoLiveMainProps) {
  const L = { moreShare: 'Instagram · TikTok · 카카오톡 · 링크 복사는', onWatch: 'Watch 페이지에서 한 번에' }
  return (
    <Layout lang="ko" preview={`${p.videoTitle} — 본선 진출작 공개, 투표가 시작됐습니다.`}>
      <Hero p={p} />
      <Heading style={headingStyle}>본선 무대에 올랐습니다, {p.creatorName}님</Heading>
      <Text style={paragraph}>
        <strong>{p.videoTitle}</strong>이(가) OXXOVO {p.seasonName} 본선 진출작으로 공개되었습니다.
        지금부터 관객 투표가 진행됩니다.
      </Text>
      <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
        <Button href={p.videoUrl} style={ctaButton}>▶ 내 작품 보고 투표하기</Button>
      </Section>
      <Hr style={hr} />
      <Text style={paragraph}>
        팬들을 불러오세요. 당신의 작품을 공유하고, 관객이 직접 감상하고 공식 투표에 참여하도록
        OXXOVO에 초대하세요.
      </Text>
      <ShareRow p={p} L={L} />
      <Hr style={hr} />
      <Text style={closer}>AI is easy. Winning is hard.</Text>
      <Text style={signoff}>Team OXXOVO</Text>
    </Layout>
  )
}

function English(p: VideoLiveMainProps) {
  const L = { moreShare: 'Instagram, TikTok, and Copy Link are all on', onWatch: 'the Watch page' }
  return (
    <Layout lang="en" preview={`${p.videoTitle} is live in the Main Round — the vote is on.`}>
      <Hero p={p} />
      <Heading style={headingStyle}>You&rsquo;re on the main stage, {p.creatorName}</Heading>
      <Text style={paragraph}>
        <strong>{p.videoTitle}</strong> is now live as a main-round film in OXXOVO {p.seasonName}.
        Community voting is on.
      </Text>
      <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
        <Button href={p.videoUrl} style={ctaButton}>▶ Watch &amp; Vote</Button>
      </Section>
      <Hr style={hr} />
      <Text style={paragraph}>
        Rally your fans. Share your film and invite them to OXXOVO to watch it and cast their
        official vote.
      </Text>
      <ShareRow p={p} L={L} />
      <Hr style={hr} />
      <Text style={closer}>AI is easy. Winning is hard.</Text>
      <Text style={signoff}>Team OXXOVO</Text>
    </Layout>
  )
}

const headingStyle: React.CSSProperties = { color: '#0a0608', fontSize: 24, lineHeight: 1.3, fontWeight: 800, margin: '20px 0 14px' }
const paragraph: React.CSSProperties = { color: '#1a1a1f', fontSize: 15, lineHeight: 1.7, margin: '0 0 14px' }
const hero: React.CSSProperties = { width: '100%', maxWidth: 536, height: 'auto', borderRadius: 10, display: 'block', margin: '0 auto' }
const ctaButton: React.CSSProperties = { background: '#8b22ff', color: '#ffffff', fontSize: 16, fontWeight: 700, padding: '14px 34px', borderRadius: 10, textDecoration: 'none', display: 'inline-block' }
const xBtn: React.CSSProperties = { background: '#111111', color: '#ffffff', fontSize: 14, fontWeight: 700, padding: '10px 22px', borderRadius: 8, textDecoration: 'none', display: 'inline-block', margin: '0 4px' }
const fbBtn: React.CSSProperties = { background: '#1877f2', color: '#ffffff', fontSize: 14, fontWeight: 700, padding: '10px 22px', borderRadius: 8, textDecoration: 'none', display: 'inline-block', margin: '0 4px' }
const shareHint: React.CSSProperties = { color: '#666666', fontSize: 12, lineHeight: 1.6, margin: '12px 0 0' }
const inlineLink: React.CSSProperties = { color: '#8b22ff', fontWeight: 600, textDecoration: 'underline' }
const hr: React.CSSProperties = { borderColor: '#eceaf2', margin: '24px 0' }
const closer: React.CSSProperties = { color: '#1a1a1f', fontSize: 15, fontWeight: 600, margin: '0 0 12px' }
const signoff: React.CSSProperties = { color: '#8b22ff', fontSize: 13, fontWeight: 600, margin: '20px 0 0' }
