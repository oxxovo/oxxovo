import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { DEFAULT_SEASON, type SeasonFormInitial } from '@/lib/season-schema'
import { SeasonForm } from '../SeasonForm'
import { NewSeasonHeader } from '../SeasonPageHeader'

export default async function NewSeasonPage() {
  await requireAdmin()
  const supabase = createSupabaseAdmin()

  const { data: latest } = await supabase
    .from('seasons')
    .select('season_number')
    .order('season_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextNumber = (latest?.season_number ?? -1) + 1
  // ★is_fixture is deliberately NOT set here. A new season has no answer yet, so
  // the form renders neither option checked and the admin has to pick one. See
  // SeasonFormInitial.
  const initial: SeasonFormInitial = {
    ...DEFAULT_SEASON,
    season_number: nextNumber,
  }

  return (
    <div className="p-8 max-w-4xl">
      <NewSeasonHeader />
      <SeasonForm id={null} initial={initial} />
    </div>
  )
}
