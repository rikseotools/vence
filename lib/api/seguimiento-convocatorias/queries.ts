// lib/api/seguimiento-convocatorias/queries.ts
// Queries para monitorear cambios en páginas de seguimiento de convocatorias

import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import crypto from 'crypto'
import https from 'https'
import { insertSignal } from '@/lib/api/oep-signals/queries'
import { baseScoreBySensor, buildDedupeKey } from '@/lib/api/oep-signals/schemas'

// Hosts cuyo servidor no envía cadena intermedia y Node no puede validar.
// Para estos solo hasheamos HTML público, así que aceptamos cert no verificado.
const INSECURE_TLS_HOSTS = new Set<string>([
  'www.dpz.es', // FNMT-RCM intermedio no servido (15-may-2026)
])

export interface OposicionToCheck {
  id: string
  nombre: string
  slug: string | null
  shortName: string | null
  seguimientoUrl: string
  seguimientoLastHash: string | null
  seguimientoLastChecked: string | null
  seguimientoChangeStatus: string | null
}

export interface CheckResult {
  oposicionId: string
  nombre: string
  slug: string | null
  hasChanged: boolean
  newHash: string
  oldHash: string | null
  httpStatus: number
  contentLength: number
  contentPreview: string
  error: string | null
}

export interface SeguimientoCheckStats {
  total: number
  checked: number
  changed: number
  errors: number
  unchanged: number
}

/** Obtiene oposiciones con seguimiento_url para verificar */
export async function getOposicionesForSeguimientoCheck(): Promise<OposicionToCheck[]> {
  const db = getDb()
  const rows = await db.execute<{
    id: string
    nombre: string
    slug: string | null
    short_name: string | null
    seguimiento_url: string
    seguimiento_last_hash: string | null
    seguimiento_last_checked: string | null
    seguimiento_change_status: string | null
  }>(sql`
    SELECT id, nombre, slug, short_name, seguimiento_url,
           seguimiento_last_hash, seguimiento_last_checked, seguimiento_change_status
    FROM oposiciones
    WHERE seguimiento_url IS NOT NULL
      AND is_active = true
    ORDER BY nombre
  `)

  const results = Array.isArray(rows) ? rows : (rows as any).rows || []
  return results.map((r: any) => ({
    id: r.id,
    nombre: r.nombre,
    slug: r.slug,
    shortName: r.short_name,
    seguimientoUrl: r.seguimiento_url,
    seguimientoLastHash: r.seguimiento_last_hash,
    seguimientoLastChecked: r.seguimiento_last_checked,
    seguimientoChangeStatus: r.seguimiento_change_status,
  }))
}

/** Limpia HTML para obtener solo texto relevante (sin scripts, styles, headers, footers dinámicos) */
function extractRelevantText(html: string): string {
  return html
    // Quitar scripts y styles
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    // Quitar comentarios HTML
    .replace(/<!--[\s\S]*?-->/g, '')
    // Quitar tags HTML
    .replace(/<[^>]+>/g, ' ')
    // Quitar entidades HTML
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/&#\d+;/g, ' ')
    // Normalizar espacios
    .replace(/\s+/g, ' ')
    .trim()
}

/** Genera hash del contenido relevante de una página */
export function hashContent(html: string): string {
  const text = extractRelevantText(html)
  return crypto.createHash('sha256').update(text).digest('hex')
}

/** Extrae preview del contenido (primeros 2000 chars de texto limpio) */
export function getContentPreview(html: string): string {
  const text = extractRelevantText(html)
  return text.slice(0, 2000)
}

/**
 * Fetch HTTPS sin validar TLS para servidores que no envían cadena intermedia
 * (ej. www.dpz.es con FNMT-RCM). Sigue hasta 5 redirects.
 */
function fetchInsecureTls(
  url: string,
  headers: Record<string, string>,
  redirectsLeft = 5
): Promise<{ html: string; status: number }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = https.request(
      {
        host: u.host,
        path: u.pathname + u.search,
        method: 'GET',
        headers,
        rejectUnauthorized: false,
        timeout: 30000,
      },
      (res) => {
        const status = res.statusCode ?? 0
        const loc = res.headers.location
        if (loc && status >= 300 && status < 400 && redirectsLeft > 0) {
          res.resume() // drenar
          const nextUrl = new URL(loc, url).toString()
          fetchInsecureTls(nextUrl, headers, redirectsLeft - 1).then(resolve, reject)
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf-8'), status }))
        res.on('error', reject)
      }
    )
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', reject)
    req.end()
  })
}

/** Verifica una URL de seguimiento y devuelve el resultado */
export async function checkSeguimientoUrl(
  oposicion: OposicionToCheck
): Promise<CheckResult> {
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (compatible; VenceBot/1.0; +https://www.vence.es)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'es-ES,es;q=0.9',
    }
    const host = new URL(oposicion.seguimientoUrl).host
    let html: string
    let httpStatus: number

    if (INSECURE_TLS_HOSTS.has(host)) {
      // Host con cadena de cert incompleta — bypass validación TLS (solo hash HTML)
      ;({ html, status: httpStatus } = await fetchInsecureTls(oposicion.seguimientoUrl, headers))
    } else {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)
      const response = await fetch(oposicion.seguimientoUrl, {
        signal: controller.signal,
        headers,
      })
      clearTimeout(timeout)
      html = await response.text()
      httpStatus = response.status
    }

    const newHash = hashContent(html)
    const hasChanged = oposicion.seguimientoLastHash !== null && newHash !== oposicion.seguimientoLastHash

    return {
      oposicionId: oposicion.id,
      nombre: oposicion.nombre,
      slug: oposicion.slug,
      hasChanged,
      newHash,
      oldHash: oposicion.seguimientoLastHash,
      httpStatus,
      contentLength: html.length,
      contentPreview: getContentPreview(html),
      error: null,
    }
  } catch (error) {
    return {
      oposicionId: oposicion.id,
      nombre: oposicion.nombre,
      slug: oposicion.slug,
      hasChanged: false,
      newHash: '',
      oldHash: oposicion.seguimientoLastHash,
      httpStatus: 0,
      contentLength: 0,
      contentPreview: '',
      error: (error as Error).message,
    }
  }
}

/** Guarda el resultado de un check en BD + genera señal si hay cambio */
export async function saveSeguimientoCheck(result: CheckResult): Promise<void> {
  const db = getDb()

  // Insertar en historial
  await db.execute(sql`
    INSERT INTO convocatoria_seguimiento_checks
      (oposicion_id, content_hash, content_length, http_status, has_changed, error_message, content_preview)
    VALUES
      (${result.oposicionId}::uuid, ${result.newHash}, ${result.contentLength},
       ${result.httpStatus}, ${result.hasChanged}, ${result.error}, ${result.contentPreview})
  `)

  // Actualizar cache en oposiciones
  if (result.error) {
    await db.execute(sql`
      UPDATE oposiciones SET
        seguimiento_last_checked = NOW(),
        seguimiento_change_status = 'error'
      WHERE id = ${result.oposicionId}::uuid
    `)
  } else if (result.hasChanged) {
    await db.execute(sql`
      UPDATE oposiciones SET
        seguimiento_last_checked = NOW(),
        seguimiento_last_hash = ${result.newHash},
        seguimiento_change_detected_at = NOW(),
        seguimiento_change_status = 'changed'
      WHERE id = ${result.oposicionId}::uuid
    `)

    // Fusión con oep-signals: generar señal hash_change
    try {
      const today = new Date().toISOString().slice(0, 10)
      await insertSignal({
        oposicionId: result.oposicionId,
        sensorType: 'hash_change',
        sourceUrl: null,
        confidenceScore: baseScoreBySensor('hash_change'),
        isNovel: false,
        signalSummary: `Hash de página oficial cambió (${result.contentLength} bytes). Revisar manualmente vs BD. Preview: ${result.contentPreview.slice(0, 200)}`,
        rawExtraction: {
          oldHash: result.oldHash,
          newHash: result.newHash,
          contentLength: result.contentLength,
          contentPreview: result.contentPreview.slice(0, 500),
          httpStatus: result.httpStatus,
        } as Record<string, unknown>,
        dedupeKey: `hash_change:${result.oposicionId}:0:${today}`,
      })
    } catch (err) {
      console.warn('⚠️ [Seguimiento] No se pudo crear señal hash_change:', err)
    }
  } else {
    await db.execute(sql`
      UPDATE oposiciones SET
        seguimiento_last_checked = NOW(),
        seguimiento_last_hash = ${result.newHash},
        seguimiento_change_status = 'ok'
      WHERE id = ${result.oposicionId}::uuid
    `)
  }
}

/** Marca un cambio como revisado */
export async function markSeguimientoReviewed(oposicionId: string): Promise<void> {
  const db = getDb()

  await db.execute(sql`
    UPDATE convocatoria_seguimiento_checks SET
      change_reviewed = TRUE,
      reviewed_at = NOW()
    WHERE oposicion_id = ${oposicionId}::uuid
      AND has_changed = TRUE
      AND change_reviewed = FALSE
  `)

  await db.execute(sql`
    UPDATE oposiciones SET
      seguimiento_change_status = 'ok',
      seguimiento_change_detected_at = NULL
    WHERE id = ${oposicionId}::uuid
  `)
}

/** Obtiene datos para la vista admin */
export async function getSeguimientoAdminData(): Promise<Array<{
  id: string
  nombre: string
  slug: string | null
  shortName: string | null
  seguimientoUrl: string
  lastChecked: string | null
  changeStatus: string | null
  changeDetectedAt: string | null
  unreviewed: number
}>> {
  const db = getDb()
  const rows = await db.execute<{
    id: string
    nombre: string
    slug: string | null
    short_name: string | null
    seguimiento_url: string
    seguimiento_last_checked: string | null
    seguimiento_change_status: string | null
    seguimiento_change_detected_at: string | null
    unreviewed: string
  }>(sql`
    SELECT o.id, o.nombre, o.slug, o.short_name, o.seguimiento_url,
           o.seguimiento_last_checked, o.seguimiento_change_status, o.seguimiento_change_detected_at,
           COALESCE(
             (SELECT COUNT(*) FROM convocatoria_seguimiento_checks c
              WHERE c.oposicion_id = o.id AND c.has_changed = TRUE AND c.change_reviewed = FALSE),
             0
           ) as unreviewed
    FROM oposiciones o
    WHERE o.seguimiento_url IS NOT NULL AND o.is_active = true
    ORDER BY
      CASE WHEN o.seguimiento_change_status = 'changed' THEN 0
           WHEN o.seguimiento_change_status = 'error' THEN 1
           ELSE 2
      END,
      o.nombre
  `)

  const results = Array.isArray(rows) ? rows : (rows as any).rows || []
  return results.map((r: any) => ({
    id: r.id,
    nombre: r.nombre,
    slug: r.slug,
    shortName: r.short_name,
    seguimientoUrl: r.seguimiento_url,
    lastChecked: r.seguimiento_last_checked,
    changeStatus: r.seguimiento_change_status,
    changeDetectedAt: r.seguimiento_change_detected_at,
    unreviewed: parseInt(r.unreviewed) || 0,
  }))
}
