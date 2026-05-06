// app/api/admin/health/db-latency/route.ts
// Probe focalizado de latencia Vercel→Supabase round-trip.
//
// Diferente de /api/admin/health (que es dump completo de incidentes):
// este endpoint SOLO mide latencia de query DB. Pensado para repetir
// (curl en bucle) y comparar pre/post cambios de region o pool config.
//
// Uso:
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//     'https://www.vence.es/api/admin/health/db-latency?samples=10'
//
// Devuelve:
//   - coldStartMs: primera query (incluye establecimiento de conexión si frío)
//   - p50/p95/min/max: estadísticos de las samples-1 queries restantes (warm)
//   - region: VERCEL_REGION para confirmar que el cambio de vercel.json llegó
//   - poolerHost: parsea DATABASE_URL para verificar que apuntamos al pooler
//     correcto (eu-west-2)
//
// Auth: Bearer CRON_SECRET (mismo patrón que /api/admin/health).
// Pool: usa getAdminDb (max:4, separado del hot path) para no competir con
// user traffic durante la medición.

import { NextResponse, type NextRequest } from 'next/server'
import { sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const runtime = 'nodejs'
export const maxDuration = 15
export const dynamic = 'force-dynamic'

const DEFAULT_SAMPLES = 10
const MAX_SAMPLES = 50

function quantile(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0
  const idx = Math.floor(q * (sortedAsc.length - 1))
  return sortedAsc[idx]
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

function extractPoolerHost(): string | null {
  // DATABASE_URL es de la forma postgresql://user:pass@host:port/db?...
  const url = process.env.DATABASE_URL
  if (!url) return null
  try {
    const parsed = new URL(url)
    return `${parsed.hostname}:${parsed.port || '5432'}`
  } catch {
    return null
  }
}

async function _GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Parsear ?samples=N (default 10, max 50)
  const { searchParams } = new URL(request.url)
  const samplesParam = searchParams.get('samples')
  const samples = Math.min(
    Math.max(parseInt(samplesParam || String(DEFAULT_SAMPLES), 10) || DEFAULT_SAMPLES, 2),
    MAX_SAMPLES,
  )

  const db = getAdminDb()
  const timings: number[] = []

  // Ejecutar N SELECT 1 secuenciales sobre la misma conexión
  // (postgres-js reutiliza la conexión warm tras la primera).
  for (let i = 0; i < samples; i++) {
    const t0 = performance.now()
    try {
      await db.execute(sql`SELECT 1`)
      timings.push(performance.now() - t0)
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Query failed',
          completedSamples: timings.length,
          partialTimings: timings.map(round),
        },
        { status: 500 },
      )
    }
  }

  const coldStartMs = timings[0]
  const warm = timings.slice(1).sort((a, b) => a - b)

  return NextResponse.json({
    success: true,
    samples,
    coldStartMs: round(coldStartMs),
    warm: {
      p50Ms: round(quantile(warm, 0.5)),
      p95Ms: round(quantile(warm, 0.95)),
      minMs: round(warm[0] ?? 0),
      maxMs: round(warm[warm.length - 1] ?? 0),
      allMs: warm.map(round),
    },
    region: process.env.VERCEL_REGION || 'unknown',
    poolerHost: extractPoolerHost(),
    timestamp: new Date().toISOString(),
  })
}

export const GET = withErrorLogging('/api/admin/health/db-latency', _GET)
