import { notFound } from 'next/navigation'
import { isMemberHostedEnabled } from '@/lib/member-hosted'

// Server gate for the whole /host route. When member_hosted_enabled is off (the
// default), /host 404s -- no host surface is reachable.
export default async function HostLayout({ children }: { children: React.ReactNode }) {
  if (!(await isMemberHostedEnabled())) notFound()
  return <>{children}</>
}
