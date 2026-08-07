// OXXOVO's official actors (`official_actors`) -- SERVER ONLY.
//
// These are the platform's own synthetic performers, distinct from the actors a
// participant registers in Studio (those live per-user; see app/studio/ActorMode).
// They are never offered to participants as naming examples -- see
// lib/character-name-examples.ts.
//
// ★WHY THIS FILE EXISTS AT ALL. The table had zero application readers: the only
// code that touched it was scripts/onboard-actor-insert.mjs, a one-off. So the
// actor, its provenance and its signature were invisible without running a script
// against production. That is the gap /admin/actors closes.
//
// ★WHY verifyActorBind IS HERE AND NOT IN lib/cryptobind.ts. That file's first
// line says it is a byte-for-byte mirror of oxxovo-studio/src/cryptobind.ts and
// must stay compatible with the worker copy. The v1actor scheme is app-side only
// -- the worker never signs or verifies an actor -- so adding it there would break
// the mirror for no gain. MOVE IT INTO THE FAMILY only when the worker itself
// needs v1actor; that is a simultaneous two-repo change and therefore a head
// office call, not a local refactor.

import 'server-only'
import { createHash, createHmac, timingSafeEqual } from 'crypto'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export type OfficialActorRow = {
  id: string
  slug: string
  display_name: string | null
  kind: string
  status: string
  provenance: Record<string, unknown> | null
  canonical_frontal_url: string
  reference_urls: string[] | null
  cryptobind_hash: string | null
  cryptobind_signature: string | null
  cryptobind_algo: string | null
  created_at: string
  updated_at: string | null
}

// ★THE EDIT BOUNDARY, AND WHY IT HAS TWO HALVES.
//
// The canonical string signed at onboarding is
//   v1actor | slug | canonical_frontal_url | sorted(reference_urls) | provHash
// so the signature itself decides most of this. Anything inside it cannot be
// edited here: the signature would stop verifying, and offering to re-sign from
// an admin screen would let an admin rewrite an actor's provenance and re-bless
// it -- which is precisely what CryptoBind exists to prevent.
//
// display_name is NOT in the canonical string, so crypto has no opinion on it. It
// is locked for a different reason: the public name is undecided (head office),
// and the value currently in the row is not authoritative.
//
// ★These two must stay distinguishable in the UI. If they read as one thing,
// someone later either seals display_name forever thinking it is cryptographic,
// or unseals a signed field thinking it is merely policy.
export const SIGNATURE_LOCKED_FIELDS = [
  'slug',
  'canonical_frontal_url',
  'reference_urls',
  'provenance',
  'cryptobind_hash',
  'cryptobind_signature',
  'cryptobind_algo',
] as const

export const POLICY_LOCKED_FIELDS = ['display_name'] as const

// Not locked by either rule, and still deliberately NOT editable here.
//
// ★The reason is the opposite of what it first looked like. The constraints on
// this table were read back on 2026-08-07 and there are only two:
//   official_actors_pkey       PRIMARY KEY (id)
//   official_actors_slug_key   UNIQUE (slug)
// There is NO CHECK on status or kind. So a bad value does not error -- it is
// stored. An admin dropdown would not have crashed; it would have silently
// invented vocabulary, and a typo would persist with nothing to reject it.
//
// And there is no vocabulary to offer yet. Everything actually known:
//   status: only 'draft' has ever existed, meaning "no public exposure"
//           (scripts/onboard-actor-insert.mjs:4). No second value is named
//           anywhere in this repo.
//   kind:   only 'live' has ever existed. A `kind: 'live' | 'anime'` union does
//           appear in lib/character-name-examples.ts:17 -- but that comment is
//           describing the SHAPE THAT FILE USED TO HAVE while it was misnamed
//           lib/studio-actors.ts, and that file was never about this table
//           ("The two have never shared an id, a slug or a name"). Treating it
//           as this column's enum would repeat the exact confusion that its
//           rename existed to end.
//
// Nor does the schema settle it by analogy: every neighbouring table has its own
// vocabulary (seasons active/upcoming/closed/completed, promo_videos ready,
// genesis_applications pending/rejected/main_round_submitted) and the closest
// equivalent gate, model_catalog, is a BOOLEAN `active` rather than a status
// string at all.
//
// So the allowed values are an application decision that has not been made, and
// whether to add a CHECK is a schema decision (head office / 지수 본체). Until
// then these are display-only: showing a value you cannot mistype is strictly
// better than editing one nothing validates.
export const UNLOCKED_BUT_NOT_YET_EDITABLE = ['status', 'kind'] as const

// Recursively key-sorted JSON. Postgres jsonb does not preserve key order, so a
// hash over raw JSON.stringify would not re-verify after a storage round-trip.
// Must stay identical to scripts/onboard-actor-insert.mjs:62.
function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']'
  if (v && typeof v === 'object') {
    return (
      '{' +
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + stableStringify((v as Record<string, unknown>)[k]))
        .join(',') +
      '}'
    )
  }
  return JSON.stringify(v)
}

export const ACTOR_CANON_VERSION = 'v1actor'
export const ACTOR_ALGO = 'HMAC-SHA256-v1actor-stable'

// The canonical string, rebuilt from the stored row. reference_urls is SORTED, so
// the order the array happens to come back in cannot change the result.
export function actorCanonicalString(input: {
  slug: string
  canonical_frontal_url: string
  reference_urls: string[] | null
  provenance: unknown
}): string {
  const provHash = createHash('sha256').update(stableStringify(input.provenance), 'utf8').digest('hex')
  const refs = [...(input.reference_urls ?? [])].sort().join(',')
  return [ACTOR_CANON_VERSION, input.slug, input.canonical_frontal_url, refs, provHash].join('|')
}

export type ActorBindVerdict =
  | { ok: true; hashMatches: true }
  // hashMatches is reported separately: a hash mismatch means the stored ROW no
  // longer matches its own canonical string (content changed), while a signature
  // mismatch with a matching hash means the secret differs from the signing one.
  // Collapsing both into one boolean loses which of those happened.
  | { ok: false; reason: 'missing' | 'hash' | 'signature' | 'no_secret'; hashMatches: boolean }

// Recompute and compare. Server-side only, and it returns a verdict rather than
// any part of the secret or the recomputed signature -- the caller renders a
// boolean, never a value derived from STUDIO_CRYPTOBIND_SECRET.
export function verifyActorBind(row: {
  slug: string
  canonical_frontal_url: string
  reference_urls: string[] | null
  provenance: unknown
  cryptobind_hash: string | null
  cryptobind_signature: string | null
}): ActorBindVerdict {
  if (!row.cryptobind_hash || !row.cryptobind_signature) {
    return { ok: false, reason: 'missing', hashMatches: false }
  }
  const secret = process.env.STUDIO_CRYPTOBIND_SECRET
  if (!secret) return { ok: false, reason: 'no_secret', hashMatches: false }

  const canonical = actorCanonicalString(row)
  const hash = createHash('sha256').update(canonical, 'utf8').digest('hex')
  const hashMatches = safeEqualHex(hash, row.cryptobind_hash)
  if (!hashMatches) return { ok: false, reason: 'hash', hashMatches: false }

  const sig = createHmac('sha256', secret).update(canonical, 'utf8').digest('hex')
  if (!safeEqualHex(sig, row.cryptobind_signature)) {
    return { ok: false, reason: 'signature', hashMatches: true }
  }
  return { ok: true, hashMatches: true }
}

// Constant-time compare on equal-length hex; length difference is not secret.
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
}

// anon SELECT on this table is refused (42501, measured), so service_role is the
// only read path -- the same shape /admin/promo uses. Limit is generous rather
// than paginated: actors are single digits by design.
export async function listOfficialActors(limit = 100): Promise<OfficialActorRow[]> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('official_actors')
    .select(
      'id, slug, display_name, kind, status, provenance, canonical_frontal_url, reference_urls, cryptobind_hash, cryptobind_signature, cryptobind_algo, created_at, updated_at',
    )
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw new Error(`official_actors read failed: ${error.message}`)
  return (data ?? []) as OfficialActorRow[]
}

// Short form for display. Full hex is handed to a copy button instead of being
// printed, so a screenshot of this page does not carry the whole signature.
export function shortHex(v: string | null, chars = 16): string {
  if (!v) return '-'
  return v.length <= chars ? v : `${v.slice(0, chars)}…`
}
