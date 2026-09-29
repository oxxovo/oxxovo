// Read-only text extraction from the already-rendered outputs/email-preview/*.html
// files, for handing to 제니3 (she has never seen these rendered). No app code touched.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(process.cwd(), 'outputs', 'email-preview')
const OUT = join(process.cwd(), 'outputs', 'email_text_all.md')

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&trade;/g, '™')
    .replace(/&copy;/g, '©')
    .replace(/&middot;/g, '·')
    .replace(/&larr;/g, '←')
}

function htmlToText(html) {
  let s = html
  // preheader (react-email hidden preview text) is explicitly marked skip-in-text
  s = s.replace(/<div[^>]*data-skip-in-text="true"[^>]*>[\s\S]*?<\/div>\s*<\/div>/, '')
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  s = s.replace(/<head[\s\S]*?<\/head>/gi, '')
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<(br|hr)\s*\/?>/gi, '\n')
  s = s.replace(/<\/(p|h1|h2|h3|li|tr|table)>/gi, '\n')
  s = s.replace(/<[^>]+>/g, '')
  s = decodeEntities(s)
  // zero-width chars used by react-email as preheader padding
  s = s.replace(/[​‌‍‎‏﻿]/g, '')
  s = s
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0)
    .join('\n')
  return s.trim()
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.html'))

function parseKey(f) {
  const m = f.match(/^(.*?)-(en|ko)(?:_#(\S+))?\.html$/)
  const base = m ? m[1] : f
  const lang = m ? m[2] : 'zz'
  const num = m && m[3] ? m[3] : null
  return { file: f, base, lang, num }
}

const parsed = files.map(parseKey)

// Order: numbered templates first (ascending by numeric prefix of #num), then
// unnumbered tick-driven templates (alpha), then membership templates (alpha).
// Within a template: en before ko.
function numSortKey(num) {
  if (!num) return [9999, '']
  const m = num.match(/^(\d+)(?:-([A-Z]))?$/)
  if (!m) return [9999, num]
  return [parseInt(m[1], 10), m[2] || '']
}
const isMembership = (base) => base.startsWith('membership_')

parsed.sort((a, b) => {
  const aHasNum = a.num ? 0 : 1
  const bHasNum = b.num ? 0 : 1
  if (aHasNum !== bHasNum) return aHasNum - bHasNum
  if (a.num && b.num) {
    const [an, al] = numSortKey(a.num)
    const [bn, bl] = numSortKey(b.num)
    if (an !== bn) return an - bn
    if (al !== bl) return al.localeCompare(bl)
  } else {
    const am = isMembership(a.base) ? 1 : 0
    const bm = isMembership(b.base) ? 1 : 0
    if (am !== bm) return am - bm
    if (a.base !== b.base) return a.base.localeCompare(b.base)
  }
  if (a.base !== b.base) return a.base.localeCompare(b.base)
  return a.lang === b.lang ? 0 : a.lang === 'en' ? -1 : 1
})

let out = `# Email text (all 38 rendered templates) — for 제니3\n\n`
out += `Extracted from \`outputs/email-preview/*.html\` (already-rendered previews, no send). Tags stripped, subject line from the render's HTML comment. Sorted by 제니3's confirmed number, then language (EN before KO); templates without a confirmed number follow, then the 2 membership templates.\n\n`
out += `**Why this file exists:** 제니3 has never seen any of these 13+2 templates actually rendered on screen — she writes the copy but doesn't see the output. Today's \`/rules\` screenshot caught a redundant sentence invisible in the diff; the same class of bug (duplication, awkward line breaks, wrong emphasis) could exist in any of these 38 renders and nobody has looked.\n\n---\n\n`

let currentBase = null
for (const p of parsed) {
  const html = readFileSync(join(DIR, p.file), 'utf8')
  const subjectMatch = html.match(/<!--\s*SUBJECT:\s*(.*?)\s*-->/)
  const subject = subjectMatch ? subjectMatch[1] : '(no subject comment found)'
  const text = htmlToText(html)

  if (p.base !== currentBase) {
    currentBase = p.base
    const label = p.num ? `${p.base} (#${p.num})` : p.base
    out += `\n## ${label}\n\n`
  }

  out += `### ${p.lang.toUpperCase()} — \`${p.file}\`\n\n`
  out += `**Subject:** ${subject}\n\n`
  out += '```\n' + text + '\n```\n\n'
}

writeFileSync(OUT, out, 'utf8')
console.log(`Wrote ${parsed.length} templates to ${OUT}`)
