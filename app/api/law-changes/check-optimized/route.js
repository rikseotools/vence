// app/api/law-changes/check-optimized/route.js
// Versión optimizada para cron diario - mínimo consumo de ancho de banda
import { getAdminDb } from '@/db/client'
import { laws as lawsTable, articles as articlesTable } from '@/db/schema'
import { and, eq, isNotNull } from 'drizzle-orm'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { extractBoeArticles, classifyContentChange } from '@/lib/api/boe-changes/normalize'

// getAdminDb() = Drizzle con DATABASE_URL, bypass RLS (equivalente al
// service_role). Agnóstico de proveedor.
const db = () => getAdminDb()

/**
 * Extrae la fecha de "Última actualización" del HTML del BOE
 */
function extractLastUpdateFromBOE(htmlContent) {
  try {
    let cleanContent = htmlContent
      .replace(/&oacute;/g, 'ó')
      .replace(/&aacute;/g, 'á')
      .replace(/&eacute;/g, 'é')
      .replace(/&iacute;/g, 'í')
      .replace(/&uacute;/g, 'ú')
      .replace(/&ntilde;/g, 'ñ')

    const patterns = [
      /Última actualización publicada el (\d{2}\/\d{2}\/\d{4})/i,
      /actualización, publicada el (\d{2}\/\d{2}\/\d{4})/i,
      /Texto consolidado.*?(\d{2}\/\d{2}\/\d{4})/i,
    ]

    for (const pattern of patterns) {
      const match = cleanContent.match(pattern)
      if (match && match[1] && /^\d{2}\/\d{2}\/\d{4}$/.test(match[1])) {
        return match[1]
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Parsea fecha DD/MM/YYYY a Date
 */
function parseSpanishDate(dateStr) {
  if (!dateStr) return null
  const [day, month, year] = dateStr.split('/')
  return new Date(year, month - 1, day)
}

/**
 * PUERTA DE CONFIRMACIÓN (24/07/2026): la fecha de "Última actualización" del BOE avanza en las
 * RE-CONSOLIDACIONES aunque no cambie ni una palabra del articulado servido → falsos positivos
 * (Ley 4/2021 FPV, Ley 1/2015 Hacienda GVA, verificadas a mano). Antes de marcar 'changed',
 * confirmamos comparando el CONTENIDO LEGAL normalizado del BOE contra NUESTROS artículos: solo
 * es cambio real si difiere el texto servido (no las notas editoriales ni el espaciado de los
 * enlaces del BOE). Recall intacto: una palabra distinta del mismo largo SÍ dispara.
 *
 * FAIL-SAFE: si no se puede descargar/parsear el BOE, devuelve isRealChange=true (mejor un falso
 * positivo puntual que perder un cambio real). Solo corre cuando la fecha ya cambió (raro).
 */
async function confirmRealChange(law) {
  try {
    const res = await fetch(law.boe_url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VenceBot/1.0)' },
    })
    if (!res.ok) return { isRealChange: true, reason: `no confirmable (HTTP ${res.status})` }
    const html = await res.text()
    const boe = extractBoeArticles(html)
    if (boe.size === 0) return { isRealChange: true, reason: 'BOE sin artículos extraíbles' }

    const rows = await db()
      .select({
        n: articlesTable.articleNumber,
        active: articlesTable.isActive,
        content: articlesTable.content,
      })
      .from(articlesTable)
      .where(eq(articlesTable.lawId, law.id))
    const ours = new Map(
      rows.map((r) => [String(r.n).toLowerCase(), { content: r.content || '', active: !!r.active }]),
    )
    return classifyContentChange(ours, boe)
  } catch (e) {
    return { isRealChange: true, reason: `error confirmando (${e.message})` }
  }
}

/**
 * FASE 0: HTTP HEAD - Comprobar Content-Length para detectar cambios sin descargar
 * Si el tamaño no ha cambiado, el archivo no ha sido modificado
 */
async function checkWithContentLength(url, cachedContentLength) {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VenceBot/1.0)' }
    })

    if (!response.ok) return { success: false, reason: 'http_error' }

    const contentLength = parseInt(response.headers.get('content-length'))

    if (!contentLength || isNaN(contentLength)) {
      return { success: false, reason: 'no_content_length', contentLength: null }
    }

    // Si tenemos cache y coincide → no hay cambios
    if (cachedContentLength && contentLength === cachedContentLength) {
      return {
        success: true,
        method: 'head_unchanged',
        unchanged: true,
        contentLength,
        bytesDownloaded: 0 // Solo HEAD, ~500 bytes de headers
      }
    }

    // Tamaño diferente o sin cache → necesita verificación
    return {
      success: false,
      reason: cachedContentLength ? 'size_changed' : 'no_cache',
      contentLength,
      previousLength: cachedContentLength
    }
  } catch {
    return { success: false, reason: 'fetch_error' }
  }
}

/**
 * FASE 2: Descarga parcial con expansión progresiva
 * Intenta primeros 50KB, si no encuentra fecha expande a 150KB, luego 300KB
 */
async function checkWithPartialDownload(url, cachedOffset = null) {
  // Si tenemos offset cacheado, descargar solo ese rango + margen
  if (cachedOffset && cachedOffset > 0) {
    const start = Math.max(0, cachedOffset - 1000)
    const end = cachedOffset + 5000
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; VenceBot/1.0)',
          'Range': `bytes=${start}-${end}`
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
    } catch {}
  }

  // Expansión progresiva: 50KB → 150KB → 300KB
  const ranges = [50000, 150000, 300000]
  let totalDownloaded = 0

  for (const rangeEnd of ranges) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; VenceBot/1.0)',
          'Range': `bytes=0-${rangeEnd}`
        }
      })

      if (!response.ok && response.status !== 206) {
        continue
      }

      const content = await response.text()
      totalDownloaded = content.length
      const dateFound = extractLastUpdateFromBOE(content)

      if (dateFound) {
        // Calcular offset aproximado para cachear
        const match = content.match(/actualización publicada el \d{2}\/\d{2}\/\d{4}/i)
        const offset = match ? content.indexOf(match[0]) : null

        return {
          success: true,
          method: rangeEnd <= 50000 ? 'partial_50k' : rangeEnd <= 150000 ? 'partial_150k' : 'partial_300k',
          lastUpdateBOE: dateFound,
          bytesDownloaded: totalDownloaded,
          dateOffset: offset
        }
      }
    } catch {
      continue
    }
  }

  return { success: false, reason: 'date_not_in_partial', bytesDownloaded: totalDownloaded }
}

/**
 * FASE 2: Descarga completa (fallback) - también guarda offset para próxima vez
 */
async function checkWithFullDownload(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VenceBot/1.0)' }
    })

    if (!response.ok) return { success: false, reason: 'http_error' }

    const content = await response.text()
    const dateFound = extractLastUpdateFromBOE(content)

    // Calcular offset para cachear
    let dateOffset = null
    if (dateFound) {
      const match = content.match(/actualización publicada el \d{2}\/\d{2}\/\d{4}/i)
      if (match) {
        dateOffset = content.indexOf(match[0])
      }
    }

    return {
      success: !!dateFound,
      method: 'full',
      lastUpdateBOE: dateFound,
      bytesDownloaded: content.length,
      dateOffset
    }
  } catch {
    return { success: false, reason: 'fetch_error' }
  }
}

/**
 * GET: Verificación optimizada de cambios en BOE
 * Parámetros opcionales:
 * - skipRecent=true: Salta leyes verificadas en las últimas 12 horas
 * - law=SHORT_NAME: Verificar solo una ley específica
 */
async function _GET(request) {
  const startTime = Date.now()
  const { searchParams } = new URL(request.url)
  const skipRecent = searchParams.get('skipRecent') !== 'false'
  const specificLaw = searchParams.get('law')
  const hoursThreshold = parseInt(searchParams.get('hours') || '12')

  try {
    // Obtener leyes a verificar (incluir offset y content_length cacheados)
    let laws = []
    let error = null
    try {
      laws = await db()
        .select({
          id: lawsTable.id,
          short_name: lawsTable.shortName,
          name: lawsTable.name,
          boe_url: lawsTable.boeUrl,
          last_update_boe: lawsTable.lastUpdateBoe,
          last_checked: lawsTable.lastChecked,
          date_byte_offset: lawsTable.dateByteOffset,
          boe_content_length: lawsTable.boeContentLength,
        })
        .from(lawsTable)
        .where(and(
          isNotNull(lawsTable.boeUrl),
          specificLaw ? eq(lawsTable.shortName, specificLaw) : undefined,
        ))
    } catch (e) {
      error = e
    }

    if (error) {
      return Response.json({ success: false, error: 'Error obteniendo leyes' }, { status: 500 })
    }

    // Filtrar leyes ya verificadas recientemente
    const now = new Date()
    const lawsToCheck = skipRecent
      ? laws.filter(law => {
          if (!law.last_checked) return true
          const lastChecked = new Date(law.last_checked)
          const hoursSince = (now - lastChecked) / (1000 * 60 * 60)
          return hoursSince >= hoursThreshold
        })
      : laws

    const stats = {
      total: laws.length,
      skipped: laws.length - lawsToCheck.length,
      checked: 0,
      headUnchanged: 0, // FASE 0: Solo HEAD (~500 bytes headers)
      cachedOffset: 0,  // FASE 1: Ultra rápido ~6KB usando posición guardada
      partial50k: 0,    // FASE 2a: Descarga parcial
      partial150k: 0,   // FASE 2b
      partial300k: 0,   // FASE 2c
      fullDownload: 0,  // FASE 3: Descarga completa (fallback)
      changesDetected: 0,
      errors: 0,
      totalBytes: 0,
      headRequests: 0   // Total HEAD requests realizados
    }

    const results = []
    const changes = []

    for (const law of lawsToCheck) {
      const lawResult = {
        id: law.id,
        shortName: law.short_name,
        previousDate: law.last_update_boe,
        newDate: null,
        changed: false,
        method: null,
        error: null
      }

      // FASE 0: HEAD request - si tenemos content_length cacheado y coincide, no hay cambios
      let currentContentLength = null
      if (law.boe_content_length && law.last_update_boe) {
        const headResult = await checkWithContentLength(law.boe_url, law.boe_content_length)
        stats.headRequests++
        currentContentLength = headResult.contentLength

        if (headResult.success && headResult.unchanged) {
          // Sin cambios - usar fecha cacheada, no descargar nada
          stats.headUnchanged++
          lawResult.method = 'head_unchanged'
          lawResult.newDate = law.last_update_boe

          // Solo actualizar last_checked
          await db().update(lawsTable).set({
            lastChecked: now.toISOString()
          }).where(eq(lawsTable.id, law.id))

          results.push(lawResult)
          stats.checked++
          continue
        }
        // Si el tamaño cambió, continuar con las siguientes fases
      } else if (!law.boe_content_length) {
        // Primera vez - obtener content_length para cachear
        const headResult = await checkWithContentLength(law.boe_url, null)
        stats.headRequests++
        currentContentLength = headResult.contentLength
      }

      // FASE 1: Descarga parcial (usa offset cacheado si existe)
      const partialResult = await checkWithPartialDownload(law.boe_url, law.date_byte_offset)

      if (partialResult.success) {
        if (partialResult.method === 'cached_offset') stats.cachedOffset++
        else if (partialResult.method === 'partial_50k') stats.partial50k++
        else if (partialResult.method === 'partial_150k') stats.partial150k++
        else if (partialResult.method === 'partial_300k') stats.partial300k++
        stats.totalBytes += partialResult.bytesDownloaded
        lawResult.method = partialResult.method
        lawResult.newDate = partialResult.lastUpdateBOE

        // Detectar cambio (con PUERTA DE CONFIRMACIÓN por contenido: la fecha sola da falsos
        // positivos en re-consolidaciones; confirmRealChange compara el articulado servido).
        if (law.last_update_boe && partialResult.lastUpdateBOE !== law.last_update_boe) {
          const verdict = await confirmRealChange(law)
          if (verdict.isRealChange) {
            lawResult.changed = true
            stats.changesDetected++
            changes.push({
              law: law.short_name,
              name: law.name,
              oldDate: law.last_update_boe,
              newDate: partialResult.lastUpdateBOE,
              articles: verdict.changedArticles
            })
          } else {
            lawResult.noiseSkipped = true
            stats.noiseSkipped = (stats.noiseSkipped || 0) + 1
            console.log(`🔇 [BOE] ${law.short_name}: fecha ${law.last_update_boe}→${partialResult.lastUpdateBOE} pero contenido servido IGUAL (${verdict.reason}) — no se marca 'changed'`)
          }
        }

        // Actualizar BD (guardar offset y content_length para próximas consultas)
        const updateData = {
          lastChecked: now.toISOString(),
          lastUpdateBoe: partialResult.lastUpdateBOE
        }
        if (partialResult.dateOffset && partialResult.dateOffset > 0) {
          updateData.dateByteOffset = partialResult.dateOffset
        }
        if (currentContentLength && currentContentLength > 0) {
          updateData.boeContentLength = currentContentLength
        }
        if (lawResult.changed) {
          updateData.changeStatus = 'changed'
          updateData.changeDetectedAt = now.toISOString()
        }
        await db().update(lawsTable).set(updateData).where(eq(lawsTable.id, law.id))

        results.push(lawResult)
        stats.checked++
        continue
      }

      // FASE 3: Descarga completa (fallback)
      const fullResult = await checkWithFullDownload(law.boe_url)
      stats.totalBytes += fullResult.bytesDownloaded || 0

      if (fullResult.success) {
        stats.fullDownload++
        lawResult.method = 'full'
        lawResult.newDate = fullResult.lastUpdateBOE

        if (law.last_update_boe && fullResult.lastUpdateBOE !== law.last_update_boe) {
          const verdict = await confirmRealChange(law)
          if (verdict.isRealChange) {
            lawResult.changed = true
            stats.changesDetected++
            changes.push({
              law: law.short_name,
              name: law.name,
              oldDate: law.last_update_boe,
              newDate: fullResult.lastUpdateBOE,
              articles: verdict.changedArticles
            })
          } else {
            lawResult.noiseSkipped = true
            stats.noiseSkipped = (stats.noiseSkipped || 0) + 1
            console.log(`🔇 [BOE] ${law.short_name}: fecha ${law.last_update_boe}→${fullResult.lastUpdateBOE} pero contenido servido IGUAL (${verdict.reason}) — no se marca 'changed'`)
          }
        }

        const fullUpdateData = {
          lastChecked: now.toISOString(),
          lastUpdateBoe: fullResult.lastUpdateBOE
        }
        if (fullResult.dateOffset && fullResult.dateOffset > 0) {
          fullUpdateData.dateByteOffset = fullResult.dateOffset
        }
        if (currentContentLength && currentContentLength > 0) {
          fullUpdateData.boeContentLength = currentContentLength
        }
        if (lawResult.changed) {
          fullUpdateData.changeStatus = 'changed'
          fullUpdateData.changeDetectedAt = now.toISOString()
        }
        await db().update(lawsTable).set(fullUpdateData).where(eq(lawsTable.id, law.id))
      } else {
        stats.errors++
        lawResult.error = fullResult.reason
      }

      results.push(lawResult)
      stats.checked++

      // Pequeña pausa para no saturar el BOE
      await new Promise(r => setTimeout(r, 100))
    }

    const duration = Date.now() - startTime

    // Calcular eficiencia
    const optimizedCount = stats.headUnchanged + stats.cachedOffset + stats.partial50k + stats.partial150k + stats.partial300k

    return Response.json({
      success: true,
      duration: `${(duration / 1000).toFixed(1)}s`,
      stats: {
        ...stats,
        optimizedTotal: optimizedCount,
        totalBytesFormatted: stats.totalBytes > 1024*1024
          ? `${(stats.totalBytes / 1024 / 1024).toFixed(1)} MB`
          : `${(stats.totalBytes / 1024).toFixed(1)} KB`,
        avgBytesPerLaw: stats.checked > 0
          ? `${(stats.totalBytes / stats.checked / 1024).toFixed(1)} KB`
          : '0 KB',
        efficiency: `${(optimizedCount / stats.checked * 100 || 0).toFixed(0)}% optimizado`,
        breakdown: {
          head: `${stats.headUnchanged} (0 KB)`,
          offset: `${stats.cachedOffset} (~6 KB c/u)`,
          partial: `${stats.partial50k + stats.partial150k + stats.partial300k} (50-300 KB c/u)`,
          full: `${stats.fullDownload} (completa)`
        }
      },
      changes,
      results: specificLaw ? results : undefined // Solo incluir detalle si es ley específica
    })

  } catch (error) {
    console.error('Error en verificación optimizada:', error)
    return Response.json({
      success: false,
      error: 'Error interno',
      details: error.message
    }, { status: 500 })
  }
}

export const GET = withErrorLogging('/api/law-changes/check-optimized', _GET)
