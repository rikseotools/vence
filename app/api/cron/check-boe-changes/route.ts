
// app/api/cron/check-boe-changes/route.ts
// Endpoint para verificar cambios en el BOE de leyes monitoreadas
// Migrado a TypeScript con Drizzle y Zod

import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
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

import { withErrorLogging } from '@/lib/api/withErrorLogging'
export const dynamic = 'force-dynamic'

// maxDuration=60s es holgado: con chunking paralelo el cron completa en
// 15-40s incluso en peor caso. Antes era 300s (timeout recurrente por
// procesamiento serial + sleeps + sin timeouts de fetch).
export const maxDuration = 60

// Tamaño de lote para procesamiento paralelo. Cada chunk se ejecuta con
// Promise.allSettled, por lo que una ley fallida no aborta el resto del
// chunk. Benchmark del BOE confirma que soporta esta concurrencia sin
// rate-limiting; el tiempo por chunk queda dominado por el outlier más
// lento del batch, no por la suma. Si algún día el BOE empieza a
// throttlear, bajar a 5.
const CHUNK_SIZE = 10

// ============================================
// GET: Verificar cambios en BOE
// ============================================

async function _GET(request: NextRequest): Promise<NextResponse<CheckBoeChangesResponse>> {
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

    // Procesar en chunks paralelos (antes era serial con sleep 100ms).
    // Con chunk=10 el tiempo total queda dominado por la ley más lenta de
    // cada chunk, no por la suma. Para 337 leyes son ~34 chunks × ~1s
    // peor-caso = ~34 segundos. Muy por debajo del maxDuration=60s.
    for (let i = 0; i < lawsToCheck.length; i += CHUNK_SIZE) {
      const chunk = lawsToCheck.slice(i, i + CHUNK_SIZE)
      const chunkStart = Date.now()
      const results = await Promise.allSettled(
        chunk.map((law) => processLaw(law, now, stats, changes))
      )
      // Contabilizar resultados. Promise.allSettled garantiza que ninguna
      // excepción aborta el chunk; los errores se reflejan en stats.errors.
      for (const r of results) {
        stats.checked++
        if (r.status === 'rejected' || r.value !== true) {
          stats.errors++
        }
      }
      const chunkMs = Date.now() - chunkStart
      // Log sintético por chunk — útil para detectar outliers de BOE en
      // los logs de Vercel sin llenarlos con 337 líneas.
      if (chunkMs > 2000) {
        console.log(`🐢 [BOE] chunk ${i / CHUNK_SIZE + 1} lento: ${chunkMs}ms (${chunk.length} leyes)`)
      }
    }

    const duration = Date.now() - startTime
    const durationFormatted = `${(duration / 1000).toFixed(1)}s`

    console.log(
      `✅ [BOE] Verificación completada: ${stats.checked} leyes, ${stats.changesDetected} cambios, ${durationFormatted}`
    )
    console.log(
      `📊 [BOE] Detalle: ${stats.headUnchanged} sin cambio (HEAD), ${stats.sizeChangeDetected} por cambio de tamaño, ${stats.partial + stats.cachedOffset} parciales, ${stats.fullDownload} completas, ${stats.errors} errores`
    )

    // Enviar email en background via after() — no bloquea la respuesta del
    // cron. Si el endpoint de email tarda 2-5s ya no consume presupuesto
    // del maxDuration del handler.
    if (changes.length > 0) {
      after(async () => {
        try {
          await sendBoeChangeNotification(changes, stats, durationFormatted)
        } catch (e) {
          console.warn('⚠️ [BOE after] Error enviando notificación:', e)
        }
      })
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
  let currentContentLength: number | null | undefined = null

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

export const GET = withErrorLogging('/api/cron/check-boe-changes', _GET)
