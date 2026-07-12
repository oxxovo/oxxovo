// Growth engine #1: sent once a creator's PRELIMINARY entry is live on Watch.
// The creator is a marketing partner -- this email hands them their published
// film + a frictionless way to show it off. No voting in prelim, so the focus is
// "watch my film + share". Tone (advisor): the work is officially live; invite
// fans to watch -- never "ask friends to vote".
//
// Hero = the creator's own thumbnail ("that's my film!"). Static email, so the
// share row is X + Facebook (web intents) + a big Watch CTA; the full native
// share sheet (Instagram/TikTok/Copy) lives on the Watch page ShareButton.
//
// Visual polish is intentionally minimal here -- structure/plumbing first;
// Jenny3's design comp gets layered on after. (TK 2026-07-11)

import { Heading, Text, Section, Button, Img, Link, Hr } from '@react-email/components'
import { Layout } from '../components/Layout'
import type { EmailLang } from '../lang'

export type VideoLivePrelimProps = {
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

export function VideoLivePrelim(p: VideoLivePrelimProps) {
  return p.lang === 'ko' ? <Korean {...p} /> : <English {...p} />
}

export function subjectFor(p: VideoLivePrelimProps): string {
  return p.lang === 'ko'
    ? `🎬 ${p.videoTitle} — OXXOVO Watch에 공개되었습니다`
    : `🎬 Your submission is now live on OXXOVO Watch`
}

function Hero({ p }: { p: VideoLivePrelimProps }) {
  if (!p.thumbnailUrl) return null
  return (
    <Link href={p.videoUrl}>
      <Img src={p.thumbnailUrl} alt={p.videoTitle} width="536" style={hero} />
    </Link>
  )
}

function ShareRow({ p, L }: { p: VideoLivePrelimProps; L: Record<string, string> }) {
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

function Korean(p: VideoLivePrelimProps) {
  const L = { moreShare: 'Instagram · TikTok · 카카오톡 · 링크 복사는', onWatch: 'Watch 페이지에서 한 번에' }
  return (
    <Layout lang="ko" preview={`${p.videoTitle} — OXXOVO Watch에 공개되었습니다.`}>
      <Hero p={p} />
      <Heading style={headingStyle}>당신의 작품이 공개되었습니다, {p.creatorName}님</Heading>
      <Text style={paragraph}>
        <strong>{p.videoTitle}</strong>이(가) OXXOVO {p.seasonName} 공식 Watch에 공개되었습니다.
        이제 전 세계 관객이 당신의 작품을 감상할 수 있습니다.
      </Text>
      <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
        <Button href={p.videoUrl} style={ctaButton}>▶ 내 작품 보기</Button>
      </Section>
      <Hr style={hr} />
      <Text style={paragraph}>
        이제 팬들에게 알려주세요. 당신의 작품을 SNS, 커뮤니티, 친구들에게 공유하고
        OXXOVO에 초대하세요.
      </Text>
      <ShareRow p={p} L={L} />
      <Hr style={hr} />
      <Text style={closer}>AI is easy. Winning is hard.</Text>
      <Text style={signoff}>Team OXXOVO</Text>
    </Layout>
  )
}

function English(p: VideoLivePrelimProps) {
  const L = { moreShare: 'Instagram, TikTok, and Copy Link are all on', onWatch: 'the Watch page' }
  return (
    <Layout lang="en" preview={`${p.videoTitle} is now live on OXXOVO Watch.`}>
      <Hero p={p} />
      <Heading style={headingStyle}>Your film is live, {p.creatorName}</Heading>
      <Text style={paragraph}>
        <strong>{p.videoTitle}</strong> is now on OXXOVO {p.seasonName}&rsquo;s official Watch.
        Audiences around the world can watch your work.
      </Text>
      <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
        <Button href={p.videoUrl} style={ctaButton}>▶ Watch Your Film</Button>
      </Section>
      <Hr style={hr} />
      <Text style={paragraph}>
        Now show your fans. Share your film to social, communities, and friends, and
        invite them to OXXOVO.
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
