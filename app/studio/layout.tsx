import { notFound } from 'next/navigation'
import { isSession6Enabled } from '@/lib/session6'

// Server gate for the whole /studio route. When session6_enabled is off (the
// default), /studio 404s -- no studio surface is reachable. This is the
// authoritative public gate; the client page never renders when off.
//
// ★force-dynamic (HQ 2026-08-13): without this, Next prerenders the whole
// route once at build time -- whatever isSession6Enabled() resolved to THEN
// gets baked into a static shell and never re-runs. session6_enabled flipped
// true in the DB, but /studio kept 404ing because the static build from
// before the flip was still being served. Same pattern as app/host/new
// (force-dynamic) for the identical member_hosted_enabled gate.
export const dynamic = 'force-dynamic'

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  if (!(await isSession6Enabled())) notFound()
  return <>{children}</>
}
