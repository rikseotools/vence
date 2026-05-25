import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3'
import type {
  StorageAdapter,
  UploadInput,
  UploadResult,
  DeleteInput,
  DeleteResult,
} from './types'

// Mapeo bucket-lógico → prefijo S3 dentro del bucket único `vence-uploads`.
// Tener un solo bucket simplifica IAM y CloudFront. Cada caller pide un
// "bucket" lógico (feedback-images, user-avatars, support, etc.) y el adapter
// lo traduce a un prefijo de S3. Si en el futuro algún bucket lógico quiere
// vivir en un bucket S3 propio (por privacidad, CDN, etc.), añadir entrada
// explícita al `BUCKET_OVERRIDES` con su nombre real.
const BUCKET_OVERRIDES: Record<string, string> = {}

function getS3Client(): S3Client {
  return new S3Client({
    region: process.env.AWS_S3_REGION ?? 'eu-west-2',
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined, // En Fargate usa el task role; Vercel usa env creds.
  })
}

function resolveS3Bucket(logicalBucket: string): { bucket: string; key: (p: string) => string } {
  if (BUCKET_OVERRIDES[logicalBucket]) {
    return {
      bucket: BUCKET_OVERRIDES[logicalBucket],
      key: (p) => p,
    }
  }
  // Único bucket — prefijo es el nombre lógico
  return {
    bucket: process.env.AWS_S3_BUCKET ?? 'vence-uploads',
    key: (p) => `${logicalBucket}/${p}`,
  }
}

function publicUrlFor(bucket: string, key: string): string {
  const region = process.env.AWS_S3_REGION ?? 'eu-west-2'
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodeURI(key)}`
}

export class S3StorageAdapter implements StorageAdapter {
  readonly provider = 's3' as const

  async upload(input: UploadInput): Promise<UploadResult> {
    const { bucket, key } = resolveS3Bucket(input.bucket)
    const fullKey = key(input.path)
    const client = getS3Client()

    const body =
      input.data instanceof ArrayBuffer
        ? new Uint8Array(input.data)
        : input.data

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: fullKey,
          Body: body,
          ContentType: input.contentType,
          CacheControl: input.cacheControl ?? 'max-age=3600',
        }),
      )
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'S3 upload failed',
      }
    }

    return {
      success: true,
      publicUrl: publicUrlFor(bucket, fullKey),
      path: input.path,
    }
  }

  async remove(input: DeleteInput): Promise<DeleteResult> {
    const { bucket, key } = resolveS3Bucket(input.bucket)
    const client = getS3Client()

    try {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: input.paths.map((p) => ({ Key: key(p) })),
            Quiet: true,
          },
        }),
      )
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'S3 delete failed',
      }
    }

    return { success: true }
  }

  getPublicUrl(logicalBucket: string, path: string): string {
    const { bucket, key } = resolveS3Bucket(logicalBucket)
    return publicUrlFor(bucket, key(path))
  }
}
