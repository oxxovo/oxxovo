// ⑤/⑪ -- "we have your submission" receipt rules. Pure; no database, no Resend.
//
// ★THE DEFECT THIS EXISTS FOR. Applying and submitting used to be one act: the
// /apply form carried the video URL, so ApplicationReceived was both "we have
// your application" and "we have your film". Studio split them. A season whose
// accepted_video_sources is ['studio'] takes an application with no film in it,
// and the film arrives days later through a different code path -- one that sends
// nothing at all. Measured 2026-08-08: the only caller of sendApplicationReceived
// is app/api/apply/route.ts, and lib/studio.ts has no email call in it. So the
// participant fills the form, gets a receipt, spends a week making a film,
// submits it, and hears nothing back.
//
// ★Which is why the rule below keys on the STUDIO columns for the preliminary
// round rather than on "there is a film". An entry that applied with a URL
// already got its receipt at apply time and must not get a second one; an entry
// that applied and then submitted through Studio got a receipt for the
// application and none for the film. The column that separates them is
// studio_application_submitted_at.

import type { TemplateKey } from './email/log'

export type SubmissionRound = 'application' | 'main'

// Whether the file itself has landed yet. Studio submissions are asynchronous:
// the entry is ACCEPTED when the participant presses submit (before the
// deadline) and the rendered file can arrive up to the processing buffer later.
// Both states are a real submission -- the receipt says which one it is rather
// than waiting for the file and risking silence through the whole window.
export type SubmissionFileState = 'processing' | 'complete'

const TEMPLATE_BY_ROUND: Record<SubmissionRound, TemplateKey> = {
  application: 'studio_submission_received',
  main: 'main_round_submission_received',
}

export function submissionReceiptTemplate(round: SubmissionRound): TemplateKey {
  return TEMPLATE_BY_ROUND[round]
}

export type SubmissionReceiptRow = {
  // Set by lib/studio submitRender / submitGeneration only. NOT set by
  // /api/apply, which is the whole point -- see the header.
  studio_application_submitted_at: string | null
  free_entry_url: string | null
  // ★The main round is NOT restricted to the Studio columns the way the prelim
  // is. There is no "applying" step in the main round -- being a Finalist is the
  // place, and submitting the film is the only act -- so every path that sets
  // this column (Studio compose, Studio single clip, and the URL form in
  // app/profile/actions.saveMainRoundSubmission) is a submission nobody has
  // confirmed. All three get the same receipt.
  main_round_submitted_at: string | null
  main_round_video_url: string | null
}

// Which rounds of this entry have an accepted submission that deserves a receipt.
export function submissionReceiptRounds(row: SubmissionReceiptRow): SubmissionRound[] {
  const rounds: SubmissionRound[] = []
  if (row.studio_application_submitted_at) rounds.push('application')
  if (row.main_round_submitted_at) rounds.push('main')
  return rounds
}

// ★The file, not the state column, is the authority. studio_submission_state is
// a human-readable mirror the finalize sweep writes; the URL is what the rest of
// the platform reads to decide the entry has a film (it is what makes an entry
// scorable). If the two ever disagree, the receipt follows the one that is true.
export function submissionFileState(
  row: SubmissionReceiptRow,
  round: SubmissionRound,
): SubmissionFileState {
  const url = round === 'application' ? row.free_entry_url : row.main_round_video_url
  return url?.trim() ? 'complete' : 'processing'
}
