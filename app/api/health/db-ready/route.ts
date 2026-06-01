// app/api/health/db-ready/route.ts
// Readiness probe específico para ECS / ALB target group.
//
// Diferencia con /api/health:
//   - /api/health         → siempre 200, JSON con detalle por componente
//                           (diseñado para diagnóstico humano + visualización).
//   - /api/health/db-ready → 200 si BD responde a SELECT 1 en <2s,
//                           503 si no. Diseñado para readiness probe del
//                           container ECS y del target group del ALB.
//
// MOTIVACIÓN — Hipótesis D confirmada el 01/06/2026:
//   Container Fargate nuevo arranca con pool `postgres-js` vacío. El ALB
//   con HealthCheckPath="/" lo marca healthy en cuanto Next.js responde
//   (~5s), pero el pool a BD aún no tiene conexión establecida. Llegan
//   requests reales y se atascan en `connect_timeout: 5s` hasta el
//   `withDbTimeout: 8s` → 503 cascada durante ~4 min.
//
//   Este endpoint cierra esa ventana: el ALB SOLO marca al container
//   healthy cuando este endpoint devuelve 200 — y este endpoint solo
//   devuelve 200 cuando el pool ha establecido conexión y respondido a
//   SELECT 1. Mientras tanto, 503 → ALB no envía tráfico.
//
// CONTRATO:
//   - 200 OK + JSON {ok: true, latencyMs, pool} → container LISTO para tráfico
//   - 503 + JSON {ok: false, reason, latencyMs}    → container NO listo
//   - El ALB con HealthyThresholdCount=2 y HealthCheckInterval=30s
//     requiere 2×OK seguidos → el container recibe tráfico al menos
//     60s después de pasar este check. Margen extra contra falsos OK.

import { NextResponse } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 5

// Timeout estricto: si la BD no responde en 2s, ALB nos marca unhealthy
// (esperado durante warmup del pool). No subir esto sin justificación —
// el objetivo es DETECTAR cold start, no tolerarlo.
const READINESS_TIMEOUT_MS = 2000

async function _GET() {
  const t0 = Date.now()

  try {
    // Import dinámico para no bloquear cold-start del módulo si la BD está fría.
    const { getDb } = await import('@/db/client')
    const { sql } = await import('drizzle-orm')

    await Promise.race([
      getDb().execute(sql`SELECT 1`),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`SELECT 1 timeout after ${READINESS_TIMEOUT_MS}ms`)),
          READINESS_TIMEOUT_MS,
        ),
      ),
    ])

    const latencyMs = Date.now() - t0
    return NextResponse.json(
      {
        ok: true,
        latencyMs,
        pool: process.env.USE_SELF_HOSTED_POOLER === 'true' ? 'self_hosted' : 'supavisor',
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      },
    )
  } catch (err) {
    const latencyMs = Date.now() - t0
    const reason = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      {
        ok: false,
        latencyMs,
        reason: reason.slice(0, 200),
        pool: process.env.USE_SELF_HOSTED_POOLER === 'true' ? 'self_hosted' : 'supavisor',
        timestamp: new Date().toISOString(),
      },
      {
        // 503 explícito → ALB target group lo marca unhealthy → no recibe tráfico
        status: 503,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Retry-After': '5',
        },
      },
    )
  }
}

// expectedStatuses: [503] — el 503 de este probe es comportamiento por
// CONTRATO (warmup del pool en container Fargate frío), no un fallo. Sin
// esto, cada deploy/reinicio de container inflaba el indicador "Errores
// 5xx" del panel de salud con ~30-50 falsos positivos, todos provenientes
// de ELB-HealthChecker/2.0 y Wget (nunca usuarios reales) y durando exacto
// el READINESS_TIMEOUT_MS. Diagnóstico documentado el 2026-06-01.
export const GET = withErrorLogging(
  '/api/health/db-ready',
  _GET as unknown as () => Promise<Response>,
  { expectedStatuses: [503] },
)
