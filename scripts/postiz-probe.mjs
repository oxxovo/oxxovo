// Postiz API 실측 probe -- lib/postiz.ts 의 응답 파싱을 실제 응답으로 확정하기 위한
// 일회성 점검 도구. 키는 환경변수로만 받고 절대 출력하지 않는다.
//
// 사용법 (PowerShell):
//   $env:POSTIZ_API_KEY="<키>"; node scripts/postiz-probe.mjs integrations
//   $env:POSTIZ_API_KEY="<키>"; node scripts/postiz-probe.mjs upload <공개영상URL>
//   $env:POSTIZ_API_KEY="<키>"; node scripts/postiz-probe.mjs post <integrationId> <provider> <mediaRef>
//
//   self-host 시: $env:POSTIZ_API_URL="https://<backend>/public/v1"
//
// integrations 는 부작용 없음(읽기). post 는 15분 뒤 "예약"으로 올리니, 확인 후
// Postiz 화면에서 해당 예약을 삭제하면 됨.

const BASE = process.env.POSTIZ_API_URL || 'https://api.postiz.com/public/v1'
const KEY = process.env.POSTIZ_API_KEY

if (!KEY) {
  console.error('ERROR: POSTIZ_API_KEY 환경변수가 없습니다. 키를 채팅에 붙이지 말고 환경변수로 주입하세요.')
  process.exit(1)
}

const cmd = process.argv[2]

async function call(path, init) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      Authorization: KEY, // Bearer 접두 없음 (lib/postiz.ts 와 동일)
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  return { status: res.status, ok: res.ok, json }
}

function show(label, r) {
  console.log(`\n=== ${label} -> HTTP ${r.status} (${r.ok ? 'ok' : 'FAIL'}) ===`)
  console.log(typeof r.json === 'string' ? r.json.slice(0, 2000) : JSON.stringify(r.json, null, 2))
}

if (cmd === 'integrations') {
  // 채널 id + 응답 구조 확인 (부작용 없음).
  const r = await call('/integrations', { method: 'GET' })
  show('GET /integrations', r)
  // 채널별 id 만 추려서 표로 (키는 출력 안 됨).
  const arr = Array.isArray(r.json) ? r.json : r.json?.integrations ?? []
  if (Array.isArray(arr) && arr.length) {
    console.log('\n--- 채널 요약 (이 id 들을 platform_config 에 넣습니다) ---')
    for (const it of arr) {
      console.log(`${it.id ?? '?'}\t${it.providerIdentifier ?? it.provider ?? it.identifier ?? '?'}\t${it.name ?? ''}`)
    }
  }
} else if (cmd === 'upload') {
  const url = process.argv[3]
  if (!url) {
    console.error('사용법: node scripts/postiz-probe.mjs upload <공개영상URL>')
    process.exit(1)
  }
  // lib/postiz.uploadMedia 가정: { url } 바디. 실패하면 multipart 필요 신호.
  const r = await call('/upload', { method: 'POST', body: JSON.stringify({ url }) })
  show('POST /upload {url}', r)
} else if (cmd === 'post') {
  const integrationId = process.argv[3]
  const provider = process.argv[4]
  const mediaRef = process.argv[5]
  if (!integrationId || !provider || !mediaRef) {
    console.error('사용법: node scripts/postiz-probe.mjs post <integrationId> <provider> <mediaRefOrUrl>')
    process.exit(1)
  }
  // 15분 뒤 예약 (확인 후 Postiz 화면에서 삭제). lib/postiz.publishPost 바디와 동일 모양.
  const date = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  const body = {
    type: 'schedule',
    date,
    posts: [
      {
        integration: { id: integrationId },
        value: [{ content: '[OXXOVO probe] 무시하세요 - API 실측 테스트', image: [mediaRef] }],
        settings: { __type: provider },
      },
    ],
  }
  const r = await call('/posts', { method: 'POST', body: JSON.stringify(body) })
  show('POST /posts (schedule +15m)', r)
  console.log('\n주의: 성공했다면 Postiz 화면에서 위 예약 글을 삭제하세요.')
} else {
  console.error('명령: integrations | upload <url> | post <integrationId> <provider> <mediaRef>')
  process.exit(1)
}
