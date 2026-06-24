import { notFound } from 'next/navigation'
import { requireStaff } from '@/lib/admin-auth'
import { createSupabaseServer } from '@/lib/supabase-server'
import { ApplicationDetail, type ScoringDetail } from '../ApplicationDetail'
import { type ApplicationRow } from '../ApplicationsView'

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireStaff()
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

  // Season name for context + scoring_results (application round) in parallel.
  const [seasonRes, scoringRes] = await Promise.all([
    supabase
      .from('seasons')
      .select('name, season_number')
      .eq('id', data.season_id)
      .single(),
    supabase
      .from('scoring_results')
      .select('*')
      .eq('application_id', id)
      .eq('round', 'application')
      .maybeSingle(),
  ])

  // Compose ApplicationRow with scoring summary fields the detail view also uses.
  const scoring = scoringRes.data as ScoringDetail | null
  const appRow: ApplicationRow = {
    ...(data as Omit<ApplicationRow, 'verified_score' | 'grade' | 'integrity_confidence' | 'integrity_flag' | 'integrity_recommendation' | 'judged_status'>),
    verified_score: scoring?.verified_score ?? null,
    grade: (scoring?.grade as ApplicationRow['grade']) ?? null,
    integrity_confidence: (scoring?.integrity_confidence as ApplicationRow['integrity_confidence']) ?? null,
    integrity_flag: scoring?.integrity_flag ?? false,
    integrity_recommendation: (scoring?.integrity_recommendation as ApplicationRow['integrity_recommendation']) ?? null,
    judged_status: (scoring?.judged_status as ApplicationRow['judged_status']) ?? null,
  }

  return (
    <ApplicationDetail
      app={appRow}
      scoring={scoring}
      seasonLabel={
        seasonRes.data
          ? `${seasonRes.data.name} (#${seasonRes.data.season_number})`
          : data.season_id
      }
    />
  )
}
