// Permanent address: oxxovo.ai/c/<id> never changes, even if the section slug does.
// 308 to the current address ONLY for an item that passes the public judgement
// AND whose kind has a configured slug. Every other case -- held, hidden, rights
// blocked, not yet due, closed switch, no slug, unknown id -- is the same
// notFound(), so this endpoint cannot be used to learn that an item exists.
import { notFound, permanentRedirect } from 'next/navigation'
import { resolvePublicAddress } from '@/lib/content-public'

export const dynamic = 'force-dynamic'

export default async function PermanentContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const to = await resolvePublicAddress(id)
  if (!to) notFound()
  permanentRedirect(to)
}
