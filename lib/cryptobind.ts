// CryptoBind (Patent 1) -- main-app mirror of oxxovo-studio/src/cryptobind.ts.
// SERVER ONLY. MUST stay byte-for-byte compatible with the worker copy: same
// canonical string, same algorithm, same STUDIO_CRYPTOBIND_SECRET. A signature
// produced at generation (worker/enqueue) verifies here at submission.

import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'

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
