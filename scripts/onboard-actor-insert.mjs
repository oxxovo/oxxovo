// Official actor onboarding -- step 5: INSERT the actor row (service_role, RLS
// stays locked). Archives the full provenance + a CryptoBind signature over the
// canonical sheet + source, so the synthetic origin can be proven later. Public
// name deferred (display_name = null, status = draft = no public exposure).
//   node --env-file=.env.local scripts/onboard-actor-insert.mjs
import { createClient } from '@supabase/supabase-js'
import { createHash, createHmac } from 'node:crypto'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SECRET = process.env.STUDIO_CRYPTOBIND_SECRET
if (!URL || !KEY) throw new Error('missing SUPABASE env')
if (!SECRET) throw new Error('missing STUDIO_CRYPTOBIND_SECRET')

const SLUG = 'actor-3-beauty-cf'
const R2 = 'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev'
const canonical_frontal_url = `${R2}/official_actors/${SLUG}/frontal.jpg`
const reference_urls = [
  `${R2}/official_actors/${SLUG}/frontal.jpg`,
  `${R2}/official_actors/${SLUG}/three_quarter_left.jpg`,
  `${R2}/official_actors/${SLUG}/three_quarter_right.jpg`,
  `${R2}/official_actors/${SLUG}/profile.jpg`,
]

// PROVENANCE.txt, as structured JSON (fully synthetic, not derived from a real person).
const provenance = {
  synthetic: true,
  base_face: {
    model: 'fal-ai/flux/dev',
    type: 'text-to-image',
    input: 'text prompt only -- NO real-person image or video reference',
    prompt:
      'Photorealistic high-end beauty campaign portrait of a young East Asian woman in her mid-20s, luminous dewy skin, high cheekbones, a small distinctive beauty mark just below her left eye, softly arched eyebrows, natural glossy lips, sleek jet-black hair pulled back, small elegant gold hoop earrings, serene confident expression, facing the camera, clean soft-lit pastel studio background, editorial cosmetics advertisement, sharp detail, film still.',
    output: 'stage3_probe/S3A_base_face.jpg',
    source_script: 'oxxovo-studio/_stage3_char_t2i.mjs',
  },
  sheet: {
    model: 'fal-ai/ideogram/character',
    reference: 'the synthetic base face',
    angles: ['frontal', 'three_quarter_left', 'three_quarter_right', 'profile'],
    note: 'face-focused, clean; the broken-fingers lipstick pose was excluded',
    source_script: 'oxxovo-studio/scripts/onboard-actor-sheet.mjs',
  },
  motion_consistency: {
    model: 'fal-ai/kling-video/v3/pro/image-to-video',
    clip: `official_actors/${SLUG}/consistency_i2v.mp4`,
    result: 'face + age impression held during motion',
    source_script: 'oxxovo-studio/scripts/onboard-actor-i2v.mjs',
  },
  conclusion:
    'Fully synthetic. Originates from a flux/dev text-to-image generation with no real-person input at any stage. No DB generation_jobs row (probes ran via scripts); the record of provenance is the generation scripts + fal model ids above.',
  gates: { provenance: 'TK pass', sheet: 'TK pass', motion_consistency: 'TK pass' },
  onboarded_by: 'jisu2',
}

// CryptoBind: sign over the canonical sheet + source. Reproducible from the same
// secret -> proves this actor's canonical set + provenance were not altered.
// ★ Use a STABLE (recursively key-sorted) JSON serialization for the provenance
// hash: Postgres jsonb does NOT preserve key order, so signing raw JSON.stringify
// would not re-verify after a round-trip. stableStringify sorts keys so the hash
// is identical before and after storage.
const stableStringify = (v) =>
  Array.isArray(v)
    ? '[' + v.map(stableStringify).join(',') + ']'
    : v && typeof v === 'object'
      ? '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}'
      : JSON.stringify(v)
const provHash = createHash('sha256').update(stableStringify(provenance), 'utf8').digest('hex')
const canonical = ['v1actor', SLUG, canonical_frontal_url, [...reference_urls].sort().join(','), provHash].join('|')
const cryptobind_hash = createHash('sha256').update(canonical, 'utf8').digest('hex')
const cryptobind_signature = createHmac('sha256', SECRET).update(canonical, 'utf8').digest('hex')
const cryptobind_algo = 'HMAC-SHA256-v1actor-stable'

const admin = createClient(URL, KEY, { auth: { persistSession: false } })

// Idempotent: skip if the slug already exists.
const { data: existing } = await admin.from('official_actors').select('id,status').eq('slug', SLUG).maybeSingle()
if (existing) {
  console.log(JSON.stringify({ note: 'already exists', ...existing }, null, 2))
  process.exit(0)
}

const { error } = await admin.from('official_actors').insert({
  slug: SLUG,
  display_name: null, // public name deferred (TK/HQ/jenny3 alignment)
  kind: 'live',
  status: 'draft',
  provenance,
  canonical_frontal_url,
  reference_urls,
  cryptobind_hash,
  cryptobind_signature,
  cryptobind_algo,
})
if (error) { console.error('INSERT error:', error.message); process.exit(1) }

// Confirm.
const { data: row } = await admin
  .from('official_actors')
  .select('id, slug, display_name, kind, status, canonical_frontal_url, cryptobind_algo')
  .eq('slug', SLUG)
  .single()
const { count } = await admin.from('official_actors').select('*', { count: 'exact', head: true })
console.log(JSON.stringify({
  inserted: true,
  total_rows: count,
  id: row.id, slug: row.slug, display_name: row.display_name, kind: row.kind, status: row.status,
  canonical_frontal_url: row.canonical_frontal_url,
  reference_count: reference_urls.length,
  cryptobind_algo: row.cryptobind_algo, cryptobind_hash, cryptobind_signature: cryptobind_signature.slice(0, 16) + '...(64 hex)',
}, null, 2))
