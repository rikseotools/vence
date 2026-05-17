// app/api/cron/refresh-rankings/route.ts
//
// Refresca la tabla `ranking_cache` para los 4 timeFilters (today, yesterday,
// week, month). Llamado por workflow GHA cada 5 min. Sustituye el GROUP BY
// pesado del hot path /api/ranking (9-12s → <100ms tras este cambio).
//
// Si el cron falla, los datos anteriores siguen disponibles (transacción
// por timeFilter dentro de la función SQL). El endpoint /api/ranking sigue
// sirviendo el ranking previo hasta el siguiente run exitoso.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { runCronWithLogging } from '@/lib/cron/runWithLogging'
import { getAdminDb } from '@/db/client'
import { sql } from 'drizzle-orm'

// maxDuration alto porque month puede tardar 15-20s con dataset actual.
// A 100k DAU podría subir; conviene observar y particionar si llegara a
// rozar el límite Vercel maxDuration (300s para Pro).
export const maxDuration = 60

async function _GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`
  if (!process.env.CRON_SECRET || authHeader !== expectedAuth) {
    console.error('❌ [cron/refresh-rankings] Unauthorized')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Supabase client solo para cron_runs logging (otros crons del proyecto).
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  try {
    const result = await runCronWithLogging(supabase, 'refresh-rankings', async () => {
      const db = getAdminDb()
      if (!db) throw new Error('getAdminDb returned null')

      // Subir statement_timeout para este request — la función agrega ~1M
      // filas para month, que tarda 15-20s. Default DSN es 30s, suficiente.
      const result = await db.execute(
        sql`SELECT * FROM refresh_ranking_cache()`,
      )

      const rows = result as unknown as Array<{
        filter_name: string
        rows_inserted: number
        duration_ms: number
      }>

      const total = rows.reduce((acc, r) => acc + r.rows_inserted, 0)
      const slowest = Math.max(...rows.map(r => r.duration_ms))

      return {
        status: 'success',
        processed: total,
        metadata: {
          filters: rows.map(r => ({
            filter: r.filter_name,
            inserted: r.rows_inserted,
            ms: r.duration_ms,
          })),
          slowest_ms: slowest,
        },
      }
    })

    if (result.errorMessage) {
      console.error('❌ [cron/refresh-rankings]', result.errorMessage)
      return NextResponse.json(
        { success: false, error: result.errorMessage, runId: result.runId },
        { status: 500 },
      )
    }

    console.log(`✅ [cron/refresh-rankings] ${result.processed} rows, ${result.durationMs}ms (run ${result.runId})`)
    return NextResponse.json({
      success: true,
      processed: result.processed,
      durationMs: result.durationMs,
      runId: result.runId,
    })
  } catch (err) {
    console.error('❌ [cron/refresh-rankings] Exception:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 },
    )
  }
}

export const GET = withErrorLogging('/api/cron/refresh-rankings', _GET)
