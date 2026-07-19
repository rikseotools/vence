// Resolución de la URL firmada del vídeo de curso, con seam de proveedor.
//
// Por defecto usa la Supabase Storage self-hosted (bucket `videos-premium`),
// comportamiento histórico. Si están configuradas las env de koigrid
// (`KOIGRID_VIDEO_BUCKET` + creds), genera un **presigned GET contra koigrid**
// (S3/MinIO en Hetzner, egress gratis) — verificado que sirve 206 Range +
// content-type video/mp4 + faststart. Flag-gated → migración reversible: quitar
// las env vuelve a Supabase sin redeploy de código.
//
// El presign se hace con **AWS SigV4 a mano** (solo `crypto` de Node) para NO
// añadir dependencias npm (evita drift del package-lock). Algoritmo estándar
// AWS4-HMAC-SHA256, path-style (MinIO), UNSIGNED-PAYLOAD.
//
// Ver tarea backlog "vídeos cursos" (koigrid + faststart).

import { createHash, createHmac } from 'crypto'

const SIGNED_URL_TTL = 3600 // 1 hora

interface KoigridConfig {
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  endpoint: string // sin barra final, p.ej. https://s3.koigrid.com
  region: string
}

function getKoigridConfig(): KoigridConfig | null {
  const bucket = process.env.KOIGRID_VIDEO_BUCKET
  const accessKeyId = process.env.KOIGRID_VIDEO_ACCESS_KEY
  const secretAccessKey = process.env.KOIGRID_VIDEO_SECRET_KEY
  if (!bucket || !accessKeyId || !secretAccessKey) return null
  const endpoint = (process.env.KOIGRID_VIDEO_ENDPOINT ?? 'https://s3.koigrid.com').replace(/\/+$/, '')
  const region = process.env.KOIGRID_VIDEO_REGION ?? 'us-east-1'
  return { bucket, accessKeyId, secretAccessKey, endpoint, region }
}

// Codificación RFC-3986 al estilo AWS: sin tocar A-Za-z0-9-_.~; el resto %XX en mayúsculas.
// `encodeSlash=false` preserva las `/` de la ruta del objeto (path-style con subcarpetas).
function awsUriEncode(str: string, encodeSlash = true): string {
  let out = ''
  for (const ch of Buffer.from(str, 'utf8')) {
    const c = String.fromCharCode(ch)
    if ((ch >= 0x41 && ch <= 0x5a) || (ch >= 0x61 && ch <= 0x7a) || (ch >= 0x30 && ch <= 0x39) ||
        c === '-' || c === '_' || c === '.' || c === '~') {
      out += c
    } else if (c === '/' && !encodeSlash) {
      out += '/'
    } else {
      out += '%' + ch.toString(16).toUpperCase().padStart(2, '0')
    }
  }
  return out
}

const sha256hex = (data: string): string => createHash('sha256').update(data, 'utf8').digest('hex')
const hmac = (key: Buffer | string, data: string): Buffer => createHmac('sha256', key).update(data, 'utf8').digest()

// amzDate 'YYYYMMDDTHHMMSSZ' y dateStamp 'YYYYMMDD' desde una fecha UTC.
function amzDates(now: Date): { amzDate: string; dateStamp: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '') // 20260717T101112Z
  return { amzDate: iso, dateStamp: iso.slice(0, 8) }
}

/** Presigned GET (SigV4) path-style contra koigrid/MinIO. */
function presignKoigridGet(cfg: KoigridConfig, key: string, expiresIn: number): string {
  const host = new URL(cfg.endpoint).host
  const { amzDate, dateStamp } = amzDates(new Date())
  const credentialScope = `${dateStamp}/${cfg.region}/s3/aws4_request`
  const canonicalUri = `/${awsUriEncode(cfg.bucket, false)}/${awsUriEncode(key, false)}`

  const q: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${cfg.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': 'host',
  }
  const canonicalQuery = Object.keys(q)
    .sort()
    .map((k) => `${awsUriEncode(k)}=${awsUriEncode(q[k])}`)
    .join('&')

  const canonicalHeaders = `host:${host}\n`
  const canonicalRequest = [
    'GET',
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n')

  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256hex(canonicalRequest)].join('\n')

  const kDate = hmac('AWS4' + cfg.secretAccessKey, dateStamp)
  const kRegion = hmac(kDate, cfg.region)
  const kService = hmac(kRegion, 's3')
  const kSigning = hmac(kService, 'aws4_request')
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex')

  return `${cfg.endpoint}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`
}

export interface VideoUrlResult {
  signedUrl: string | null
  provider: 'koigrid' | 'supabase'
  error?: string
}

/** Fallback a Supabase Storage, inyectado por el caller (que ya tiene su cliente). */
export type SupabaseSignedUrlFn = (
  videoPath: string,
  ttlSeconds: number,
) => Promise<{ signedUrl: string | null; error?: string }>

/**
 * Devuelve una URL firmada (1h) para `videoPath`. koigrid si está configurado, si no Supabase.
 * El fallback de Supabase se **inyecta** (`supabaseFallback`) para no crear aquí un cliente
 * service-role (barrera agnóstica del guardrail) y reutilizar el cliente del caller.
 */
export async function resolveVideoSignedUrl(
  videoPath: string,
  supabaseFallback: SupabaseSignedUrlFn,
): Promise<VideoUrlResult> {
  const cfg = getKoigridConfig()
  if (cfg) {
    try {
      const url = presignKoigridGet(cfg, videoPath, SIGNED_URL_TTL)
      return { signedUrl: url, provider: 'koigrid' }
    } catch (e) {
      // Fallback resiliente: si el presign koigrid falla, no dejar al premium sin vídeo → Supabase.
      console.error('⚠️ [videoSignedUrl] koigrid presign falló, fallback a Supabase:', (e as Error).message)
    }
  }
  const { signedUrl, error } = await supabaseFallback(videoPath, SIGNED_URL_TTL)
  return { signedUrl, provider: 'supabase', error: signedUrl ? undefined : (error ?? 'no signed url') }
}
