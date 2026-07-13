// TEMP: insert 6 curated demo applications into season_test for the Watch demo.
// Existing [TEST] A01~A20 are NOT touched. Run:
//   node --env-file=.env.local _watch_demo_insert.mjs
// Prints the inserted application IDs (comma-joined) for the scoring step.
// Delete after use.
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const BASE = 'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/watch_demo/season_test'

const DEMOS = [
  {
    name: 'demo_artisan', creator_name: 'Kiln & Clay', country: 'KR',
    video_title: "The Potter's Hands", ai_service: 'Kling', video_duration_seconds: 15,
    creator_statement:
      "A close, unhurried study of a potter's hands drawing a bowl up from wet clay on the wheel. I wanted every fingertip and the slip of water to read as real touch — the craft carried entirely by motion and light, with no cuts to hide behind.",
  },
  {
    name: 'demo_sf', creator_name: 'NEONFALL', country: 'US',
    video_title: 'Reentry', ai_service: 'Hailuo 02 Pro', video_duration_seconds: 6,
    creator_statement:
      'A lone craft tearing through the upper atmosphere on reentry, hull glowing white-hot. My aim was cinematic sci-fi motion that actually holds together — stable camera, believable speed and heat — the kind of shot that usually falls apart in AI video.',
  },
  {
    name: 'demo_duel', creator_name: 'Zero-G Studio', country: 'JP',
    video_title: 'Weightless Duel', ai_service: 'Kling', video_duration_seconds: 15,
    creator_statement:
      'Two figures fighting in zero gravity, momentum carrying every strike. I wanted the choreography to obey weightlessness — no floor, no up or down — so the tension comes from drift and recoil rather than footing.',
  },
  {
    name: 'demo_astronaut', creator_name: 'Orbit Diary', country: 'CA',
    video_title: 'A Day in Orbit', ai_service: 'Kling (multi-shot)', video_duration_seconds: 15,
    creator_statement:
      'A three-shot micro-story of a single astronaut across one orbit — the same character held consistent from shot to shot. The goal was narrative continuity in AI video: one recognizable person, three angles, one small arc.',
  },
  {
    name: 'demo_ichar', creator_name: 'Frame & Muse', country: 'FR',
    video_title: 'Her Walk', ai_service: 'Image-to-Video', video_duration_seconds: 9,
    creator_statement:
      'A character brought to life from a single portrait — she steps forward and walks, features and wardrobe staying true to the source image. I was testing whether an image-to-video pipeline can keep one identity stable in motion.',
  },
  {
    name: 'demo_anne', creator_name: 'Green Gables', country: 'GB',
    video_title: 'Anne, in the Park', ai_service: 'Image-to-Video', video_duration_seconds: 15,
    creator_statement:
      'A red-haired girl wanders a sunlit park, lost in daydream — a gentle nod to a beloved character. I wanted a warm, storybook mood with a face that stays consistent throughout, proving a stylized character can carry a quiet, wordless scene.',
  },
]

const ids = []
for (const d of DEMOS) {
  const row = {
    creator_name: d.creator_name,
    email: `watch-${d.name}@oxxovo-demo.local`,
    country: d.country,
    free_entry_url: `${BASE}/${d.name}.mp4`,
    creator_statement: d.creator_statement,
    video_title: d.video_title,
    ai_service: d.ai_service,
    video_duration_seconds: d.video_duration_seconds,
    season_id: 'season_test',
    status: 'pending',
    moderation_status: 'approved',
    watch_hidden: false,
    agreed_to_rules: true,
    agreed_to_privacy: true,
    agreed_to_integrity_notice: true,
    user_id: null,
    ai_score: null,
  }
  const { data, error } = await admin
    .from('genesis_applications')
    .insert(row)
    .select('id, creator_name, video_title')
    .single()
  if (error) {
    console.error(`INSERT FAILED (${d.name}): ${error.message}`)
    process.exit(1)
  }
  ids.push(data.id)
  console.error(`+ ${data.creator_name.padEnd(16)} "${data.video_title}"  id=${data.id}`)
}
console.log(ids.join(','))
process.exit(0)
