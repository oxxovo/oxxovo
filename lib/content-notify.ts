// Import notices for /admin/contents (design SS5-3 step 1b, SS8 "알림 메일").
//
// What this sends: ONE mail for contents that stopped at import and need a
// person (held), ONE for contents that are scheduled to go out. They are never
// mixed ("held인데 송출 예정이라고 보내면 담당자가 안 본다"). Contents held only
// because rights are not cleared get their own section inside the held mail and
// do NOT count towards "need action" -- nobody here can fix them, they only have
// to stay visible (otherwise "why is the news not going out" is never answered).
//
// Not sent: returned notices. contents has no column to track them (notified_at
// is the import notice). Open item in the design doc.
//
// Same rule as the dispatch alerts: notified_at is written only AFTER the mail
// was accepted, so a failed send is retried on the next tick. Runs in the
// dispatch tick before the switch checks, so closed switches do not silence it.
//
// probe- rows (permanent test rows) are excluded in the QUERY and again here.
// Pure + injected client: no env, no mail, no DB import, so it is testable.
import { isProbeRef } from '@/lib/content-admin'

export const NOTIFY_LIMIT = 100
export const ADMIN_CONTENTS_URL = 'https://www.oxxovo.ai/admin/contents'

export type NotifiableContent = {
  id: string
  title: string
  kind: string
  source_ref: string
  source_version: number
  status: string
  rights_status: string
  held_reason: string | null
  rights_reason: string | null
  publish_at: string
}

// ALL wording lives here so it can be reworded in one place later.
export const NOTICE_TEXT = {
  actionSubject: (n: number) => `[OXXOVO] ${n} content item(s) held -- action needed`,
  scheduledSubject: (n: number) => `[OXXOVO] ${n} new content item(s) scheduled`,
  // First line of the held mail: WHY they stopped.
  actionLead: (counts: string) => `Held at import, waiting for a person: ${counts}.`,
  reason: {
    late_for_slot: 'missed its publish slot',
    manual: 'stopped by a person',
    version: (v: number) => `version ${v} is always held until a person releases it`,
    none: 'held, no reason recorded',
  },
  rightsHeader: (n: number) => `Also waiting on rights (${n}) -- no action needed here; the maker fixes and resends:`,
  scheduledLead: (n: number) => `${n} content item(s) imported and scheduled. Times are UTC.`,
  moreNote: (limit: number) => `More than ${limit} pending; the rest follow in the next mail.`,
  linkLabel: 'Open in admin',
} as const

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

// Source-supplied text goes into HTML mail: strip control characters, cap the
// length, then escape.
function safe(s: string | null | undefined, max = 120): string {
  const t = (s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim()
  return esc(t.length > max ? `${t.slice(0, max)}...` : t)
}

type Group = 'scheduled' | 'rights' | 'action'

function groupOf(c: NotifiableContent): Group | null {
  if (c.status === 'scheduled') return 'scheduled'
  if (c.status === 'held') return c.rights_status !== 'cleared' ? 'rights' : 'action'
  return null
}

export function heldReasonText(c: NotifiableContent): string {
  if (c.held_reason === 'late_for_slot') return NOTICE_TEXT.reason.late_for_slot
  if (c.held_reason === 'manual') return NOTICE_TEXT.reason.manual
  if (c.source_version >= 2) return NOTICE_TEXT.reason.version(c.source_version)
  return NOTICE_TEXT.reason.none
}

const minuteUtc = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '-' : d.toISOString().slice(0, 16).replace('T', ' ')
}

export type Notice = { subject: string; html: string; ids: string[] }
export type NoticePlan = {
  action: Notice | null
  scheduled: Notice | null
  // Rights-waiting only, no action item: nothing to mail, but the rows must be
  // marked so they do not pile up.
  markOnly: string[]
}

export function planNotices(all: readonly NotifiableContent[], more: boolean): NoticePlan {
  const rows = all.filter((c) => !isProbeRef(c.source_ref))
  const action = rows.filter((c) => groupOf(c) === 'action')
  const rights = rows.filter((c) => groupOf(c) === 'rights')
  const scheduled = rows.filter((c) => groupOf(c) === 'scheduled')
  const link = (q: string, label: string) => `<p><a href="${ADMIN_CONTENTS_URL}${q}">${esc(label)}</a></p>`
  const moreHtml = more ? `<p>${esc(NOTICE_TEXT.moreNote(NOTIFY_LIMIT))}</p>` : ''

  let actionNotice: Notice | null = null
  let markOnly: string[] = []
  if (action.length > 0) {
    const counts = new Map<string, number>()
    for (const c of action) counts.set(heldReasonText(c), (counts.get(heldReasonText(c)) ?? 0) + 1)
    const lead = NOTICE_TEXT.actionLead([...counts].map(([r, n]) => `${n} ${r}`).join(', '))
    const items = action
      .map((c) => `<li><b>${safe(c.title)}</b> (${safe(c.kind, 20)}, ${safe(c.source_ref, 80)}) -- ${esc(heldReasonText(c))}</li>`)
      .join('')
    const rightsHtml =
      rights.length > 0
        ? `<p>${esc(NOTICE_TEXT.rightsHeader(rights.length))}</p><ul>${rights
            .map((c) => `<li>${safe(c.title)} (${safe(c.source_ref, 80)}) -- ${c.rights_status}${c.rights_reason ? `: ${safe(c.rights_reason, 200)}` : ''}</li>`)
            .join('')}</ul>`
        : ''
    actionNotice = {
      subject: NOTICE_TEXT.actionSubject(action.length),
      html: `<p>${esc(lead)}</p><ul>${items}</ul>${rightsHtml}${moreHtml}${link('?status=action', NOTICE_TEXT.linkLabel)}`,
      ids: [...action, ...rights].map((c) => c.id),
    }
  } else if (rights.length > 0) {
    markOnly = rights.map((c) => c.id)
  }

  const scheduledNotice: Notice | null =
    scheduled.length > 0
      ? {
          subject: NOTICE_TEXT.scheduledSubject(scheduled.length),
          html:
            `<p>${esc(NOTICE_TEXT.scheduledLead(scheduled.length))}</p><ul>${scheduled
              .map((c) => `<li><b>${safe(c.title)}</b> (${safe(c.kind, 20)}, ${safe(c.source_ref, 80)}) -- ${minuteUtc(c.publish_at)} UTC</li>`)
              .join('')}</ul>${moreHtml}` + link('?status=scheduled', NOTICE_TEXT.linkLabel),
          ids: scheduled.map((c) => c.id),
        }
      : null

  return { action: actionNotice, scheduled: scheduledNotice, markOnly }
}

export type NoticeDeps = {
  list(): Promise<NotifiableContent[]>
  send(subject: string, html: string): Promise<boolean>
  mark(ids: string[]): Promise<void>
}
export type NoticeReport = { mails: number; marked: number; warnings: string[] }

export async function runContentNotices(deps: NoticeDeps): Promise<NoticeReport> {
  const report: NoticeReport = { mails: 0, marked: 0, warnings: [] }
  let rows: NotifiableContent[]
  try {
    rows = await deps.list()
  } catch (e) {
    report.warnings.push(`notify_list_failed:${e instanceof Error ? e.message : String(e)}`)
    return report
  }
  if (rows.length === 0) return report
  const plan = planNotices(rows, rows.length >= NOTIFY_LIMIT)

  const deliver = async (label: string, n: Notice | null) => {
    if (!n) return
    try {
      if (!(await deps.send(n.subject, n.html))) {
        report.warnings.push(`notice_not_sent:${label}`) // not marked -> retried next tick
        return
      }
      report.mails++
      await deps.mark(n.ids)
      report.marked += n.ids.length
    } catch (e) {
      report.warnings.push(`notice_failed:${label}:${e instanceof Error ? e.message : String(e)}`)
    }
  }
  await deliver('held', plan.action)
  await deliver('scheduled', plan.scheduled)

  if (plan.markOnly.length > 0) {
    try {
      await deps.mark(plan.markOnly)
      report.marked += plan.markOnly.length
    } catch (e) {
      report.warnings.push(`notice_failed:rights:${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return report
}

// ---- DB side (client injected) ---------------------------------------------
export type NoticeAdmin = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
}

const COLUMNS = 'id, title, kind, source_ref, source_version, status, rights_status, held_reason, rights_reason, publish_at'

export async function listNotifiableContents(admin: NoticeAdmin): Promise<NotifiableContent[]> {
  const { data, error } = await admin
    .from('contents')
    .select(COLUMNS)
    .is('notified_at', null)
    .in('status', ['scheduled', 'held'])
    // probe- rows are permanent test rows: excluded by the QUERY, not the UI.
    .not('source_ref', 'ilike', 'probe-%')
    .order('created_at', { ascending: true })
    .limit(NOTIFY_LIMIT)
  if (error) throw new Error(error.message)
  return (data ?? []) as NotifiableContent[]
}

export async function markContentsNotified(admin: NoticeAdmin, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await admin
    .from('contents')
    .update({ notified_at: new Date().toISOString() })
    .in('id', ids)
    .is('notified_at', null)
  if (error) throw new Error(error.message)
}
