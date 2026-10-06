// R2 access for the contents pipeline: signed PUT URLs for sources, and the
// server-side checks import needs (object exists, size, sha256 computed by us).
//
// Design SS3-2: sources never hold R2 credentials and we never fetch an
// arbitrary URL (SSRF) -- we only read keys we issued. R2 does not support
// x-amz-checksum-sha256 for whole objects, so sha256 is computed here by
// streaming (design open item #10: confirm with a real presigned PUT).
//
// This is a SEPARATE bucket from the studio worker's (HQ/TK 2026-10-05). The
// bucket name and public base come from env and are not defined here.
//
// Fail-closed: any of the five env vars missing -> r2Config() is null and the
// routes answer 503 r2_not_configured. Nothing here has a default bucket.
import 'server-only'
import { createHash } from 'node:crypto'
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { Readable } from 'node:stream'

export type R2Config = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  publicBase: string
}

export function r2Config(env: Record<string, string | undefined> = process.env): R2Config | null {
  const accountId = env.R2_ACCOUNT_ID
  const accessKeyId = env.R2_ACCESS_KEY_ID
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY
  const bucket = env.R2_BUCKET
  const publicBase = env.R2_PUBLIC_BASE
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBase) return null
  // The public base becomes part of stored asset urls: it must be https.
  if (!/^https:\/\/[^\s/]+(\/\S*)?$/.test(publicBase)) return null
  return { accountId, accessKeyId, secretAccessKey, bucket, publicBase }
}

// What import verification needs from storage. Injected so the verification
// logic is testable without R2.
export type ContentStorage = {
  head(key: string): Promise<{ bytes: number } | null>
  sha256(key: string): Promise<string>
}

function client(cfg: R2Config): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  })
}

export function r2Storage(cfg: R2Config): ContentStorage {
  const s3 = client(cfg)
  return {
    async head(key) {
      try {
        const r = await s3.send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: key }))
        return { bytes: Number(r.ContentLength ?? 0) }
      } catch (e) {
        const name = (e as { name?: string; $metadata?: { httpStatusCode?: number } })
        if (name.name === 'NotFound' || name.$metadata?.httpStatusCode === 404) return null
        throw e
      }
    },
    async sha256(key) {
      const r = await s3.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: key }))
      const body = r.Body as Readable | undefined
      if (!body) throw new Error('r2_empty_body')
      const h = createHash('sha256')
      for await (const chunk of body) h.update(chunk as Buffer)
      return h.digest('hex')
    },
  }
}

// ContentLength and ContentType are part of the signature: a PUT with a
// different size or type is rejected by R2, so the bytes the RPC recorded
// are the bytes that can be uploaded.
export async function signPutUrl(
  cfg: R2Config,
  args: { key: string; contentType: string; bytes: number; expiresInSeconds: number },
): Promise<string> {
  return getSignedUrl(
    client(cfg),
    new PutObjectCommand({ Bucket: cfg.bucket, Key: args.key, ContentType: args.contentType, ContentLength: args.bytes }),
    { expiresIn: args.expiresInSeconds },
  )
}
