// Prompt-level IP/likeness check (HQ 2026-08-17). SERVER ONLY.
//
// Separate from Triple-AI scoring (oxxovo-scoring/src/scorer.ts) on purpose --
// that pipeline judges VIDEO FRAMES and feeds a score (Defect 1 happened
// there). This checks PROMPT TEXT ONLY, before generation, and never touches
// scoring_results or any score. One question: does the prompt name a
// copyrighted character/work/brand or a real person's likeness/name. Answer
// is a flag on generation_jobs, not a score.
//
// Fail-OPEN: if the check errors, times out, or the response doesn't parse,
// generation proceeds -- this is a safety net, not an integrity axis, and a
// dead check must never stop the whole competition during the submission
// window. The row is stamped ip_check_status='unchecked' so it can be pulled
// for review later instead of silently passing as "clear".
//
// Block threshold is NOT a code constant -- platform_config
// 'ip_check_block_confidence' (low|medium|high) decides which confidence
// level blocks. TK changes it via SQL/admin, no redeploy.

import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { getPlatformConfigMap } from './partners'

export type IpCheckConfidence = 'low' | 'medium' | 'high'
export type IpCheckStatus = 'clear' | 'flagged' | 'unchecked'

export type IpCheckResult = {
  status: IpCheckStatus
  blocked: boolean
  what: string | null
  evidence: string | null
  confidence: IpCheckConfidence | null
  // TEMP wording -- 제니3 확정 전. Only set when blocked=true.
  blockMessage: string | null
}

const CONFIDENCE_RANK: Record<IpCheckConfidence, number> = { low: 1, medium: 2, high: 3 }
const TIMEOUT_MS = 6000
const MODEL = 'claude-haiku-4-5'

const SYSTEM_PROMPT = `You review a short prompt a creator is about to submit to an AI video generator.

Answer exactly ONE question: does this prompt reference a copyrighted character, a copyrighted work/franchise, a brand, or a real (living or historical) person's name or likeness -- something the creator does not own the rights to?

Do NOT judge quality, originality, or anything else. Generic descriptions ("a superhero", "a pop star", "a city street") are NOT a match. A specific named character, franchise, brand, or real person's name IS a match, even spelled loosely or in another language.

Respond with ONLY this JSON, no other text:
{"flagged": boolean, "confidence": "low"|"medium"|"high", "what": string|null, "evidence": string|null}

"what" = the specific character/work/brand/person name, or null if not flagged.
"evidence" = the exact phrase from the prompt that triggered the flag, or null if not flagged.
"confidence": "high" = unambiguous, unmistakable reference. "medium" = probable but could be coincidental/generic. "low" = weak or uncertain match.`

// Shares getPlatformConfigMap()'s 60s TTL cache (HQ 2026-08-20) with the
// cosmetic guard instead of its own direct query -- one cache, two callers.
async function getBlockThreshold(): Promise<IpCheckConfidence> {
  try {
    const cfg = await getPlatformConfigMap()
    const v = (cfg.get('ip_check_block_confidence') as string | undefined)?.trim().toLowerCase()
    if (v === 'low' || v === 'medium' || v === 'high') return v
  } catch {
    // fall through to default
  }
  return 'high' // conservative default -- only unmistakable matches block
}

// Checks raw prompt text (call BEFORE any display truncation -- a truncated
// multi-shot prompt can drop a later shot's IP reference entirely).
export async function checkPromptForIp(promptText: string): Promise<IpCheckResult> {
  const text = (promptText ?? '').trim()
  if (!text) return { status: 'clear', blocked: false, what: null, evidence: null, confidence: null, blockMessage: null }

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    console.error('[ip-check] ANTHROPIC_API_KEY missing -> unchecked (fail-open)')
    return { status: 'unchecked', blocked: false, what: null, evidence: null, confidence: null, blockMessage: null }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const client = new Anthropic({ apiKey: key })
    const resp = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }],
      },
      { signal: controller.signal },
    )
    const raw = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()

    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('no JSON in response')
    const parsed = JSON.parse(match[0]) as {
      flagged?: unknown
      confidence?: unknown
      what?: unknown
      evidence?: unknown
    }
    const flagged = parsed.flagged === true
    const confidence: IpCheckConfidence | null =
      parsed.confidence === 'low' || parsed.confidence === 'medium' || parsed.confidence === 'high'
        ? parsed.confidence
        : null
    const what = typeof parsed.what === 'string' ? parsed.what.trim() || null : null
    const evidence = typeof parsed.evidence === 'string' ? parsed.evidence.trim() || null : null

    if (!flagged || !confidence) {
      return { status: 'clear', blocked: false, what: null, evidence: null, confidence: null, blockMessage: null }
    }

    const threshold = await getBlockThreshold()
    const shouldBlock = CONFIDENCE_RANK[confidence] >= CONFIDENCE_RANK[threshold]

    if (!shouldBlock) {
      // Ambiguous / below threshold: pass through, flagged for later review.
      return { status: 'flagged', blocked: false, what, evidence, confidence, blockMessage: null }
    }

    // TEMP wording -- 제니3 확정 전, 코드 리터럴로 자리만 잡음.
    const blockMessage = what
      ? `[TEMP] '${what}'은(는) 타인의 저작권 캐릭터/작품/브랜드 또는 실존 인물로 보입니다.`
      : `[TEMP] 프롬프트에 타인의 저작권 캐릭터/작품/브랜드 또는 실존 인물이 감지되었습니다.`

    return { status: 'flagged', blocked: true, what, evidence, confidence, blockMessage }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[ip-check] failed/timeout -> unchecked (fail-open):', msg)
    return { status: 'unchecked', blocked: false, what: null, evidence: null, confidence: null, blockMessage: null }
  } finally {
    clearTimeout(timeout)
  }
}
