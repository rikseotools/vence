// HLS (fase 2): la app sirve los manifiestos (texto) y reescribe los segmentos a URLs
// **presignadas** de koigrid → los .ts van directos de koigrid al reproductor (hls.js /
// HLS nativo), no por la app. Protección premium sin filtrar los segmentos.
//
// AUTH = token-capability firmado en la query (`?tk=`), NO Bearer. Motivo: iOS Safari
// (sin MSE) usa HLS nativo y NO puede añadir cabeceras a las peticiones de manifiesto;
// un token en la URL sí viaja. video-url emite el tk SOLO tras el gate premium → poseer
// un tk válido = autorizado (mismo modelo que una URL presignada). El tk lleva el
// videoPath firmado → la ruta no toca la BD (stateless, rápido, cacheable a nivel edge).
//
// Origen HLS en koigrid: hls/<slug>/<bloque>/{master.m3u8,<q>/index.m3u8,<q>/seg_*.ts}.

import { createHmac } from 'crypto'
import { presignKoigridKey } from './videoSignedUrl'

const MANIFEST_TTL = 3600
const SEGMENT_TTL = 3600
export const HLS_TOKEN_TTL = 3600 // 1h — el player recarga vía video-url al expirar

export const HLS_QUALITIES = ['1080p', '720p', '480p'] as const

/** `word-365/bloque-01.mp4` → `hls/word-365/bloque-01`. */
export function hlsBaseKeyFor(videoPath: string): string {
  return 'hls/' + videoPath.replace(/\.mp4$/i, '')
}

// ── Token-capability (HMAC sobre SUPABASE_JWT_SECRET, server-only) ────────────
function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
function hlsSecret(): string {
  const s = process.env.SUPABASE_JWT_SECRET
  if (!s) throw new Error('SUPABASE_JWT_SECRET ausente — no se puede firmar el tk HLS')
  return s
}

/** Firma un tk que autoriza el HLS de `videoPath` durante `ttlSec`. */
export function signHlsToken(videoPath: string, ttlSec: number = HLS_TOKEN_TTL): string {
  const payload = b64url(JSON.stringify({ v: videoPath, e: Math.floor(Date.now() / 1000) + ttlSec }))
  const sig = b64url(createHmac('sha256', hlsSecret()).update(payload).digest())
  return `${payload}.${sig}`
}

/** Verifica el tk. Devuelve el `videoPath` si es válido y no expiró, si no null. */
export function verifyHlsToken(tk: string | null | undefined): string | null {
  if (!tk || !tk.includes('.')) return null
  const [payload, sig] = tk.split('.')
  const expected = b64url(createHmac('sha256', hlsSecret()).update(payload).digest())
  // comparación en tiempo (aprox) constante
  if (sig.length !== expected.length) return null
  let diff = 0
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  if (diff !== 0) return null
  try {
    const { v, e } = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    if (typeof v !== 'string' || typeof e !== 'number') return null
    if (Math.floor(Date.now() / 1000) > e) return null
    return v
  } catch {
    return null
  }
}

// ── Fetch + reescritura de manifiestos ───────────────────────────────────────
/** Descarga el texto de un objeto de koigrid vía presign. null si no configurado o 404. */
export async function fetchKoigridText(key: string): Promise<string | null> {
  const url = presignKoigridKey(key, MANIFEST_TTL)
  if (!url) return null
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  return res.text()
}

/**
 * Reescribe el master.m3u8: cada playlist de variante (`720p/index.m3u8`) apunta a la
 * ruta de la app arrastrando el mismo `tk`. `apiBase` = `/api/cursos/hls/<lessonId>`.
 */
export function rewriteMaster(masterText: string, apiBase: string, tk: string): string {
  return masterText
    .split('\n')
    .map((line) => {
      const t = line.trim()
      if (!t || t.startsWith('#')) return line
      if (t.endsWith('.m3u8')) return `${apiBase}/${t}?tk=${encodeURIComponent(tk)}`
      return line
    })
    .join('\n')
}

/**
 * Reescribe una playlist de variante: cada segmento (`seg_0000.ts`) → URL presignada
 * absoluta de koigrid. `baseKey` = `hls/<slug>/<bloque>`, `quality` = `720p`.
 * null si algún segmento no se pudo presignar (koigrid no configurado).
 */
export function rewriteVariant(variantText: string, baseKey: string, quality: string): string | null {
  const out: string[] = []
  for (const line of variantText.split('\n')) {
    const t = line.trim()
    if (t && !t.startsWith('#') && t.endsWith('.ts')) {
      const signed = presignKoigridKey(`${baseKey}/${quality}/${t}`, SEGMENT_TTL)
      if (!signed) return null
      out.push(signed)
    } else {
      out.push(line)
    }
  }
  return out.join('\n')
}
