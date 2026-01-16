// app/api/cron/check-boe-changes/route.ts
// Endpoint para verificar cambios en el BOE de leyes monitoreadas
// Migrado a TypeScript con Drizzle y Zod

import { NextRequest, NextResponse } from 'next/server'
import {
  SIZE_TOLERANCE_BYTES,
  getLawsForBoeCheck,
  updateLawAfterCheck,
  checkWithContentLength,
  checkWithPartialDownload,
  checkWithFullDownload,
  sendBoeChangeNotification,
  formatBytes,
  createInitialStats,
  type LawForCheck,
  type DetectedChange,
  type CheckStats,
  type CheckBoeChangesResponse
} from '@/lib/api/boe-changes'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutos máximo

// ============================================
// GET: Verificar cambios en BOE
// ============================================

export async function GET(request: NextRequest): Promise<NextResponse<CheckBoeChangesResponse>> {
  // Verificar authorization header
  const authHeader = request.headers.get('authorization')
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

  if (authHeader !== expectedAuth) {
    console.error('❌ [BOE] Unauthorized request to check-boe-changes cron')
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const startTime = Date.now()

  try {
    console.log('🔍 [BOE] Iniciando verificación BOE...')
    console.log(`📏 [BOE] Tolerancia de tamaño: ${SIZE_TOLERANCE_BYTES} bytes`)

    // Obtener leyes a verificar usando Drizzle
    const lawsToCheck = await getLawsForBoeCheck()

    if (!lawsToCheck.length) {
      return NextResponse.json({
        success: true,
        duration: '0s',
        stats: createInitialStats(0),
        changes: [],
        timestamp: new Date().toISOString()
      })
    }

    const now = new Date()
    const stats = createInitialStats(lawsToCheck.length)
    const changes: DetectedChange[] = []

    // Procesar cada ley
    for (const law of lawsToCheck) {
      const result = await processLaw(law, now, stats, changes)
      if (!result) {
        stats.errors++
      }
      stats.checked++

      // Pequeña pausa para no saturar el BOE
      await new Promise((r) => setTimeout(r, 100))
    }

    const duration = Date.now() - startTime
    const durationFormatted = `${(duration / 1000).toFixed(1)}s`

    console.log(
      `✅ [BOE] Verificación completada: ${stats.checked} leyes, ${stats.changesDetected} cambios, ${durationFormatted}`
    )
    console.log(
      `📊 [BOE] Detalle: ${stats.headUnchanged} sin cambio (HEAD), ${stats.sizeChangeDetected} por cambio de tamaño, ${stats.partial + stats.cachedOffset} parciales, ${stats.fullDownload} completas`
    )

    // Enviar email si hay cambios detectados
    if (changes.length > 0) {
      await sendBoeChangeNotification(changes, stats, durationFormatted)
    }

    return NextResponse.json({
      success: true,
      duration: durationFormatted,
      stats: {
        ...stats,
        totalBytes: stats.totalBytes
      },
      changes,
      timestamp: now.toISOString()
    })
  } catch (error) {
    console.error('❌ [BOE] Error en verificación:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

// ============================================
// PROCESAR UNA LEY
// ============================================

async function processLaw(
  law: LawForCheck,
  now: Date,
  stats: CheckStats,
  changes: DetectedChange[]
): Promise<boolean> {
  let currentContentLength: number | null = null

  // ============================================
  // FASE 0: HEAD check con tolerancia de tamaño
  // ============================================
  if (law.boeContentLength && law.lastUpdateBoe) {
    const headResult = await checkWithContentLength(law.boeUrl, law.boeContentLength)
    currentContentLength = headResult.contentLength

    if (headResult.success && headResult.unchanged) {
      // Sin cambios detectados por tamaño
      stats.headUnchanged++
      await updateLawAfterCheck(law.id, {
        lastChecked: now.toISOString()
      })
      return true
    }

    // Si hay cambio de tamaño, registrarlo
    if (headResult.reason === 'size_changed' && headResult.sizeChange) {
      stats.sizeChangeDetected++
      console.log(
        `🔔 [BOE] ${law.shortName}: Cambio de tamaño detectado (${headResult.sizeChange} bytes), verificando fecha...`
      )
    }
  } else if (!law.boeContentLength) {
    // Primera vez sin cache, obtener Content-Length
    const headResult = await checkWithContentLength(law.boeUrl, null)
    currentContentLength = headResult.contentLength
  }

  // ============================================
  // FASE 1: Descarga parcial
  // ============================================
  const partialResult = await checkWithPartialDownload(law.boeUrl, law.dateByteOffset)

  if (partialResult.success && partialResult.lastUpdateBOE) {
    if (partialResult.method === 'cached_offset') {
      stats.cachedOffset++
    } else {
      stats.partial++
    }
    stats.totalBytes += partialResult.bytesDownloaded || 0

    // Detectar cambio de fecha
    const dateChanged = law.lastUpdateBoe && partialResult.lastUpdateBOE !== law.lastUpdateBoe

    if (dateChanged) {
      stats.changesDetected++
      changes.push({
        law: law.shortName,
        name: law.name,
        oldDate: law.lastUpdateBoe,
        newDate: partialResult.lastUpdateBOE
      })
      console.log(
        `⚠️ [BOE] CAMBIO DETECTADO: ${law.shortName} (${law.lastUpdateBoe} → ${partialResult.lastUpdateBOE})`
      )
    }

    // Actualizar en BD
    await updateLawAfterCheck(law.id, {
      lastChecked: now.toISOString(),
      lastUpdateBoe: partialResult.lastUpdateBOE,
      ...(partialResult.dateOffset && partialResult.dateOffset > 0
        ? { dateByteOffset: partialResult.dateOffset }
        : {}),
      ...(currentContentLength && currentContentLength > 0
        ? { boeContentLength: currentContentLength }
        : {}),
      ...(dateChanged
        ? {
            changeStatus: 'changed',
            changeDetectedAt: now.toISOString()
          }
        : {})
    })

    return true
  }

  // ============================================
  // FASE 2: Descarga completa (fallback)
  // ============================================
  const fullResult = await checkWithFullDownload(law.boeUrl)
  stats.totalBytes += fullResult.bytesDownloaded || 0

  if (fullResult.success && fullResult.lastUpdateBOE) {
    stats.fullDownload++

    const dateChanged = law.lastUpdateBoe && fullResult.lastUpdateBOE !== law.lastUpdateBoe

    if (dateChanged) {
      stats.changesDetected++
      changes.push({
        law: law.shortName,
        name: law.name,
        oldDate: law.lastUpdateBoe,
        newDate: fullResult.lastUpdateBOE
      })
      console.log(
        `⚠️ [BOE] CAMBIO DETECTADO: ${law.shortName} (${law.lastUpdateBoe} → ${fullResult.lastUpdateBOE})`
      )
    }

    // Actualizar en BD
    await updateLawAfterCheck(law.id, {
      lastChecked: now.toISOString(),
      lastUpdateBoe: fullResult.lastUpdateBOE,
      ...(fullResult.dateOffset && fullResult.dateOffset > 0
        ? { dateByteOffset: fullResult.dateOffset }
        : {}),
      ...(currentContentLength && currentContentLength > 0
        ? { boeContentLength: currentContentLength }
        : {}),
      ...(dateChanged
        ? {
            changeStatus: 'changed',
            changeDetectedAt: now.toISOString()
          }
        : {})
    })

    return true
  }

  // Error: no se pudo obtener la fecha
  console.warn(`⚠️ [BOE] No se pudo verificar ${law.shortName}: ${fullResult.reason}`)
  return false
}
