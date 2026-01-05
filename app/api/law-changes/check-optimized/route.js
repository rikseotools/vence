// app/api/law-changes/check-optimized/route.js
// Versión optimizada para cron diario - mínimo consumo de ancho de banda
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

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
export async function GET(request) {
  const startTime = Date.now()
  const { searchParams } = new URL(request.url)
  const skipRecent = searchParams.get('skipRecent') !== 'false'
  const specificLaw = searchParams.get('law')
  const hoursThreshold = parseInt(searchParams.get('hours') || '12')

  try {
    // Obtener leyes a verificar (incluir offset y content_length cacheados)
    let query = supabase
      .from('laws')
      .select('id, short_name, name, boe_url, last_update_boe, last_checked, date_byte_offset, boe_content_length')
      .not('boe_url', 'is', null)

    if (specificLaw) {
      query = query.eq('short_name', specificLaw)
    }

    const { data: laws, error } = await query

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
          await supabase.from('laws').update({
            last_checked: now.toISOString()
          }).eq('id', law.id)

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

        // Detectar cambio
        if (law.last_update_boe && partialResult.lastUpdateBOE !== law.last_update_boe) {
          lawResult.changed = true
          stats.changesDetected++
          changes.push({
            law: law.short_name,
            name: law.name,
            oldDate: law.last_update_boe,
            newDate: partialResult.lastUpdateBOE
          })
        }

        // Actualizar BD (guardar offset y content_length para próximas consultas)
        const updateData = {
          last_checked: now.toISOString(),
          last_update_boe: partialResult.lastUpdateBOE
        }
        if (partialResult.dateOffset && partialResult.dateOffset > 0) {
          updateData.date_byte_offset = partialResult.dateOffset
        }
        if (currentContentLength && currentContentLength > 0) {
          updateData.boe_content_length = currentContentLength
        }
        if (lawResult.changed) {
          updateData.change_status = 'changed'
          updateData.change_detected_at = now.toISOString()
        }
        await supabase.from('laws').update(updateData).eq('id', law.id)

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
          lawResult.changed = true
          stats.changesDetected++
          changes.push({
            law: law.short_name,
            name: law.name,
            oldDate: law.last_update_boe,
            newDate: fullResult.lastUpdateBOE
          })
        }

        const fullUpdateData = {
          last_checked: now.toISOString(),
          last_update_boe: fullResult.lastUpdateBOE
        }
        if (fullResult.dateOffset && fullResult.dateOffset > 0) {
          fullUpdateData.date_byte_offset = fullResult.dateOffset
        }
        if (currentContentLength && currentContentLength > 0) {
          fullUpdateData.boe_content_length = currentContentLength
        }
        if (lawResult.changed) {
          fullUpdateData.change_status = 'changed'
          fullUpdateData.change_detected_at = now.toISOString()
        }
        await supabase.from('laws').update(fullUpdateData).eq('id', law.id)
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
