// OXXOVO intellectual property metadata.
// To be migrated to a `platform_config` table once admin editing is needed.

export type PatentStatus = 'pending' | 'granted'
export type TrademarkStatus = 'pending' | 'registered'
export type InternationalStatus = 'pending' | 'filed' | 'registered'

export const IP_INFO = {
  patent: {
    office: {
      name: 'Korean Intellectual Property Office',
      abbreviation: 'KIPO',
    },
    filingDate: 'May 19, 2026',
    filingDateISO: '2026-05-19',
    titles: [
      'Production-Stage Authentication & Session-Bound Generation',
      'Server-Authoritative Tournament State Control',
    ] as readonly string[],
    status: 'pending' as PatentStatus,
    jurisdictionShort: 'Korea',
  },
  trademark: {
    name: 'OXXOVO',
    classes: [9, 35, 38, 41, 42, 45] as readonly number[],
    status: 'pending' as TrademarkStatus,
    jurisdictionShort: 'Korea',
  },
  international: {
    status: 'pending' as InternationalStatus,
    treaty: 'Paris Convention',
  },
} as const

export function formatTrademarkClasses(
  classes: readonly number[] = IP_INFO.trademark.classes,
): string {
  return `Classes ${classes.join(', ')}`
}

// Single-line summary used in every page footer.
// Assumes trademark and patent share the same status and jurisdiction.
export function formatFooterStatusLine(): string {
  return `Trademark and patent applications ${IP_INFO.patent.status} in ${IP_INFO.patent.jurisdictionShort}.`
}

export function formatInternationalNote(): string {
  return `International applications ${IP_INFO.international.status} under the ${IP_INFO.international.treaty}.`
}

export function formatPatentOfficeFull(): string {
  return `${IP_INFO.patent.office.name} (${IP_INFO.patent.office.abbreviation})`
}
