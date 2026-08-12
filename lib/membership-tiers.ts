// Which tiers the /membership comparison shows, and which capability rows survive.
//
// Why this is a module and not two `&&`s in the page: the Partner column was
// public with no gate on it at all. member_hosted_enabled is "false" live, the
// standard rules say season 0 has no partners, and lib/member-hosted.ts states in
// its own doc comment that the switch "gates every public member-hosted surface"
// -- /membership was the one exception, which makes it a bug rather than a choice.
//
// The row rule is derived, not declared. "Hide Partner, and also hide the Host
// tournaments row" would be two facts that have to agree; instead a row is shown
// when some VISIBLE tier grants it. Hiding Partner then removes the host row on
// its own, because Partner is the only tier that grants it -- and if a future
// season grants hosting to Creators, the row keeps itself without anyone
// remembering to revisit this file.
//
// The old page carried the matrix as two parallel arrays (`columns[i]` lined up
// with every `rows[].cells[i]`). That alignment is only safe while nothing is
// ever removed from the middle, which is exactly what a gate does. Keyed by id
// here, so a hidden tier cannot shift another tier's checkmarks onto it.
//
// No imports, so the rule is reachable from a unit test.

export const TIER_IDS = ['visitor', 'member', 'creator', 'partner'] as const
export type TierId = (typeof TIER_IDS)[number]

export const ROW_IDS = ['browse', 'vote', 'compete', 'studio', 'host'] as const
export type RowId = (typeof ROW_IDS)[number]

// Which tiers grant which capability. Unchanged from the four-column table this
// replaces (app/membership/page.tsx rows 45-49 before the gate).
export const GRANTS: Record<RowId, readonly TierId[]> = {
  browse: ['visitor', 'member', 'creator', 'partner'],
  vote: ['member', 'creator', 'partner'],
  compete: ['creator', 'partner'],
  studio: ['creator', 'partner'],
  host: ['partner'],
}

export type MembershipTableInput = {
  // platform_config.member_hosted_enabled -- the same switch that 404s /host and
  // /partner. Off by default, and off live today.
  memberHostedEnabled: boolean
}

export function visibleTiers(input: MembershipTableInput): TierId[] {
  return TIER_IDS.filter((t) => t !== 'partner' || input.memberHostedEnabled)
}

// A row earns its place by being granted to someone the visitor can actually
// become. A row no visible tier grants would render as a full line of dashes --
// a capability the page names and then denies to every tier it shows.
export function visibleRows(input: MembershipTableInput): RowId[] {
  const tiers = visibleTiers(input)
  return ROW_IDS.filter((r) => tiers.some((t) => GRANTS[r].includes(t)))
}

export function tierGrants(row: RowId, tier: TierId): boolean {
  return GRANTS[row].includes(tier)
}

// The whole table, labels included. The page is left as a renderer that maps this
// to markup, which is what makes the gate testable: a pure `visibleTiers` proves
// the rule but not that the page asks it, and the copy is the part that actually
// leaks -- a header hardcoded to col_partner would pass an id-level test.
//
// Labels are passed in because they come from useT() (bilingual, and the KO/EN
// choice is client state), so this module never imports the i18n bundle.

export type TierColumn = {
  id: TierId
  name: string
  sub: string
  highlight: boolean
}

export type CapabilityRow = {
  id: RowId
  label: string
  // One entry per visible column, in the same order as `columns`.
  cells: boolean[]
}

export type MembershipTable = {
  columns: TierColumn[]
  rows: CapabilityRow[]
}

export function buildMembershipTable(
  input: MembershipTableInput & {
    tierLabels: Record<TierId, { name: string; sub: string; highlight: boolean }>
    rowLabels: Record<RowId, string>
  },
): MembershipTable {
  const columns = visibleTiers(input).map((id) => ({ id, ...input.tierLabels[id] }))
  const rows = visibleRows(input).map((id) => ({
    id,
    label: input.rowLabels[id],
    // Keyed off the tier id, not a position, so a hidden column cannot shift
    // another tier's checkmarks onto it.
    cells: columns.map((c) => tierGrants(id, c.id)),
  }))
  return { columns, rows }
}
