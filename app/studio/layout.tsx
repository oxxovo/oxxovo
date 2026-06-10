import { notFound } from 'next/navigation'
import { isSession6Enabled } from '@/lib/session6'

// Server gate for the whole /studio route. When session6_enabled is off (the
// default), /studio 404s -- no studio surface is reachable. This is the
// authoritative public gate; the client page never renders when off.
export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  if (!(await isSession6Enabled())) notFound()
  return <>{children}</>
}
