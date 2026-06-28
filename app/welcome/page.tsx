// /welcome -- the marketing landing, always reachable here even when the root
// is switched to Watch (watch_as_home on). The Watch sidebar's "Tournament"
// link points here. When watch_as_home is off, the root (/) shows the same view.

import { LandingView } from '@/app/_landing/LandingView'

export const dynamic = 'force-dynamic'

export default function WelcomePage() {
  return <LandingView />
}
