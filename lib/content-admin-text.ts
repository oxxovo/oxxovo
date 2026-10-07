// ALL wording of /admin/contents lives here (design SS8; terms confirmed by the
// copy owner 2026-10-07, "어드민 영어 용어"). English only, on purpose: the page, the
// server actions and the confirmation dialogs all read these, and a server-built
// message cannot know the browser's language toggle. Reword here, nowhere else;
// lib/content-admin-text.test.ts fails if Korean or a mixed term comes back.
//
// Terms (do not drift):
//   dispatch = WE send it OUT (SNS / YouTube). publish = it goes live ON THE SITE.
//     This screen is only about dispatch: the word "publish" never appears here.
//   Held / Returned = the same words the notice mails use (Hold, not Pause).
//   Daily (never "News": the brand is OXXOVO AI DAILY) / Entertainment (never "Ent").
//   Metadata (never "Meta": it collides with the company name).
//   Internal keys are unchanged (news_* settings, kind, DBA ...): never shown as prose.
//
// Times on this screen are US Pacific, one zone, 24-hour, always suffixed "PT"
// (see formatPT in lib/content-admin.ts). Cron logs and the EOD docs stay UTC.

// content.status -> label. Keys are the DB check-constraint values
// (reports/phase1_step1_tables_2026-10-05.sql); the test reads that file.
export const CONTENT_STATUS_TEXT = {
  scheduled: 'Scheduled',
  held: 'Held',
  returned: 'Returned',
  hidden: 'Hidden',
} as const

// content_distributions.status -> label. Same rule (the DB value `posted` is shown
// as "Dispatched", `sending` as "Dispatching", `unknown` as "Needs review").
export const DIST_STATUS_TEXT = {
  queued: 'Queued',
  sending: 'Dispatching',
  posted: 'Dispatched',
  failed: 'Failed',
  unknown: 'Needs review',
  cancelled: 'Canceled',
  skipped_no_asset: 'Skipped — no asset',
  skipped_oversize: 'Skipped — too large',
} as const

// DBA = the two brands. Keys are the Dba values of lib/content-kinds.ts.
export const DBA_TEXT = { news: 'Daily', entertainment: 'Entertainment' } as const

export const FILTER_TEXT = {
  all: 'All',
  action: '⚠️ Needs action',
  rights: '⏸ Waiting on rights',
  // scheduled / held / returned / hidden reuse CONTENT_STATUS_TEXT
} as const

export const HELD_REASON_TEXT = {
  late_for_slot: 'Missed its slot',
  manual: 'Held manually',
  none: 'No reason recorded (version 2+, etc.)',
  rightsNotCleared: (rights: string) => `Rights not cleared (${rights})`,
  computed: (s: string) => `Computed: ${s}`,
  stored: (s: string) => `Stored: ${s}`,
} as const

export const BUTTON_TEXT = {
  hold: 'Hold',
  hide: 'Hide',
  return: 'Return',
  restoreToHold: 'Restore to hold',
  unhide: 'Unhide',
  dispatch: 'Dispatch',
  redispatch: 'Re-dispatch',
  markDispatched: 'Mark dispatched', // records something a person put up by hand
  editMetadata: 'Edit metadata',
  editDispatchTime: 'Edit dispatch time',
  save: 'Save',
  close: 'Close',
  cancel: 'Cancel',
  addToQueue: 'Add to queue',
} as const

export const SCREEN_TEXT = {
  title: 'Content dispatch', // same as the admin menu entry
  subtitle:
    'Manage the status and dispatch queue of imported content. Dispatch only puts an item in the queue; the 5-minute cron does the actual sending.',
  noConfigTitle: 'Dispatch settings missing — nothing is being dispatched right now.',
  configUnreadable: 'The settings could not be read.',
  missingKeys: (keys: string) => `Missing keys: ${keys}`,
  noRetryConfig: (keys: string) =>
    `Retry settings are missing, so a failed dispatch goes straight to "Needs action" with no automatic retry (${keys}).`,
  switchesUnreadable: 'Could not read the dispatch switch state.',
  switchLine: 'Dispatch switches',
  master: 'Master',
  open: 'Open',
  closed: 'Closed',
  filterDba: 'DBA',
  filterStatus: 'Status',
  filterKind: 'Kind',
  filterTestRows: 'Test rows',
  probeShown: 'Showing probe- rows (hide)',
  probeHidden: 'probe- rows hidden (show)',
  probeNote: 'Test rows cannot be dispatched or re-dispatched.',
  loadFailed: (e: string) => `Could not load the list: ${e}`,
  truncated: (n: number) => `Only the latest ${n} were read. Narrow the filters.`,
  empty: 'No matching content.',
  noVideo: 'No video',
  testRow: 'Test row',
  dispatchScheduled: (when: string, remaining: string) => `Dispatch scheduled ${when} (${remaining})`,
  rights: (status: string, reason: string | null) => `Rights ${status}${reason ? ` — ${reason}` : ''}`,
  holdReason: (r: string) => `Hold reason — ${r}`,
  returnReason: (r: string) => `Return reason — ${r}`,
  alreadyDispatched: 'Already dispatched — delete it on each platform by hand.',
  noChannels: 'No dispatch channels (site only)',
  oversize: (size: string) => `Video ${size} — over the dispatch limit; it will fail at dispatch`,
  restoreTitle: 'Undo a wrong return — goes back to Held',
  attempts: (n: number) => `Attempts ${n}`,
  queueDialogTitle: 'Add to dispatch queue',
  switchStateUnreadable: 'Could not read the switch state.',
  returnPrompt: 'Enter the return reason (required, up to 2000 characters)',
  markDispatchedPrompt: (platform: string, urlRequired: boolean) =>
    `Did you confirm it is up on ${platform} yourself?\nEnter the post URL${urlRequired ? ' (required for this channel)' : ' (optional)'}.`,
  redispatchUnknown: (platform: string) =>
    `${platform}: it is not known whether this already went out. Did you check the platform first? If it is up, re-dispatching will duplicate it. Re-dispatch?`,
  redispatchFailed: (platform: string) => `${platform}: re-dispatching. Continue?`,
  labelTitle: 'Title',
  labelDescription: 'Description',
  labelCaption: 'Caption (the text that goes out with the dispatch)',
  labelNewDispatchTime: 'New dispatch time (Pacific Time, PT · must be later than now + the minimum lead time)',
} as const

// ---- server-side messages (action errors, the Dispatch confirmation) --------
export const PROBE_BLOCK_MESSAGE = 'This is a test row. It cannot be dispatched.'

export const ACTION_ERROR_TEXT: Record<string, string> = {
  actor_required: 'The admin email could not be determined',
  not_found: 'Target not found',
  reason_required: 'Enter a reason',
  title_empty: 'The title cannot be empty',
  nothing_to_update: 'Nothing changed',
  lead_too_short: 'The time must be later than now + the minimum lead time',
  url_invalid: 'Only https addresses are allowed',
  url_required: 'This channel needs the URL of the post you put up by hand',
  'precondition_failed:rights_not_cleared': 'Rights are not cleared, so it cannot be dispatched',
  'precondition_failed:no_main_asset': 'There is no main video asset to dispatch',
  'precondition_failed:asset_url_empty': 'The main video asset has an empty URL',
  internal_error: 'Server error (check the server log)',
}

export const ERROR_TEXT = {
  invalidTransition: (from: string) => `Not allowed from the current status (${from})`,
  configError: (code: string) => `Settings error: ${code}`,
  failed: (code: string) => `Failed: ${code}`,
  targetUnverifiable: 'Stopped: the target could not be verified',
  reasonTooLong: (max: number) => `The reason must be ${max} characters or fewer`,
  badTime: 'The time format is not valid',
  unknownKind: 'Unknown kind',
  urlInvalid: 'The URL format is not valid',
  httpsOnly: 'Only https addresses are allowed',
  unknownChannel: 'Unknown channel',
  wrongDomain: (platform: string, hosts: string) => `The address must be on a ${platform} domain (${hosts})`,
  urlRequired: 'This channel needs the URL of the post you put up by hand',
} as const

export const SWITCH_TEXT = {
  masterClosed: 'The master dispatch switch is closed.',
  dbaClosed: (dba: string) => `The ${dba} dispatch switch is closed.`,
} as const

export const CONFIRM_TEXT = {
  channels: (list: string) => `Channels: ${list}`,
  noChannels: 'Channels: none (site only)',
  queueNote: 'This puts it in the dispatch queue. If the switches are open it goes out within about 5 minutes.',
  switchesUnreadable: 'Could not read the dispatch switch state, so we cannot tell whether they are open.',
  onlyQueued: (closed: string) => `${closed} It will only be queued.`,
  priorDispatched: (list: string) => `An earlier version was already dispatched (${list}). Did you delete it on the platform?`,
  oversize: (max: string, size: string) =>
    `The video is larger than the dispatch limit (${max}): ${size}. It will fail at dispatch.`,
} as const
