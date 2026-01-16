// lib/api/boe-changes/queries.ts - Queries y funciones para monitoreo BOE
import { getDb } from '@/db/client'
import { laws } from '@/db/schema'
import { isNotNull, eq } from 'drizzle-orm'
import {
  SIZE_TOLERANCE_BYTES,
  type LawForCheck,
  type HeadCheckResult,
  type PartialCheckResult,
  type FullCheckResult,
  type LawUpdateData,
  type CheckStats,
  type DetectedChange
} from './schemas'

// ============================================
// OBTENER LEYES PARA VERIFICAR
// ============================================

export async function getLawsForBoeCheck(): Promise<LawForCheck[]> {
  const db = getDb()

  const result = await db
    .select({
      id: laws.id,
      shortName: laws.shortName,
      name: laws.name,
      boeUrl: laws.boeUrl,
      lastUpdateBoe: laws.lastUpdateBoe,
      dateByteOffset: laws.dateByteOffset,
      boeContentLength: laws.boeContentLength
    })
    .from(laws)
    .where(isNotNull(laws.boeUrl))

  // Filtrar y mapear a LawForCheck
  return result
    .filter((law) => law.boeUrl !== null && law.boeUrl.length > 0)
    .map((law) => ({
      id: law.id,
      shortName: law.shortName,
      name: law.name,
      boeUrl: law.boeUrl as string,
      lastUpdateBoe: law.lastUpdateBoe ?? null,
      dateByteOffset: law.dateByteOffset ?? null,
      boeContentLength: law.boeContentLength ?? null
    }))
}

// ============================================
// ACTUALIZAR LEY DESPUÉS DE VERIFICACIÓN
// ============================================

export async function updateLawAfterCheck(
  lawId: string,
  data: LawUpdateData
): Promise<boolean> {
  try {
    const db = getDb()

    await db
      .update(laws)
      .set({
        lastChecked: data.lastChecked,
        ...(data.lastUpdateBoe && { lastUpdateBoe: data.lastUpdateBoe }),
        ...(data.dateByteOffset && { dateByteOffset: data.dateByteOffset }),
        ...(data.boeContentLength && { boeContentLength: data.boeContentLength }),
        ...(data.changeStatus && { changeStatus: data.changeStatus }),
        ...(data.changeDetectedAt && { changeDetectedAt: data.changeDetectedAt })
      })
      .where(eq(laws.id, lawId))

    return true
  } catch (error) {
    console.error(`❌ [BOE] Error actualizando ley ${lawId}:`, error)
    return false
  }
}

// ============================================
// EXTRACTOR DE FECHA DEL BOE
// ============================================

export function extractLastUpdateFromBOE(htmlContent: string): string | null {
  try {
    const cleanContent = htmlContent
      .replace(/&oacute;/g, 'ó')
      .replace(/&aacute;/g, 'á')
      .replace(/&eacute;/g, 'é')
      .replace(/&iacute;/g, 'í')
      .replace(/&uacute;/g, 'ú')
      .replace(/&ntilde;/g, 'ñ')

    const patterns = [
      /Última actualización publicada el (\d{2}\/\d{2}\/\d{4})/i,
      /actualización, publicada el (\d{2}\/\d{2}\/\d{4})/i,
      /Texto consolidado.*?(\d{2}\/\d{2}\/\d{4})/i
    ]

    for (const pattern of patterns) {
      const match = cleanContent.match(pattern)
      if (match?.[1] && /^\d{2}\/\d{2}\/\d{4}$/.test(match[1])) {
        return match[1]
      }
    }
    return null
  } catch {
    return null
  }
}

// ============================================
// FASE 0: HTTP HEAD - Comprobar Content-Length
// Con tolerancia de tamaño
// ============================================

export async function checkWithContentLength(
  url: string,
  cachedContentLength: number | null
): Promise<HeadCheckResult> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VenceBot/1.0)' }
    })

    if (!response.ok) {
      return { success: false, reason: 'http_error', contentLength: null }
    }

    const contentLengthHeader = response.headers.get('content-length')
    const contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : null

    if (!contentLength || isNaN(contentLength)) {
      return { success: false, reason: 'no_content_length', contentLength: null }
    }

    // Si no hay cache previo, no podemos determinar si cambió
    if (!cachedContentLength) {
      return {
        success: false,
        reason: 'no_cache',
        contentLength,
        previousLength: null
      }
    }

    // Calcular diferencia de tamaño
    const sizeChange = Math.abs(contentLength - cachedContentLength)

    // ✅ TOLERANCIA DE TAMAÑO: Si cambia más de SIZE_TOLERANCE_BYTES, verificar
    if (sizeChange > SIZE_TOLERANCE_BYTES) {
      console.log(
        `📊 [BOE] Cambio de tamaño detectado: ${cachedContentLength} → ${contentLength} (${sizeChange > 0 ? '+' : ''}${contentLength - cachedContentLength} bytes)`
      )
      return {
        success: false,
        reason: 'size_changed',
        contentLength,
        previousLength: cachedContentLength,
        sizeChange,
        bytesDownloaded: 0
      }
    }

    // Tamaño igual o casi igual = sin cambios
    return {
      success: true,
      method: 'head_unchanged',
      unchanged: true,
      contentLength,
      sizeChange: 0,
      bytesDownloaded: 0
    }
  } catch {
    return { success: false, reason: 'fetch_error', contentLength: null }
  }
}

// ============================================
// FASE 1: Descarga parcial con offset cacheado
// ============================================

export async function checkWithPartialDownload(
  url: string,
  cachedOffset: number | null
): Promise<PartialCheckResult> {
  // Si tenemos offset cacheado, intentar primero con rango pequeño
  if (cachedOffset && cachedOffset > 0) {
    const start = Math.max(0, cachedOffset - 1000)
    const end = cachedOffset + 5000

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; VenceBot/1.0)',
          Range: `bytes=${start}-${end}`
        }
      })

      if (response.ok || response.status === 206) {
        const content = await response.text()
        const dateFound = extractLastUpdateFromBOE(content)

        if (dateFound) {
          return {
            success: true,
            method: 'cached_offset',
            lastUpdateBOE: dateFound,
            bytesDownloaded: content.length
          }
        }
      }
    } catch {
      // Continuar con rangos progresivos
    }
  }

  // Rangos progresivos: 50KB, 150KB, 300KB
  const ranges = [50000, 150000, 300000]
  let totalDownloaded = 0

  for (const rangeEnd of ranges) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; VenceBot/1.0)',
          Range: `bytes=0-${rangeEnd}`
        }
      })

      if (!response.ok && response.status !== 206) continue

      const content = await response.text()
      totalDownloaded = content.length
      const dateFound = extractLastUpdateFromBOE(content)

      if (dateFound) {
        const match = content.match(/actualización publicada el \d{2}\/\d{2}\/\d{4}/i)
        const offset = match ? content.indexOf(match[0]) : null

        const method =
          rangeEnd <= 50000
            ? 'partial_50k'
            : rangeEnd <= 150000
              ? 'partial_150k'
              : 'partial_300k'

        return {
          success: true,
          method,
          lastUpdateBOE: dateFound,
          bytesDownloaded: totalDownloaded,
          dateOffset: offset
        }
      }
    } catch {
      continue
    }
  }

  return {
    success: false,
    reason: 'date_not_in_partial',
    bytesDownloaded: totalDownloaded
  }
}

// ============================================
// FASE 2: Descarga completa (fallback)
// ============================================

export async function checkWithFullDownload(url: string): Promise<FullCheckResult> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VenceBot/1.0)' }
    })

    if (!response.ok) {
      return { success: false, reason: 'http_error', bytesDownloaded: 0 }
    }

    const content = await response.text()
    const dateFound = extractLastUpdateFromBOE(content)

    let dateOffset: number | null = null
    if (dateFound) {
      const match = content.match(/actualización publicada el \d{2}\/\d{2}\/\d{4}/i)
      if (match) dateOffset = content.indexOf(match[0])
    }

    return {
      success: !!dateFound,
      method: 'full',
      lastUpdateBOE: dateFound,
      bytesDownloaded: content.length,
      dateOffset
    }
  } catch {
    return { success: false, reason: 'fetch_error', bytesDownloaded: 0 }
  }
}

// ============================================
// ENVIAR NOTIFICACIÓN DE CAMBIOS
// ============================================

export async function sendBoeChangeNotification(
  changes: DetectedChange[],
  stats: CheckStats,
  duration: string
): Promise<boolean> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://www.vence.es'
    const adminEmail = process.env.ADMIN_EMAIL || 'manueltrader@gmail.com'

    const response = await fetch(`${baseUrl}/api/emails/send-admin-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'boe_change',
        adminEmail,
        data: {
          changesCount: changes.length,
          changes,
          stats: {
            checked: stats.checked,
            duration,
            totalBytesFormatted: formatBytes(stats.totalBytes),
            sizeChangeDetected: stats.sizeChangeDetected
          },
          timestamp: new Date().toISOString(),
          adminUrl: 'https://www.vence.es/admin/monitoreo'
        }
      })
    })

    const result = await response.json()
    console.log(`📧 [BOE] Email enviado:`, result.success ? '✅' : '❌')
    return result.success
  } catch (error) {
    console.error('❌ [BOE] Error enviando email:', error)
    return false
  }
}

// ============================================
// UTILIDADES
// ============================================

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }
  return `${(bytes / 1024).toFixed(1)} KB`
}

export function createInitialStats(total: number): CheckStats {
  return {
    total,
    checked: 0,
    headUnchanged: 0,
    sizeChangeDetected: 0,
    cachedOffset: 0,
    partial: 0,
    fullDownload: 0,
    changesDetected: 0,
    errors: 0,
    totalBytes: 0
  }
}
