import { requireAdmin } from '@/lib/admin-auth'
import {
  getActivePartners,
  getSuspendedPartners,
  getEligibleMembers,
  getTierConfigs,
  getPartnerTournaments,
} from '@/lib/partners'
import { PartnersView } from './PartnersView'

// Partner / Member-Hosted Tournament admin console. All reads go through the
// service-role helpers in lib/partners (the partner tables are service_role
// only), gated by requireAdmin() above.
export default async function PartnersPage() {
  await requireAdmin()

  const [active, suspended, eligible, tiers, tournaments] = await Promise.all([
    getActivePartners(),
    getSuspendedPartners(),
    getEligibleMembers(),
    getTierConfigs(),
    getPartnerTournaments(),
  ])

  return (
    <PartnersView
      active={active}
      suspended={suspended}
      eligible={eligible}
      tiers={tiers}
      tournaments={tournaments}
    />
  )
}
