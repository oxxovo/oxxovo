#!/usr/bin/env node
/**
 * End-to-end check for the {{aspect_ratio}} FAQ token TK asked for: insert a
 * real, active faq_items row containing {{aspect_ratio}}, then read it back
 * through the REAL public path -- getFaqItems('landing_home') via the ANON
 * key against faq_items_public (same as LandingView.tsx), and resolve it
 * with the REAL getCurrentSeason() + resolveFaqText (not a replica). Confirms
 * the text that would actually render on the live page contains "9:16".
 * Deletes the test row in a finally block.
 *
 * Run: node --import ./scripts/test-register.mjs --env-file=.env.local scripts/zz_probe_faq_aspect_token_2026-08-27.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { getFaqItems } from '../lib/faq.ts'
import { getCurrentSeason } from '../lib/seasons.ts'
import { resolveFaqText } from '../lib/faq-tokens.ts'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !SERVICE_KEY) { console.error('Missing env.'); process.exit(1) }
const admin = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

let itemId = null
let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m) } else { fail++; console.log('  FAIL', m) } }

async function main() {
  const { data, error } = await admin.from('faq_items').insert({
    surface: 'landing_home',
    question_en: 'zz aspect-token probe (temporary)',
    question_ko: 'zz 종횡비 토큰 프로브 (임시)',
    answer_en: 'This season is locked to {{aspect_ratio}}.',
    answer_ko: '이번 시즌은 {{aspect_ratio}}로 고정되어 있습니다.',
    sort_order: 9999,
    is_active: true,
  }).select('id').single()
  if (error || !data) throw new Error('insert faq_items: ' + (error?.message ?? 'no data'))
  itemId = data.id
  console.log('inserted test faq_items row', itemId)

  const items = await getFaqItems('landing_home')
  const item = items.find((i) => i.id === itemId)
  ok(!!item, 'test item comes back through getFaqItems (real anon read path, faq_items_public)')
  if (!item) return

  const season = await getCurrentSeason()
  ok(!!season, 'getCurrentSeason() returned a season')
  if (!season) return
  console.log('  season.aspect_ratio =', season.aspect_ratio)

  const resolvedKo = resolveFaqText(item.answerKo, { season, membership: null, lang: 'ko' })
  const resolvedEn = resolveFaqText(item.answerEn, { season, membership: null, lang: 'en' })
  console.log('  resolved KO:', JSON.stringify(resolvedKo))
  console.log('  resolved EN:', JSON.stringify(resolvedEn))
  ok(resolvedKo.ok === true && resolvedKo.text.includes('9:16'), 'KO answer resolves and contains 9:16 (real render path)')
  ok(resolvedEn.ok === true && resolvedEn.text.includes('9:16'), 'EN answer resolves and contains 9:16 (real render path)')
}

async function cleanup() {
  if (!itemId) { console.log('\ncleanup: nothing was created'); return }
  try {
    const { error } = await admin.from('faq_items').delete().eq('id', itemId)
    if (error) throw error
    const { data: check } = await admin.from('faq_items').select('id').eq('id', itemId).maybeSingle()
    console.log('\ncleanup: deleted', itemId, '-- remaining:', check ? 'STILL THERE (problem)' : '0 rows')
  } catch (e) {
    console.log('\ncleanup ERROR (manual check needed):', e.message, itemId)
  }
}

main()
  .then(cleanup, async (e) => { console.error('\nERROR:', e.message); await cleanup(); process.exit(1) })
  .then(() => {
    console.log(`\n== FAQ aspect_ratio token real-path probe: ${pass} pass, ${fail} fail ==`)
    process.exit(fail ? 1 : 0)
  })
