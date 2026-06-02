// app/api/cron/check-stats-drift/route.ts
// Cron diario: detecta divergencias silenciosas entre los contadores
// materializados (user_stats_summary, user_question_history_v2, y las
// 4 tablas nuevas del fix de /api/stats cuando lleguen) y el fresh scan
// equivalente sobre test_questions.
//
// Sin esto, un bug en cualquier trigger de materialización corrompe los
// contadores en silencio: el endpoint /api/stats responde 200 con
// números incorrectos durante días o semanas hasta que un usuario lo
// nota. Sentry NO lo ve (no es excepción).
//
// Flujo:
//   1) GHA llama este endpoint cada noche 4 AM UTC con Bearer CRON_SECRET.
//   2) Endpoint llama a check_stats_drift(50) (función SQL append-only).
//   3) Si drifts_found > 0 con drift_pct > 5%, captura warning a Sentry
//      con tag check=stats_drift.
//   4) El admin panel /admin/infraestructura → tab "Salud sistema"
//      muestra el resumen para que un humano lo mire en 30s.
//
// Runbook: docs/runbooks/health-check.md

import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
// 60s holgado: 50 users × ~200ms/user = ~10s real. Margen amplio.
export const maxDuration = 60

// AUDIT 2026-05-26: la RPC check_stats_drift escala superlineal
// (sample=10: 1.4s; sample=20: 6s; sample=50: timeout >8s). Bajado de 50
// a 20 mientras se optimiza la RPC (N+1 queries probables — ver postmortem #113).
// Con sample=20 cabe en el statement_timeout y el cron vuelve a verde.
// Cuando la RPC esté optimizada, revertir a 50 o subir más.
const DEFAULT_SAMPLE_SIZE = 20
const ALERT_DRIFT_PCT_THRESHOLD = 5

interface CheckStatsDriftResponse {
  success: boolean
  duration: string
  stats: {
    sample_size: number
    checked: number
    drifts_found: number
    errors: number
    significant_drifts: number  // drift_pct > 5
    duration_ms: number
  }
  // Top divergencias para el log de GHA (no full dump)
  top_drifts: Array<{
    target_table: string
    field_name: string
    drift_pct: number | null
    sample_count: number
  }>
  timestamp: string
  error?: string
}

async function _GET(request: NextRequest): Promise<NextResponse<CheckStatsDriftResponse>> {
  // Auth: solo GHA con CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized',
        duration: '0s',
        stats: { sample_size: 0, checked: 0, drifts_found: 0, errors: 0, significant_drifts: 0, duration_ms: 0 },
        top_drifts: [],
        timestamp: new Date().toISOString(),
      },
      { status: 401 },
    )
  }

  const startTime = Date.now()
  const sampleSize = Number(new URL(request.url).searchParams.get('sample') ?? DEFAULT_SAMPLE_SIZE)

  // getAdminDb() = Drizzle/DATABASE_URL (bypass RLS, equivalente al
  // service_role). La función SQL es SECURITY DEFINER; anon no tiene EXECUTE.
  const db = getAdminDb()

  try {
    console.log(`🔍 [DriftCheck] Iniciando con sample_size=${sampleSize}`)

    // Llamada principal a la función SQL (RETURNS TABLE → array de filas).
    // Un error de la RPC lanza → lo captura el catch externo (500 + Sentry),
    // igual que el `throw` anterior.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpcResult = (await db.execute(sql`SELECT * FROM check_stats_drift(${sampleSize})`)) as any[]
    const summary = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult
    const checked = Number(summary?.checked ?? 0)
    const driftsFound = Number(summary?.drifts_found ?? 0)
    const errors = Number(summary?.errors ?? 0)
    const durationMs = Number(summary?.duration_ms ?? 0)

    // Recoger las divergencias significativas (drift_pct > umbral) que
    // se acaban de escribir, para alertar a Sentry y devolver en payload.
    // stats_drift_log no está tipada en Drizzle → raw SQL. La lectura es
    // NO-fatal (try/catch local): si falla, el cron sigue siendo success.
    const cutoffTime = new Date(startTime).toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let significant: any[] = []
    try {
      significant = (await db.execute(sql`
        SELECT target_table, field_name, drift_pct
        FROM stats_drift_log
        WHERE checked_at >= ${cutoffTime}
          AND drift_pct > ${ALERT_DRIFT_PCT_THRESHOLD}
        ORDER BY drift_pct DESC
        LIMIT 100
      `)) as any[]
    } catch (selError) {
      console.warn('[DriftCheck] No se pudo leer stats_drift_log:', (selError as Error).message)
    }

    const significantDrifts = significant?.length ?? 0

    // Agregar por (target_table, field_name) para el resumen
    const grouped = new Map<string, { table: string; field: string; max_pct: number; count: number }>()
    for (const d of significant ?? []) {
      const key = `${d.target_table}::${d.field_name}`
      const existing = grouped.get(key)
      const pct = Number(d.drift_pct ?? 0)
      if (existing) {
        existing.count++
        if (pct > existing.max_pct) existing.max_pct = pct
      } else {
        grouped.set(key, { table: d.target_table, field: d.field_name, max_pct: pct, count: 1 })
      }
    }
    const topDrifts = Array.from(grouped.values())
      .sort((a, b) => b.max_pct - a.max_pct)
      .slice(0, 10)
      .map(g => ({
        target_table: g.table,
        field_name: g.field,
        drift_pct: g.max_pct,
        sample_count: g.count,
      }))

    // Sentry warning si hay divergencias significativas. NO falla el
    // endpoint — el cron sigue siendo "successful" porque DETECTAR drift
    // es justamente su trabajo. La señal va a Sentry para que un humano
    // mire el panel admin.
    if (significantDrifts > 0) {
      Sentry.captureMessage(
        `Stats drift detected: ${significantDrifts} significant divergences (>${ALERT_DRIFT_PCT_THRESHOLD}%)`,
        {
          level: 'warning',
          tags: {
            check: 'stats_drift',
            severity: significantDrifts > 10 ? 'high' : 'medium',
          },
          extra: {
            sample_size: sampleSize,
            checked,
            drifts_found: driftsFound,
            significant_drifts: significantDrifts,
            top_drifts: topDrifts,
          },
        },
      )
      console.warn(`⚠️ [DriftCheck] ${significantDrifts} divergencias >${ALERT_DRIFT_PCT_THRESHOLD}% — reported to Sentry`)
    } else {
      console.log(`✅ [DriftCheck] OK — ${checked} users checked, ${driftsFound} minor drifts, 0 significant`)
    }

    return NextResponse.json({
      success: true,
      duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
      stats: {
        sample_size: sampleSize,
        checked,
        drifts_found: driftsFound,
        errors,
        significant_drifts: significantDrifts,
        duration_ms: durationMs,
      },
      top_drifts: topDrifts,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ [DriftCheck] Error:', errorMsg)

    // Sentry SÍ captura excepciones del propio cron — un fallo del check
    // es un problema distinto del drift detectado
    Sentry.captureException(error, {
      level: 'error',
      tags: { check: 'stats_drift', component: 'cron_endpoint' },
    })

    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
        stats: { sample_size: sampleSize, checked: 0, drifts_found: 0, errors: 0, significant_drifts: 0, duration_ms: 0 },
        top_drifts: [],
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

export const GET = withErrorLogging('/api/cron/check-stats-drift', _GET)
