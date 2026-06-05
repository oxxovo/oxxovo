import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getTierConfig } from '@/lib/partners'
import { getCurrentSeasonId, type Season } from '@/lib/seasons'
import { HostNewForm } from './HostNewForm'

export const dynamic = 'force-dynamic'

function Gate({ title, body, cta }: { title: string; body: string; cta?: { href: string; label: string } }) {
  return (
    <main className="min-h-screen bg-[#030305] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-black text-[#8b22ff] mb-2">OXXOVO</h1>
        <p className="text-white/70 text-sm mb-6">{body}</p>
        <p className="sr-only">{title}</p>
        {cta && (
          <Link
            href={cta.href}
            className="inline-block bg-[#8b22ff] text-white font-bold text-sm px-6 py-3 rounded-lg hover:bg-[#7a1de0] transition"
          >
            {cta.label}
          </Link>
        )}
      </div>
    </main>
  )
}

export default async function HostNewPage() {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <Gate
        title="Sign in required"
        body="Please sign in to create a tournament."
        cta={{ href: '/login', label: 'Sign in' }}
      />
    )
  }

  const db = createSupabaseAdmin()
  const { data: profile } = await db
    .from('profiles')
    .select('partner_status, partner_tier')
    .eq('id', user.id)
    .maybeSingle()

  const status = profile?.partner_status
  if (status !== 'active') {
    return (
      <Gate
        title="Not a partner host"
        body={
          status === 'invited'
            ? 'Your partner invitation is pending. Please activate it from your invite email first.'
            : 'Only active partner hosts can create tournaments.'
        }
        cta={{ href: '/', label: 'Back to home' }}
      />
    )
  }

  const tierName = (profile?.partner_tier as string | null) ?? null
  const tier = tierName ? await getTierConfig(tierName) : null
  if (!tier) {
    return (
      <Gate
        title="Tier missing"
        body="No tier is assigned to your partner account. Please contact the OXXOVO team."
        cta={{ href: '/', label: 'Back to home' }}
      />
    )
  }

  // Prefill the configurable fields from the current official season so the
  // partner starts from sane, platform-consistent defaults.
  const { data: tmpl } = await db
    .from('seasons')
    .select('*')
    .eq('id', getCurrentSeasonId())
    .single()
  const t = tmpl as Season | null

  const defaults = {
    application_video_min_seconds: t?.application_video_min_seconds ?? 15,
    application_video_max_seconds: t?.application_video_max_seconds ?? 30,
    prize_first_pct: t?.prize_first_pct ?? 60,
    prize_second_pct: t?.prize_second_pct ?? 25,
    prize_third_pct: t?.prize_third_pct ?? 15,
    scoring_intent_clarity_weight: t?.scoring_intent_clarity_weight ?? 0.2,
    scoring_execution_weight: t?.scoring_execution_weight ?? 0.25,
    scoring_originality_weight: t?.scoring_originality_weight ?? 0.35,
    scoring_integrity_weight: t?.scoring_integrity_weight ?? 0.2,
  }

  return (
    <HostNewForm
      tierName={tier.tier}
      maxApplicantsCap={tier.max_applications_cap}
      maxTournamentsPerSeason={tier.max_tournaments_per_season}
      defaults={defaults}
    />
  )
}
