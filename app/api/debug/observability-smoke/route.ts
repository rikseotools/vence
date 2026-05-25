// app/api/debug/observability-smoke/route.ts
//
// Endpoint de validación end-to-end del stack de observabilidad.
//
// Llamar `GET /api/debug/observability-smoke?secret=<CRON_SECRET>` dispara
// un evento controlado en cada uno de los 3 canales:
//
//   1. observable_events directo (vía emit interna desde Vercel function)
//   2. Sentry server-side (Sentry.captureException — el server config tiene
//      el SDK; verá el evento en Sentry dashboard)
//   3. validation_error_logs (vía withErrorLogging que captura el 500 de
//      respuesta — espejado a observable_events automáticamente)
//
// Tras llamarlo, verificar en:
//   - psql: SELECT * FROM observable_events WHERE event_type = 'smoke_test'
//                 OR error_message LIKE '%smoke-test-%' ORDER BY ts DESC LIMIT 5;
//   - Sentry dashboard: filtrar por tag environment + buscar "smoke-test"
//
// Auth: requiere CRON_SECRET para evitar abuso (cada llamada genera 3
// eventos de tipo "error" — útil testing, malo para spam).
//
// Bloque 4 Gap 7 del manual de observabilidad (§3).

import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
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

  // 2. Sentry.captureException → dashboard Sentry
  if (mode === 'all' || mode === 'sentry') {
    try {
      Sentry.captureException(new Error(`${smokeId} (canal: sentry server)`), {
        tags: { smoke: 'true', smokeId },
      })
      results.sentry = '✅ enviado a Sentry (verificar en dashboard)'
    } catch (err) {
      results.sentry = `❌ ${err instanceof Error ? err.message : String(err)}`
    }
  }

  // 3. withErrorLogging captura — provocar 500 con throw
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
      'Verifica Sentry dashboard: busca "' + smokeId + '" (tag smoke=true)',
      'Para validar withErrorLogging + espejo, llama con ?mode=throw (devuelve 500)',
    ],
  })
}

export const GET = withErrorLogging('/api/debug/observability-smoke', _GET)
