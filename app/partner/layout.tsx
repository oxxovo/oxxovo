import { notFound } from 'next/navigation'
import { isMemberHostedEnabled } from '@/lib/member-hosted'

// M-3: server gate for the whole /partner route (activation landing + invite
// flow). When member_hosted_enabled is off (the default) every /partner page
// 404s, so an invited user cannot activate while the program is disabled. The
// auth-callback route handler is gated separately (layouts do not wrap route
// handlers) -- see app/partner/auth/callback/route.ts.
export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  if (!(await isMemberHostedEnabled())) notFound()
  return <>{children}</>
}
