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
const EDL_VERSION_V1 = 'edl1'
const EDL_VERSION_V2 = 'edl2'

export type EdlSegment = { jobId: string; startMs: number; endMs: number }

// ---------------------------------------------------------------------------
// EDL v2 -- adds in-platform effects to the composition (Genesis Rule redefined:
// grade / LUT / transitions / stylize are creator skill, all in-platform). The
// signed canonical string covers EVERY effect param, so the render must match the
// request byte-for-byte (determinism = same EDL -> same render -> same signature).
// v1 (bare {jobId,startMs,endMs}[]) stays valid; v2 is the {version,segments,
// transitions,global} object. Both repos mirror THIS serialization exactly (KAT).
// ---------------------------------------------------------------------------

// Effect params. Integer sliders (neutral = 0, so 0/absent are the SAME canonical
// -- never signature-visible). `lut` is an enum id (''/absent = none). Extend by
// APPENDING to EFFECT_KEYS (never reorder -- order is part of the signature).
export type EffectParams = {
  exposure?: number
  contrast?: number
  saturation?: number
  temperature?: number
  tint?: number
  lut?: string
  lutIntensity?: number
  grain?: number
  vignette?: number
  glow?: number
  motionBlur?: number
  sharpen?: number
  chromatic?: number
}

// Fixed order -- part of the canonical signature. APPEND-ONLY.
const EFFECT_KEYS: readonly (keyof EffectParams)[] = [
  'exposure', 'contrast', 'saturation', 'temperature', 'tint',
  'lut', 'lutIntensity', 'grain', 'vignette', 'glow', 'motionBlur', 'sharpen', 'chromatic',
]

// `fit` = how the clip fills the output canvas when its aspect differs from the
// chosen output aspect. 'contain' (default/absent) = letterbox (no loss);
// 'cover' = center-crop to fill. Per-clip (TK 2026-07-23).
export type SegmentEffect = EdlSegment & { speed?: number; effects?: EffectParams; fit?: 'contain' | 'cover' }
export type Transition = { afterIndex: number; type: string; durationMs: number }

// Text/title overlay layer (creator copy -- NOT an external asset, so Genesis-OK).
// Coords/size are NORMALIZED (fraction of the render canvas) so they are aspect-
// agnostic (9:16 / 16:9). Rendered authoritatively by the worker (skia canvas ->
// ffmpeg overlay); the preview mirrors it with the SAME font + layout (parity).
export type TextLayer = {
  content: string        // the text; may be multi-line ('\n')
  font: string           // allowlisted font id (e.g. 'pretendard')
  sizePct: number        // font size as % of canvas height
  color: string          // '#rrggbb'
  strokeColor?: string   // '#rrggbb' outline for legibility over video
  strokePct?: number     // outline width as % of font size
  align: string          // 'left' | 'center' | 'right'
  xNorm: number          // 0..1 anchor x (fraction of canvas width)
  yNorm: number          // 0..1 anchor y (fraction of canvas height)
  startMs: number        // shown from (composition-global ms)
  endMs: number          // shown until
  fadeInMs?: number
  fadeOutMs?: number
}

// Music bed (platform library track or in-platform AI generation -- NEVER an
// upload). `assetId` -> studio_music_assets (signed like a source clip, so the bed
// can't be swapped after signing). volume/clipVolume are the balance (0..100%).
export type MusicBed = {
  assetId: string
  source: 'library' | 'ai'
  volume: number      // bed gain, 0..100 (%)
  clipVolume: number  // original clip-audio gain, 0..100 (%)
  startMs?: number    // bed starts at this composition time (default 0)
  endMs?: number      // bed ends (default = composition end)
  fadeInMs?: number
  fadeOutMs?: number
}

export type ComposeEdl = {
  version: 2
  segments: SegmentEffect[]
  transitions?: Transition[]
  global?: EffectParams
  texts?: TextLayer[]
  // Output aspect ratio. Absent = legacy (canvas follows the smallest source).
  aspect?: '16:9' | '9:16'
  // Music bed. Absent = clip audio only (unchanged).
  music?: MusicBed
}

// Canonical, minimal effect string: only non-neutral params, in EFFECT_KEYS order.
// Numbers are rounded to integers (slider grid) so preview/store/render never drift
// a float and break the signature.
function effectsCanonical(e?: EffectParams): string {
  if (!e) return ''
  const parts: string[] = []
  for (const k of EFFECT_KEYS) {
    const v = e[k]
    if (v === undefined || v === null || v === '') continue
    if (typeof v === 'number') {
      const r = Math.round(v)
      if (r === 0) continue // neutral == absent
      parts.push(`${k}=${r}`)
    } else {
      parts.push(`${k}=${v}`)
    }
  }
  return parts.join(',')
}

function segCanonical(s: SegmentEffect): string {
  let out = `${s.jobId}:${s.startMs}:${s.endMs}`
  if (s.speed !== undefined && Math.round(s.speed * 1000) !== 1000) out += `;spd=${Math.round(s.speed * 1000)}`
  const fx = effectsCanonical(s.effects)
  if (fx) out += `;fx=${fx}`
  // APPEND-ONLY: only the non-default 'cover' is signature-visible, so every
  // existing segment (contain/absent) keeps its exact canonical + hash.
  if (s.fit === 'cover') out += ';fit=cover'
  return out
}

// Canonical text layer. Fixed field order (part of the signature -- APPEND-ONLY).
// content is percent-encoded so it can never collide with the ':'/'|' separators
// (and encodeURIComponent is byte-identical in both repos' JS). Numbers ride a
// fixed grid (0.1% / 1‰) so preview/store/render never drift a float.
function textCanonical(x: TextLayer): string {
  return [
    encodeURIComponent(x.content),
    x.font,
    Math.round(x.sizePct * 10),
    x.color,
    x.strokeColor ?? '',
    Math.round((x.strokePct ?? 0) * 10),
    x.align,
    Math.round(x.xNorm * 1000),
    Math.round(x.yNorm * 1000),
    Math.round(x.startMs),
    Math.round(x.endMs),
    Math.round(x.fadeInMs ?? 0),
    Math.round(x.fadeOutMs ?? 0),
  ].join(':')
}

function textsCanonical(texts: TextLayer[]): string {
  return texts
    .slice()
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs || a.content.localeCompare(b.content))
    .map(textCanonical)
    .join('|')
}

// Canonical music bed. Fixed field order (part of the signature -- APPEND-ONLY).
// assetId percent-encoded (never collides with ':'); volumes/times on the integer
// grid so preview/store/render never drift.
function musicCanonical(m: MusicBed): string {
  return [
    encodeURIComponent(m.assetId),
    m.source,
    Math.round(m.volume),
    Math.round(m.clipVolume),
    Math.round(m.startMs ?? 0),
    Math.round(m.endMs ?? 0),
    Math.round(m.fadeInMs ?? 0),
    Math.round(m.fadeOutMs ?? 0),
  ].join(':')
}

function edlCanonicalStringV2(edl: ComposeEdl): string {
  const segs = edl.segments.map(segCanonical).join('|')
  const trans = (edl.transitions ?? [])
    .slice()
    .sort((a, b) => a.afterIndex - b.afterIndex || a.type.localeCompare(b.type))
    .map((tr) => `${tr.type}@${tr.afterIndex}:${Math.round(tr.durationMs)}`)
    .join('|')
  const base = [EDL_VERSION_V2, segs, `T:${trans}`, `G:${effectsCanonical(edl.global)}`]
  // APPEND-ONLY: the TX section is added ONLY when texts exist, so every existing
  // text-free v2 EDL keeps its exact canonical string + hash (KAT/signatures stay).
  if (edl.texts && edl.texts.length) base.push(`TX:${textsCanonical(edl.texts)}`)
  // APPEND-ONLY: AR section only when an output aspect is chosen, so aspect-free
  // EDLs keep their exact canonical + hash.
  if (edl.aspect) base.push(`AR:${edl.aspect}`)
  // APPEND-ONLY: MU section only when a music bed is set, so music-free EDLs keep
  // their exact canonical + hash.
  if (edl.music) base.push(`MU:${musicCanonical(edl.music)}`)
  return base.join('||')
}

// Canonical EDL string. Order IS the sequence; startMs/endMs encode trim + cut;
// v2 additionally encodes per-segment speed + effects, transitions, global grade.
export function edlCanonicalString(edl: EdlSegment[] | ComposeEdl): string {
  if (Array.isArray(edl)) return [EDL_VERSION_V1, ...edl.map((s) => `${s.jobId}:${s.startMs}:${s.endMs}`)].join('|')
  return edlCanonicalStringV2(edl)
}

function sha256Hex(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex')
}

export function computeEdlHash(edl: EdlSegment[] | ComposeEdl): string {
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
  edl: EdlSegment[] | ComposeEdl
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
//
// ★`requireFinal` exists for asynchronous submission (72h window + 24h processing
// buffer). The two halves of this check become available at DIFFERENT times:
//   v1sr (request)  -- signed by createRender, so it exists BEFORE the render;
//   v1sc (content)  -- stamped by the worker, so it exists only AFTER the render.
// Accepting a submission at the deadline therefore verifies v1sr (requireFinal
// false) and the finalize pass verifies both once the render lands. NOTHING about
// the signatures changes -- no new canonical string, no new signature, worker
// untouched. Only WHEN each half is checked moves. Default stays true so every
// existing caller keeps the strict behaviour.
export function verifyComposeBind(
  row: {
    id: string
    cryptobind_pid: string
    cryptobind_tid: string
    cryptobind_algo: string
    cryptobind_render_signature: string
    cryptobind_final_hash?: string | null
    cryptobind_final_signature?: string | null
    edl: EdlSegment[] | ComposeEdl
  },
  expectedTid: string,
  sourceSignatures: string[],
  opts: { requireFinal?: boolean } = {},
): ComposeVerifyResult {
  const requireFinal = opts.requireFinal ?? true
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
    // Not yet rendered. At intent time that is the expected state; at finalize time
    // it means the sweep ran too early and the caller must retry, never accept.
    return requireFinal ? { ok: false, reason: 'final_missing' } : { ok: true }
  }
  // A final signature that is PRESENT is always checked, even at intent time: if the
  // render already landed there is no reason to look at less evidence than we have.
  const expectedFinal = sign(
    composeContentCanonical({ renderId: row.id, tid: row.cryptobind_tid, finalHash: row.cryptobind_final_hash }),
  )
  if (!safeEqualHex(expectedFinal, row.cryptobind_final_signature)) {
    return { ok: false, reason: 'final_sig_mismatch' }
  }
  return { ok: true }
}

// ===========================================================================
// Music-asset binding (v1m) -- a music bed (platform library track OR in-platform
// AI generation, NEVER an upload) is signed like a source clip so the EDL's
// music.assetId cannot be repointed to different audio after signing. Content-hash
// based (like v1c): binds assetId + source to the EXACT audio bytes. Stamped when
// the asset's audio exists (library seed / AI worker download); the asset's
// signature is folded into the compose-request SOURCE BUNDLE (computeSourceBundle)
// so swapping the bed breaks the render signature (render_sig_mismatch). No tid/pid
// in the canonical -- library beds are cross-season/platform-owned; the anti-swap
// binding is assetId <-> content only. Mirrors oxxovo-studio/src/cryptobind.ts.
// ===========================================================================
const MUSIC_ASSET_VERSION = 'v1m'

export function musicAssetCanonicalString(i: { assetId: string; source: string; contentHash: string }): string {
  return [MUSIC_ASSET_VERSION, i.assetId, i.source, i.contentHash].join('|')
}

// sha256 over the audio bytes -- identical to the worker copy.
export function hashMusicAsset(buffer: Buffer | Uint8Array): string {
  return createHash('sha256').update(buffer).digest('hex')
}

export interface MusicAssetBindFields {
  cryptobind_content_hash: string
  cryptobind_signature: string
  cryptobind_generated_at: string
  cryptobind_algo: string
}

// Build the signing columns for a music asset (library seed / AI worker download).
export function buildMusicAssetBind(i: {
  assetId: string
  source: string
  contentHash: string
  generatedAt: Date
}): MusicAssetBindFields {
  return {
    cryptobind_content_hash: i.contentHash,
    cryptobind_signature: sign(
      musicAssetCanonicalString({ assetId: i.assetId, source: i.source, contentHash: i.contentHash }),
    ),
    cryptobind_generated_at: i.generatedAt.toISOString(),
    cryptobind_algo: CRYPTOBIND_ALGO,
  }
}

export type MusicAssetVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported_algo' | 'signature_mismatch' | 'content_missing' }

// Verify a music asset's v1m signature. Pass a freshly-computed `contentHash`
// (worker, from the downloaded bytes) to ALSO prove the audio is intact: a
// repointed r2_key or tampered bytes change the hash, so the recomputed signature
// no longer matches the stored one. The app (request time, no bytes) omits it and
// only checks the row is self-consistent.
export function verifyMusicAssetBind(
  row: {
    id: string
    source: string
    cryptobind_content_hash?: string | null
    cryptobind_signature?: string | null
    cryptobind_algo?: string | null
  },
  contentHash?: string,
): MusicAssetVerifyResult {
  if (row.cryptobind_algo !== CRYPTOBIND_ALGO) return { ok: false, reason: 'unsupported_algo' }
  const hash = contentHash ?? row.cryptobind_content_hash
  if (!hash || !row.cryptobind_signature) return { ok: false, reason: 'content_missing' }
  const expected = sign(musicAssetCanonicalString({ assetId: row.id, source: row.source, contentHash: hash }))
  if (!safeEqualHex(expected, row.cryptobind_signature)) return { ok: false, reason: 'signature_mismatch' }
  return { ok: true }
}

// ===========================================================================
// Image / i2v bindings (v1i / v1ic / v1v) -- Stage 3 AI-actor extension.
// Mirrors oxxovo-studio/src/cryptobind.ts byte-for-byte in the CANONICAL / HASH
// / BUILD region (only the secret injection differs: here sign() reads the
// secret internally, the worker copy takes it as an argument). Verify functions
// are main-app only, exactly like verifyComposeBind.
//   v1i  -- platform-generated IMAGE generation signature (v1 without duration).
//   v1ic -- image content hash (worker-stamped, verified here) -- v1c for images.
//   v1v  -- i2v generation signature = v1 + parentBundle, binding the clip to
//           EXACTLY the parent images (start_image + elements) it was built from.
//           The i2v output is a video, so its CONTENT binding stays v1c.
// ===========================================================================

const IMAGE_CANON_VERSION = 'v1i'
const IMAGE_CONTENT_VERSION = 'v1ic'
const I2V_CANON_VERSION = 'v1v'

export interface ImageBindInput {
  jobId: string
  pid: string
  tid: string
  modelId: string
  generatedAt: Date
}

export interface I2vBindInput {
  jobId: string
  pid: string
  tid: string
  modelId: string
  durationSeconds: number
  generatedAt: Date
  parentBundle: string
}

export interface ImageContentBindFields {
  cryptobind_content_hash: string
  cryptobind_content_signature: string
}

export interface I2vBindFields extends CryptoBindFields {
  cryptobind_parent_bundle: string
}

// v1i canonical -- v1 without duration (images have none).
export function imageCanonicalString(i: ImageBindInput): string {
  return [IMAGE_CANON_VERSION, i.pid, i.tid, i.jobId, i.generatedAt.toISOString(), i.modelId].join('|')
}

// v1ic canonical -- image content. Worker stamps, main verifies -> byte-mirror.
function imageContentCanonicalString(i: { jobId: string; tid: string; contentHash: string }): string {
  return [IMAGE_CONTENT_VERSION, i.jobId, i.tid, i.contentHash].join('|')
}

// v1v canonical -- v1 plus the parentBundle that pins the parent images.
export function i2vCanonicalString(i: I2vBindInput): string {
  return [
    I2V_CANON_VERSION,
    i.pid,
    i.tid,
    i.jobId,
    i.generatedAt.toISOString(),
    i.modelId,
    String(i.durationSeconds),
    i.parentBundle,
  ].join('|')
}

// sha256 over image bytes -- identical to the worker copy.
export function hashImageContent(buffer: Buffer | Uint8Array): string {
  return createHash('sha256').update(buffer).digest('hex')
}

// Generation-time (main, enqueue): image signature columns.
export function buildImageBind(i: ImageBindInput): CryptoBindFields {
  return {
    cryptobind_pid: i.pid,
    cryptobind_tid: i.tid,
    cryptobind_generated_at: i.generatedAt.toISOString(),
    cryptobind_signature: sign(imageCanonicalString(i)),
    cryptobind_algo: CRYPTOBIND_ALGO,
  }
}

// Content stage for an image (mirrored; the worker actually stamps these).
export function buildImageContentBind(i: { jobId: string; tid: string; contentHash: string }): ImageContentBindFields {
  return {
    cryptobind_content_hash: i.contentHash,
    cryptobind_content_signature: sign(imageContentCanonicalString(i)),
  }
}

// Generation-time (main, enqueue): i2v signature columns (includes parentBundle).
export function buildI2vBind(i: I2vBindInput): I2vBindFields {
  return {
    cryptobind_pid: i.pid,
    cryptobind_tid: i.tid,
    cryptobind_generated_at: i.generatedAt.toISOString(),
    cryptobind_signature: sign(i2vCanonicalString(i)),
    cryptobind_algo: CRYPTOBIND_ALGO,
    cryptobind_parent_bundle: i.parentBundle,
  }
}

// --- verify (main app only, same placement as verifyComposeBind) ---

// Verify a platform-generated image's v1i (+ v1ic content when the worker stamped it).
export function verifyImageBind(
  row: {
    id: string
    cryptobind_pid: string
    cryptobind_tid: string
    cryptobind_generated_at: string
    cryptobind_signature: string
    cryptobind_algo: string
    model_id: string
    cryptobind_content_hash?: string | null
    cryptobind_content_signature?: string | null
  },
  expectedTid: string,
): VerifyResult {
  if (row.cryptobind_algo !== CRYPTOBIND_ALGO) return { ok: false, reason: 'unsupported_algo' }
  if (row.cryptobind_tid !== expectedTid) return { ok: false, reason: 'tid_mismatch' }
  const expected = sign(
    imageCanonicalString({
      jobId: row.id,
      pid: row.cryptobind_pid,
      tid: row.cryptobind_tid,
      modelId: row.model_id,
      generatedAt: new Date(row.cryptobind_generated_at),
    }),
  )
  if (!safeEqualHex(expected, row.cryptobind_signature)) return { ok: false, reason: 'signature_mismatch' }
  if (row.cryptobind_content_hash || row.cryptobind_content_signature) {
    if (!row.cryptobind_content_hash || !row.cryptobind_content_signature) {
      return { ok: false, reason: 'content_mismatch' }
    }
    const expectedContent = sign(
      imageContentCanonicalString({ jobId: row.id, tid: row.cryptobind_tid, contentHash: row.cryptobind_content_hash }),
    )
    if (!safeEqualHex(expectedContent, row.cryptobind_content_signature)) {
      return { ok: false, reason: 'content_mismatch' }
    }
  }
  return { ok: true }
}

export type I2vVerifyResult =
  | { ok: true }
  | {
      ok: false
      reason: 'unsupported_algo' | 'tid_mismatch' | 'parent_bundle_mismatch' | 'signature_mismatch' | 'content_mismatch'
    }

// Verify an i2v clip's v1v. `parentSignatures` are the LIVE parent image v1i
// signatures (each parent separately verified by the caller via verifyImageBind
// + ownership + season). The parentBundle is recomputed here from those live
// signatures -- the stored column is never trusted.
export function verifyI2vBind(
  row: {
    id: string
    cryptobind_pid: string
    cryptobind_tid: string
    cryptobind_generated_at: string
    cryptobind_signature: string
    cryptobind_algo: string
    model_id: string
    duration_seconds: number
    cryptobind_parent_bundle: string
    cryptobind_content_hash?: string | null
    cryptobind_content_signature?: string | null
  },
  expectedTid: string,
  parentSignatures: string[],
): I2vVerifyResult {
  if (row.cryptobind_algo !== CRYPTOBIND_ALGO) return { ok: false, reason: 'unsupported_algo' }
  if (row.cryptobind_tid !== expectedTid) return { ok: false, reason: 'tid_mismatch' }
  const parentBundle = computeSourceBundle(parentSignatures)
  if (parentBundle !== row.cryptobind_parent_bundle) return { ok: false, reason: 'parent_bundle_mismatch' }
  const expected = sign(
    i2vCanonicalString({
      jobId: row.id,
      pid: row.cryptobind_pid,
      tid: row.cryptobind_tid,
      modelId: row.model_id,
      durationSeconds: row.duration_seconds,
      generatedAt: new Date(row.cryptobind_generated_at),
      parentBundle,
    }),
  )
  if (!safeEqualHex(expected, row.cryptobind_signature)) return { ok: false, reason: 'signature_mismatch' }
  // i2v output is a video -> content binding uses v1c (contentCanonicalString).
  if (row.cryptobind_content_hash || row.cryptobind_content_signature) {
    if (!row.cryptobind_content_hash || !row.cryptobind_content_signature) {
      return { ok: false, reason: 'content_mismatch' }
    }
    const expectedContent = sign(
      contentCanonicalString({ jobId: row.id, tid: row.cryptobind_tid, contentHash: row.cryptobind_content_hash }),
    )
    if (!safeEqualHex(expectedContent, row.cryptobind_content_signature)) {
      return { ok: false, reason: 'content_mismatch' }
    }
  }
  return { ok: true }
}
