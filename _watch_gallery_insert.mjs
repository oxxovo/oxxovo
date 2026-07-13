// TEMP: insert the 14 remaining gallery clips into season_test.
//   node --env-file=.env.local _watch_gallery_insert.mjs
// Prints inserted IDs (comma-joined) for scoring. Existing rows untouched.
import { createClient } from '@supabase/supabase-js'
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)
const BASE = 'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/watch_demo/season_test'

const G = [
  { name: 'g_anne_cafe', creator: 'Green Gables', country: 'GB', title: 'Anne, at the Café', ai: 'Image-to-Video', dur: 15,
    stmt: 'The same red-haired girl, now in a warm café — a companion to the park scene. I wanted to prove a stylized character can hold her identity across different settings and light, carrying a quiet mood with no dialogue.' },
  { name: 'g_sfx_a', creator: 'Vela Motion', country: 'US', title: 'Camera Sweep', ai: 'Kling v3', dur: 8,
    stmt: 'A sweeping camera move around a subject in motion — a pure test of camera dynamism and spatial coherence. The goal was a controlled orbit that keeps the scene readable, the move that betrays weak models instantly.' },
  { name: 'g_sfx_c', creator: 'Halo Pictures', country: 'KR', title: "Director's Eye", ai: 'MiniMax Director', dur: 6,
    stmt: 'A short directed shot exploring cinematic framing and staging — testing how much director intent an AI model can honor from one prompt: blocking, focus, and a deliberate camera beat.' },
  { name: 'g_ichar2', creator: 'Frame & Muse', country: 'FR', title: 'Her Gaze', ai: 'Image-to-Video', dur: 5,
    stmt: 'Second in a character-consistency series — the same person, now looking up. I was testing whether facial features and wardrobe stay locked as pose and gaze change from shot to shot.' },
  { name: 'g_ichar3', creator: 'Frame & Muse', country: 'FR', title: 'Her Turn', ai: 'Image-to-Video', dur: 5,
    stmt: 'Third in the series — the same character turning. The aim was continuity of identity through rotation, the hardest test for image-to-video: the face must survive the turn.' },
  { name: 'g_astro_single', creator: 'Orbit Diary', country: 'CA', title: 'Solo Orbit', ai: 'Kling', dur: 15,
    stmt: 'A single continuous shot of an astronaut — no cuts, one take. A counterpoint to the multi-shot version: how much story can one unbroken 15-second orbit hold on its own?' },
  { name: 'g_composed', creator: 'Cutroom', country: 'US', title: 'Composed Study', ai: 'OXXOVO Studio', dur: 18,
    stmt: 'A piece stitched from multiple generated segments in the studio editor — testing seamless assembly and pacing, and whether hard cuts read as intentional craft rather than visible seams.' },
  { name: 'g_kling_o3', creator: 'Model Atelier', country: 'US', title: 'Kling O3 — Study', ai: 'Kling O3', dur: 15,
    stmt: 'Part of a model-comparison series — the same brief across models. This one on Kling O3: documenting how it handles motion, coherence and detail. A raw study to help creators pick the right tool, not a polished entry.' },
  { name: 'g_kling_v3', creator: 'Model Atelier', country: 'US', title: 'Kling V3 — Study', ai: 'Kling v3', dur: 15,
    stmt: 'Model-comparison series, Kling V3: the same brief run to compare motion, coherence and detail against the other models. A raw study for tool selection, not a finished piece.' },
  { name: 'g_ltx2', creator: 'Model Atelier', country: 'US', title: 'LTX — Study (16s)', ai: 'LTX-2', dur: 16,
    stmt: 'Model-comparison series, LTX-2 at 16 seconds: testing how the model sustains motion and coherence over a longer take. Raw study for tool selection.' },
  { name: 'g_ltx23', creator: 'Model Atelier', country: 'US', title: 'LTX-2 — Study (20s)', ai: 'LTX-2', dur: 20,
    stmt: 'Model-comparison series, LTX-2 pushed to 20 seconds: how far the model holds together at length. A raw study documenting motion and drift, not a polished entry.' },
  { name: 'g_sora_pro', creator: 'Model Atelier', country: 'US', title: 'Sora 2 Pro — Study', ai: 'Sora 2 Pro', dur: 20,
    stmt: 'Model-comparison series, Sora 2 Pro at 20 seconds: documenting its motion, coherence and detail against the other models. Raw study for tool selection, not a finished entry.' },
  { name: 'g_sora_std16', creator: 'Model Atelier', country: 'US', title: 'Sora 2 — Study (16s)', ai: 'Sora 2', dur: 16,
    stmt: 'Model-comparison series, Sora 2 (standard) at 16 seconds: comparing motion and coherence against Pro and the other models. A raw study, not a polished piece.' },
  { name: 'g_sora_std20', creator: 'Model Atelier', country: 'US', title: 'Sora 2 — Study (20s)', ai: 'Sora 2', dur: 20,
    stmt: 'Model-comparison series, Sora 2 (standard) at 20 seconds: how it sustains a longer take versus Pro. Raw study documenting motion and drift, for tool selection.' },
]

const ids = []
for (const g of G) {
  const { data, error } = await admin.from('genesis_applications').insert({
    creator_name: g.creator,
    email: `watch-${g.name}@oxxovo-demo.local`,
    country: g.country,
    free_entry_url: `${BASE}/${g.name}.mp4`,
    creator_statement: g.stmt,
    video_title: g.title,
    ai_service: g.ai,
    video_duration_seconds: g.dur,
    season_id: 'season_test',
    status: 'pending',
    moderation_status: 'approved',
    watch_hidden: false,
    agreed_to_rules: true,
    agreed_to_privacy: true,
    agreed_to_integrity_notice: true,
    user_id: null,
    ai_score: null,
  }).select('id, creator_name, video_title').single()
  if (error) { console.error(`INSERT FAILED (${g.name}): ${error.message}`); process.exit(1) }
  ids.push(data.id)
  console.error(`+ ${data.creator_name.padEnd(16)} "${data.video_title}"  ${data.id}`)
}
console.log(ids.join(','))
process.exit(0)
