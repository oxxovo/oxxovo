import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseServer } from '@/lib/supabase-server'
import { ApplicationDetail } from '../ApplicationDetail'
import { type ApplicationRow } from '../ApplicationsView'

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const supabase = await createSupabaseServer()

  const { data, error } = await supabase
    .from('genesis_applications')
    .select(
      'id, season_id, email, creator_name, country, channel_url, free_entry_url, video_duration_seconds, ai_service, creator_statement, status, award_rank, admin_notes, created_at, winner_info_completed_at',
    )
    .eq('id', id)
    .single()

  if (error || !data) {
    notFound()
  }

  // Season name for context
  const { data: season } = await supabase
    .from('seasons')
    .select('name, season_number')
    .eq('id', data.season_id)
    .single()

  return (
    <ApplicationDetail
      app={data as ApplicationRow}
      seasonLabel={
        season ? `${season.name} (#${season.season_number})` : data.season_id
      }
    />
  )
}
