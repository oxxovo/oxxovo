// TEMP verification script for lib/ip-check.ts (HQ 2026-08-17 deploy check).
// Run: node --import ./scripts/test-register.mjs scripts/verify-ip-check.mjs
import { checkPromptForIp } from '../lib/ip-check.ts'
import { createGeneration } from '../lib/studio.ts'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

function line(s) { console.log(s) }
function hr() { console.log('-'.repeat(70)) }

let pass = 0, fail = 0
function check(label, ok, detail) {
  if (ok) { pass++; line(`  OK   ${label}`) }
  else { fail++; line(`  FAIL ${label}  ${detail ?? ''}`) }
}

hr()
line('1) FAIL-OPEN (most important)')
hr()
{
  const realKey = process.env.ANTHROPIC_API_KEY
  process.env.ANTHROPIC_API_KEY = 'sk-ant-invalid-deliberately-broken-key'
  const t0 = Date.now()
  const r = await checkPromptForIp('a golden retriever running on a beach at sunset')
  const ms = Date.now() - t0
  process.env.ANTHROPIC_API_KEY = realKey
  check('status=unchecked on broken key', r.status === 'unchecked', JSON.stringify(r))
  check('blocked=false on broken key (generation proceeds)', r.blocked === false, JSON.stringify(r))
  check(`responded quickly (${ms}ms, timeout is 6000ms)`, ms < 6500, `${ms}ms`)
}

hr()
line('2) BENIGN PROMPT -- must not be blocked (false-positive check)')
hr()
{
  const prompts = [
    'a golden retriever running on a beach at sunset, cinematic, slow motion',
    'a neon-lit cyberpunk city street at night, rain reflections, wide shot',
    'a chef plating a dessert in a modern kitchen, close-up, shallow depth of field',
  ]
  for (const p of prompts) {
    const r = await checkPromptForIp(p)
    check(`"${p.slice(0, 40)}..." -> not blocked`, r.blocked === false, JSON.stringify(r))
  }
}

hr()
line('3) OBVIOUS IP PROMPT -- must block, name in evidence')
hr()
{
  const r = await checkPromptForIp('Spider-Man swinging between skyscrapers in New York City, cinematic')
  check('blocked=true', r.blocked === true, JSON.stringify(r))
  check('confidence=high (threshold)', r.confidence === 'high', JSON.stringify(r))
  check('what mentions Spider-Man', /spider-?man/i.test(r.what ?? ''), JSON.stringify(r))
  check('blockMessage contains the name', /spider-?man/i.test(r.blockMessage ?? ''), JSON.stringify(r))
  line(`  blockMessage: ${r.blockMessage}`)
}

hr()
line('4) END-TO-END WIRING -- real createGeneration(), clear prompt, DB write + cleanup')
hr()
{
  const DEMO_EMAIL = 'studio-demo@oxxovo.ai'
  let uid = null
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === DEMO_EMAIL)
    if (hit) { uid = hit.id; break }
    if (data.users.length < 200) break
  }
  if (!uid) {
    check('demo account found', false, `${DEMO_EMAIL} not found -- skipping E2E`)
  } else {
    const SEASON = 'season_test'
    const { data: models } = await admin
      .from('model_catalog')
      .select('id, min_duration_seconds, max_duration_seconds')
      .eq('active', true)
      .order('min_duration_seconds', { ascending: true })
      .limit(1)
    const modelId = models?.[0]?.id
    const testDuration = models?.[0]?.min_duration_seconds ?? 5
    const { data: balBefore } = await admin.from('credit_transactions').select('amount_credits').eq('user_id', uid)
    const before = (balBefore ?? []).reduce((s, r) => s + Number(r.amount_credits), 0)

    const res = await createGeneration({
      userId: uid,
      seasonId: SEASON,
      modelId,
      prompt: 'a lighthouse on a rocky coast at dawn, misty, wide establishing shot',
      durationSeconds: testDuration,
    })
    check('createGeneration ok=true (not blocked)', res.ok === true, JSON.stringify(res))

    if (res.ok) {
      const { data: row } = await admin.from('generation_jobs').select('ip_check_status, ip_check_note').eq('id', res.jobId).maybeSingle()
      check('ip_check_status written to DB', row?.ip_check_status === 'clear', JSON.stringify(row))
      // cleanup: delete the job + reverse the charge so this test costs nothing
      // and the row is never picked up by the render worker.
      await admin.from('credit_transactions').delete().eq('generation_job_id', res.jobId)
      await admin.from('generation_jobs').delete().eq('id', res.jobId)
      line('  cleanup: test job + charge deleted')
    }

    hr()
    line('5) END-TO-END BLOCKED -- real createGeneration(), obvious IP prompt, credits untouched')
    hr()
    const res2 = await createGeneration({
      userId: uid,
      seasonId: SEASON,
      modelId,
      prompt: 'Spider-Man swinging between skyscrapers in New York City, cinematic',
      durationSeconds: testDuration,
    })
    check('createGeneration ok=false', res2.ok === false, JSON.stringify(res2))
    check('reason=ip_flag', res2.ok === false && res2.reason === 'ip_flag', JSON.stringify(res2))
    check('detail contains a name', res2.ok === false && /spider-?man/i.test(res2.detail ?? ''), JSON.stringify(res2))

    const { data: balAfter } = await admin.from('credit_transactions').select('amount_credits').eq('user_id', uid)
    const after = (balAfter ?? []).reduce((s, r) => s + Number(r.amount_credits), 0)
    check(`balance unchanged (before=${before}, after=${after})`, before === after, `delta=${after - before}`)

    hr()
    line('6) END-TO-END UNCHECKED -- real createGeneration() with the check forced to fail-open')
    hr()
    const realKey = process.env.ANTHROPIC_API_KEY
    process.env.ANTHROPIC_API_KEY = 'sk-ant-invalid-deliberately-broken-key'
    const res3 = await createGeneration({
      userId: uid,
      seasonId: SEASON,
      modelId,
      prompt: 'a lighthouse on a rocky coast at dawn, misty, wide establishing shot',
      durationSeconds: testDuration,
    })
    process.env.ANTHROPIC_API_KEY = realKey
    check('createGeneration ok=true (fail-open lets it through)', res3.ok === true, JSON.stringify(res3))
    if (res3.ok) {
      const { data: row3 } = await admin.from('generation_jobs').select('ip_check_status').eq('id', res3.jobId).maybeSingle()
      check('ip_check_status=unchecked written to DB', row3?.ip_check_status === 'unchecked', JSON.stringify(row3))
      await admin.from('credit_transactions').delete().eq('generation_job_id', res3.jobId)
      await admin.from('generation_jobs').delete().eq('id', res3.jobId)
      line('  cleanup: test job + charge deleted')
    }

    hr()
    line('7) BORDERLINE PROMPT (traits only, no name) -- check the flagged/pass-through path')
    hr()
    // ★2026-08-18 finding: across 18 trait-only prompts (this one + 17 probed
    // separately), Haiku 4.5 under this system prompt never returned medium/low
    // -- it either names the character at confidence=high or doesn't flag at
    // all. So this step logs whatever comes back rather than asserting a tier;
    // see the chat report for the full finding and what it means for the
    // 'flagged' (non-blocking) DB-write path.
    const borderlinePrompt = 'a young wizard boy with round glasses and a lightning-shaped scar on his forehead'
    const rDirect = await checkPromptForIp(borderlinePrompt)
    line(`  direct checkPromptForIp(): ${JSON.stringify(rDirect)}`)

    const res4 = await createGeneration({
      userId: uid,
      seasonId: SEASON,
      modelId,
      prompt: borderlinePrompt,
      durationSeconds: testDuration,
    })
    line(`  createGeneration(): ${JSON.stringify(res4)}`)
    if (res4.ok) {
      const { data: row4 } = await admin.from('generation_jobs').select('ip_check_status, ip_check_note').eq('id', res4.jobId).maybeSingle()
      line(`  DB row: ${JSON.stringify(row4)}`)
      check('ip_check_status written (clear or flagged)', row4?.ip_check_status === 'clear' || row4?.ip_check_status === 'flagged', JSON.stringify(row4))
      await admin.from('credit_transactions').delete().eq('generation_job_id', res4.jobId)
      await admin.from('generation_jobs').delete().eq('id', res4.jobId)
      line('  cleanup: test job + charge deleted')
    } else {
      check('ip_flag block carries a name', /\w/.test(res4.detail ?? ''), JSON.stringify(res4))
    }
  }
}

hr()
line(`RESULT: ${pass} pass, ${fail} fail`)
process.exit(fail === 0 ? 0 : 1)
