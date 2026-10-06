// Live runtime probe for /api/contents/* (Phase 1 step 4).
//
// Usage:  node scripts/probe-contents.mjs <step>
//   steps (in order): wrongsecret | presign | put | import | resend | conflict |
//                     rightsdown | status | returns | public
//   or:               all   (runs every step in order, stops at first FAIL)
//
// The secret is read from the environment and is never printed or stored:
//   CONTENT_IMPORT_SECRET_PRODUCTION_OS   (the production_os source secret)
// Optional: PROBE_BASE (default https://www.oxxovo.ai)
//
// Everything is created as `restricted` under a source_ref starting with
// `probe-`, so it can never be dispatched. Rows are permanent (delete
// triggers), the same as the earlier probe-trg / probe-rpc rows.
//
// State between steps (ref, key, approval id) lives in the OS temp dir, not in
// the repo. `presign` starts a fresh run.
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = (process.env.PROBE_BASE || 'https://www.oxxovo.ai').replace(/\/+$/, '')
const SECRET = process.env.CONTENT_IMPORT_SECRET_PRODUCTION_OS
const STATE_FILE = join(tmpdir(), 'oxxovo-probe-contents-state.json')
const STEPS = ['wrongsecret', 'presign', 'put', 'import', 'resend', 'conflict', 'rightsdown', 'status', 'returns', 'public']
const FILE_BYTES = 2048
// PROBE_RIGHTS=cleared makes a CLEARED probe row (for the DB-path test of release/claim/mark).
// It must be finished by the SQL blocks (ends hidden); never leave it scheduled.
const CLEARED = process.env.PROBE_RIGHTS === 'cleared'
// The mode of a run is fixed by its source_ref prefix (set at presign), so a later step run
// without PROBE_RIGHTS cannot silently send a different rights_status for the same ref.
const isCleared = (s) => (s && s.ref ? s.ref.startsWith('probe-rt-cl-') : CLEARED)

let failed = false
function show(ok, label, detail) {
  if (!ok) failed = true
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`)
}
function expectLine(text) {
  console.log(`      (성공이면: ${text})`)
}

function loadState() {
  if (!existsSync(STATE_FILE)) return null
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'))
}
function saveState(s) {
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2))
}
function needState(...fields) {
  const s = loadState()
  const missing = !s ? fields : fields.filter((f) => s[f] === undefined)
  if (!s || missing.length) {
    console.log(`FAIL  이전 단계 결과가 없습니다 (${missing.join(', ')}). 순서대로 하나씩 실행하세요 (presign부터).`)
    process.exit(1)
  }
  return s
}

// Deterministic 2KB payload from the ref, so `put` and `import` agree on bytes/sha256.
function fileBuffer(ref) {
  const parts = []
  for (let i = 0; parts.length * 32 < FILE_BYTES; i++) parts.push(createHash('sha256').update(`${ref}:${i}`).digest())
  return Buffer.concat(parts).subarray(0, FILE_BYTES)
}
const sha256Hex = (buf) => createHash('sha256').update(buf).digest('hex')

async function call(method, path, { body, secret = SECRET } = {}) {
  const headers = {}
  if (secret) headers.authorization = `Bearer ${secret}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* keep text */ }
  return { status: res.status, json, text }
}
const brief = (r) => `HTTP ${r.status} ${r.json ? JSON.stringify(r.json) : r.text.slice(0, 200)}`

function importBody(s, over = {}) {
  return {
    spec_version: 1,
    source_ref: s.ref,
    source_version: 1,
    kind: 'cf',
    form: 'short',
    language: 'ko',
    rights_status: isCleared(s) ? 'cleared' : 'restricted',
    ...(isCleared(s) ? {} : { rights_reason: 'probe: runtime test, never publish' }),
    title: 'probe runtime test',
    upstream_approved_by: 'probe@oxxovo',
    upstream_approved_at: s.approvedAt,
    upstream_approval_id: s.approvalId,
    ai_generated: true,
    allowed_platforms: ['youtube'],
    not_before: s.notBefore,
    assets: [{
      role: 'main_16x9',
      key: s.key,
      file_format: 'mp4',
      bytes: FILE_BYTES,
      duration_sec: 1,
      width: 1920,
      height: 1080,
      sha256: sha256Hex(fileBuffer(s.ref)),
    }],
    ...over,
  }
}

// Printed before EVERY step so a pasted result says which server and which test
// it belongs to (2026-10-06: two runs were mixed up because neither was shown).
function header(step) {
  const s = loadState()
  console.log('==============================================================')
  console.log(`[대상 서버]  ${BASE}`)
  console.log(`[단계]       ${step}   (모드: ${isCleared(s) ? 'cleared' : 'restricted'})`)
  console.log(`[source_ref] ${s?.ref ?? '(아직 없음 -- presign 단계에서 만들어집니다)'}`)
  console.log(`[content id] ${s?.contentId ?? '(아직 없음 -- import 성공 후 생깁니다)'}`)
  console.log('==============================================================')
}

const run = {
  async wrongsecret() {
    console.log('[2] 잘못된 시크릿으로 호출 -> 거절되어야 함')
    expectLine('PASS 1줄, HTTP 401')
    const r = await call('POST', '/api/contents/presign', { body: {}, secret: 'this-is-not-the-secret-0123456789abcdef' })
    show(r.status === 401, '잘못된 시크릿 401', brief(r))
  },

  async presign() {
    console.log('[3-a] 업로드 URL 받기 (새 시험 시작)')
    expectLine('PASS 1줄, key가 imports/production_os/probe-.../v1/main_16x9- 로 시작')
    if (!SECRET) return show(false, '환경변수 CONTENT_IMPORT_SECRET_PRODUCTION_OS 없음', '아래 안내의 1번 줄을 먼저 실행하세요')
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
    const ref = `${CLEARED ? 'probe-rt-cl-' : 'probe-rt-'}${stamp}`
    const s = {
      ref,
      approvalId: randomUUID(),
      approvedAt: new Date().toISOString(),
      notBefore: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
    }
    const r = await call('POST', '/api/contents/presign', {
      body: { source_ref: ref, source_version: 1, role: 'main_16x9', bytes: FILE_BYTES, content_type: 'video/mp4' },
    })
    const ok = r.status === 200 && r.json?.key?.startsWith(`imports/production_os/${ref}/v1/main_16x9-`) && !!r.json?.upload_url
    // never print the signed query string
    const safe = r.json ? { ...r.json, upload_url: r.json.upload_url ? r.json.upload_url.split('?')[0] + '?<signature hidden>' : undefined } : null
    show(ok, 'presign 200 + key 형식', safe ? JSON.stringify(safe) : brief(r))
    if (ok) {
      saveState({ ...s, key: r.json.key, uploadUrl: r.json.upload_url, headers: r.json.required_headers })
      console.log(`      source_ref = ${ref}`)
    }
  },

  async put() {
    console.log('[3-b] R2에 실제로 올리기 (설계 미결 #10 -- 서명된 PUT이 R2에서 받아지는가)')
    expectLine('PASS 1줄, HTTP 200')
    const s = needState('uploadUrl', 'headers')
    const res = await fetch(s.uploadUrl, { method: 'PUT', headers: s.headers, body: fileBuffer(s.ref) })
    const txt = await res.text()
    show(res.status === 200, 'R2 PUT 200', `HTTP ${res.status}${res.status === 200 ? '' : ' ' + txt.slice(0, 300)}`)
  },

  async import() {
    console.log('[4-a] 수입 -> created (서버가 R2에서 파일 존재·크기·sha256을 직접 확인한다)')
    expectLine(`PASS 1줄, HTTP 201, "outcome":"created", status는 ${isCleared(loadState()) ? 'scheduled (cleared라서)' : 'held (restricted라서)'}`)
    const s = needState('key')
    const r = await call('POST', '/api/contents/import', { body: importBody(s) })
    const ok = r.status === 201 && r.json?.outcome === 'created'
    show(ok, 'import created', brief(r))
    if (ok) {
      saveState({ ...s, contentId: r.json.id })
      console.log('')
      console.log(`  ★★★  content id = ${r.json.id}`)
      console.log(`  ★★★  source_ref = ${s.ref}   (이 두 값을 SQL 블록에 쓰세요)`)
      console.log('')
    }
  },

  async resend() {
    console.log('[4-b] 같은 내용 다시 보내기 -> idempotent (재시도가 안전한가)')
    expectLine('PASS 1줄, HTTP 200, "idempotent":true')
    const s = needState('key', 'contentId')
    const r = await call('POST', '/api/contents/import', { body: importBody(s) })
    show(r.status === 200 && r.json?.idempotent === true, 'resend idempotent', brief(r))
  },

  async conflict() {
    console.log('[4-c] 같은 버전에 다른 내용 -> conflict (제목만 바꿈)')
    expectLine('PASS 1줄, HTTP 409, "error":"payload_conflict"')
    const s = needState('key', 'contentId')
    const r = await call('POST', '/api/contents/import', { body: importBody(s, { title: 'probe runtime test CHANGED' }) })
    show(r.status === 409 && r.json?.error === 'payload_conflict', 'conflict 409', brief(r))
  },

  async rightsdown() {
    console.log('[5-a] 권리 내리기 restricted -> blocked, 그리고 올리기 시도는 거절')
    expectLine('PASS 2줄: 첫째 HTTP 200 "lowered", 둘째 HTTP 400 rights_up_denied')
    const s = needState('contentId')
    const down = await call('POST', '/api/contents/rights-down', {
      body: { source_ref: s.ref, source_version: 1, rights_status: 'blocked', rights_reason: 'probe: lowering test' },
    })
    show(down.status === 200 && down.json?.outcome === 'lowered', 'rights-down lowered', brief(down))
    const up = await call('POST', '/api/contents/rights-down', {
      body: { source_ref: s.ref, source_version: 1, rights_status: 'cleared', rights_reason: 'probe: raising must fail' },
    })
    show(up.status === 400, 'rights up 거절', brief(up))
  },

  async status() {
    console.log('[5-b] 상태 조회')
    expectLine('PASS 1줄, HTTP 200, items 1개, rights_status가 blocked, status가 held')
    const s = needState('contentId')
    const r = await call('GET', `/api/contents/status?source_ref=${encodeURIComponent(s.ref)}`)
    const it = r.json?.items?.[0]
    show(r.status === 200 && r.json.items.length === 1 && it.rights_status === 'blocked' && it.status === 'held', 'status', brief(r))
    const miss = await call('GET', '/api/contents/status?source_ref=probe-does-not-exist')
    show(miss.status === 404, '없는 ref는 404', brief(miss))
  },

  async returns() {
    console.log('[5-c] 반송 목록 (이 시험 행은 반송 상태가 아니므로 비어 있어야 정상)')
    expectLine('PASS 1줄, HTTP 200, "items" 배열에 이번 probe-rt 행이 없음')
    const s = needState('contentId')
    const r = await call('GET', '/api/contents/returns?limit=100')
    const ok = r.status === 200 && Array.isArray(r.json?.items) && !r.json.items.some((i) => i.source_ref === s.ref)
    show(ok, 'returns 200', `HTTP ${r.status} items=${r.json?.items?.length ?? '?'}`)
  },

  async public() {
    console.log('[참고] R2 공개 주소로 방금 올린 파일이 열리는가 (R2_PUBLIC_BASE 확인용, 판정 아님)')
    expectLine('PASS 1줄, HTTP 200 + 2048바이트. 404/403이면 버킷 공개 설정 또는 R2_PUBLIC_BASE 값을 확인')
    const s = needState('key')
    const pub = (process.env.PROBE_PUBLIC_BASE || 'https://pub-e3c934bf3d8b47e1862eed1c83ae7530.r2.dev').replace(/\/+$/, '')
    const res = await fetch(`${pub}/${s.key}`)
    const len = (await res.arrayBuffer()).byteLength
    show(res.status === 200 && len === FILE_BYTES, 'R2 공개 주소 열림', `HTTP ${res.status} ${len}bytes`)
  },
}

async function main() {
  const step = process.argv[2]
  if (step === 'all') {
    for (const st of STEPS.filter((x) => x !== 'public')) {
      header(st)
    await run[st]()
      console.log('')
      if (failed) break
    }
  } else if (run[step]) {
    header(step)
    await run[step]()
  } else {
    console.log(`사용법: node scripts/probe-contents.mjs <${STEPS.join('|')}|all>`)
    process.exit(2)
  }
  if (failed) {
    console.log('\n실패가 있습니다. 위 FAIL 줄을 그대로 복사해서 지수에게 보내 주세요 (시크릿은 출력되지 않습니다).')
    process.exit(1)
  }
}
main().catch((e) => {
  console.log('FAIL  스크립트 오류:', e instanceof Error ? e.message : e)
  process.exit(1)
})
