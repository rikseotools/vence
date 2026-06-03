// app/api/cron/conversion-outbox/route.ts
//
// Cron del outbox de conversiones (F1 trackeo-conversiones-ventas). Drena los
// eventos pendientes y los entrega a cada destino (Google Ads…). Emite un tick
// a observable_events para monitorización.
//
// Flags de seguridad (arranque conservador):
//   ADS_CONVERSION_UPLOAD_ENABLED=true  → habilita el envío real.
//   ADS_CONVERSION_DRYRUN=true          → fuerza validate-only aunque esté enabled.
// Por defecto (ambos sin setear): dryRun=true → valida contra Ads sin escribir,
// las filas quedan pending hasta que se active el envío real.

import { NextRequest, NextResponse } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { drainConversionOutbox } from '@/lib/conversions/worker'
import { emit } from '@/lib/observability/emit'

export const maxDuration = 60

async function _GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const enabled = process.env.ADS_CONVERSION_UPLOAD_ENABLED === 'true'
  const dryRun = !enabled || process.env.ADS_CONVERSION_DRYRUN === 'true'

  const summary = await drainConversionOutbox({ dryRun })

  await emit({
    source: 'vercel',
    severity: summary.dlq > 0 ? 'warn' : 'info',
    eventType: 'conversion_outbox_tick',
    endpoint: '/api/cron/conversion-outbox',
    metadata: { ...summary, enabled },
  })

  return NextResponse.json({ success: true, ...summary, timestamp: new Date().toISOString() })
}

export const GET = withErrorLogging('/api/cron/conversion-outbox', _GET)
