// CryptoBind (Patent 1) -- main-app mirror of oxxovo-studio/src/cryptobind.ts.
// SERVER ONLY. MUST stay byte-for-byte compatible with the worker copy: same
// canonical string, same algorithm, same STUDIO_CRYPTOBIND_SECRET. A signature
// produced at generation (worker/enqueue) verifies here at submission.

import 'server-only'
import { createHash, createHmac, timingSafeEqual } from 'crypto'

export const CRYPTOBIND_ALGO = 'HMAC-SHA256'
const CANON_VERSION = 'v1'
// Content-binding canonical version (S-6). Must match the worker copy.
const CONTENT_CANON_VERSION = 'v1c'

function secret(): string {
  const s = process.env.STUDIO_CRYPTOBIND_SECRET
  if (!s) throw new Error('STUDIO_CRYPTOBIND_SECRET is not set')
  return s
}

export interface CryptoBindInput {
  jobId: string
  pid: string // participant / user id
  tid: string // tournament / season id
  modelId: string
  durationSeconds: number
  generatedAt: Date
}

export interface CryptoBindFields {
  cryptobind_pid: string
  cryptobind_tid: string
  cryptobind_generated_at: string
  cryptobind_signature: string
  cryptobind_algo: string
}

// Order/separators are part of the contract (versioned 'v1').
export function canonicalString(i: CryptoBindInput): string {
  return [
    CANON_VERSION,
    i.pid,
    i.tid,
    i.jobId,
    i.generatedAt.toISOString(),
    i.modelId,
    String(i.durationSeconds),
  ].join('|')
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload, 'utf8').digest('hex')
}

// Stage 1: columns to insert with a new generation_jobs row (generation-time).
export function buildCryptoBind(i: CryptoBindInput): CryptoBindFields {
  return {
    cryptobind_pid: i.pid,
    cryptobind_tid: i.tid,
    cryptobind_generated_at: i.generatedAt.toISOString(),
    cryptobind_signature: sign(canonicalString(i)),
    cryptobind_algo: CRYPTOBIND_ALGO,
  }
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  } catch {
    return false
  }
}

// S-6: content-binding canonical string. Mirrors the worker copy; jobId + tid
// pin the video hash to this job and tournament.
function contentCanonicalString(i: { jobId: string; tid: string; contentHash: string }): string {
  return [CONTENT_CANON_VERSION, i.jobId, i.tid, i.contentHash].join('|')
}

export type VerifyResult =
  | { ok: true }
  | {
      ok: false
      reason: 'signature_mismatch' | 'tid_mismatch' | 'unsupported_algo' | 'content_mismatch'
    }

// Stage 2 (submission): recompute + compare, and the embedded TID must equal the
// tournament being submitted to.
export function verifyCryptoBind(
  row: {
    id: string
    cryptobind_pid: string
    cryptobind_tid: string
    cryptobind_generated_at: string
    cryptobind_signature: string
    cryptobind_algo: string
    model_id: string
    duration_seconds: number
    // S-6 content binding (nullable: jobs produced before the worker stamped it,
    // or when its secret was unset, simply skip the extra check).
    cryptobind_content_hash?: string | null
    cryptobind_content_signature?: string | null
  },
  expectedTid: string,
): VerifyResult {
  if (row.cryptobind_algo !== CRYPTOBIND_ALGO) return { ok: false, reason: 'unsupported_algo' }
  if (row.cryptobind_tid !== expectedTid) return { ok: false, reason: 'tid_mismatch' }
  const expected = sign(
    canonicalString({
      jobId: row.id,
      pid: row.cryptobind_pid,
      tid: row.cryptobind_tid,
      modelId: row.model_id,
      durationSeconds: row.duration_seconds,
      generatedAt: new Date(row.cryptobind_generated_at),
    }),
  )
  if (!safeEqualHex(expected, row.cryptobind_signature)) return { ok: false, reason: 'signature_mismatch' }

  // S-6: when the worker stamped a content binding, the stored hash must carry a
  // valid signature for THIS job + tournament. An attacker who rewrites
  // video_url/the hash post-generation cannot forge this without the secret.
  if (row.cryptobind_content_hash || row.cryptobind_content_signature) {
    if (!row.cryptobind_content_hash || !row.cryptobind_content_signature) {
      return { ok: false, reason: 'content_mismatch' }
    }
    const expectedContent = sign(
      contentCanonicalString({
        jobId: row.id,
        tid: row.cryptobind_tid,
        contentHash: row.cryptobind_content_hash,
      }),
    )
    if (!safeEqualHex(expectedContent, row.cryptobind_content_signature)) {
      return { ok: false, reason: 'content_mismatch' }
    }
  }

  return { ok: true }
}

// ===========================================================================
// Compose (in-platform stitching) bindings -- v1s. Integrity dimension only;
// no patent claim asserted here (that is the patent attorney's domain). Extends
// the per-clip v1/v1c chain to a COMPOSED final video. Two stages:
//   request  (v1sr) -- stamped at compose-request time (lib/studio createRender).
//                      Binds pid+tid+renderId+EDL hash+source-signature bundle.
//                      EDL and sources are fully known up front.
//   content  (v1sc) -- stamped by the worker once the final artifact exists.
//                      Binds renderId+tid+sha256(final bytes).
// At submission verifyComposeBind() recomputes the EDL hash and source bundle
// from the live data and checks both signatures, so neither the edit list nor
// the set of source clips can be altered after the fact without the secret.
// Mirrors oxxovo-studio/src/cryptobind.ts -- keep byte-for-byte in lockstep.
// ===========================================================================

const COMPOSE_REQUEST_VERSION = 'v1sr'
const COMPOSE_CONTENT_VERSION = 'v1sc'
const EDL_VERSION = 'edl1'

export type EdlSegment = { jobId: string; startMs: number; endMs: number }

// Canonical EDL string. Order IS the sequence; startMs/endMs encode trim + cut.
export function edlCanonicalString(edl: EdlSegment[]): string {
  return [EDL_VERSION, ...edl.map((s) => `${s.jobId}:${s.startMs}:${s.endMs}`)].join('|')
}

function sha256Hex(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex')
}

export function computeEdlHash(edl: EdlSegment[]): string {
  return sha256Hex(edlCanonicalString(edl))
}

// Bundle = sha256 over the source clips' generation-time signatures (sorted,
// joined). Pins the composition to EXACTLY those bound source clips.
export function computeSourceBundle(sourceSignatures: string[]): string {
  return sha256Hex([...sourceSignatures].sort().join('|'))
}

function composeRequestCanonical(i: {
  pid: string
  tid: string
  renderId: string
  edlHash: string
  sourceBundle: string
}): string {
  return [COMPOSE_REQUEST_VERSION, i.pid, i.tid, i.renderId, i.edlHash, i.sourceBundle].join('|')
}

function composeContentCanonical(i: { renderId: string; tid: string; finalHash: string }): string {
  return [COMPOSE_CONTENT_VERSION, i.renderId, i.tid, i.finalHash].join('|')
}

export interface ComposeRequestFields {
  cryptobind_edl_hash: string
  cryptobind_source_bundle: string
  cryptobind_render_signature: string
}

// Request stage: columns to insert with a new render_jobs row.
export function buildComposeRequestBind(i: {
  pid: string
  tid: string
  renderId: string
  edl: EdlSegment[]
  sourceSignatures: string[]
}): ComposeRequestFields {
  const edlHash = computeEdlHash(i.edl)
  const sourceBundle = computeSourceBundle(i.sourceSignatures)
  return {
    cryptobind_edl_hash: edlHash,
    cryptobind_source_bundle: sourceBundle,
    cryptobind_render_signature: sign(
      composeRequestCanonical({ pid: i.pid, tid: i.tid, renderId: i.renderId, edlHash, sourceBundle }),
    ),
  }
}

export interface ComposeContentFields {
  cryptobind_final_hash: string
  cryptobind_final_signature: string
}

// Content stage: worker stamps these once the final video exists.
export function buildComposeContentBind(i: {
  renderId: string
  tid: string
  finalHash: string
}): ComposeContentFields {
  return {
    cryptobind_final_hash: i.finalHash,
    cryptobind_final_signature: sign(composeContentCanonical(i)),
  }
}

export type ComposeVerifyResult =
  | { ok: true }
  | {
      ok: false
      reason: 'unsupported_algo' | 'tid_mismatch' | 'render_sig_mismatch' | 'final_missing' | 'final_sig_mismatch'
    }

// Submission verify: recompute EDL hash + source bundle from live data, confirm
// the request signature, then confirm the worker's content signature. The caller
// MUST separately verify each source clip's own v1/v1c CryptoBind + ownership.
export function verifyComposeBind(
  row: {
    id: string
    cryptobind_pid: string
    cryptobind_tid: string
    cryptobind_algo: string
    cryptobind_render_signature: string
    cryptobind_final_hash?: string | null
    cryptobind_final_signature?: string | null
    edl: EdlSegment[]
  },
  expectedTid: string,
  sourceSignatures: string[],
): ComposeVerifyResult {
  if (row.cryptobind_algo !== CRYPTOBIND_ALGO) return { ok: false, reason: 'unsupported_algo' }
  if (row.cryptobind_tid !== expectedTid) return { ok: false, reason: 'tid_mismatch' }

  const edlHash = computeEdlHash(row.edl)
  const sourceBundle = computeSourceBundle(sourceSignatures)
  const expectedReq = sign(
    composeRequestCanonical({
      pid: row.cryptobind_pid,
      tid: row.cryptobind_tid,
      renderId: row.id,
      edlHash,
      sourceBundle,
    }),
  )
  if (!safeEqualHex(expectedReq, row.cryptobind_render_signature)) {
    return { ok: false, reason: 'render_sig_mismatch' }
  }

  if (!row.cryptobind_final_hash || !row.cryptobind_final_signature) {
    return { ok: false, reason: 'final_missing' }
  }
  const expectedFinal = sign(
    composeContentCanonical({ renderId: row.id, tid: row.cryptobind_tid, finalHash: row.cryptobind_final_hash }),
  )
  if (!safeEqualHex(expectedFinal, row.cryptobind_final_signature)) {
    return { ok: false, reason: 'final_sig_mismatch' }
  }
  return { ok: true }
}
