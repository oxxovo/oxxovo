// Import-time verification of uploaded objects (EOD 2026-10-05 SS8 item 6).
//
// The RPC only checks that a key matches a presign record. That a real object
// sits behind it, with the size and sha256 the source claims, is checked here
// BEFORE content_import -- otherwise an object that was never uploaded (or
// was swapped) gets imported.
//
// sha256 is computed by us from the stored bytes and compared to the claim;
// the claim is never trusted. Pure over an injected ContentStorage.
import type { ContentStorage } from '@/lib/content-r2'
import type { ParsedAsset } from '@/lib/content-import'

export type VerifyFail = { ok: false; status: 422; code: string }

export async function verifyUploadedAssets(
  assets: readonly ParsedAsset[],
  storage: ContentStorage,
): Promise<{ ok: true } | VerifyFail> {
  for (const a of assets) {
    if (a.media_type === 'text') continue // text assets live in the row, no object
    const tag = a.role
    if (!a.key || !a.sha256 || a.bytes === null) return { ok: false, status: 422, code: `asset_invalid:${tag}` }

    const head = await storage.head(a.key)
    if (!head) return { ok: false, status: 422, code: `asset_not_uploaded:${tag}` }
    if (head.bytes !== a.bytes) return { ok: false, status: 422, code: `asset_size_mismatch:${tag}` }

    // Cheap size check first; the expensive full read only when it can pass.
    const actual = await storage.sha256(a.key)
    if (actual !== a.sha256) return { ok: false, status: 422, code: `asset_sha256_mismatch:${tag}` }
  }
  return { ok: true }
}
