// app/api/cron/process-outbox/route.ts
// Worker del patrón outbox (Fase 2 paso 0).
//
// Lee eventos pendientes de la tabla outbox_events y los procesa. Cada evento
// se ejecuta en su propia transacción y de forma idempotente — los handlers
// deben tolerar reintento.
//
// Schedule: una vez añadido a vercel.json y/o .github/workflows, se ejecutará
// cada minuto. El advisory lock dentro de processOutboxBatch evita doble
// procesamiento si dos invocaciones colisionan.
//
// Observabilidad: cada ejecución se registra en tabla cron_runs.
//
// Fase 2 paso 0: el worker está activo pero no hay handlers registrados todavía.
// Llamar al endpoint sin eventos pendientes es seguro y rápido.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { runCronWithLogging } from '@/lib/cron/runWithLogging'
import { getAdminDb } from '@/db/client'
import { processOutboxBatch } from '@/lib/outbox/processBatch'

export const maxDuration = 60

async function _GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`
  if (!process.env.CRON_SECRET || authHeader !== expectedAuth) {
    console.error('❌ [cron/process-outbox] Unauthorized')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Cliente Supabase sólo se usa para cron_runs logging — los datos del
  // outbox los maneja Drizzle (getAdminDb, max:4) directamente. Esto deja
  // el camino al outbox 100% portable (sin supabase-js).
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  try {
    const result = await runCronWithLogging(supabase, 'process-outbox', async () => {
      const db = getAdminDb()
      const batch = await processOutboxBatch(db, 200)

      if (batch.skipped) {
        return { status: 'skipped', metadata: { reason: 'another worker active' } }
      }

      // Si todos los eventos del lote fallaron y hay >0 eventos, lo marcamos
      // error para que el siguiente run reintente con visibilidad. Pero un
      // mix processed/failed se considera success — los failed quedan con
      // attempts++ y serán reintentados.
      if (batch.fetched > 0 && batch.processed === 0) {
        return {
          status: 'error',
          processed: 0,
          errorMessage: `All ${batch.failed} events in batch failed`,
          metadata: { fetched: batch.fetched, failed: batch.failed },
        }
      }

      return {
        status: 'success',
        processed: batch.processed,
        metadata: { fetched: batch.fetched, failed: batch.failed },
      }
    })

    if (result.skipped) {
      console.log(`⏭️  [cron/process-outbox] Skipped (${result.durationMs}ms)`)
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'another worker active',
        durationMs: result.durationMs,
        runId: result.runId,
      })
    }

    if (result.errorMessage) {
      console.error('❌ [cron/process-outbox]', result.errorMessage)
      return NextResponse.json(
        { success: false, error: result.errorMessage, runId: result.runId },
        { status: 500 },
      )
    }

    console.log(
      `✅ [cron/process-outbox] Processed ${result.processed} in ${result.durationMs}ms (run ${result.runId})`,
    )
    return NextResponse.json({
      success: true,
      processed: result.processed,
      durationMs: result.durationMs,
      runId: result.runId,
    })
  } catch (err) {
    console.error('❌ [cron/process-outbox] Exception:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 },
    )
  }
}

export const GET = withErrorLogging('/api/cron/process-outbox', _GET)
