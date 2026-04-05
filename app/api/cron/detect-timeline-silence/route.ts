// app/api/cron/detect-timeline-silence/route.ts
// Cron Sensor 3: detector de silencio en timeline
// Si un hito 'current' tiene fecha pasada (+3 días) sin avance → señal crítica.
import { NextRequest, NextResponse } from 'next/server'
import { findTimelineSilences, insertSignal } from '@/lib/api/oep-signals/queries'
import { baseScoreBySensor, buildDedupeKey } from '@/lib/api/oep-signals/schemas'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface TimelineSilenceResponse {
  success: boolean
  duration: string
  stats: { candidates: number; signals: number }
  signals: Array<{ oposicion: string; hito: string; diasRetraso: number; score: number }>
  timestamp: string
  error?: string
}

async function _GET(request: NextRequest): Promise<NextResponse<TimelineSilenceResponse>> {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({
      success: false,
      duration: '0s',
      stats: { candidates: 0, signals: 0 },
      signals: [],
      timestamp: new Date().toISOString(),
      error: 'Unauthorized',
    }, { status: 401 })
  }

  const startTime = Date.now()
  const GRACE_DAYS = 3

  try {
    console.log('🔍 [TimelineSilence] Buscando hitos retrasados...')
    const candidates = await findTimelineSilences(GRACE_DAYS)
    console.log(`📋 [TimelineSilence] ${candidates.length} candidatos`)

    const signalsCreated: Array<{ oposicion: string; hito: string; diasRetraso: number; score: number }> = []

    for (const c of candidates) {
      const baseScore = baseScoreBySensor('timeline_silence')
      // Más retraso = más urgente (max +30)
      const urgencyBonus = Math.min(30, c.diasRetraso * 2)
      const score = Math.min(100, baseScore + urgencyBonus)

      const year = new Date(c.hitoFecha).getFullYear()
      const dedupeKey = buildDedupeKey({
        sensorType: 'timeline_silence',
        oposicionId: c.oposicionId,
        year,
        bocRef: c.hitoId, // único por hito
      })

      const summary = `Hito "${c.hitoTitulo}" esperado ${c.hitoFecha} (+${c.diasRetraso} días retraso). Revisar página oficial.`

      const { inserted } = await insertSignal({
        oposicionId: c.oposicionId,
        sensorType: 'timeline_silence',
        sourceUrl: null,
        detectedYear: year,
        confidenceScore: score,
        isNovel: false, // no es OEP nueva, es ausencia de evento
        signalSummary: summary,
        rawExtraction: {
          hitoId: c.hitoId,
          hitoTitulo: c.hitoTitulo,
          hitoFecha: c.hitoFecha,
          diasRetraso: c.diasRetraso,
        } as Record<string, unknown>,
        dedupeKey,
      })

      if (inserted) {
        console.log(`  🚨 ${c.oposicionNombre}: hito "${c.hitoTitulo}" +${c.diasRetraso}d retraso (score=${score})`)
        signalsCreated.push({
          oposicion: c.oposicionNombre,
          hito: c.hitoTitulo,
          diasRetraso: c.diasRetraso,
          score,
        })
      }
    }

    const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`
    const stats = { candidates: candidates.length, signals: signalsCreated.length }
    console.log(`📊 [TimelineSilence] Completado en ${duration}:`, stats)

    return NextResponse.json({
      success: true,
      duration,
      stats,
      signals: signalsCreated,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`
    console.error('❌ [TimelineSilence] Error:', error)
    return NextResponse.json({
      success: false,
      duration,
      stats: { candidates: 0, signals: 0 },
      signals: [],
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Error interno',
    }, { status: 500 })
  }
}

export const GET = withErrorLogging('/api/cron/detect-timeline-silence', _GET)
