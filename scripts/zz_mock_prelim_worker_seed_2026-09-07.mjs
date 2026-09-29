// 실전 검증(본부 지시 2026-09-07) -- 9/5 하니스가 쓴 43편 세트를 season_test에
// 신규로 넣어 REAL 프로덕션 워커(batch.ts, 하니스 아님)로 채점한다.
// TEST-01~19(기존 리허설 계열)와 완전히 분리된 별도 행 -- 정리는 cleanup.
//   node --env-file=.env.local scripts/zz_mock_prelim_worker_seed_2026-09-07.mjs insert
//   node --env-file=.env.local scripts/zz_mock_prelim_worker_seed_2026-09-07.mjs cleanup
import { admin, SEASON } from './rehearsal-lib.mjs'

const R2 = 'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev'
const TK_UID = '9b5ceed5-34b3-4a64-af4a-3fe898dd547f'
// ★본부 지시 2026-09-07(승인 메시지): 기존 W0907- 43편(구 루브릭 대조군)은
// 절대 안 건드린다(8/29 삭제사고와 같은 자리 -- 지우면 비교가 영원히 불가능).
// v1 재시험은 SEED_PREFIX로 별도 application_id 세트를 새로 심어 완전히
// 분리한다 -- 같은 행 upsert 자체가 안 생기니 덮어쓰기 위험이 구조적으로 없다.
const PREFIX = process.env.SEED_PREFIX ?? 'W0907-'

const NEUTRAL_STATEMENT =
  '(No statement was provided by the creator for this piece. Evaluate the video ' +
  'strictly on what is visible in the frames. Do not raise or lower any score ' +
  'because a statement is absent.)'

const A_NAMES = [
  'A01_fashion', 'A01_fashion_fusion', 'A01_fashion_wearable',
  'A02_fabric', 'A03_street', 'A04_morph',
  'A05_plating', 'A06_splash', 'A07_cooking', 'A08_dessert', 'A09_race',
  'A10_drift', 'A11_night', 'A12_mech', 'A13_group', 'A14_solo',
  'A15_rhythm', 'A16_crowd', 'A17_vista', 'A18_cities', 'A19_sunrise', 'A20_culture',
]
const CF_NAMES = [
  ['cf_01_lumea_premium', 'lumea'], ['cf_02_aurelie_premium', 'aurelie'],
  ['cf_03_novya_pop', 'novya'], ['cf_04_bloomix_pop', 'bloomix'],
  ['cf_05_aquelle_cool', 'aquelle'], ['cf_06_noira_premium', 'noira'],
  ['cf_07_eclare_premium', 'eclare'], ['cf_08_soira_premium', 'soira'],
  ['cf_09_velix_pop', 'velix'],
]
const WATCH_DEMO = [
  { name: 'demo_artisan', statement: "A close, unhurried study of a potter's hands drawing a bowl up from wet clay on the wheel. I wanted every fingertip and the slip of water to read as real touch -- the craft carried entirely by motion and light, with no cuts to hide behind." },
  { name: 'demo_sf', statement: 'A lone craft tearing through the upper atmosphere on reentry, hull glowing white-hot. My aim was cinematic sci-fi motion that actually holds together -- stable camera, believable speed and heat -- the kind of shot that usually falls apart in AI video.' },
  { name: 'demo_duel', statement: 'Two figures fighting in zero gravity, momentum carrying every strike. I wanted the choreography to obey weightlessness -- no floor, no up or down -- so the tension comes from drift and recoil rather than footing.' },
  { name: 'demo_astronaut', statement: 'A three-shot micro-story of a single astronaut across one orbit -- the same character held consistent from shot to shot. The goal was narrative continuity in AI video: one recognizable person, three angles, one small arc.' },
  { name: 'demo_ichar', statement: 'A character brought to life from a single portrait -- she steps forward and walks, features and wardrobe staying true to the source image. I was testing whether an image-to-video pipeline can keep one identity stable in motion.' },
  { name: 'demo_anne', statement: 'A red-haired girl wanders a sunlit park, lost in daydream -- a gentle nod to a beloved character. I wanted a warm, storybook mood with a face that stays consistent throughout, proving a stylized character can carry a quiet, wordless scene.' },
  { name: 'demo_consistency', statement: null },
]
const TK_RENDERS = [
  { id: 'c0114e2c-f374-4063-b146-4f54d5a71502' },
  { id: '9f31a120-91c9-46f8-9d63-5163b431c327' },
]

function buildRows() {
  const rows = []
  for (const name of A_NAMES) {
    rows.push({
      creator_name: `${PREFIX}${name}`,
      free_entry_url: `${R2}/promo/content_video/content_${name}_EN_9x16.mp4`,
      video_title: name,
      creator_statement: NEUTRAL_STATEMENT,
    })
  }
  const Z = [
    ['Z01_table', 'content_Z01_table_EN_9x16.mp4'],
    ['Z02_dusk', 'content_Z02_dusk_EN_9x16.mp4'],
    ['Z03_studio', 'content_Z03_studio_EN_9x16.mp4'],
  ]
  for (const [id, file] of Z) {
    rows.push({
      creator_name: `${PREFIX}${id}`,
      free_entry_url: `${R2}/promo/content_video/content_${file.replace(/^content_/, '')}`.replace('content_video/content_content_', 'content_video/content_'),
      video_title: id,
      creator_statement: NEUTRAL_STATEMENT,
    })
  }
  for (const [file, short] of CF_NAMES) {
    rows.push({
      creator_name: `${PREFIX}cf_${short}`,
      free_entry_url: `${R2}/cf/v3/${file}.mp4`,
      video_title: `cf_${short}`,
      creator_statement: NEUTRAL_STATEMENT,
    })
  }
  for (const d of WATCH_DEMO) {
    rows.push({
      creator_name: `${PREFIX}${d.name}`,
      free_entry_url: `${R2}/watch_demo/season_test/${d.name}.mp4`,
      video_title: d.name,
      creator_statement: d.statement ?? NEUTRAL_STATEMENT,
    })
  }
  TK_RENDERS.forEach((r, i) => {
    rows.push({
      creator_name: `${PREFIX}tk_render_${i + 1}`,
      free_entry_url: `${R2}/renders/season_test/${TK_UID}/${r.id}.mp4`,
      video_title: `tk_render_${i + 1}`,
      creator_statement: NEUTRAL_STATEMENT,
    })
  })
  return rows
}

const COMMON = {
  season_id: SEASON, country: null, channel_url: null, agreed_to_rules: true,
  status: 'pending', ai_score: null, ip_address: null,
  ai_service: 'OXXOVO Studio', agreed_to_privacy: true, agreed_to_integrity_notice: true,
  moderation_status: 'approved', staff_pick: false, watch_hidden: true, watch_hold: true,
  main_round_disqualified: false, user_id: null, age: null,
}

const cmd = process.argv[2]
const db = admin()

if (cmd === 'insert') {
  const rows = buildRows()
  console.log(`inserting ${rows.length} rows (prefix=${PREFIX})`)
  let ok = 0
  for (const r of rows) {
    const { data: existing } = await db.from('genesis_applications')
      .select('id').eq('season_id', SEASON).eq('creator_name', r.creator_name).maybeSingle()
    if (existing) { console.log(`[skip] ${r.creator_name} exists`); ok++; continue }
    const { error } = await db.from('genesis_applications').insert({
      ...COMMON, creator_name: r.creator_name,
      email: `${r.creator_name.toLowerCase()}@oxxovo-demo.local`,
      free_entry_url: r.free_entry_url, video_title: r.video_title,
      creator_statement: r.creator_statement,
    })
    if (error) { console.error(`[FAIL] ${r.creator_name}: ${error.message}`); process.exit(1) }
    ok++
  }
  console.log(`done: ${ok}/${rows.length}`)
} else if (cmd === 'cleanup') {
  const { data: apps } = await db.from('genesis_applications').select('id, creator_name')
    .eq('season_id', SEASON).like('creator_name', `${PREFIX}%`)
  console.log(`cleaning up ${apps?.length ?? 0} rows`)
  for (const a of apps ?? []) {
    await db.from('scoring_results').delete().eq('application_id', a.id)
    await db.from('genesis_applications').delete().eq('id', a.id)
  }
  console.log('cleanup done')
} else {
  console.error('usage: insert|cleanup')
  process.exit(1)
}
process.exit(0)
