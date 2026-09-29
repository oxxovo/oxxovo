// Read-only preview of the rewritten chatbot system prompt, tokens resolved
// against the live season_0 + membership + platform_config rows. No model
// call, no send -- just the exact string app/api/chat/route.ts would hand to
// Claude right now. Writes to outputs/chatbot-kb-preview.txt.
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadChatbotContext } from '../lib/chatbot-context'
import { buildChatbotSystemPrompt } from '../lib/chatbot-kb'

const ctx = await loadChatbotContext()
const prompt = buildChatbotSystemPrompt(ctx)

const outDir = fileURLToPath(new URL('../outputs/', import.meta.url))
mkdirSync(outDir, { recursive: true })
const outFile = join(outDir, 'chatbot-kb-preview.txt')
writeFileSync(outFile, prompt, 'utf8')

console.log('wrote', outFile, `(${prompt.length} chars)`)
const unresolved = prompt.match(/\{\{(\w+)\}\}/g)
console.log('unresolved {{token}} occurrences:', unresolved ? [...new Set(unresolved)] : 'none')
const unavailable = (prompt.match(/\(not available -- do not guess\)/g) ?? []).length
console.log('(not available) markers:', unavailable)
