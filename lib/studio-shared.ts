// Studio types + pure helpers shared by BOTH the server (lib/studio.ts
// createGeneration -- the authority) and the client (CameraDirector preview,
// which must show the participant exactly what will be generated). No imports,
// no IO -- keep this file bundle-safe for the client.

// A participant-tunable fal param rule, from model_catalog.metadata.
// param_whitelist. Only MEASURED params are listed there; anything absent is
// rejected server-side and dropped worker-side.
export type StudioParamRule = {
  type?: string // 'string' | 'number'
  min?: number
  max?: number
  max_len?: number
}

export type StudioPresetGroup = 'action' | 'drama' | 'beauty'

// A camera/motion preset row (studio_presets). desc_text is the shared
// natural-language camera direction; bracket_tags additionally prefix models
// whose metadata.prompt_style === 'bracket' (Hailuo 02 Pro, Video-01 Director
// -- measured 2026-07-10/12).
export type StudioPreset = {
  id: string
  group_id: StudioPresetGroup
  label_en: string
  bracket_tags: string
  desc_text: string
  preview_url: string | null
  sort_order: number
}

// Assemble the final generation prompt from the participant's prompt and the
// chosen preset. EXACTLY the rule validated by the stage1 matrix (19 clips,
// TK-approved 2026-07-16): bracket models get the [tags] prefix, every model
// gets the camera description appended. No preset -> the prompt is untouched.
// The server assembles and stores the result; the client calls this only to
// PREVIEW it -- the server never trusts a client-assembled prompt.
export function assemblePresetPrompt(
  userPrompt: string,
  preset: Pick<StudioPreset, 'bracket_tags' | 'desc_text'> | null,
  promptStyle: 'bracket' | null,
): string {
  const p = userPrompt.trim()
  if (!preset) return p
  return promptStyle === 'bracket'
    ? `${preset.bracket_tags} ${p}. ${preset.desc_text}`
    : `${p}. ${preset.desc_text}`
}

// ★WHICH RENDER STATUSES A PARTICIPANT MAY SUBMIT. ONE definition, imported by
// both sides, because this list existed twice and the copy is what broke.
//
// Submission is not tied to the render being finished: a final REQUESTED before
// the deadline must be submittable before the deadline, or a busy queue costs
// the participant their entry. 'failed' is included because a failure inside the
// 24h buffer is ours to fix (the sweep re-renders it once), not grounds for
// losing the round. 'submitted' is absent -- an entry is accepted once.
//
// On 2026-07-31 the server accepted all of these while the editor rendered its
// submit form only in the `renderReady` branch, so every asynchronous path was
// dead code on the screen: the server-side tests passed and no participant could
// reach the control. That is why the list lives here and not in two files.
export const ASYNC_SUBMIT_STATUSES = ['queued', 'rendering', 'uploading', 'ready', 'failed'] as const
export type AsyncSubmitStatus = (typeof ASYNC_SUBMIT_STATUSES)[number]

export function isSubmittableRenderStatus(status: string | null | undefined): boolean {
  return !!status && (ASYNC_SUBMIT_STATUSES as readonly string[]).includes(status)
}
