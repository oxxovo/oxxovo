// /admin/actors -- OXXOVO's own synthetic performers (`official_actors`).
//
// READ-ONLY by design, phase 1. Nothing on this page writes. See
// lib/studio-official-actors.ts for why status/kind are shown rather than edited
// (no CHECK exists on either column, and no vocabulary has been decided) and why
// the signed fields can never be edited from here at all.
//
// The signature is verified HERE, in the server component, and only the verdict
// crosses into the client bundle -- STUDIO_CRYPTOBIND_SECRET must not reach the
// browser, and neither must any value recomputed from it.

import { requireAdmin } from '@/lib/admin-auth'
import {
  listOfficialActors,
  verifyActorBind,
  type ActorBindVerdict,
} from '@/lib/studio-official-actors'
import { ActorsView, type ActorRow } from './ActorsView'

export const dynamic = 'force-dynamic'

export default async function ActorsPage() {
  await requireAdmin()

  const actors = await listOfficialActors()

  const rows: ActorRow[] = actors.map((a) => {
    const verdict: ActorBindVerdict = verifyActorBind(a)
    return {
      id: a.id,
      slug: a.slug,
      displayName: a.display_name,
      kind: a.kind,
      status: a.status,
      canonicalFrontalUrl: a.canonical_frontal_url,
      referenceUrls: a.reference_urls ?? [],
      provenance: a.provenance,
      cryptobindHash: a.cryptobind_hash,
      cryptobindSignature: a.cryptobind_signature,
      cryptobindAlgo: a.cryptobind_algo,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
      // Only the verdict, never the recomputed signature.
      verified: verdict.ok,
      verifyReason: verdict.ok ? null : verdict.reason,
    }
  })

  return <ActorsView rows={rows} />
}
