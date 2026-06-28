// Common AI provider layer -- SERVER ONLY.
//
// One small surface over the three judging providers (Claude / GPT / Gemini) so
// the chatbot's Triple-AI Review (and, later, anything else in this repo) can
// call all three the same way. Claude uses the Anthropic SDK; GPT and Gemini use
// raw fetch so we add no extra dependencies.
//
// Key reality (2026-06): ANTHROPIC_API_KEY is set; OPENAI_API_KEY and the Gemini
// key are NOT yet set in this repo (OPENAI_API_KEY is the launch blocker). Every
// provider degrades gracefully: a missing key returns { available: false }
// instead of throwing, so a partial panel still works.

import 'server-only'
import Anthropic from '@anthropic-ai/sdk'

export type ProviderId = 'claude' | 'gpt' | 'gemini'

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  claude: 'Claude',
  gpt: 'GPT',
  gemini: 'Gemini',
}

// Route a model id to its provider by the id prefix -- robust regardless of how
// the season's `provider` label is spelled ("Anthropic"/"OpenAI"/"Google" etc.).
export function providerForModel(modelId: string): ProviderId | null {
  const id = modelId.toLowerCase()
  if (id.startsWith('claude')) return 'claude'
  if (id.startsWith('gpt') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('o4')) return 'gpt'
  if (id.startsWith('gemini')) return 'gemini'
  return null
}

function keyFor(provider: ProviderId): string | undefined {
  switch (provider) {
    case 'claude':
      return process.env.ANTHROPIC_API_KEY
    case 'gpt':
      return process.env.OPENAI_API_KEY
    case 'gemini':
      return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  }
}

export function providerAvailable(provider: ProviderId): boolean {
  return !!keyFor(provider)
}

export type AskResult = {
  provider: ProviderId
  model: string
  available: boolean // key present
  ok: boolean // call succeeded
  text: string
  error?: string
}

const DEFAULT_MAX_TOKENS = 1000
const REQUEST_TIMEOUT_MS = 30_000

// Single entry point: ask one model a question with a system prompt. Never
// throws -- failures come back as { ok: false }. Routing is by model-id prefix.
export async function ask(
  modelId: string,
  system: string,
  userText: string,
  opts: { maxTokens?: number } = {},
): Promise<AskResult> {
  const provider = providerForModel(modelId)
  if (!provider) {
    return { provider: 'claude', model: modelId, available: false, ok: false, text: '', error: 'unknown_provider' }
  }
  const key = keyFor(provider)
  if (!key) {
    return { provider, model: modelId, available: false, ok: false, text: '', error: 'no_key' }
  }
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS
  try {
    const text =
      provider === 'claude'
        ? await askClaude(key, modelId, system, userText, maxTokens)
        : provider === 'gpt'
          ? await askGPT(key, modelId, system, userText, maxTokens)
          : await askGemini(key, modelId, system, userText, maxTokens)
    const trimmed = text.trim()
    if (!trimmed) return { provider, model: modelId, available: true, ok: false, text: '', error: 'empty' }
    return { provider, model: modelId, available: true, ok: true, text: trimmed }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    console.error(`[ai] ${provider} (${modelId}) failed:`, msg)
    return { provider, model: modelId, available: true, ok: false, text: '', error: msg }
  }
}

async function askClaude(
  apiKey: string,
  model: string,
  system: string,
  userText: string,
  maxTokens: number,
): Promise<string> {
  const client = new Anthropic({ apiKey })
  const resp = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userText }],
  })
  return resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
}

async function askGPT(
  apiKey: string,
  model: string,
  system: string,
  userText: string,
  maxTokens: number,
): Promise<string> {
  // Chat Completions. Omit token/temperature caps that vary by model family
  // (gpt-4o uses max_tokens, gpt-5/o-series use max_completion_tokens) to avoid
  // 400s; let the model default. maxTokens is intentionally unused here.
  void maxTokens
  const res = await fetchJSON('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userText },
      ],
    }),
  })
  const content = res?.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new Error('openai_no_content')
  return content
}

async function askGemini(
  apiKey: string,
  model: string,
  system: string,
  userText: string,
  maxTokens: number,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const res = await fetchJSON(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  })
  const parts = res?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) throw new Error('gemini_no_content')
  return parts.map((p: { text?: string }) => p.text ?? '').join('')
}

async function fetchJSON(url: string, init: RequestInit): Promise<any> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      const detail = body?.error?.message || `http_${res.status}`
      throw new Error(detail)
    }
    return body
  } finally {
    clearTimeout(timer)
  }
}
