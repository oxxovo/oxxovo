import Link from 'next/link'
import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseServer } from '@/lib/supabase-server'
import { DEFAULT_SEASON, type SeasonInput } from '@/lib/season-schema'
import { SeasonForm } from '../SeasonForm'

export default async function NewSeasonPage() {
  await requireAdmin()
  const supabase = await createSupabaseServer()

  const { data: latest } = await supabase
    .from('seasons')
    .select('season_number')
    .order('season_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextNumber = (latest?.season_number ?? -1) + 1
  const initial: SeasonInput = {
    ...DEFAULT_SEASON,
    season_number: nextNumber,
  }

  return (
    <div className="p-8 max-w-4xl">
      <header className="mb-8">
        <Link href="/admin/seasons" className="text-xs text-[#ff8844] hover:underline">
          ← Seasons
        </Link>
        <h1 className="text-3xl font-black mt-3">New season</h1>
        <p className="text-sm text-white/40 mt-1">
          Defaults filled with the standard tournament profile. Save creates the
          season in <span className="text-white/70">draft</span> status — it
          won&rsquo;t appear on the public site until you switch the status to{' '}
          <span className="text-white/70">active</span>.
        </p>
      </header>

      <SeasonForm id={null} initial={initial} />
    </div>
  )
}
