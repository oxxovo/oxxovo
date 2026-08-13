// Admin recipient-console campaign (admin_broadcasts). Unlike every other
// template here, the copy is admin-authored free text, not a ko/en DICT --
// whatever language the admin wrote in is what goes out. The chrome (Layout
// footer, unsubscribe) stays in the lang passed to it (default 'en').
//
// The poster is a REFERENCE image (<img src>), never the carrier of the
// message: TK's rule is that the core copy must survive images being
// blocked, so bodyText always renders as real text above/around it -- never
// baked into the picture as the only copy.

import { Heading, Img, Link, Text } from '@react-email/components'
import { Layout } from '../components/Layout'
import type { EmailLang } from '../lang'

export type AdminBroadcastProps = {
  lang: EmailLang
  subject: string
  bodyText: string
  posterImageUrl: string | null
  promoVideoUrl: string | null
}

export function AdminBroadcast(p: AdminBroadcastProps) {
  const paragraphs = p.bodyText.split('\n').map((line) => line.trim()).filter(Boolean)

  return (
    <Layout lang={p.lang} preview={p.subject}>
      <Heading style={headingStyle}>{p.subject}</Heading>

      {paragraphs.map((line, i) => (
        <Text key={i} style={paragraph}>
          {line}
        </Text>
      ))}

      {p.posterImageUrl && (
        <Img src={p.posterImageUrl} alt="" width="536" style={poster} />
      )}

      {p.promoVideoUrl && (
        <Text style={paragraph}>
          <Link href={p.promoVideoUrl} style={videoLink}>
            {p.lang === 'ko' ? '영상 보기 →' : 'Watch the video →'}
          </Link>
        </Text>
      )}
    </Layout>
  )
}

export function subjectFor(p: AdminBroadcastProps): string {
  return p.subject
}

const headingStyle: React.CSSProperties = {
  color: '#0a0608',
  fontSize: 24,
  lineHeight: 1.3,
  fontWeight: 800,
  margin: '0 0 16px',
}

const paragraph: React.CSSProperties = {
  color: '#1a1a1f',
  fontSize: 15,
  lineHeight: 1.7,
  margin: '0 0 14px',
  whiteSpace: 'pre-wrap',
}

const poster: React.CSSProperties = {
  display: 'block',
  width: '100%',
  maxWidth: 536,
  height: 'auto',
  borderRadius: 8,
  margin: '8px 0 14px',
}

const videoLink: React.CSSProperties = {
  color: '#8b22ff',
  fontWeight: 700,
  textDecoration: 'none',
}
