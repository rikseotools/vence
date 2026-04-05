// app/api/cron/detect-oep-llm/route.ts
// Cron Sensor 1: LLM semántico sobre páginas oficiales de seguimiento
// Extrae entidades OEP con Claude Haiku, compara con estado conocido, genera señales.
import { NextRequest, NextResponse } from 'next/server'
import { getOposicionesForLlmScan, insertSignal, type OposicionToScan } from '@/lib/api/oep-signals/queries'
import { extractOepFromHtml, fetchPageHtml } from '@/lib/api/oep-signals/llm-extractor'
import { baseScoreBySensor, buildDedupeKey, type LlmExtraction } from '@/lib/api/oep-signals/schemas'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutos

interface DetectOepLlmResponse {
  success: boolean
  duration: string
  stats: {
    total: number
    scanned: number
    withExtraction: number
    signals: number
    errors: number
  }
  signals: Array<{ oposicion: string; summary: string; score: number; isNovel: boolean }>
  errors: Array<{ oposicion: string; error: string }>
  timestamp: string
  error?: string
}

function buildKnownContext(opo: OposicionToScan): string {
  const parts: string[] = []
  parts.push(`Nombre: ${opo.nombre}`)
  if (opo.convocatoriaNumero) parts.push(`Convocatoria actual BD: ${opo.convocatoriaNumero}`)
  if (opo.oepFecha) parts.push(`OEP fecha BD: ${opo.oepFecha}`)
  if (opo.plazasLibres !== null) parts.push(`Plazas libres BD: ${opo.plazasLibres}`)
  if (opo.plazasDiscapacidad !== null) parts.push(`Plazas discap BD: ${opo.plazasDiscapacidad}`)
  if (opo.estadoProceso) parts.push(`Estado BD: ${opo.estadoProceso}`)
  return parts.join(' | ')
}

/**
 * Determina si la extracción supone una NOVEDAD respecto al estado BD.
 * Es novel si:
 * - Año extraído > año OEP BD
 * - BOC ref distinto y nuevo
 * - Plazas distintas (posible convocatoria nueva)
 */
function computeNovelty(extraction: LlmExtraction, opo: OposicionToScan): { isNovel: boolean; reasons: string[] } {
  const reasons: string[] = []

  if (extraction.year) {
    const currentYear = opo.oepFecha ? new Date(opo.oepFecha).getFullYear() : null
    if (currentYear && extraction.year > currentYear) {
      reasons.push(`año ${extraction.year} > BD ${currentYear}`)
    }
  }
  if (extraction.bocRef && opo.convocatoriaNumero && extraction.bocRef !== opo.convocatoriaNumero) {
    reasons.push(`BOC ref ${extraction.bocRef} ≠ BD ${opo.convocatoriaNumero}`)
  }
  if (extraction.bocRef && !opo.convocatoriaNumero) {
    reasons.push(`BOC ref detectado: ${extraction.bocRef} (BD sin convocatoria)`)
  }
  if (extraction.plazasLibre !== null && opo.plazasLibres !== null && extraction.plazasLibre !== opo.plazasLibres) {
    reasons.push(`plazas ${extraction.plazasLibre} ≠ BD ${opo.plazasLibres}`)
  }

  return { isNovel: reasons.length > 0, reasons }
}

/**
 * Ajusta el score según múltiples evidencias encontradas.
 */
function adjustScore(base: number, extraction: LlmExtraction, noveltyReasons: string[]): number {
  let score = base
  if (extraction.bocRef) score += 15 // referencia BOC oficial es fuerte
  if (extraction.year) score += 5
  if (extraction.plazasLibre !== null) score += 5
  if (extraction.fechaInscripcionFin) score += 5
  if (noveltyReasons.length >= 2) score += 10 // múltiples evidencias de cambio
  return Math.min(100, score)
}

async function _GET(request: NextRequest): Promise<NextResponse<DetectOepLlmResponse>> {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({
      success: false,
      duration: '0s',
      stats: { total: 0, scanned: 0, withExtraction: 0, signals: 0, errors: 0 },
      signals: [],
      errors: [],
      timestamp: new Date().toISOString(),
      error: 'Unauthorized',
    }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    console.log('🔍 [OepLlm] Iniciando escaneo semántico...')
    const oposiciones = await getOposicionesForLlmScan()
    console.log(`📋 [OepLlm] ${oposiciones.length} oposiciones con seguimiento_url`)

    const signalsCreated: Array<{ oposicion: string; summary: string; score: number; isNovel: boolean }> = []
    const errors: Array<{ oposicion: string; error: string }> = []
    let scanned = 0
    let withExtraction = 0

    for (const opo of oposiciones) {
      const label = opo.shortName ?? opo.nombre
      console.log(`  🔎 ${label}`)
      scanned++

      // 1. Fetch HTML
      const fetchResult = await fetchPageHtml(opo.seguimientoUrl)
      if (!fetchResult.html) {
        console.log(`     ❌ Fetch error: ${fetchResult.error}`)
        errors.push({ oposicion: label, error: fetchResult.error ?? 'fetch failed' })
        continue
      }

      // 2. LLM extract
      const knownContext = buildKnownContext(opo)
      const extraction = await extractOepFromHtml(fetchResult.html, knownContext)
      if (!extraction) {
        console.log(`     ⚠️ Sin extracción válida`)
        continue
      }

      if (!extraction.hasOepInfo) {
        console.log(`     ℹ️ Sin OEP clara en página`)
        continue
      }

      withExtraction++

      // 3. Compare con estado BD
      const { isNovel, reasons } = computeNovelty(extraction, opo)
      if (!isNovel) {
        console.log(`     ✓ Coincide con BD, sin señal`)
        continue
      }

      // 4. Score + insert
      const baseScore = baseScoreBySensor('llm_semantic')
      const score = adjustScore(baseScore, extraction, reasons)

      const dedupeKey = buildDedupeKey({
        sensorType: 'llm_semantic',
        oposicionId: opo.id,
        year: extraction.year,
        bocRef: extraction.bocRef,
      })

      const summary = `${extraction.summary} · Diff: ${reasons.join('; ')}`

      const { inserted } = await insertSignal({
        oposicionId: opo.id,
        sensorType: 'llm_semantic',
        sourceUrl: opo.seguimientoUrl,
        detectedYear: extraction.year,
        detectedPlazasLibre: extraction.plazasLibre,
        detectedPlazasDiscapacidad: extraction.plazasDiscapacidad,
        detectedPlazasPromocionInterna: extraction.plazasPromocionInterna,
        detectedBocRef: extraction.bocRef,
        detectedFechaPublicacion: extraction.fechaPublicacion,
        detectedFechaInscripcionFin: extraction.fechaInscripcionFin,
        detectedFechaExamen: extraction.fechaExamen,
        detectedEstado: extraction.estado,
        confidenceScore: score,
        isNovel,
        signalSummary: summary,
        rawExtraction: { extraction, noveltyReasons: reasons, knownContext } as Record<string, unknown>,
        dedupeKey,
      })

      if (inserted) {
        console.log(`     🚨 SEÑAL score=${score} novel=${isNovel}: ${extraction.summary}`)
        signalsCreated.push({ oposicion: label, summary: extraction.summary, score, isNovel })
      } else {
        console.log(`     ⏭️ Señal duplicada (ya existe pending)`)
      }

      // Pausa entre oposiciones para no saturar el LLM ni fetch
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`
    const stats = {
      total: oposiciones.length,
      scanned,
      withExtraction,
      signals: signalsCreated.length,
      errors: errors.length,
    }
    console.log(`📊 [OepLlm] Completado en ${duration}:`, stats)

    return NextResponse.json({
      success: true,
      duration,
      stats,
      signals: signalsCreated,
      errors,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`
    console.error('❌ [OepLlm] Error:', error)
    return NextResponse.json({
      success: false,
      duration,
      stats: { total: 0, scanned: 0, withExtraction: 0, signals: 0, errors: 0 },
      signals: [],
      errors: [],
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Error interno',
    }, { status: 500 })
  }
}

export const GET = withErrorLogging('/api/cron/detect-oep-llm', _GET)
