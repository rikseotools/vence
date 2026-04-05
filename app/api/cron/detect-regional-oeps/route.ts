// app/api/cron/detect-regional-oeps/route.ts
// Cron regional_scan: escanea listados de convocatorias de entidades (CCAA/ayuntamientos)
// y detecta OEPs C1/C2 NUEVAS que no están en la tabla oposiciones.
import { NextRequest, NextResponse } from 'next/server'
import { getActiveSources, updateSourceCheckResult } from '@/lib/api/oep-signals/sources'
import { extractRegionalOeps } from '@/lib/api/oep-signals/regional-extractor'
import { fetchPageHtml } from '@/lib/api/oep-signals/llm-extractor'
import { insertSignal, matchDetectedOepToOposicion } from '@/lib/api/oep-signals/queries'
import { baseScoreBySensor, buildDedupeKey } from '@/lib/api/oep-signals/schemas'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'
export const maxDuration = 600 // 10 minutos

interface RegionalScanResponse {
  success: boolean
  duration: string
  stats: {
    totalSources: number
    scanned: number
    extractionOk: number
    novelSignals: number
    existingSignals: number
    errors: number
  }
  novelOeps: Array<{ region: string; name: string; group: string | null; score: number }>
  errors: Array<{ region: string; error: string }>
  timestamp: string
  error?: string
}

async function _GET(request: NextRequest): Promise<NextResponse<RegionalScanResponse>> {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({
      success: false,
      duration: '0s',
      stats: { totalSources: 0, scanned: 0, extractionOk: 0, novelSignals: 0, existingSignals: 0, errors: 0 },
      novelOeps: [],
      errors: [],
      timestamp: new Date().toISOString(),
      error: 'Unauthorized',
    }, { status: 401 })
  }

  const startTime = Date.now()
  try {
    console.log('🌍 [RegionalScan] Iniciando escaneo regional...')
    const sources = await getActiveSources()
    console.log(`📋 [RegionalScan] ${sources.length} fuentes activas`)

    const novelOeps: Array<{ region: string; name: string; group: string | null; score: number }> = []
    const errors: Array<{ region: string; error: string }> = []
    let scanned = 0
    let extractionOk = 0
    let novelSignals = 0
    let existingSignals = 0

    for (const source of sources) {
      const label = `${source.regionName} (${source.sourceType})`
      console.log(`  🔎 ${label}`)
      scanned++

      // Fetch
      const fetchResult = await fetchPageHtml(source.listingUrl, 20000)
      if (!fetchResult.html) {
        console.log(`     ❌ ${fetchResult.error}`)
        errors.push({ region: label, error: fetchResult.error ?? 'fetch failed' })
        await updateSourceCheckResult({ sourceId: source.id, newHash: null, error: fetchResult.error ?? 'fetch failed' })
        continue
      }

      // Extract
      const extraction = await extractRegionalOeps(fetchResult.html, source.regionName)
      if (!extraction) {
        console.log(`     ⚠️ Sin extracción`)
        await updateSourceCheckResult({ sourceId: source.id, newHash: null, error: 'extraction_failed' })
        continue
      }

      extractionOk++
      console.log(`     ✓ ${extraction.oeps.length} OEPs extraídas`)

      // Filter C1/C2 only + match against existing
      const allowedGroups = source.positionGroups ?? ['C1', 'C2']
      for (const oep of extraction.oeps) {
        // Filtrar por grupo si el LLM lo detectó
        if (oep.positionGroup && !allowedGroups.includes(oep.positionGroup)) continue

        // Match contra BD
        const match = await matchDetectedOepToOposicion({
          detectedName: oep.name,
          regionName: source.regionName,
          bocRef: oep.bocRef,
        })

        if (match.matched) {
          // Ya existe — no generar señal (Sensor 1 LLM la vigila)
          existingSignals++
          continue
        }

        // NUEVA OEP detectada
        const score = baseScoreBySensor('regional_scan') + (oep.bocRef ? 15 : 0) + (oep.plazas ? 5 : 0) + (oep.year ? 5 : 0)

        const dedupeKey = buildDedupeKey({
          sensorType: 'regional_scan',
          oposicionId: source.id, // usamos source.id como "pseudo-opo" para dedupe
          year: oep.year,
          bocRef: oep.bocRef ?? oep.name, // fallback nombre si no hay BOC
        })

        const summary = `🆕 ${oep.name} (${oep.positionGroup ?? '?'}) en ${source.regionName}${oep.plazas ? ` · ${oep.plazas} plazas` : ''}${oep.bocRef ? ` · ${oep.bocRef}` : ''}`

        const { inserted } = await insertSignal({
          oposicionId: null,
          sourceId: source.id,
          regionName: source.regionName,
          positionCategory: oep.positionGroup,
          detectedOposicionName: oep.name,
          sensorType: 'regional_scan',
          sourceUrl: oep.url ?? source.listingUrl,
          detectedYear: oep.year,
          detectedPlazasLibre: oep.plazas,
          detectedBocRef: oep.bocRef,
          detectedFechaInscripcionFin: oep.fechaInscripcionFin,
          detectedEstado: oep.estado,
          confidenceScore: Math.min(100, score),
          isNovel: true,
          signalSummary: summary,
          rawExtraction: { oep, sourceRegion: source.regionName } as Record<string, unknown>,
          dedupeKey,
        })

        if (inserted) {
          novelSignals++
          console.log(`     🆕 NUEVA OEP: ${oep.name}`)
          novelOeps.push({ region: source.regionName, name: oep.name, group: oep.positionGroup, score: Math.min(100, score) })
        }
      }

      await updateSourceCheckResult({ sourceId: source.id, newHash: null, error: null })

      // Pausa entre sources
      await new Promise(resolve => setTimeout(resolve, 1500))
    }

    const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`
    const stats = { totalSources: sources.length, scanned, extractionOk, novelSignals, existingSignals, errors: errors.length }
    console.log(`📊 [RegionalScan] Completado en ${duration}:`, stats)

    return NextResponse.json({
      success: true,
      duration,
      stats,
      novelOeps,
      errors,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`
    console.error('❌ [RegionalScan] Error:', error)
    return NextResponse.json({
      success: false,
      duration,
      stats: { totalSources: 0, scanned: 0, extractionOk: 0, novelSignals: 0, existingSignals: 0, errors: 0 },
      novelOeps: [],
      errors: [],
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Error interno',
    }, { status: 500 })
  }
}

export const GET = withErrorLogging('/api/cron/detect-regional-oeps', _GET)
