#!/usr/bin/env node
/**
 * Guardrail test for the OXXOVO Help Assistant (v4 KB).
 *
 * Uses the SAME system prompt the /api/chat route uses (extracted from
 * lib/chatbot-kb.ts so there is one source of truth), runs it against the real
 * model with 8 questions, and checks the v4 launch-critical guardrails:
 *   credit self-pay / Season-0 preliminary external / no $10 welcome credit /
 *   membership != credit / no invented prices / WC prize "Up to $250,000" /
 *   out-of-scope -> info@ / in-scope accuracy.
 *
 * API key is read from the scoring repo's .env (local test only; never printed).
 *   node scripts/test-chatbot-guardrails.mjs
 */
import fs from 'fs'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-haiku-4-5'

function readEnvVar(path, name) {
  try {
    const t = fs.readFileSync(path, 'utf8')
    for (const ln of t.split(/\r?\n/)) {
      const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
      if (m && m[1] === name) {
        let v = m[2].trim()
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
        return v
      }
    }
  } catch {}
  return null
}

function extractBacktick(src, varName) {
  const re = new RegExp('const ' + varName + ' = `([\\s\\S]*?)`')
  const m = src.match(re)
  if (!m) throw new Error('could not extract ' + varName)
  return m[1]
}

const kbSrc = fs.readFileSync('lib/chatbot-kb.ts', 'utf8')
const SYSTEM = extractBacktick(kbSrc, 'SYSTEM_RULES') + '\n\n' + extractBacktick(kbSrc, 'KNOWLEDGE_BASE')

const apiKey = readEnvVar('C:/Users/Tom/oxxovo-scoring/.env', 'ANTHROPIC_API_KEY')
if (!apiKey) { console.error('No ANTHROPIC_API_KEY found in scoring .env'); process.exit(1) }
const client = new Anthropic({ apiKey })

// Each case: prompt + must-include (any-of groups, all groups must match) + must-NOT-include.
const CASES = [
  {
    label: 'credit self-pay (KR)',
    q: '영상 만드는 데 비용이 드나요?',
    must: [['외부', '예선'], ['본선', 'Studio'], ['본인', '부담', '사용']],
    mustNot: ['$10', '웰컴 크레딧', '무료 크레딧'],
  },
  {
    label: 'preliminary external (EN)',
    q: 'Where do I make my Season 0 preliminary video?',
    must: [['external', 'URL', 'elsewhere', 'outside']],
    mustNot: ['preliminary in OXXOVO Studio', 'preliminary is made in Studio', 'preliminary is created in Studio'],
  },
  {
    label: 'no $10 welcome credit (KR)',
    q: '가입하면 $10 웰컴 크레딧 주나요?',
    must: [['없', 'No', '제공되지']],
    mustNot: ['$10', '드립니다', '제공합니다'],
  },
  {
    label: 'membership != credit (EN)',
    q: 'My membership is free, so is video generation also free?',
    must: [['separate', 'credit', 'main round', 'paid']],
    mustNot: ['everything is free', 'video generation is free'],
  },
  {
    label: 'no invented credit price (KR)',
    q: '크레딧 1개에 정확히 얼마예요?',
    must: [['Studio', 'info@oxxovo.com']],
    mustNot: ['$0.10', '0.1달러', '10센트'],
  },
  {
    label: 'WC prize not fixed (EN)',
    q: 'Exactly how much is the World Championship prize?',
    must: [['Up to $250,000', '$250,000', 'TBD', 'to be announced']],
    mustNot: ['is $250,000', 'will be $250,000', 'guaranteed'],
  },
  {
    label: 'out-of-scope refund -> info@ (KR)',
    q: '결제한 멤버십 환불은 어떻게 받나요?',
    must: [['info@oxxovo.com']],
    mustNot: ['환불 절차는 다음', '7일 이내 전액'],
  },
  {
    label: 'in-scope prize accuracy (EN)',
    q: 'What is the Season 0 prize pool?',
    must: [['3,000', '3000'], ['1,800', '1800'], ['750'], ['450']],
    mustNot: ['$5,000', '$10,000'],
  },
  {
    label: 'Founding 2 benefits (KR)',
    q: 'Founding Creator 혜택이 뭐예요?',
    must: [['멤버십'], ['배지']],
    mustNot: ['$10', '웰컴', '아카이브', '영구 기록'],
  },
  {
    label: 'Founding digital badge (EN)',
    q: 'Is the Founding badge a physical item?',
    must: [['digital', 'profile']],
    mustNot: ['physical badge', 'physical Founding'],
  },
]

function check(reply, c) {
  const r = reply
  const missing = (c.must || []).filter((group) => !group.some((s) => r.includes(s)))
  const leaked = (c.mustNot || []).filter((s) => r.includes(s))
  return { pass: missing.length === 0 && leaked.length === 0, missing, leaked }
}

async function ask(q) {
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: q }],
  })
  return resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
}

let passCount = 0
console.log(`=== OXXOVO chatbot guardrail test (${MODEL}) ===\n`)
for (const c of CASES) {
  const reply = await ask(c.q)
  const { pass, missing, leaked } = check(reply, c)
  if (pass) passCount++
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${c.label}`)
  console.log(`  Q: ${c.q}`)
  console.log(`  A: ${reply.replace(/\s+/g, ' ').slice(0, 400)}`)
  if (!pass) {
    if (missing.length) console.log(`  !! missing any-of: ${JSON.stringify(missing)}`)
    if (leaked.length) console.log(`  !! leaked forbidden: ${JSON.stringify(leaked)}`)
  }
  console.log('')
}
console.log(`=== ${passCount}/${CASES.length} PASS ===`)
process.exit(passCount === CASES.length ? 0 : 1)
