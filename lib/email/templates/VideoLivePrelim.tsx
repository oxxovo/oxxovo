// Growth engine #1 -- PRELIMINARY film published + scored (Jenny3 dark comp,
// TK 2026-07-12). The creator's film is live on Watch AND their score is public
// (OXXOVO publishes prelim scores). The email hands them their score + Triple-AI
// notes + a frictionless share so they bring fans in. Dark, 520px table layout;
// R2-hosted logo (no base64 -- Gmail-safe); the "share" link carries the
// creator's ?ref= UTM so fans' signups + votes credit back to them.

import { Html, Head, Body } from '@react-email/components'
import type { EmailLang } from '../lang'

const LOGO = 'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/brand/oxxovo_email_logo_dark.png'

export type VideoLivePrelimProps = {
  lang: EmailLang
  nickname: string
  seasonName: string
  videoTitle: string
  thumbnailUrl: string | null
  watchUrl: string // "Watch your film" (creator's own, plain)
  shareUrl: string // "share to fans" (?ref= + utm)
  reportUrl: string // "full report"
  score: number | null
  percentile: number | null
  rank: number | null
  aiStrength: string
  aiImprove: string
}

export function subjectFor(p: VideoLivePrelimProps): string {
  return p.lang === 'ko'
    ? `🎬 ${p.videoTitle} — 작품과 점수가 공개됐습니다`
    : `🎬 ${p.videoTitle} — your film & score are live on OXXOVO`
}

export function VideoLivePrelim(p: VideoLivePrelimProps) {
  const ko = p.lang === 'ko'
  const t = ko
    ? {
        head: 'PRELIMINARY',
        badge: '✓ PUBLISHED · SCORED',
        title: ['당신의 작품과 점수가', '공개됐습니다'],
        sub: 'OXXOVO는 예선부터 모든 참가작의 점수를 공개합니다.',
        watch: '▶ Watch your film',
        share: '팬들에게 공유하기',
        critique: 'Triple-AI 심사평',
        strength: '강점',
        improve: '개선',
        report: '전체 리포트 보기 →',
        closer: ['당신의 실력이 점수로 공개됐습니다.', '팬들에게 보여주세요.'],
      }
    : {
        head: 'PRELIMINARY',
        badge: '✓ PUBLISHED · SCORED',
        title: ['Your film and score', 'are now public'],
        sub: 'OXXOVO publishes every entry’s score, from the preliminary round on.',
        watch: '▶ Watch your film',
        share: 'Share with your fans',
        critique: 'Triple-AI notes',
        strength: 'Strength',
        improve: 'Improve',
        report: 'See the full report →',
        closer: ['Your skill is public, in numbers.', 'Show it to your fans.'],
      }

  return (
    <Html lang={p.lang}>
      <Head />
      <Body style={page}>
        <table width="520" cellPadding={0} cellSpacing={0} border={0} align="center" style={shell}>
          {/* header */}
          <tbody>
            <tr>
              <td style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}` }}>
                <table width="100%" cellPadding={0} cellSpacing={0} border={0}>
                  <tbody>
                    <tr>
                      <td>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={LOGO} width={110} alt="OXXOVO" style={logoImg} />
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

            {/* score / percentile / rank */}
            <tr>
              <td style={{ padding: '20px 24px 16px' }}>
                <table width="100%" cellPadding={0} cellSpacing={0} border={0}>
                  <tbody>
                    <tr>
                      <Stat label="OXXOVO SCORE" value={p.score != null ? p.score.toFixed(2) : '—'} accent />
                      <td width="2%"></td>
                      <Stat label="TOP" value={p.percentile != null ? `${p.percentile}%` : '—'} />
                      <td width="2%"></td>
                      <Stat label="RANK" value={p.rank != null ? String(p.rank) : '—'} />
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            {/* CTAs */}
            <tr>
              <td style={{ padding: '0 24px 8px' }}>
                <Ctas watchUrl={p.watchUrl} shareUrl={p.shareUrl} watchLabel={t.watch} shareLabel={t.share} />
              </td>
            </tr>

            {/* Triple-AI critique */}
            <tr>
              <td style={{ padding: '16px 24px 20px' }}>
                <table width="100%" cellPadding={0} cellSpacing={0} border={0} style={{ background: C.card, borderRadius: 12 }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: 18 }}>
                        <p style={{ color: C.gray, fontSize: 12, margin: '0 0 10px' }}>{t.critique}</p>
                        <p style={{ margin: '0 0 12px' }}>
                          <Chip>Claude</Chip>
                          <Chip>GPT</Chip>
                          <Chip>Gemini</Chip>
                        </p>
                        <p style={critiqueLine}>
                          <span style={{ color: C.green }}>{t.strength}</span> — {p.aiStrength}
                        </p>
                        <p style={{ ...critiqueLine, margin: '0 0 14px' }}>
                          <span style={{ color: C.amber }}>{t.improve}</span> — {p.aiImprove}
                        </p>
                        <a href={p.reportUrl} style={{ color: C.purple, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                          {t.report}
                        </a>
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

// ── shared building blocks (used by both prelim & main) ─────────────────────

export const C = {
  bg: '#030305',
  page: '#0F0D14',
  border: '#2A1B45',
  purple: '#8B22FF',
  lilac: '#C6A8FF',
  badgeBg: '#2A1550',
  card: '#12091F',
  thumbBg: '#2A1550',
  thumbFoot: '#0A0512',
  gray: '#9B93A8',
  dim: '#6B6478',
  body: '#C6BFD4',
  green: '#4ADE80',
  amber: '#FBBF24',
  mainStat: '#1A0F2E',
}

export function Thumb({
  videoTitle,
  nickname,
  seasonName,
  thumbnailUrl,
  watchUrl,
}: {
  videoTitle: string
  nickname: string
  seasonName: string
  thumbnailUrl: string | null
  watchUrl: string
}) {
  return (
    <table width="100%" cellPadding={0} cellSpacing={0} border={0} style={{ background: C.thumbBg, borderRadius: 12 }}>
      <tbody>
        <tr>
          <td align="center" height={190} style={{ padding: '30px 0' }}>
            <a href={watchUrl} style={{ textDecoration: 'none' }}>
              {thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbnailUrl} alt={videoTitle} width={472} style={{ display: 'block', width: '100%', maxWidth: 472, height: 'auto', borderRadius: 8, margin: '0 auto' }} />
              ) : (
                <>
                  <div style={playCircle}>{'▶'}</div>
                  <p style={{ color: C.gray, fontSize: 11, margin: '10px 0 0' }}>[ thumbnail ]</p>
                </>
              )}
            </a>
          </td>
        </tr>
        <tr>
          <td style={{ padding: '12px 14px', background: C.thumbFoot, borderRadius: '0 0 12px 12px' }}>
            <p style={{ color: '#ffffff', fontSize: 14, fontWeight: 600, margin: '0 0 2px' }}>{videoTitle}</p>
            <p style={{ color: C.dim, fontSize: 11, margin: 0 }}>by @{nickname} · {seasonName}</p>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <td width="32%" align="center" style={{ background: C.card, borderRadius: 12, padding: '16px 8px' }}>
      <p style={{ color: C.dim, fontSize: 10, margin: '0 0 6px' }}>{label}</p>
      <p style={{ color: accent ? C.purple : '#ffffff', fontSize: 28, fontWeight: 600, margin: 0 }}>{value}</p>
    </td>
  )
}

export function Ctas({ watchUrl, shareUrl, watchLabel, shareLabel }: { watchUrl: string; shareUrl: string; watchLabel: string; shareLabel: string }) {
  return (
    <table width="100%" cellPadding={0} cellSpacing={0} border={0}>
      <tbody>
        <tr>
          <td align="center" style={{ background: C.purple, borderRadius: 12, padding: 16 }}>
            <a href={watchUrl} style={{ color: '#ffffff', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>{watchLabel}</a>
          </td>
        </tr>
        <tr>
          <td height={10}></td>
        </tr>
        <tr>
          <td align="center" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
            <a href={shareUrl} style={{ color: C.lilac, fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>{shareLabel}</a>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

function Chip({ children }: { children: string }) {
  return <span style={chip}>{children}</span>
}

export function Footer({ closer }: { closer: string[] }) {
  return (
    <tr>
      <td align="center" style={{ padding: '0 24px 24px' }}>
        <p style={{ color: C.dim, fontSize: 11, lineHeight: 1.6, margin: '0 0 14px' }}>
          {closer[0]}
          <br />
          {closer[1]}
        </p>
        <table width="100%" cellPadding={0} cellSpacing={0} border={0}>
          <tbody>
            <tr>
              <td style={{ borderTop: `1px solid ${C.border}`, paddingTop: 18 }} align="center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={LOGO} width={76} alt="OXXOVO" style={{ display: 'block', margin: '0 auto 10px', border: 0, height: 'auto', opacity: 0.55 }} />
                <p style={{ color: '#4A4458', fontSize: 10, margin: 0 }}>OXXOVO{'™'} · www.oxxovo.ai</p>
                <p style={{ color: '#3A3548', fontSize: 10, margin: '6px 0 0' }}>OXXOVO Labs Inc. · Las Vegas, Nevada, USA</p>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  )
}

// ── styles ──────────────────────────────────────────────────────────────────
const page: React.CSSProperties = { margin: 0, padding: '40px 20px', background: C.page, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',sans-serif" }
const shell: React.CSSProperties = { maxWidth: 520, background: C.bg, borderRadius: 12, overflow: 'hidden' }
const logoImg: React.CSSProperties = { display: 'block', border: 0, height: 'auto' }
const badge: React.CSSProperties = { display: 'inline-block', background: C.badgeBg, color: C.lilac, fontSize: 11, padding: '5px 12px', borderRadius: 12, marginBottom: 14 }
const title: React.CSSProperties = { color: '#ffffff', fontSize: 24, fontWeight: 600, margin: '0 0 8px', lineHeight: 1.4 }
const subtext: React.CSSProperties = { color: C.gray, fontSize: 13, margin: 0, lineHeight: 1.6 }
const playCircle: React.CSSProperties = { width: 56, height: 56, borderRadius: '50%', background: C.purple, lineHeight: '56px', margin: '0 auto', color: '#fff', fontSize: 22 }
const chip: React.CSSProperties = { display: 'inline-block', background: C.badgeBg, color: C.lilac, fontSize: 11, padding: '3px 8px', borderRadius: 10, marginRight: 6 }
const critiqueLine: React.CSSProperties = { color: C.body, fontSize: 12, lineHeight: 1.6, margin: '0 0 8px' }
