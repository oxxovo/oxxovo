// Compose source-clip CryptoBind routing -- the PURE core shared by createRender
// + submitRender (via lib/studio verifySourceCryptoBind). Kept dependency-free
// (only cryptobind) so the routing + regression can be unit-tested without the DB
// / '@/' import graph. The DB work (loading parents, own/season/ready checks)
// stays in lib/studio; here we only decide the path and run the signature checks.
//
//   normal clip (no parent images)  -> v1/v1c  (EXACT existing path -- no regression)
//   i2v clip (media_type=video + parents) -> each parent v1i/v1ic, parentBundle
//                                            recomputed from live parent sigs, v1v
import { verifyCryptoBind, verifyImageBind, verifyI2vBind } from './cryptobind'

// `getParent(id)` returns the parent image row ALREADY validated for own/season/
// ready/image by the caller (lib/studio loadOwnedReadyImages), or undefined.
export function verifySourceClipCrypto(
  row: any,
  expectedTid: string,
  getParent: (id: string) => any | undefined,
): { ok: true; signature: string } | { ok: false; detail: string } {
  const parents = ((row.parent_image_job_ids as string[] | null) ?? []) as string[]
  if (row.media_type === 'video' && parents.length > 0) {
    const parentSignatures: string[] = []
    for (const pid of [...new Set(parents)]) {
      const p = getParent(pid)
      if (!p) return { ok: false, detail: `parent not_found ${pid}` }
      if (p.media_type !== 'image') return { ok: false, detail: `parent not_image ${pid}` }
      const pv = verifyImageBind(p, expectedTid)
      if (!pv.ok) return { ok: false, detail: `parent ${pid}: ${pv.reason}` }
      parentSignatures.push(String(p.cryptobind_signature))
    }
    const iv = verifyI2vBind(row, expectedTid, parentSignatures)
    if (!iv.ok) return { ok: false, detail: `i2v ${iv.reason}` }
    return { ok: true, signature: String(row.cryptobind_signature) }
  }
  // Parent-less clip: byte-for-byte the old verifyCryptoBind path.
  const v = verifyCryptoBind(row, expectedTid)
  if (!v.ok) return { ok: false, detail: v.reason }
  return { ok: true, signature: String(row.cryptobind_signature) }
}
