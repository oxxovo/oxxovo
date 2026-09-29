// ④ 게이트 실측 -- season-tick 응답의 scoringIncompletePastDeadline 필드 확인.
// CRON_SECRET 값은 절대 출력하지 않는다(rehearsal-lib.pingCron과 동일 패턴).
//   node --env-file=.env.local scripts/zz_probe_gate_check_2026-09-07.mjs
const base = process.env.REHEARSAL_CRON_BASE ?? 'https://www.oxxovo.ai'
const secret = process.env.CRON_SECRET
if (!secret) { console.error('missing CRON_SECRET'); process.exit(1) }
const res = await fetch(`${base}/api/cron/season-tick`, { method: 'POST', headers: { Authorization: `Bearer ${secret}` } })
const body = await res.json().catch(() => ({}))
console.log('status:', res.status)
console.log('scoringIncompletePastDeadline:', JSON.stringify(body.scoringIncompletePastDeadline))
console.log('advancements:', JSON.stringify(body.advancements))
console.log('errors:', JSON.stringify(body.errors))
process.exit(0)
