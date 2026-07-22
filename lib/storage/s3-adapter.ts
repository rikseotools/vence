import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import type {
  StorageAdapter,
  UploadInput,
  UploadResult,
  DeleteInput,
  DeleteResult,
  DownloadInput,
  DownloadResult,
} from './types'

// Mapeo bucket-lógico → prefijo S3 dentro del bucket único `vence-uploads`.
// Tener un solo bucket simplifica IAM y CloudFront. Cada caller pide un
// "bucket" lógico (feedback-images, user-avatars, support, etc.) y el adapter
// lo traduce a un prefijo de S3. Si en el futuro algún bucket lógico quiere
// vivir en un bucket S3 propio (por privacidad, CDN, etc.), añadir entrada
// explícita al `BUCKET_OVERRIDES` con su nombre real.
const BUCKET_OVERRIDES: Record<string, string> = {}

// Endpoint S3-compatible OPCIONAL (MinIO, o el object storage de koigrid, etc.). Vacío = AWS S3
// nativo (comportamiento por defecto, sin cambios). Se lee inline (no como const de módulo) para
// respetar el env de runtime. Habilita mover el storage a koigrid sin reescribir el adapter: basta
// poner AWS_S3_ENDPOINT + las credenciales/bucket de ese proveedor. Ver T-086 Fase D.
function s3Endpoint(): string | undefined {
  const e = process.env.AWS_S3_ENDPOINT?.trim()
  return e ? e.replace(/\/$/, '') : undefined
}

function getS3Client(): S3Client {
  const endpoint = s3Endpoint()
  return new S3Client({
    region: process.env.AWS_S3_REGION ?? 'eu-west-2',
    // Con endpoint custom se fuerza path-style (bucket en la ruta, no en el host): lo requieren
    // casi todos los S3-compatibles. Se puede desactivar con AWS_S3_FORCE_PATH_STYLE=false.
    ...(endpoint ? { endpoint, forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE !== 'false' } : {}),
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
  const endpoint = s3Endpoint()
  if (endpoint) {
    // Endpoint S3-compatible (path-style): <endpoint>/<bucket>/<key>. Si el storage vive detrás de
    // un CDN/dominio propio, exportar AWS_S3_PUBLIC_BASE con esa base.
    const base = process.env.AWS_S3_PUBLIC_BASE?.trim().replace(/\/$/, '') || `${endpoint}/${bucket}`
    return `${base}/${encodeURI(key)}`
  }
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

  async download(input: DownloadInput): Promise<DownloadResult> {
    const { bucket, key } = resolveS3Bucket(input.bucket)
    const fullKey = key(input.path)
    const client = getS3Client()

    try {
      const res = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: fullKey }),
      )
      // El Body es un stream (Node) → lo materializamos a Buffer. transformToByteArray
      // es la API estable del SDK v3 para esto (server-side).
      const bytes = await res.Body?.transformToByteArray()
      if (!bytes) return { success: false, error: 'empty body' }
      return {
        success: true,
        data: Buffer.from(bytes),
        contentType: res.ContentType,
      }
    } catch (err) {
      const name = (err as { name?: string })?.name
      // NoSuchKey / NotFound = miss NORMAL de caché, no un error de infra.
      const notFound = name === 'NoSuchKey' || name === 'NotFound'
      return {
        success: false,
        error: err instanceof Error ? err.message : 'S3 download failed',
        notFound,
      }
    }
  }
}
