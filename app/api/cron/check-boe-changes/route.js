import { NextResponse } from 'next/server'
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
 * FASE 0: HTTP HEAD - Comprobar Content-Length
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

    if (cachedContentLength && contentLength === cachedContentLength) {
      return {
        success: true,
        method: 'head_unchanged',
        unchanged: true,
        contentLength,
        bytesDownloaded: 0
      }
    }

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
 * FASE 1: Descarga parcial con offset cacheado o expansión progresiva
 */
async function checkWithPartialDownload(url, cachedOffset = null) {
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

      if (!response.ok && response.status !== 206) continue

      const content = await response.text()
      totalDownloaded = content.length
      const dateFound = extractLastUpdateFromBOE(content)

      if (dateFound) {
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
 * FASE 2: Descarga completa (fallback)
 */
async function checkWithFullDownload(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VenceBot/1.0)' }
    })

    if (!response.ok) return { success: false, reason: 'http_error' }

    const content = await response.text()
    const dateFound = extractLastUpdateFromBOE(content)

    let dateOffset = null
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
    return { success: false, reason: 'fetch_error' }
  }
}

export async function GET(request) {
  // Verificar authorization header
  const authHeader = request.headers.get('authorization')
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

  if (authHeader !== expectedAuth) {
    console.error('❌ Unauthorized request to check-boe-changes cron')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    console.log('🔍 Iniciando verificación BOE...')

    const { data: laws, error } = await supabase
      .from('laws')
      .select('id, short_name, name, boe_url, last_update_boe, date_byte_offset, boe_content_length')
      .not('boe_url', 'is', null)

    if (error) {
      return NextResponse.json({ success: false, error: 'Error obteniendo leyes' }, { status: 500 })
    }

    const now = new Date()
    const stats = {
      total: laws.length,
      checked: 0,
      headUnchanged: 0,
      cachedOffset: 0,
      partial: 0,
      fullDownload: 0,
      changesDetected: 0,
      errors: 0,
      totalBytes: 0
    }

    const changes = []

    for (const law of laws) {
      let currentContentLength = null

      // FASE 0: HEAD check
      if (law.boe_content_length && law.last_update_boe) {
        const headResult = await checkWithContentLength(law.boe_url, law.boe_content_length)
        currentContentLength = headResult.contentLength

        if (headResult.success && headResult.unchanged) {
          stats.headUnchanged++
          await supabase.from('laws').update({ last_checked: now.toISOString() }).eq('id', law.id)
          stats.checked++
          continue
        }
      } else if (!law.boe_content_length) {
        const headResult = await checkWithContentLength(law.boe_url, null)
        currentContentLength = headResult.contentLength
      }

      // FASE 1: Partial download
      const partialResult = await checkWithPartialDownload(law.boe_url, law.date_byte_offset)

      if (partialResult.success) {
        if (partialResult.method === 'cached_offset') stats.cachedOffset++
        else stats.partial++
        stats.totalBytes += partialResult.bytesDownloaded

        // Detectar cambio
        if (law.last_update_boe && partialResult.lastUpdateBOE !== law.last_update_boe) {
          stats.changesDetected++
          changes.push({
            law: law.short_name,
            name: law.name,
            oldDate: law.last_update_boe,
            newDate: partialResult.lastUpdateBOE
          })
          console.log(`⚠️ CAMBIO DETECTADO: ${law.short_name} (${law.last_update_boe} → ${partialResult.lastUpdateBOE})`)
        }

        const updateData = {
          last_checked: now.toISOString(),
          last_update_boe: partialResult.lastUpdateBOE
        }
        if (partialResult.dateOffset > 0) updateData.date_byte_offset = partialResult.dateOffset
        if (currentContentLength > 0) updateData.boe_content_length = currentContentLength
        if (law.last_update_boe && partialResult.lastUpdateBOE !== law.last_update_boe) {
          updateData.change_status = 'changed'
          updateData.change_detected_at = now.toISOString()
        }
        await supabase.from('laws').update(updateData).eq('id', law.id)

        stats.checked++
        continue
      }

      // FASE 2: Full download
      const fullResult = await checkWithFullDownload(law.boe_url)
      stats.totalBytes += fullResult.bytesDownloaded || 0

      if (fullResult.success) {
        stats.fullDownload++

        if (law.last_update_boe && fullResult.lastUpdateBOE !== law.last_update_boe) {
          stats.changesDetected++
          changes.push({
            law: law.short_name,
            name: law.name,
            oldDate: law.last_update_boe,
            newDate: fullResult.lastUpdateBOE
          })
          console.log(`⚠️ CAMBIO DETECTADO: ${law.short_name} (${law.last_update_boe} → ${fullResult.lastUpdateBOE})`)
        }

        const fullUpdateData = {
          last_checked: now.toISOString(),
          last_update_boe: fullResult.lastUpdateBOE
        }
        if (fullResult.dateOffset > 0) fullUpdateData.date_byte_offset = fullResult.dateOffset
        if (currentContentLength > 0) fullUpdateData.boe_content_length = currentContentLength
        if (law.last_update_boe && fullResult.lastUpdateBOE !== law.last_update_boe) {
          fullUpdateData.change_status = 'changed'
          fullUpdateData.change_detected_at = now.toISOString()
        }
        await supabase.from('laws').update(fullUpdateData).eq('id', law.id)
      } else {
        stats.errors++
      }

      stats.checked++
      await new Promise(r => setTimeout(r, 100))
    }

    const duration = Date.now() - startTime
    const durationFormatted = `${(duration / 1000).toFixed(1)}s`

    console.log(`✅ Verificación completada: ${stats.checked} leyes, ${stats.changesDetected} cambios, ${durationFormatted}`)

    // Enviar email si hay cambios detectados
    if (stats.changesDetected > 0) {
      try {
        const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || 'https://www.vence.es'}/api/emails/send-admin-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'boe_change',
            adminEmail: process.env.ADMIN_EMAIL || 'manueltrader@gmail.com',
            data: {
              changesCount: stats.changesDetected,
              changes,
              stats: {
                checked: stats.checked,
                duration: durationFormatted,
                totalBytesFormatted: stats.totalBytes > 1024*1024
                  ? `${(stats.totalBytes / 1024 / 1024).toFixed(1)} MB`
                  : `${(stats.totalBytes / 1024).toFixed(1)} KB`
              },
              timestamp: now.toISOString(),
              adminUrl: 'https://www.vence.es/admin/monitoreo'
            }
          })
        })
        const emailResult = await emailResponse.json()
        console.log(`📧 Email enviado:`, emailResult.success ? '✅' : '❌', emailResult)
      } catch (emailError) {
        console.error('❌ Error enviando email:', emailError)
      }
    }

    return NextResponse.json({
      success: true,
      duration: durationFormatted,
      stats: {
        ...stats,
        totalBytesFormatted: stats.totalBytes > 1024*1024
          ? `${(stats.totalBytes / 1024 / 1024).toFixed(1)} MB`
          : `${(stats.totalBytes / 1024).toFixed(1)} KB`
      },
      changes,
      timestamp: now.toISOString()
    })

  } catch (error) {
    console.error('❌ Error en verificación BOE:', error)
    return NextResponse.json({
      success: false,
      error: 'Error interno',
      details: error.message
    }, { status: 500 })
  }
}
