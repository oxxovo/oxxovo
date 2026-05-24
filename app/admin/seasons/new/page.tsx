import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseServer } from '@/lib/supabase-server'
import { DEFAULT_SEASON, type SeasonInput } from '@/lib/season-schema'
import { SeasonForm } from '../SeasonForm'
import { NewSeasonHeader } from '../SeasonPageHeader'

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
      <NewSeasonHeader />
      <SeasonForm id={null} initial={initial} />
    </div>
  )
}
