// app/api/debug/observability-smoke/route.ts
//
// Endpoint de validación end-to-end del stack de observabilidad IN-HOUSE.
//
// Llamar `GET /api/debug/observability-smoke?secret=<CRON_SECRET>` dispara
// un evento controlado en cada canal:
//
//   1. observable_events directo (vía emit() desde la Vercel function)
//   2. validation_error_logs (vía withErrorLogging que captura el 500 de
//      respuesta con ?mode=throw — espejado a observable_events automáticamente)
//
// Tras llamarlo, verificar en:
//   - psql: SELECT * FROM observable_events WHERE event_type = 'smoke_test'
//                 OR error_message LIKE '%smoke-test-%' ORDER BY ts DESC LIMIT 5;
//
// Auth: requiere CRON_SECRET para evitar abuso.
// (Sentry retirado 05/07/2026 — observabilidad 100% in-house.)

import { NextRequest, NextResponse } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { emit } from '@/lib/observability/emit'

async function _GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  const mode = searchParams.get('mode') ?? 'all'

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  const smokeId = `smoke-test-${Date.now()}`
  const results: Record<string, string> = {}

  // 1. emit directo → observable_events
  if (mode === 'all' || mode === 'emit') {
    try {
      await emit({
        source: 'vercel',
        severity: 'info',
        eventType: 'smoke_test',
        endpoint: '/api/debug/observability-smoke',
        errorMessage: `${smokeId} (canal: emit directo)`,
        metadata: { smokeId, channel: 'emit', timestamp: new Date().toISOString() },
      })
      results.emit = '✅ emitido a observable_events'
    } catch (err) {
      results.emit = `❌ ${err instanceof Error ? err.message : String(err)}`
    }
  }

  // 2. withErrorLogging captura — provocar 500 con throw
  // (solo si mode=throw, porque DEVUELVE 500 al caller)
  if (mode === 'throw') {
    throw new Error(`${smokeId} (canal: withErrorLogging via throw)`)
  }

  return NextResponse.json({
    success: true,
    smokeId,
    results,
    nextSteps: [
      'Verifica observable_events: SELECT * FROM observable_events WHERE error_message LIKE \'%' + smokeId + '%\' ORDER BY ts DESC;',
      'Para validar withErrorLogging + espejo, llama con ?mode=throw (devuelve 500)',
    ],
  })
}

export const GET = withErrorLogging('/api/debug/observability-smoke', _GET)
