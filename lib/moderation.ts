// AI pre-moderation (Patent 3 -- "AI 사전 콘텐츠 모더레이션부"). SERVER ONLY.
//
// Scans submitted content with OpenAI's moderation endpoint (omni-moderation-
// latest: text + image, no extra cost). Returns the resulting moderation_status
// for genesis_applications:
//   'approved' -- scan ran, nothing flagged -> public
//   'flagged'  -- scan ran, content flagged  -> auto-hidden, admin review
//   'pending'  -- scan could NOT run (no key / API error) -> NOT public,
//                 fail-safe: a video is never published unless a scan approved
//                 it. Admin can review/approve from the moderation queue.
//
// Note: external-URL entries (Season 0 prelim) can scan the creator statement +
// the YouTube thumbnail image (the raw video can't be fetched). Self-hosted R2
// video frame scanning is phase C2 (worker).

import 'server-only'

export type ModerationStatus = 'approved' | 'flagged' | 'pending'
export type ModerationResult = { status: ModerationStatus; categories: string[] }

type ModerationInput = { text?: string | null; imageUrl?: string | null }

export async function moderateSubmission(input: ModerationInput): Promise<ModerationResult> {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    console.warn('[moderation] OPENAI_API_KEY missing -> pending (fail-safe, stays unpublished)')
    return { status: 'pending', categories: [] }
  }

  const content: unknown[] = []
  const text = input.text?.trim()
  if (text) content.push({ type: 'text', text })
  if (input.imageUrl) content.push({ type: 'image_url', image_url: { url: input.imageUrl } })
  if (content.length === 0) {
    // Nothing scannable -> can't approve; hold for review.
    return { status: 'pending', categories: [] }
  }

  // Bound the OpenAI call: at launch (up to 500 concurrent submissions) a slow or
  // hung moderation API must not stall the submit request. On timeout the fetch
  // aborts -> caught below -> 'pending' (fail-safe: not public, admin queue).
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: content }),
      signal: controller.signal,
    })
    if (!res.ok) {
      console.error('[moderation] API error', res.status)
      return { status: 'pending', categories: [] }
    }
    const json = (await res.json()) as {
      results?: { flagged: boolean; categories: Record<string, boolean> }[]
    }
    const flagged = (json.results ?? []).some((r) => r.flagged)
    const categories = [
      ...new Set(
        (json.results ?? []).flatMap((r) =>
          Object.entries(r.categories ?? {})
            .filter(([, v]) => v)
            .map(([k]) => k),
        ),
      ),
    ]
    return flagged ? { status: 'flagged', categories } : { status: 'approved', categories: [] }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // AbortError (5s timeout) lands here too -> pending, never a hung submit.
    console.error('[moderation] fetch failed/timeout (-> pending):', msg)
    return { status: 'pending', categories: [] }
  } finally {
    clearTimeout(timeout)
  }
}
