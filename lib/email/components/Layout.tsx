// Shared layout for every transactional email. Header is the OXXOVO wordmark
// (image, since CSS gradient text doesn't render in most email clients).
// Footer carries the corporate name + Privacy/Terms links.
//
// Light mode only — most email clients (especially Outlook) render dark mode
// inconsistently, so we keep the body white with high-contrast text.

import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { ReactNode } from 'react'
import type { EmailLang } from '../lang'

const APP_URL = process.env.APP_URL ?? 'https://oxxovo.com'

type Props = {
  lang: EmailLang
  preview: string
  children: ReactNode
}

export function Layout({ lang, preview, children }: Props) {
  return (
    <Html lang={lang === 'ko' ? 'ko' : 'en'}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Img
              src={`${APP_URL}/oxxovo_logo.png`}
              alt="OXXOVO"
              width="160"
              height="48"
              style={logo}
            />
          </Section>

          <Section style={content}>{children}</Section>

          <Hr style={divider} />

          <Section style={footer}>
            <Text style={footerText}>OXXOVO Labs Inc. · Las Vegas, NV</Text>
            <Text style={footerLinks}>
              <Link href={`${APP_URL}/privacy`} style={footerLink}>
                {lang === 'ko' ? '개인정보 처리방침' : 'Privacy'}
              </Link>
              {' · '}
              <Link href={`${APP_URL}/terms`} style={footerLink}>
                {lang === 'ko' ? '이용약관' : 'Terms'}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const body: React.CSSProperties = {
  background: '#f5f5f7',
  margin: 0,
  padding: '24px 0',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
}

const container: React.CSSProperties = {
  background: '#ffffff',
  maxWidth: 600,
  margin: '0 auto',
  borderRadius: 8,
  overflow: 'hidden',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
}

const header: React.CSSProperties = {
  padding: '28px 32px 20px',
  borderBottom: '1px solid #ececef',
}

const logo: React.CSSProperties = {
  display: 'block',
  height: 48,
  width: 'auto',
}

const content: React.CSSProperties = {
  padding: '32px',
}

const divider: React.CSSProperties = {
  margin: 0,
  border: 'none',
  borderTop: '1px solid #ececef',
}

const footer: React.CSSProperties = {
  padding: '20px 32px 28px',
  textAlign: 'center',
}

const footerText: React.CSSProperties = {
  color: '#888888',
  fontSize: 12,
  margin: '0 0 6px',
}

const footerLinks: React.CSSProperties = {
  color: '#888888',
  fontSize: 12,
  margin: 0,
}

const footerLink: React.CSSProperties = {
  color: '#888888',
  textDecoration: 'underline',
}
