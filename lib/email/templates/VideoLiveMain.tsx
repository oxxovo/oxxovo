// Growth engine #2 -- MAIN-ROUND film NOW LIVE (Jenny3 dark comp, TK 2026-07-12).
// The core growth loop: the film is officially live and community voting is open
// (Triple-AI 50% + audience 50%). The email rallies the creator's fans to watch
// AND vote, with a ?ref= share link that credits their signups + votes back.
// Shares the dark building blocks with VideoLivePrelim.

import { Html, Head, Body } from '@react-email/components'
import type { EmailLang } from '../lang'
import { C, Thumb, Ctas, Footer } from './VideoLivePrelim'

const LOGO = 'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/brand/oxxovo_email_logo_dark.png'

export type VideoLiveMainProps = {
  lang: EmailLang
  nickname: string
  seasonName: string
  videoTitle: string
  thumbnailUrl: string | null
  watchUrl: string
  shareUrl: string
  voteDeadline: string // preformatted, e.g. "2일 14시간" / "2d 14h"
  viewCount: number
}

export function subjectFor(p: VideoLiveMainProps): string {
  return p.lang === 'ko'
    ? `🏆 ${p.videoTitle} — 본선 공개, 공식 투표가 열렸습니다`
    : `🏆 ${p.videoTitle} — live in the Main Round, the vote is on`
}

export function VideoLiveMain(p: VideoLiveMainProps) {
  const ko = p.lang === 'ko'
  const t = ko
    ? {
        head: 'MAIN ROUND',
        badge: '🔴 NOW LIVE ON OXXOVO',
        title: ['당신의 작품이', '공식 공개됐습니다'],
        sub: '전 세계 관객이 지금 이 작품을 보고 있습니다.',
        watch: '▶ Watch your film',
        share: '팬들에게 공유하기',
        voteTitle: '공식 투표가 열렸습니다',
        voteBody: ['본선 결과는 ', 'Triple-AI 심사 50%', '와 ', '관객 투표 50%', '로 결정됩니다. 당신의 팬들을 공식 투표에 초대하세요.'],
        deadlineLabel: '투표 마감',
        viewLabel: '현재 조회',
        closer: ['링크 하나면 팬들이 작품을 보고, 투표하고,', '당신을 팔로우합니다.'],
      }
    : {
        head: 'MAIN ROUND',
        badge: '🔴 NOW LIVE ON OXXOVO',
        title: ['Your film is', 'officially live'],
        sub: 'Audiences around the world are watching it right now.',
        watch: '▶ Watch your film',
        share: 'Share with your fans',
        voteTitle: 'Community voting is open',
        voteBody: ['The main round is decided by ', 'Triple-AI 50%', ' and ', 'audience votes 50%', '. Invite your fans to cast their official vote.'],
        deadlineLabel: 'Voting closes in',
        viewLabel: 'Views',
        closer: ['One link, and your fans watch, vote,', 'and follow you.'],
      }

  return (
    <Html lang={p.lang}>
      <Head />
      <Body style={page}>
        <table width="520" cellPadding={0} cellSpacing={0} border={0} align="center" style={shell}>
          <tbody>
            {/* header */}
            <tr>
              <td style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}` }}>
                <table width="100%" cellPadding={0} cellSpacing={0} border={0}>
                  <tbody>
                    <tr>
                      <td>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={LOGO} width={110} alt="OXXOVO" style={{ display: 'block', border: 0, height: 'auto' }} />
                      </td>
                      <td align="right" style={{ color: C.dim, fontSize: 11 }}>
                        {p.seasonName} · {t.head}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            {/* hero heading */}
            <tr>
              <td align="center" style={{ padding: '28px 24px 20px' }}>
                <span style={badge}>{t.badge}</span>
                <p style={title}>
                  {t.title[0]}
                  <br />
                  {t.title[1]}
                </p>
                <p style={subtext}>{t.sub}</p>
              </td>
            </tr>

            {/* thumbnail */}
            <tr>
              <td style={{ padding: '0 24px' }}>
                <Thumb videoTitle={p.videoTitle} nickname={p.nickname} seasonName={p.seasonName} thumbnailUrl={p.thumbnailUrl} watchUrl={p.watchUrl} />
              </td>
            </tr>

            {/* CTAs */}
            <tr>
              <td style={{ padding: '20px 24px 8px' }}>
                <Ctas watchUrl={p.watchUrl} shareUrl={p.shareUrl} watchLabel={t.watch} shareLabel={t.share} />
              </td>
            </tr>

            {/* vote block */}
            <tr>
              <td style={{ padding: '16px 24px 20px' }}>
                <table width="100%" cellPadding={0} cellSpacing={0} border={0} style={{ background: C.card, borderRadius: 12 }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: 18 }}>
                        <p style={{ color: C.gray, fontSize: 12, margin: '0 0 12px' }}>{t.voteTitle}</p>
                        <p style={{ color: C.body, fontSize: 13, lineHeight: 1.7, margin: '0 0 14px' }}>
                          {t.voteBody[0]}
                          <span style={{ color: '#fff' }}>{t.voteBody[1]}</span>
                          {t.voteBody[2]}
                          <span style={{ color: '#fff' }}>{t.voteBody[3]}</span>
                          {t.voteBody[4]}
                        </p>
                        <table width="100%" cellPadding={0} cellSpacing={0} border={0}>
                          <tbody>
                            <tr>
                              <VoteStat label={t.deadlineLabel} value={p.voteDeadline} />
                              <td width="4%"></td>
                              <VoteStat label={t.viewLabel} value={p.viewCount.toLocaleString()} />
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            <Footer closer={t.closer} />
          </tbody>
        </table>
      </Body>
    </Html>
  )
}

function VoteStat({ label, value }: { label: string; value: string }) {
  return (
    <td width="48%" align="center" style={{ background: C.mainStat, borderRadius: 8, padding: 12 }}>
      <p style={{ color: C.dim, fontSize: 10, margin: '0 0 4px' }}>{label}</p>
      <p style={{ color: '#fff', fontSize: 16, fontWeight: 600, margin: 0 }}>{value}</p>
    </td>
  )
}

const page: React.CSSProperties = { margin: 0, padding: '40px 20px', background: C.page, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',sans-serif" }
const shell: React.CSSProperties = { maxWidth: 520, background: C.bg, borderRadius: 12, overflow: 'hidden' }
const badge: React.CSSProperties = { display: 'inline-block', background: C.badgeBg, color: C.lilac, fontSize: 11, padding: '5px 12px', borderRadius: 12, marginBottom: 14 }
const title: React.CSSProperties = { color: '#ffffff', fontSize: 24, fontWeight: 600, margin: '0 0 8px', lineHeight: 1.4 }
const subtext: React.CSSProperties = { color: C.gray, fontSize: 13, margin: 0, lineHeight: 1.6 }
